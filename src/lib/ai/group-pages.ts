// Groups pages into calls by a model's measured rows-per-call limit (page-limits.ts).
import { limitsFor, PAGE_LIMITS, type ModelLimit } from './page-limits';
import { chunkRuns, type PageChunk } from './page-runs';

/**
 * Fills a group while rows so far + the next page's expected rows ≤ maxRowsPerCall,
 * under maxPagesPerCall and the image cap. A null estimate (scan) = the running
 * average of known estimates, else maxRowsPerCall — so a first scanned page is
 * its own group. A group always gets at least one page.
 */
export function groupPages(pages: number[], expectedRows: (number | null)[], limit: ModelLimit, imageCap: number | null): number[][] {
  const maxLen = Math.max(1, Math.min(limit.maxPagesPerCall, imageCap ?? Infinity));
  const groups: number[][] = [];
  let cur: number[] = [], rows = 0, known = 0, n = 0;
  pages.forEach((p, k) => {
    const est = expectedRows[k];
    const e = est ?? (n ? known / n : limit.maxRowsPerCall);
    if (cur.length && (rows + e > limit.maxRowsPerCall || cur.length >= maxLen)) { groups.push(cur); cur = []; rows = 0; }
    cur.push(p); rows += e;
    if (est != null) { known += est; n++; }
  });
  if (cur.length) groups.push(cur);
  return groups;
}

export interface ChunkSizes { text: number; vision: number; imageCap: number | null }

/**
 * Re-plans chunks[from..] for `model`: each remaining run is grouped by the model's
 * limit for its method, or by today's fixed sizes when there is none. chunks[from]
 * always starts on a default chunk boundary, so with no limits the plan is unchanged.
 * `expected` is indexed by 0-based page.
 */
export function planChunks(chunks: PageChunk[], from: number, model: string | undefined, expected: (number | null)[], sizes: ChunkSizes, table: readonly ModelLimit[] = PAGE_LIMITS): PageChunk[] {
  const rest = chunks.slice(from);
  if (!rest.length || !model || !rest.some(c => limitsFor(model, c.method, table))) return chunks;
  const runs: { method: PageChunk['method']; pages: number[] }[] = [];
  for (const c of rest) {
    const pages = Array.from({ length: c.last - c.first + 1 }, (_, k) => c.first + k);
    const last = runs[runs.length - 1];
    if (last?.method === c.method) last.pages.push(...pages); else runs.push({ method: c.method, pages });
  }
  const planned = runs.flatMap(r => {
    const limit = limitsFor(model, r.method, table);
    if (!limit) return chunkRuns([r], sizes.text, sizes.vision);
    return groupPages(r.pages, r.pages.map(p => expected[p] ?? null), limit, r.method === 'vision' ? sizes.imageCap : null)
      .map(g => ({ method: r.method, first: g[0], last: g[g.length - 1] }));
  });
  return [...chunks.slice(0, from), ...planned];
}
