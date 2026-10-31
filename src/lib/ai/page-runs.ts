// Per-page text-or-image decision for extractDocument, grouped into runs.

const TEXT_RICH_THRESHOLD = 200;  // chars/page → clearly digitally-born

export type PageMode = 'text' | 'vision';

export interface PageProfile {
  pageIndex: number;
  charCount: number;
  text: string;
  mode: PageMode;
}

/**
 * True if the text is mostly garbage (corrupted export from a legacy ERP):
 * >25% of characters outside printable ASCII, newline, Devanagari or ₹.
 */
export function isGarbageText(text: string): boolean {
  if (text.length < 50) return false;
  const printable = text.match(/[\n\x20-\x7Eऀ-ॿ₹]/g) ?? [];
  return (printable.length / text.length) < 0.75;
}

/**
 * A page is read as text only when it has ≥ TEXT_RICH_THRESHOLD chars and the
 * text is not garbled; otherwise it is sent as an image. `docMode` is 'text'
 * only when every page is text (used to decide whether the page text can be
 * trusted to verify the printed gross).
 */
export function profilePages(textLayers: string[]): { pages: PageProfile[]; docMode: PageMode } {
  const pages: PageProfile[] = textLayers.map((text, i) => ({
    pageIndex: i,
    charCount: text.length,
    text,
    mode: text.length >= TEXT_RICH_THRESHOLD && !isGarbageText(text) ? 'text' : 'vision',
  }));
  const docMode: PageMode = pages.length > 0 && pages.every(p => p.mode === 'text') ? 'text' : 'vision';
  return { pages, docMode };
}

export interface PageRun { method: PageMode; pages: number[] }   // 0-based, ascending, consecutive

export function pageRuns(modes: PageMode[], force?: PageMode): PageRun[] {
  const runs: PageRun[] = [];
  modes.forEach((m, i) => {
    const method = force ?? m;
    const last = runs[runs.length - 1];
    if (last?.method === method) last.pages.push(i);
    else runs.push({ method, pages: [i] });
  });
  return runs;
}

export interface PageChunk { method: PageMode; first: number; last: number }   // 0-based, inclusive

/** Splits each run into chunks of its method's size; a chunk never crosses a run. */
export function chunkRuns(runs: PageRun[], textSize: number, visionSize: number): PageChunk[] {
  return runs.flatMap(r => {
    const size = Math.max(1, r.method === 'text' ? textSize : visionSize);
    const out: PageChunk[] = [];
    for (let i = 0; i < r.pages.length; i += size) {
      out.push({ method: r.method, first: r.pages[i], last: r.pages[Math.min(i + size, r.pages.length) - 1] });
    }
    return out;
  });
}
