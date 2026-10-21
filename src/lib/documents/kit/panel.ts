/** Small pure helpers behind the portal checklist and upload-review panels. */
import type { ClaimDocument } from '@/types/documents';
import type { BoxState } from './checklist';
import type { IdentityResult } from './identity';
import { buildable } from './orchestrate';

/** [3,4,5,7] -> "p3–5, 7". */
export function formatPages(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    runs.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return runs.length ? `p${runs.join(', ')}` : '';
}

/** "Documents.pdf p3–4, RC.jpg": where a box's file comes from. */
export function sourceLine(parts: BoxState['parts'], documents: Record<string, ClaimDocument>): string {
  return parts
    .flatMap((p) => {
      const doc = documents[p.docId];
      return doc ? [[doc.relPath, formatPages(p.pages)].filter(Boolean).join(' ')] : [];
    })
    .join(', ');
}

/** Only boxes the surveyor has to think about count: not-needed and empty optional boxes don't. */
export function countsLine(states: BoxState[]): string {
  const counted = states.filter((s) => s.status === 'ready' || s.status === 'check' || s.status === 'missing');
  const n = (status: BoxState['status']): number => counted.filter((s) => s.status === status).length;
  return `${n('ready')} of ${counted.length} ready · ${n('missing')} missing · ${n('check')} to check`;
}

/** Build is allowed when no mandatory box is missing and at least one box has something to build. */
export const canBuild = (states: BoxState[]): boolean =>
  !states.some((s) => s.status === 'missing' && s.box.mandatory) && buildable(states).length > 0;

export const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** How the pages feeding a box fared in the identity checks (a page nobody could check counts as can't-check). */
export function identityMarks(
  state: BoxState,
  identity: Record<string, Record<number, IdentityResult>>,
): Record<IdentityResult['status'], number> {
  const out = { match: 0, mismatch: 0, cantCheck: 0 };
  for (const p of state.parts) {
    for (const n of p.pages.length ? p.pages : [0]) out[identity[p.docId]?.[n]?.status ?? 'cantCheck']++;
  }
  return out;
}

/** A box can be ticked only when its built file was made this session, is still current, and still fills a ready box of the current list. */
export const canTick = (a: { built: boolean; entry: { stale?: boolean }; state: BoxState | undefined; setMatchesRecipe: boolean }): boolean =>
  a.built && !a.entry.stale && a.state?.status === 'ready' && a.setMatchesRecipe;

/** Boxes that were reviewed (`before`) and no longer are: something changed since. */
export const droppedReviews = (before: string[], boxes: Record<string, { reviewedAt?: string }>): string[] =>
  before.filter((id) => id in boxes && !boxes[id].reviewedAt);
