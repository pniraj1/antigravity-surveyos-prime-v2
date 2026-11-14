// Parser-first reading: rows come from code (row-parser) and are accepted only
// when they tie to the printed totals; the model only reads the header fields.
import { getHeaderPrompt, headerFields } from './prompts';
import { parseEstimate, type Layout, type ParseOutcome, type ParsedEstimate, type PdfToken } from './row-parser';
import { keepLayout, keptLayouts, layoutFromAnswer, layoutPrompt } from './layout-learning';

/** A parser throw on an odd layout is a decline, not a failed extraction. */
export function safeParse(pageTokens: PdfToken[][], layout?: Layout): ParseOutcome {
  try { return parseEstimate(pageTokens, layout); }
  catch (e) { return { ok: false, reason: 'parser error: ' + (e instanceof Error ? e.message : String(e)) }; }
}

const AMOUNT_LIKE = /^\d{1,3}(,\d{2,3})*\.\d{2}$|^\d+\.\d{2}$/;   // "1,990.00": a row total in the part no. column. Plain digits (Tata 1018805163) are real part numbers.
const HSN_OK = /^(\d{4}|\d{6}|\d{8})$/;
const SECTIONS = [['spare_parts', 'parts'], ['labour_items', 'labour'], ['painting_items', 'painting']] as const;

type Row = { sr_no: number; part_number?: string; hsn_sac?: string };

/** A doubtful part no. or HSN/SAC is blanked, never passed on: the surveyor gets a blank to check, not a confident wrong value. */
export function checkFields<T extends Record<(typeof SECTIONS)[number][0], Row[]>>(data: T): { data: T; issues: string[] } {
  const flagged: string[] = [];
  let n = 0;
  const out = { ...data };
  for (const [key, label] of SECTIONS) {
    const srs: number[] = [];
    out[key] = data[key].map(r => {
      const badPart = !!r.part_number && AMOUNT_LIKE.test(r.part_number.trim());
      const badHsn = !!r.hsn_sac && !HSN_OK.test(r.hsn_sac.replace(/[.\s]/g, ''));
      if (!badPart && !badHsn) return r;
      srs.push(r.sr_no);
      return { ...r, ...(badPart && { part_number: '' }), ...(badHsn && { hsn_sac: '' }) };
    }) as T[typeof key];
    if (srs.length) { flagged.push(`${label} ${srs.join(', ')}`); n += srs.length; }
  }
  if (!n) return { data, issues: [] };
  return { data: out, issues: [`Part no. or HSN/SAC was unclear and left blank on ${n} ${n === 1 ? 'row' : 'rows'} (${flagged.join('; ')}). Please check them against the PDF.`] };
}

const RATE_SLACK = 0.02, MAX_OFF = 0.2, MAX_UNCLEAR = 0.25;

/** A learned layout must do more than tie: qty x rate gives the row's amount, and part no./HSN look like codes. A swapped column fails here. */
export function learnedLooksRight(data: ParsedEstimate): boolean {
  const rows = [...data.spare_parts, ...data.labour_items, ...data.painting_items];
  const rated = rows.filter(r => r.unit_price > 0);
  const off = rated.filter(r => ![r.taxable_amount, r.total_amount].some(a => Math.abs(r.quantity * r.unit_price - a) <= Math.max(1, a * RATE_SLACK)));
  const checked = checkFields(data);
  const unclear = SECTIONS.reduce((n, [k]) => n + checked.data[k].filter((r, i) => r !== data[k][i]).length, 0);
  return off.length <= rated.length * MAX_OFF && unclear <= rows.length * MAX_UNCLEAR;
}

function readWith(pages: PdfToken[][], layout: Layout): ParseOutcome | null {
  const r = safeParse(pages, layout);
  return r.ok && learnedLooksRight(r.data) ? r : null;
}

/** Step 1: the built-in rules. Step 2: a layout kept on this device, else one small AI call naming the columns.
 *  Rows are always read in code and must tie to the printed totals; a decline here means the whole bill goes to AI. */
export async function parseFirst(pages: PdfToken[][], call: (prompt: string) => Promise<string>): Promise<ParseOutcome & { learned?: boolean }> {
  const built = safeParse(pages);
  if (built.ok) return built;
  for (const kept of keptLayouts()) {
    const r = readWith(pages, kept);
    if (r) { keepLayout(kept); return { ...r, learned: true }; }
  }
  let layout: Layout | null = null;
  try { layout = layoutFromAnswer(JSON.parse(await call(layoutPrompt(pages))), pages); }
  catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    console.warn('[Parser] layout call failed', e);
  }
  const r = layout && readWith(pages, layout);
  if (!r) return built;
  keepLayout(layout!);
  return { ...r, learned: true };
}

export function parserEligible(o: {
  key: string; allText: boolean; fileCount: number;
  feedback?: string; previousData?: unknown; forceDocMode?: string; override: unknown;
}): boolean {
  return (o.key === 'estimate' || o.key === 'final-bill') && o.allText && o.fileCount === 1
    // forced Text means a digital PDF: the parser still goes first (a page with no text layer gives it no rows, so it declines)
    && !o.feedback && !o.previousData && o.forceDocMode !== 'vision' && !o.override;
}

/** Header comes from page 1 + the last page only. Never returns gross_amount. */
export async function readHeader(
  key: 'estimate' | 'final-bill',
  textLayers: string[],
  call: (prompt: string) => Promise<string>,
): Promise<Record<string, string>> {
  const fields = headerFields(key);
  const blank = Object.fromEntries(fields.map(f => [f, '']));
  const pages = textLayers.length > 1 ? [textLayers[0], textLayers[textLayers.length - 1]] : textLayers;
  try {
    const raw = JSON.parse(await call(`${getHeaderPrompt(key)}\n\n${pages.join('\n---PAGE BREAK---\n')}`));
    return Object.fromEntries(fields.map(f => [f, typeof raw?.[f] === 'string' ? raw[f] : raw?.[f] != null ? String(raw[f]) : '']));
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    console.warn('[Parser] header call failed — rows kept, header left blank', e);
    return blank;
  }
}
