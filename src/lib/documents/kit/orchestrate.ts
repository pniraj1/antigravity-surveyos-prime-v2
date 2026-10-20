/**
 * The pure-ish glue behind useDocumentKit: label a claim's pages after a scan, check them against the
 * claim, and turn the surveyor's label actions into claim patches. File access is passed in, so it is testable.
 *
 * Page texts can hold Aadhaar/PAN numbers: they are returned to the caller for in-memory identity checks
 * and are never put on the claim.
 */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType, PageLabel, UploadSet } from '@/types/documents';
import { addDocuments, claimDocuments, onThisDevice } from '../index-ops';
import type { BoxState } from './checklist';
import { identityCheck } from './identity';
import type { IdentityResult } from './identity';
import { pageCountOf, pageTexts } from './page-text';
import { labelEntry } from './recognise';
import { invalidate } from './review';

type ClaimPatch = Pick<ClaimData, 'documents'> & { uploadSet?: UploadSet };

/** PDFs and images carry pages we can label; Word/Excel and the print-time HTML are whole files. */
const labelable = (d: ClaimDocument): boolean => /\.(pdf|jpe?g|png)$/i.test(d.relPath) && d.mime !== 'text/html';
const isPdf = (d: ClaimDocument): boolean => /\.pdf$/i.test(d.relPath) || d.mime === 'application/pdf';

/** Every page 1..pageCount has a label (so there is nothing left to guess). */
function fullyLabelled(d: ClaimDocument): boolean {
  const n = d.pageCount ?? 0;
  return n > 0 && Array.from({ length: n }, (_, i) => i + 1).every((p) => d.pages?.[p]);
}

/**
 * Label the pages of every file on this device. Reads a file once for its page count and text layer.
 *
 * `cached` (optional): the page texts this session already holds for a file (null/undefined = none).
 * With it, a cached file is never read again: if it still has unlabelled pages it is labelled from the cached
 * text. A file that is not cached is read even when fully labelled, because identity checks need its text.
 * Without it, fully labelled files are skipped. A failed read (cloud placeholder, lock) skips that file only.
 *
 * Returns the same `claim` object when nothing changed (no dirty claim, no cloud write); `texts` holds only
 * the files read now.
 */
export async function labelClaim(
  claim: ClaimData,
  read: (doc: ClaimDocument) => Promise<Blob>,
  device: string,
  cached?: (doc: ClaimDocument) => (string | null)[] | undefined,
): Promise<{ claim: ClaimData; texts: Record<string, (string | null)[]> }> {
  const texts: Record<string, (string | null)[]> = {};
  const changed: ClaimDocument[] = [];

  for (const d of claimDocuments(claim)) {
    if (!onThisDevice(d, device) || !labelable(d)) continue;
    const held = cached?.(d);
    if (held) {
      // All-null = the file has no text layer; labelEntry wants null for that.
      const labelled = fullyLabelled(d) ? d : labelEntry(d, held.every((t) => t === null) ? null : (held as string[]));
      if (labelled !== d) changed.push(labelled);
      continue;
    }
    if (!cached && fullyLabelled(d)) continue;
    let blob: Blob;
    try { blob = await read(d); } catch { continue; }

    const count = await pageCountOf(blob);
    const layer = isPdf(d) ? await pageTexts(blob) : null;
    texts[d.id] = layer ?? Array.from({ length: count > 0 ? count : (d.pageCount ?? 1) }, () => null);

    const counted = count > 0 && d.pageCount !== count ? { ...d, pageCount: count } : d;
    const labelled = labelEntry(counted, layer);
    if (labelled !== d) changed.push(labelled);
  }
  return { claim: changed.length ? addDocuments(claim, changed) : claim, texts };
}

/**
 * Has the claim's document index moved on since slow work (a scan, a build) started from `started`?
 * 'edited': same claim, new documents (a label write, a scan): the work's result is stale.
 * 'switched': another claim (or none) is open now.
 */
