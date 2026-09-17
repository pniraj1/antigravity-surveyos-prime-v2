/**
 * Which pages of a PDF the surveyor wants the AI to read.
 *
 * ponytail: the selection rides on the File object via a WeakMap so no
 * signature in the extraction chain (triggerExtraction → extractDocument →
 * filesToImages → fileToImages) changes, and Re-scan / Smart Fix — which hold
 * the same File in the extraction store — inherit it for free. Upgrade path
 * if this ever bites: thread `pages` explicitly through those calls.
 */
const aiPages = new WeakMap<File, number[]>();

/** Tag a File with the 1-based page numbers the AI should read. */
export function setAIPages(file: File, pages: number[]): void {
  aiPages.set(file, pages);
}

/** The tagged selection, or undefined when the whole file should be read. */
export function getAIPages(file: File): number[] | undefined {
  return aiPages.get(file);
}

/**
 * The page numbers `fileToImages` should actually render: ascending, unique,
 * clamped to 1..numPages. No selection (or an empty one) means every page.
 */
export function resolveAIPages(numPages: number, selection: number[] | undefined): number[] {
  if (!selection || selection.length === 0) {
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }
  const kept = new Set(selection.filter(p => Number.isInteger(p) && p >= 1 && p <= numPages));
  return [...kept].sort((a, b) => a - b);
}
