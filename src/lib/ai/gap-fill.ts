//
// Surgical re-read: one call per page that a serial gap points at, asking only
// for the missed rows, merged by serial so nothing already read is touched.
import { callAIGateway, AllProvidersBusyError, OfflineError, newSession } from './service';
import { SECTIONS, mergeBySerial, tagRows } from './row-check';

export const MAX_GAP_PAGES = 6;

export interface GapFillInput {
  basePrompt: string;
  apiImages: string[];
  data: unknown;
  srNos: number[];
  pages: number[];
  session?: ReturnType<typeof newSession>;
  signal?: AbortSignal;
  onProgress?: (msg: string) => void;
}

function serialsIn(data: unknown): number[] {
  const d = data as Record<string, unknown> | null;
  return SECTIONS.flatMap(s => (Array.isArray(d?.[s]) ? (d![s] as { sr_no?: unknown }[]) : []))
    .map(r => Number(r.sr_no)).filter(n => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
}

export function gapPrompt(basePrompt: string, page1: number, srNos: number[], have: number[]): string {
  const what = srNos.length
    ? `Rows with serial numbers ${srNos.join(', ')} were missed on page ${page1}.`
    : `Rows already captured: ${have.join(', ')}. Return ONLY rows on page ${page1} that are NOT in that list.`;
  return `${basePrompt}\n\nTARGETED RE-READ of page ${page1} only.\n${what}\n` +
    `Return ONLY those rows, in the same JSON shape (spare_parts / labour_items / painting_items, each row with its sr_no). ` +
    `Leave every other field empty. Do not repeat rows that were already captured.`;
}

function shouldPropagate(e: unknown): boolean {
  return (e as { name?: string })?.name === 'AbortError' || e instanceof AllProvidersBusyError || e instanceof OfflineError;
}

export async function fillGaps(input: GapFillInput): Promise<unknown> {
  const pages = [...new Set(input.pages)].filter(p => p >= 0 && p < input.apiImages.length);
  // ponytail: > MAX_GAP_PAGES gap pages means the whole read is suspect, not a
  // few rows — let the caller's second-opinion rule handle it.
  if (pages.length === 0 || pages.length > MAX_GAP_PAGES) return input.data;

  let data = input.data;
  for (const p of pages) {
    if (input.signal?.aborted) { const e = new Error('Extraction cancelled'); e.name = 'AbortError'; throw e; }
    const label = input.srNos.length ? `Rows ${input.srNos.join(', ')} missing` : 'Some rows missing';
    input.onProgress?.(`${label} — re-reading page ${p + 1}…`);
    // ponytail: always vision for a gap page — a second look at the same text
    // layer tends to repeat the same miss.
    const prompt = gapPrompt(input.basePrompt, p + 1, input.srNos, serialsIn(data));
    let raw: string;
    try {
      raw = await callAIGateway(prompt, [input.apiImages[p]], 'json', 'heavy', input.session, input.signal);
    } catch (e) {
      if (shouldPropagate(e)) throw e;
      console.warn(`[Smart Fix] page ${p + 1} re-read failed — keeping first result`, e);
      continue;
    }
    try {
      data = mergeBySerial(data, tagRows(JSON.parse(raw), p, p));
    } catch {
      console.warn(`[Smart Fix] page ${p + 1} returned unparseable JSON — skipping.`);
    }
  }
  return data;
}