export type Drift = 'same' | 'edited' | 'switched';
export function claimDrift(started: ClaimData, now: ClaimData | null): Drift {
  if (!now || now.id !== started.id) return 'switched';
  return now.documents === started.documents ? 'same' : 'edited';
}

/** Identity result per labelled page, from the in-memory texts. Pages with no text give cantCheck. */
export function identityMap(
  claim: ClaimData,
  device: string,
  texts: Record<string, (string | null)[]>,
): Record<string, Record<number, IdentityResult>> {
  const out: Record<string, Record<number, IdentityResult>> = {};
  for (const d of claimDocuments(claim)) {
    if (!onThisDevice(d, device) || !d.pages) continue;
    out[d.id] = Object.fromEntries(
      Object.entries(d.pages).map(([n, l]) => [Number(n), identityCheck(l.type, texts[d.id]?.[Number(n) - 1] ?? null, claim)]),
    );
  }
  return out;
}

/** `set` with the given reviews cancelled, or null when no box was reviewed (so nothing needs saving). */
export function invalidateIfReviewed(set: UploadSet, change: { docIds?: string[]; claimFields?: boolean }): UploadSet | null {
  const next = invalidate(set, change);
  return Object.values(set.boxes).some((b, i) => b.reviewedAt && !Object.values(next.boxes)[i].reviewedAt) ? next : null;
}

/** The ids of documents whose file is at one of these paths (Scan reports resets by path). */
export const docIdsForPaths = (claim: ClaimData, relPaths: string[]): string[] =>
  claimDocuments(claim).filter((d) => relPaths.includes(d.relPath)).map((d) => d.id);

/** A label change is a claim update; it also cancels the review of every box that used the file. */
function commit(claim: ClaimData, changed: ClaimDocument[]): ClaimPatch | null {
  if (!changed.length) return null;
  const { documents } = addDocuments(claim, changed);
  const cancelled = claim.uploadSet ? invalidateIfReviewed(claim.uploadSet, { docIds: changed.map((d) => d.id) }) : null;
  return { documents, ...(cancelled ? { uploadSet: cancelled } : {}) };
}

export function setPageLabels(claim: ClaimData, docId: string, pages: number[], type: DocType): ClaimPatch | null {
  const d = claim.documents?.[docId];
  if (!d || !pages.length) return null;
  const label: PageLabel = { type, by: 'surveyor', confirmed: true };
  return commit(claim, [{ ...d, pages: { ...d.pages, ...Object.fromEntries(pages.map((n) => [n, label])) } }]);
}

/** Confirms every guessed (text/name) label on this device's files. */
export function confirmAllLabels(claim: ClaimData, device: string): ClaimPatch | null {
  const changed = claimDocuments(claim).filter((d) => onThisDevice(d, device)).flatMap((d) => {
    const guessed = Object.entries(d.pages ?? {}).filter(([, l]) => !l.confirmed && (l.by === 'text' || l.by === 'name'));
    if (!guessed.length) return [];
    return [{ ...d, pages: { ...d.pages, ...Object.fromEntries(guessed.map(([n, l]) => [n, { ...l, confirmed: true }])) } }];
  });
  return commit(claim, changed);
}

/** "Use anyway" on an identity mismatch. */
export function overrideLabel(claim: ClaimData, docId: string, page: number, now: string): ClaimPatch | null {
  const d = claim.documents?.[docId];
  const l = d?.pages?.[page];
  return d && l ? commit(claim, [{ ...d, pages: { ...d.pages, [page]: { ...l, overrideAt: now } } }]) : null;
}

/** Boxes that Build makes a file for. */
export const buildable = (states: BoxState[]): BoxState[] =>
  states.filter((s) => (s.status === 'ready' || s.status === 'check') && s.parts.length > 0);

/** Built boxes that need another look before they can be reviewed. */
export const blockedBoxes = (states: BoxState[], builtIds: string[]): string[] =>
  states.filter((s) => s.status === 'check' && builtIds.includes(s.box.id)).map((s) => s.box.id);
