// Parser-first, step 2: when the built-in rules do not know a bill's table layout, one small AI call names its
// columns; the parser then reads every row in code. A layout that works is kept on this device for the next bill like it.
import { parseMoney, type Field, type Layout, type LayoutTable, type PdfToken } from './row-parser';

const FIELDS: readonly Field[] = ['sr_no', 'description', 'part_number', 'hsn_sac', 'quantity', 'unit_price', 'taxable_amount', 'total_amount', 'gst_percent', 'tax'];
const TEXT_FIELDS: readonly Field[] = ['sr_no', 'description', 'part_number', 'hsn_sac'];
const STORE_KEY = 'surveyos.parserLayouts';
const MAX_KEPT = 20;
const SAME_Y = 1.5;   // pt: stacked heading lines stay apart

const PROMPT = `Below are lines of text from a vehicle repair estimate or invoice PDF. Each line is "y=<n>:" then its words as "<x>:<word>".
Find every item table heading (the column titles over a parts or labour table; one heading may span 2-3 lines).
For each table give the page, the y of each heading line, and for EVERY column (including ones you call other) the x of that column's value in the first item row under the heading, and its field:
sr_no, description, part_number, hsn_sac, quantity (qty or hours), unit_price (rate per unit), taxable_amount (amount before GST), total_amount (row amount including GST, or the row's final amount), gst_percent, tax (GST amount), other (discount, share %, category, codes, anything else).
Return ONLY JSON: {"tables":[{"page":1,"heading_y":[319,315,310],"columns":[{"x":46,"field":"sr_no"}]}]}`;

const round = (n: number) => Math.round(n);

function linesByY(toks: PdfToken[]): { y: number; toks: PdfToken[] }[] {
  const lines: { y: number; toks: PdfToken[] }[] = [];
  for (const t of [...toks].sort((a, b) => b.y - a.y)) {
    const l = lines.find(l => Math.abs(l.y - t.y) <= SAME_Y);
    if (l) l.toks.push(t); else lines.push({ y: t.y, toks: [t] });
  }
  return lines.map(l => ({ ...l, toks: l.toks.sort((a, b) => a.x - b.x) }));
}

/** Page 1 and the last page; only heading-like lines (no amounts) and the two lines under each, so the call stays small. */
export function layoutPrompt(pages: PdfToken[][]): string {
  const picks = pages.length > 1 ? [0, pages.length - 1] : [0];
  const body = picks.map(p => {
    const lines = linesByY(pages[p]);
    const plain = lines.map(l => !l.toks.some(t => parseMoney(t.s) !== null));
    const keep = lines.filter((_, i) => plain[i] || plain[i - 1] || plain[i - 2]);
    return `PAGE ${p + 1}\n${keep.map(l => `y=${round(l.y)}: ${l.toks.map(t => `${round(t.x)}:${t.s}`).join(' ')}`).join('\n')}`;
  });
  return `${PROMPT}\n\n${body.join('\n\n')}`;
}

/** The AI's answer checked against the page: heading lines must exist, and each named amount column must have a value where the AI says. null = not usable. */
export function layoutFromAnswer(raw: unknown, pages: PdfToken[][]): Layout | null {
  const tables = (raw as { tables?: unknown } | null)?.tables;
  if (!Array.isArray(tables) || !tables.length) return null;
  const out: LayoutTable[] = [];
  for (const t of tables as Array<Record<string, unknown>>) {
    const toks = pages[Number(t?.page) - 1];
    const ys = Array.isArray(t?.heading_y) ? t.heading_y.map(Number).filter(Number.isFinite) : [];
    if (!toks || !ys.length || !Array.isArray(t.columns)) return null;
    const head = toks.filter(k => ys.some(y => Math.abs(k.y - y) <= SAME_Y));
    if (head.length < 3) return null;
    const bottom = Math.min(...head.map(k => k.y));
    const cols: LayoutTable['cols'] = [];
    for (const c of t.columns as Array<Record<string, unknown>>) {
      const field = FIELDS.includes(c?.field as Field) ? c.field as Field : null;
      const x = Number(c?.x);
      if (!Number.isFinite(x)) return null;
      const value = toks.filter(k => k.y < bottom - 2 && k.y > bottom - 200 && Math.abs(k.x - x) <= 3).sort((a, b) => b.y - a.y)[0];
      if (!value && field && !TEXT_FIELDS.includes(field)) return null;   // amounts are matched by their right edge: it must be real
      cols.push({ field, x: value?.x ?? x, right: value ? value.x + value.w : x });
    }
    if (!cols.some(c => c.field === 'description') || !cols.some(c => c.field === 'total_amount' || c.field === 'taxable_amount')) return null;
    out.push({ words: head.map(k => ({ s: k.s, x: k.x, dy: k.y - bottom })), cols });
  }
  return out;
}

/** Layouts that read a bill on this device, most recent first. Storage blocked or corrupt: none. */
export function keptLayouts(): Layout[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(v) ? v as Layout[] : [];
  } catch { return []; }
}

export function keepLayout(layout: Layout): void {
  try {
    const s = JSON.stringify(layout);
    const rest = keptLayouts().filter(l => JSON.stringify(l) !== s);
    localStorage.setItem(STORE_KEY, JSON.stringify([layout, ...rest].slice(0, MAX_KEPT)));
  } catch { /* storage blocked: the layout is learned again next time */ }
}
