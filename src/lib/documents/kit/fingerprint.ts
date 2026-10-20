// src/lib/documents/kit/fingerprint.ts
/**
 * A file's identity on disk. When it changes (replaced in place, re-saved),
 * the page labels made on the old file would point at the wrong pages, so they go.
 * Fingerprints are kept per device: `lastModified` differs between PCs holding
 * copies of the same file, so it is only compared against this device's own.
 */
import type { ClaimDocument, Fingerprint } from '@/types/documents';

export function fingerprintOf(file: { size: number; lastModified: number }, pageCount: number): Fingerprint {
  return { size: file.size, lastModified: file.lastModified, pageCount };
}

/** A page count of 0 means "not yet known" and matches anything. */
const samePages = (a: Fingerprint, b: Fingerprint) => a.pageCount === 0 || b.pageCount === 0 || a.pageCount === b.pageCount;
const sameHere = (a: Fingerprint, b: Fingerprint) => a.size === b.size && a.lastModified === b.lastModified && samePages(a, b);
const sameElsewhere = (a: Fingerprint, b: Fingerprint) => a.size === b.size && samePages(a, b);

const sameStored = (a: Fingerprint, b: Fingerprint) => sameHere(a, b) && a.pageCount === b.pageCount;

export function reconcileEntry(
  entry: ClaimDocument,
  fp: Fingerprint,
  device: string,
): { entry: ClaimDocument; reset: boolean } {
  const all = entry.fingerprints ?? {};
  const mine = all[device];
  const others = Object.entries(all).filter(([d]) => d !== device).map(([, f]) => f);
  // ponytail: with several other devices, one match is enough to call the file unchanged.
  const reset = mine ? !sameHere(mine, fp) : others.length > 0 && !others.some((o) => sameElsewhere(o, fp));
  // "Unknown" never erases a count we already have.
  const stored: Fingerprint = { ...fp, pageCount: fp.pageCount || (reset ? 0 : mine?.pageCount ?? 0) };
  if (!reset && mine && sameStored(mine, stored)) return { entry, reset: false };
  const next = { ...entry, fingerprints: { ...all, [device]: stored } };
  if (!reset) return { entry: next, reset: false };
  const { pages: _dropped, ...rest } = next;
  return { entry: { ...rest, pageCount: stored.pageCount }, reset: true };
}

/**
 * Re-check every entry that shares one file on disk against what the scan just
 * saw. `reset`: some entry lost its page labels. `changed`: anything at all
 * differs, so the caller knows whether the claim needs saving.
 */
export function reconcileKnown(
  entries: ClaimDocument[],
  file: { size: number; lastModified: number },
  device: string,
): { entries: ClaimDocument[]; reset: boolean; changed: boolean } {
  let reset = false;
  const out = entries.map((e) => {
    const isPdf = e.mime === 'application/pdf' || /\.pdf$/i.test(e.relPath);
    const r = reconcileEntry(e, fingerprintOf(file, isPdf ? (e.pageCount ?? 0) : 1), device);
    reset ||= r.reset;
    return r.entry;
  });
  return { entries: out, reset, changed: out.some((e, i) => e !== entries[i]) };
}
