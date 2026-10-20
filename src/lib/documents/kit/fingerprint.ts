// src/lib/documents/kit/fingerprint.ts
/**
 * A file's identity on disk. When it changes (replaced in place, re-saved),
 * the page labels made on the old file would point at the wrong pages, so they go.
 */
import type { ClaimDocument, Fingerprint } from '@/types/documents';

export function fingerprintOf(file: { size: number; lastModified: number }, pageCount: number): Fingerprint {
  return { size: file.size, lastModified: file.lastModified, pageCount };
}

/** A page count of 0 means "not yet known" and matches anything. */
function sameFile(a: Fingerprint, b: Fingerprint): boolean {
  return a.size === b.size
    && a.lastModified === b.lastModified
    && (a.pageCount === 0 || b.pageCount === 0 || a.pageCount === b.pageCount);
}

export function reconcileEntry(entry: ClaimDocument, fp: Fingerprint): { entry: ClaimDocument; reset: boolean } {
  if (!entry.fingerprint) return { entry: { ...entry, fingerprint: fp }, reset: false };
  if (sameFile(entry.fingerprint, fp)) return { entry, reset: false };
  const { pages: _dropped, ...rest } = entry;
  return { entry: { ...rest, fingerprint: fp, pageCount: fp.pageCount }, reset: true };
}
