// Parser-first reading: rows come from code (row-parser) and are accepted only
// when they tie to the printed totals; the model only reads the header fields.
import { getHeaderPrompt, headerFields } from './prompts';
import { parseEstimate, type ParseOutcome, type PdfToken } from './row-parser';

/** A parser throw on an odd layout is a decline, not a failed extraction. */
export function safeParse(pageTokens: PdfToken[][]): ParseOutcome {
  try { return parseEstimate(pageTokens); }
  catch (e) { return { ok: false, reason: 'parser error: ' + (e instanceof Error ? e.message : String(e)) }; }
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
