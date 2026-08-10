import {
  putBenchmarkDoc, readBenchmarkDoc, removeBenchmarkDoc,
  type BenchmarkDocRecord,
} from '@/lib/storage/indexeddb';

/**
 * The admin's specimen estimate for probe accuracy testing.
 *
 * Stored in IndexedDB rather than Firebase: Firebase Storage is unused by this
 * app (no storage.rules, nothing imports getStorage), so using it would mean
 * new rules, a new deploy surface and a second persistence layer for one file.
 *
 * The document is transmitted in full to every shortlisted model on each
 * accuracy run, which is why the panel says so at the point of upload.
 */

export type BenchmarkDoc = BenchmarkDocRecord;

export async function saveBenchmarkDoc(doc: BenchmarkDoc): Promise<void> {
  await putBenchmarkDoc(doc);
}

export async function getBenchmarkDoc(): Promise<BenchmarkDoc | null> {
  try {
    return await readBenchmarkDoc();
  } catch {
    // No DB open yet (not signed in) — the panel treats this as "none set".
    return null;
  }
}

export async function deleteBenchmarkDoc(): Promise<void> {
  await removeBenchmarkDoc();
}

/** Returns an error message, or null when the value is usable. */
export function validateBenchmarkInput(expectedTotal: number): string | null {
  if (!Number.isFinite(expectedTotal)) {
    return 'Enter the grand total printed on the document.';
  }
  if (expectedTotal <= 0) {
    return 'Expected total must be greater than zero.';
  }
  return null;
}
