// Parser-first reading: rows come from code (row-parser) and are accepted only
// when they tie to the printed totals; the model only reads the header fields.
import { getHeaderPrompt, headerFields } from './prompts';
import { parseEstimate, type ParseOutcome, type PdfToken } from './row-parser';

/** A parser throw on an odd layout is a decline, not a failed extraction. */
export function safeParse(pageTokens: PdfToken[][]): ParseOutcome {
  try { return parseEstimate(pageTokens); }
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

export function parserEligible(o: {
  key: string; allText: boolean; fileCount: number;
  feedback?: string; previousData?: unknown; forceDocMode?: string; override: unknown;
}): boolean {
  return (o.key === 'estimate' || o.key === 'final-bill') && o.allText && o.fileCount === 1
    && !o.feedback && !o.previousData && !o.forceDocMode && !o.override;
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
