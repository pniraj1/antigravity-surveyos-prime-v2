// AI-free row reader for digital estimate PDFs: pdf.js text items (x/y) → line-item rows.
// Rows are anchored on the serial-number column; each row owns the vertical band halfway
// to its neighbours, so wrapped text and split numbers ("8,845." / "76") stay with their row.

export interface PdfToken { s: string; x: number; y: number; w: number }   // y grows upward (pdf.js)
export type Field = 'sr_no' | 'part_number' | 'description' | 'hsn_sac' | 'quantity' | 'unit_price' | 'taxable_amount' | 'total_amount' | 'gst_percent' | 'tax' | 'type';   // tax: a bare "Tax" header, holding either a rate (18%) or an amount
export interface RawRow { sr: number; page: number; cells: Partial<Record<Field, string>>; text: string; y: number; x: number; lead?: string }   // lead: text above the serial line, on section-start rows only   // page 0-based
export interface NonItemLine { page: number; text: string; nums: number[]; y: number; x: number }

const MONEY = /^(\d{1,3}(,\d{2,3})+(\.\d{1,2})?|\d+(\.\d{1,2})?)$/;
const SERIAL_WORD = /^(srl\.?|s\.?no\.?|sr\.?|seq\.?|s)$/i;
const HEADER_SYNONYMS: Record<string, Field> = {
  'part number': 'part_number', 'part no': 'part_number', 'part #': 'part_number',
  'description': 'description', 'particulars': 'description', 'part description': 'description',
  'labour description': 'description', 'part labor description': 'description',
  'hsn': 'hsn_sac', 'hsn/sac': 'hsn_sac', 'sac': 'hsn_sac', 'hsn\\sac': 'hsn_sac', 'hsn sac': 'hsn_sac',
  'qty': 'quantity', 'qty.': 'quantity',
  'rate': 'unit_price', 'rate/unit': 'unit_price', 'unit price': 'unit_price', 'part amt': 'unit_price', 'labour amt': 'unit_price',
  'taxable': 'taxable_amount', 'labor': 'taxable_amount', 'labour': 'taxable_amount', 'gst base amount': 'taxable_amount', 'base amount': 'taxable_amount',
  'total': 'total_amount', 'amount': 'total_amount', 'amount incl. tax': 'total_amount', 'amount incl tax': 'total_amount', 'final amount': 'total_amount', 'ins.amt': 'total_amount', 'ins share amount': 'total_amount', 'total amt': 'total_amount',
  'tax%': 'gst_percent', 'tax %': 'gst_percent', 'tax': 'tax', 'total gst': 'tax',
  'type': 'type',
};

/** '2,27,794.00'→227794; fragments like '8,845.' or '8708.99.00' → null. */
export function parseMoney(s: string): number | null {
  return MONEY.test(s) ? Number(s.replace(/,/g, '')) : null;
}

/** Split pdf.js items into one token per word, estimating each word's x from the item width. */
export function tokensFromItems(items: Array<{ str: string; transform: number[]; width: number }>): PdfToken[] {
  const out: PdfToken[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const cw = it.width / it.str.length;
    for (const m of it.str.matchAll(/\S+/g)) {
      out.push({ s: m[0], x: it.transform[4] + (m.index ?? 0) * cw, w: m[0].length * cw, y: it.transform[5] });
    }
  }
  return out;
}

/** Group tokens into lines (y within 2pt), top to bottom, each left to right. */
function linesOf(toks: PdfToken[]): PdfToken[][] {
  const lines: PdfToken[][] = [];
  for (const t of [...toks].sort((a, b) => b.y - a.y)) {
    const l = lines.find(l => Math.abs(l[0].y - t.y) <= 4);   // a figure may sit a few pt below its label
    if (l) l.push(t); else lines.push([t]);
  }
  return lines.map(l => l.sort((a, b) => a.x - b.x));
}

/** Join "8,845." with the "76" directly below it (x overlap within 2pt, gap < 14pt). */
function repairNumbers(toks: PdfToken[]): PdfToken[] {
  const sorted = [...toks].sort((a, b) => b.y - a.y);
  const used = new Set<PdfToken>();
  const out: PdfToken[] = [];
  for (const t of sorted) {
    if (used.has(t)) continue;
    let cur = t;
    while (/^[\d,]*\d[.,]$|^(\d{1,3}(,\d{2,3})+|\d{4,})\.\d$/.test(cur.s)) {   // "8,845." / "76", and Tata's "2,916.9" / "5" (one stray digit only: "496.0" and a qty "1.5" are whole)
      const top = cur;
      const tail = /\.\d$/.test(top.s) ? /^\d$/ : /^[\d,.]+$/;
      const below = sorted.find(b => !used.has(b) && b !== top && tail.test(b.s) && top.y - b.y > 0 && top.y - b.y < 14
        && b.x < top.x + top.w + 2 && b.x + b.w > top.x - 2);
      if (!below) break;
      used.add(below);
      cur = { s: cur.s + below.s, x: cur.x, y: cur.y, w: Math.max(cur.w, below.w) };
    }
    out.push(cur);
  }
  return out;
}

interface Column { field: Field | null; start: number; end: number; right: number }   // right = header's right edge

/** Header = first line with a serial word and Qty; synonyms may span adjacent tokens. */
function findHeader(toks: PdfToken[]): { y: number; cols: Column[] } | null {
  const line = linesOf(toks).find(l => (l.some(t => SERIAL_WORD.test(t.s)) || l.some(t => /^type$/i.test(t.s))) && l.some(t => /^qty\.?$/i.test(t.s)));
  if (!line) return null;
  const groups: { field: Field | null; x: number; right: number }[] = [];
  for (let i = 0; i < line.length;) {
    let field: Field | null = null, n = 1;
    for (const k of [3, 2, 1]) {
      if (i + k > line.length) continue;
      const f = HEADER_SYNONYMS[line.slice(i, i + k).map(t => t.s.toLowerCase()).join(' ')];
      if (f) { field = f; n = k; break; }
    }
    if (!field && SERIAL_WORD.test(line[i].s)) field = 'sr_no';
    groups.push({ field, x: line[i].x, right: line[i + n - 1].x + line[i + n - 1].w });
    i += n;
  }
  const cols = groups.map((g, i) => ({ field: g.field, start: i === 0 ? -Infinity : g.x, end: i + 1 < groups.length ? groups[i + 1].x : Infinity, right: g.right }));
  return { y: line[0].y, cols };
}

const byReading = (a: PdfToken, b: PdfToken) => (b.y - a.y) || (a.x - b.x);

// Tata: headings stacked over short lines ("Total Amt" / "(Incl." / "Taxes)"), often split mid-word ("Amoun" / "t").
const BLOCK_AMOUNT: [RegExp, Field | null][] = [
  [/incl/, 'total_amount'], [/gst|%|base|disc|extra|insura|liabil|campai/, null],
  [/^taxabl/, 'taxable_amount'], [/^qty/, 'quantity'], [/^rate/, 'unit_price'],
];
const BLOCK_TEXT: [RegExp, Field | null][] = [
  [/^(particulars|description)/i, 'description'], [/^part/i, 'part_number'], [/^hsn/i, 'hsn_sac'], [/^(type|uom?|um)$/i, null],
];

/** Header spread over several close lines: amount columns are where the row amounts right-align, each named by the heading words above it; text columns start at their heading word. */
function findHeaderBlock(toks: PdfToken[]): { y: number; cols: Column[] } | null {
  const lines = linesOf(toks);
  const qi = lines.findIndex(l => l.some(t => /^qty\.?$/i.test(t.s)));
  if (qi < 0) return null;
  const plain = (l: PdfToken[]) => !l.some(t => /\d/.test(t.s));
  let a = qi, b = qi;
  while (a > 0 && lines[a - 1][0].y - lines[a][0].y <= 10 && plain(lines[a - 1])) a--;
  while (b + 1 < lines.length && lines[b][0].y - lines[b + 1][0].y <= 10 && plain(lines[b + 1])) b++;
  const block = lines.slice(a, b + 1).flat();
  const y = Math.min(...block.map(t => t.y));
  const text = block.flatMap(t => { const m = BLOCK_TEXT.find(([re]) => re.test(t.s)); return m ? [{ field: m[1], x: t.x, right: t.x + t.w }] : []; });
  const desc = text.find(c => c.field === 'description');
  if (!desc || !block.some(t => SERIAL_WORD.test(t.s))) return null;
  // right edges of the amounts under the block, within 4pt; a real column has a value on many rows
  const clusters: { right: number; narrow: number; n: number }[] = [];
  for (const t of toks.filter(t => t.y < y - 2 && t.x > desc.right && parseMoney(t.s) !== null)) {
    const c = clusters.find(c => Math.abs(c.right - (t.x + t.w)) <= 4);
    if (c) { c.narrow = Math.min(c.narrow, t.w); c.n++; } else clusters.push({ right: t.x + t.w, narrow: t.w, n: 1 });
  }
  const most = Math.max(0, ...clusters.map(c => c.n));
  const amounts = clusters.filter(c => c.n >= Math.max(2, most * 0.3)).map(c => {
    const label = block.filter(t => t.x < c.right && t.x + t.w > c.right - c.narrow).sort(byReading).map(t => t.s).join('').toLowerCase();   // headings over the narrowest value
    return { field: BLOCK_AMOUNT.find(([re]) => re.test(label))?.[1] ?? null, x: c.right - c.narrow, right: c.right };
  });
  if (!amounts.some(c => c.field === 'quantity') || !amounts.some(c => c.field === 'total_amount' || c.field === 'taxable_amount')) return null;
  const all = [...text, ...amounts].sort((p, q) => p.x - q.x);
  // Tata centres headings over left-aligned text: a column starts halfway between the previous heading's end and its own
  const starts = all.map((g, i) => (i === 0 ? -Infinity : (Math.min(all[i - 1].right, g.x) + g.x) / 2));
  return { y, cols: all.map((g, i) => ({ field: g.field, start: starts[i], end: i + 1 < all.length ? starts[i + 1] : Infinity, right: g.right })) };
}

/** Serial tokens near the leftmost integer column, below the header, continuing the sequence. */
function anchorsOf(toks: PdfToken[], headerY: number, prev: number, cols?: Column[]): { anchors: PdfToken[]; last: number } {
  const typeCol = cols?.find(c => c.field === 'type');
  if (typeCol) {
    const typeToks = toks.filter(t => (prev > 0 || t.y < headerY) && t.x >= typeCol.start && t.x <= typeCol.end && /^(item|labou?r)$/i.test(t.s));
    if (typeToks.length) {
      const anchors: PdfToken[] = [];
      let last = prev;
      for (const t of typeToks.sort((p, q) => q.y - p.y)) {
        last++;
        anchors.push({ ...t, s: String(last) });
      }
      return { anchors, last };
    }
  }
  // with rows already read, numbers above this page's header may continue the previous section (the sequence check keeps strays out)
  const ints = toks.filter(t => /^\d{1,3}$/.test(t.s) && (prev > 0 || t.y < headerY));
  if (!ints.length) return { anchors: [], last: prev };
  const minX = Math.min(...ints.map(t => t.x));
  const anchors: PdfToken[] = [];
  let last = prev;
  for (const a of ints.filter(t => t.x < minX + 12).sort((p, q) => q.y - p.y)) {
    const n = Number(a.s);
    if (n === last + 1 || n === 1) { anchors.push(a); last = n; }   // ponytail: a skipped serial drops the rest of its section
  }
  return { anchors, last };
}

/** Rightmost non-empty, non-zero cell wins when several header columns share a Field. */
function pickCell(texts: string[]): string | undefined {
  const rev = texts.filter(Boolean).reverse();
  return rev.find(t => parseMoney(t) !== 0) ?? rev[0];
}

const PERCENT = /^\d+(\.\d+)?%$/;   // a share like "100.00%" sits beside an amount but is never one
const RIGHT_EDGE_SLACK = 8;   // pt
const AMOUNT_FIELDS: ReadonlySet<Field | null> = new Set<Field | null>(['quantity', 'unit_price', 'taxable_amount', 'total_amount', 'gst_percent', 'tax', null]);

/** Text goes by centre. Amounts are right-aligned under their header, so a wide one starts left of its column: a number whose centre falls in an amount (or unmapped) column is matched by right edge instead; numeric words in description/part/HSN columns stay put. */
function columnOf(t: PdfToken, cols: Column[]): Column | undefined {
  const m = t.x + t.w / 2;
  const byCentre = cols.find(c => m >= c.start && m < c.end);
  if (parseMoney(t.s) === null || (byCentre && !AMOUNT_FIELDS.has(byCentre.field))) return byCentre;
  const right = t.x + t.w;   // the closest header right edge wins; a header narrower than its numbers falls back to the centre column
  const near = cols.filter(c => Math.abs(c.right - right) <= RIGHT_EDGE_SLACK).sort((a, b) => Math.abs(a.right - right) - Math.abs(b.right - right))[0];
  return near ?? byCentre ?? cols[cols.length - 1];
}

function rowCells(band: PdfToken[], anchor: PdfToken, cols: Column[]): Partial<Record<Field, string>> {
  const perField = new Map<Field, string[]>();
  for (const c of cols) {
    if (!c.field) continue;
    const text = band.filter(t => columnOf(t, cols) === c && (c.field === 'gst_percent' || c.field === 'tax' || !PERCENT.test(t.s))).sort(byReading).map(t => t.s).join(c.field === 'hsn_sac' ? '' : ' ');   // a wrapped HSN ("8708.22" / ".00") is one code
    perField.set(c.field, [...(perField.get(c.field) ?? []), text]);
  }
  const cells: Partial<Record<Field, string>> = {};
  for (const [f, texts] of perField) { const v = pickCell(texts); if (v) cells[f] = v; }
  cells.sr_no = anchor.s;
  return cells;
}

const PART_WORD = /\bparts?\b/i;
const LABOUR_WORD = /\blabou?r\b|\bservices?\b/i;
const KIND_WORDS = new RegExp(`${PART_WORD.source}|${LABOUR_WORD.source}`, 'i');

export function readRows(pages: PdfToken[][], stacked = false): { rows: RawRow[]; nonItemLines: NonItemLine[] } | { declined: string } {
  const rows: RawRow[] = [];
  const nonItemLines: NonItemLine[] = [];
  let cols: Column[] | null = null;   // a page without its own header reuses the previous one
  let prev = 0;
  for (let p = 0; p < pages.length; p++) {
    const toks = repairNumbers(pages[p]);
    const header = stacked ? findHeaderBlock(toks) : findHeader(toks);
    const earlierCols = cols;   // rows above this page's header still follow the columns they were printed under
    if (header) cols = header.cols;
    // numbered terms printed under the grand total are not rows
    const grandY = Math.min(...linesOf(toks).filter(l => GRAND_LABEL.test(l.map(t => t.s).join(' ')) && l.some(t => parseMoney(t.s) !== null)).map(l => l[0].y), Infinity);
    const { anchors, last } = cols ? anchorsOf(toks.filter(t => grandY === Infinity || t.y > grandY - 2), header?.y ?? Infinity, prev, cols) : { anchors: [], last: prev };
    prev = last;
    const bands = anchors.map((a, i) => {
      const gapUp = i > 0 ? (anchors[i - 1].y - a.y) / 2 : null;
      const gapDn = i + 1 < anchors.length ? (a.y - anchors[i + 1].y) / 2 : null;
      const up = gapUp ?? gapDn ?? 8;
      const lo = a.y - (gapDn ?? up);
      return { a, hi: a.y + up, lo: header && a.y > header.y ? Math.max(lo, a.y - up) : lo };   // the last row above a header must not swallow it
    });
    for (const { a, hi, lo } of bands) {
      const belowHeader = header && a.y < header.y - 2;   // the header line (and what sits above it) is never part of a row below it
      const band = toks.filter(t => t.y < hi && t.y >= lo && !(belowHeader && t.y >= header.y - 2));
      const leadToks = a.s === '1' ? band.filter(t => t.y > a.y + 2) : [];
      const lead = leadToks.sort(byReading).map(t => t.s).join(' ');
      const heading = KIND_WORDS.test(lead) || TOTAL_LABEL.test(lead) || /\bsuggested\s*jobs\b/i.test(lead);   // a heading (Maruti bills: "Demanded Repairs-Others/Suggested Jobs") or a totals line is not part of the row's cells
      rows.push({ sr: Number(a.s), page: p, y: a.y, x: a.x, lead: a.s === '1' ? lead : undefined, cells: rowCells(band.filter(t => t !== a && !(heading && leadToks.includes(t))), a, (header && a.y > header.y && earlierCols) || cols!), text: [...band].sort(byReading).map(t => t.s).join(' ') });
    }
    for (const l of linesOf(toks)) {
      if (bands.some(b => l[0].y < b.hi && l[0].y >= b.lo)) continue;
      nonItemLines.push({ page: p, y: l[0].y, x: l[0].x, text: l.map(t => t.s).join(' '), nums: l.map(t => parseMoney(t.s)).filter((n): n is number => n !== null) });
    }
  }
  if (!cols) return { declined: 'no header line with a serial and Qty column found' };
  if (!rows.length) return { declined: 'no serial-numbered rows found under the header' };
  return { rows, nonItemLines };
}

export interface ParsedEstimate { spare_parts: any[]; labour_items: any[]; painting_items: any[]; gross_amount: number }
export type ParseOutcome = { ok: true; data: ParsedEstimate } | { ok: false; reason: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const num = (s: string | undefined) => (s === undefined ? null : parseMoney(s.replace(/%$/, '')));

const GST_RATES = [0, 5, 12, 18, 28];
/** A bare Tax value is an amount only if it is exactly a standard GST rate of the pre-tax part of the printed total; otherwise a rate only if it is itself a standard rate; else null. */
function bareTax(v: number | null, total: number | null): { rate: number; amount?: number } | null {
  if (v === null) return null;
  if (total !== null) {
    const rate = GST_RATES.find(s => Math.abs(round2((total - v) * s / 100) - v) <= 0.02);
    // both readings can pass (rate 18 on a 378 total is also 5% of 360): only trust the amount when the value cannot be a rate, or is the same rate
    if (rate !== undefined) return rate === v || !GST_RATES.includes(v) ? { rate, amount: v } : null;
  }
  return GST_RATES.includes(v) ? { rate: v } : null;
}

/** Estimate row shape of prompts.ts; null when taxable and total cannot both be had without guessing. noRate: only a bare amount is printed, its tax is settled per section (footerTax). */
function toItem(r: RawRow, preTax: boolean): { item: Record<string, unknown>; printedTotal: boolean; noRate?: boolean } | null {
  const c = r.cells;
  const bare = c.tax !== undefined && !c.tax.endsWith('%') ? bareTax(num(c.tax), num(c.total_amount)) : undefined;
  if (bare === null) return null;   // a bare Tax value that is neither a GST rate nor the amount for one: decline
  const taxAmount = bare?.amount ?? null;
  const gst = num(c.gst_percent) ?? (c.tax?.endsWith('%') ? num(c.tax) : null) ?? bare?.rate ?? null;
  // preTax: the Amount column is printed before tax (Kia and Maruti invoices), so it is the taxable value
  const asTaxable = preTax && c.taxable_amount === undefined;
  const printed = asTaxable ? null : num(c.total_amount);
  const taxable = num(c.taxable_amount) ?? (asTaxable ? num(c.total_amount) : printed !== null && gst !== null ? round2(printed / (1 + gst / 100)) : printed !== null && taxAmount !== null ? round2(printed - taxAmount) : null);
  const total = printed ?? (taxable !== null && gst !== null ? round2(taxable * (1 + gst / 100)) : null);
  const noRate = taxable !== null && total === null && taxAmount === null && c.tax === undefined;
  if (taxable === null || (total === null && !noRate)) return null;
  // Tata prints taxable and total but only half-rates (CGST 9%): the rate is the one standard GST rate that joins them
  const joins = gst === null && printed !== null && num(c.taxable_amount) !== null ? GST_RATES.filter(g => Math.abs(taxable * (1 + g / 100) - printed) <= 1) : [];
  const item = {
    sr_no: r.sr, description: (c.description ?? '').replace(/\b(CGST|SGST|IGST)\b.*$/i, '').trim(), part_number: c.part_number ?? '', hsn_sac: c.hsn_sac ?? '',
    quantity: /^\d+(\.\d+)?$/.test(c.quantity ?? '') ? Number(c.quantity) : num(c.quantity) ?? 1,   // Maruti prints "2.000"
    unit_price: num(c.unit_price) ?? 0, taxable_amount: taxable,
    cgst_amount: 0, sgst_amount: 0, total_amount: total, gst_percent: gst ?? (joins.length === 1 ? joins[0] : 0), category: '', _page: r.page, type: c.type ?? '',
  };
  return { item, printedTotal: printed !== null, noRate };
}

/** Maruti: rows print a bare amount and the tax is added under the section. The section's base plus exactly one GST rate must be a labelled total;
 *  else the base itself must be one, and the rows already include tax (rate left blank: the app's 18% default applies). null = no reading ties. */
function footerTax(items: any[], labelled: number[]): { items: any[]; inclusive: boolean } | null {
  const base = sum(items.map(it => it.taxable_amount as number));
  const ties = (n: number) => labelled.some(l => Math.abs(l - n) <= 1);
  const rates = GST_RATES.filter(g => g > 0 && ties(base * (1 + g / 100)));
  if (rates.length === 1) return { inclusive: false, items: items.map(it => ({ ...it, gst_percent: rates[0], total_amount: round2(it.taxable_amount * (1 + rates[0] / 100)) })) };
  if (rates.length || !ties(base)) return null;
  return { inclusive: true, items: items.map(({ taxable_amount, gst_percent, ...it }) => ({ ...it, total_amount: taxable_amount })) };
}

const above = (a: { page: number; y: number }, b: { page: number; y: number }) => a.page < b.page || (a.page === b.page && a.y > b.y);   // a is higher in reading order
// Maruti: "Net Estimate Amounts", "Net Bill Amount (Rounded)"; Tata: "Gross Amount"
const GRAND_LABEL = /\bgrand\s*total\b|\bnet\s*((estimate|bill)\s*)?amounts?\b|\btotal\s*amt\b|\bgross\s*amount\b|\bfinal\s*amount\b/i;
const TOTAL_LABEL = /\btotal\b|\bnet\s*((estimate|bill)\s*)?amounts?\b|\bgross\s*amount\b|\b(part|labou?r)\s*(amt|amount)\b/i;

/** Parts / labour from the heading between the header (or the previous section) and this section's first row; null = unknown. */
function kindOf(first: RawRow, prevRow: RawRow | undefined, lines: NonItemLine[]): 'part' | 'labour' | null {
  const header = lines.filter(l => /\bqty\b/i.test(l.text) && above(l, first)).pop();
  const floor = [header, prevRow].filter((b): b is NonItemLine | RawRow => !!b).sort((a, b) => (above(a, b) ? -1 : 1)).pop();
  const text = [TOTAL_LABEL.test(first.lead ?? '') ? '' : first.lead ?? '', ...lines.filter(l => above(l, first) && (!floor || above(floor, l)) && !TOTAL_LABEL.test(l.text)).map(l => l.text)].join(' ');
  const part = PART_WORD.test(text), labour = LABOUR_WORD.test(text);
  return part === labour ? null : part ? 'part' : 'labour';
}

/** Rows → estimate sections, accepted only when every section and the grand total tie to printed figures. */
export function parseEstimate(pages: PdfToken[][]): ParseOutcome {
  const first = parseWith(pages, false);
  if (first.ok) return first;
  // each reading must tie to printed figures, so trying others is safe
  const other = [parseWith(pages, true), parseWith(pages, false, true)].find(r => r.ok);
  return other ?? first;
}

function parseWith(pages: PdfToken[][], preTax: boolean, stacked = false): ParseOutcome {
  const read = readRows(pages, stacked);
  if ('declined' in read) return { ok: false, reason: read.declined };
  const { rows, nonItemLines } = read;
  const grands = nonItemLines.filter(l => GRAND_LABEL.test(l.text) && l.nums.length);
  if (!grands.length) return { ok: false, reason: 'no grand total found' };
  const gross = Math.max(...grands.flatMap(l => l.nums));
  // a second document (or a page of one) after the first grand total must not be silently dropped
  const afterGrand = nonItemLines.slice(nonItemLines.indexOf(grands[0]) + 1);
  const isHeader = (l: NonItemLine) => /\bqty\b/i.test(l.text) && l.text.split(' ').some(w => SERIAL_WORD.test(w));
  const looksLikeRow = (l: NonItemLine) => /^\d{1,3}$/.test(l.text.split(' ')[0]) && l.nums.length >= 3;
  if (afterGrand.some(l => isHeader(l) || looksLikeRow(l)) || rows.some(r => above(grands[0], r))) return { ok: false, reason: 'multiple documents: a header or numbered item line follows the grand total' };
  // a serial the reader skipped leaves a line starting in the serial column, between the header and the last grand total
  const lastGrand = grands[grands.length - 1];
  const header = nonItemLines.find(l => /\bqty\b/i.test(l.text));
  const serialX = (page: number) => Math.min(...rows.filter(r => r.page === page).map(r => r.x), Infinity);
  if (nonItemLines.some(l => /^\d{1,3}$/.test(l.text.split(' ')[0]) && l.text.includes(' ') && l.x < serialX(l.page) + 12
    && header && above(header, l) && above(l, lastGrand))) return { ok: false, reason: 'serial gap: a numbered line was not read as a row' };
  const labelled = nonItemLines.filter((l, idx) => TOTAL_LABEL.test(l.text) || (idx > 0 && TOTAL_LABEL.test(nonItemLines[idx - 1].text) && nonItemLines[idx - 1].nums.length === 0)).flatMap(l => l.nums);

  const sections: RawRow[][] = [];
  for (const r of rows) { if (r.sr === 1) sections.push([]); sections[sections.length - 1].push(r); }
  let computed = false;   // some row total is taxable x (1+gst), not printed
  let footerRated = false, inclusiveSum = 0;   // tax-inclusive bare rows are trusted only beside a section whose tax was visibly added
  const out: ParsedEstimate = { spare_parts: [], labour_items: [], painting_items: [], gross_amount: gross };
  for (const [i, sec] of sections.entries()) {
    if (sec.some((r, k) => r.sr !== k + 1)) return { ok: false, reason: `serial gap in section ${i + 1}` };
    const built = sec.map(r => toItem(r, preTax));
    if (built.some(b => !b)) return { ok: false, reason: `section ${i + 1}: a row has no readable amount` };
    const noRate = built.filter(b => b!.noRate).length;
    if (noRate && noRate < built.length) return { ok: false, reason: `section ${i + 1}: some rows print a tax rate and some do not` };
    let items = built.map(b => b!.item as any);
    if (noRate) {
      const taxed = footerTax(items, labelled);
      if (!taxed) return { ok: false, reason: `section ${i + 1}: rows have no tax rate and no printed subtotal settles one` };
      items = taxed.items;
      if (taxed.inclusive) inclusiveSum += sum(items.map(it => it.total_amount)); else { computed = true; footerRated = true; }
    } else {
      if (built.some(b => !b!.printedTotal)) computed = true;
      const key = built.every(b => b!.printedTotal) ? 'total_amount' : 'taxable_amount';
      const secSum = sum(items.map(it => it[key] as number));
      if (!labelled.some(n => Math.abs(n - secSum) <= 1)) return { ok: false, reason: `section ${i + 1} sum ${round2(secSum)} matches no printed subtotal` };
    }
    const kind = kindOf(sec[0], rows[rows.indexOf(sec[0]) - 1], nonItemLines);
    for (const it of items) {
      const labour = kind ? kind === 'labour' : /labou?r/i.test(it.type) || /^0*9987/.test(it.hsn_sac);
      if (!labour) out.spare_parts.push(it);
      else if (/PAINT|COLOU?R/i.test(it.description)) out.painting_items.push(it);
      else out.labour_items.push(it);
    }
  }
  // a pre-tax "Gross Amount" would also tie: only trust it when the document visibly adds tax to another section (Maruti estimates)
  if (inclusiveSum && !footerRated) return { ok: false, reason: 'rows print no tax rate and no section shows tax being added' };
  const all = [...out.spare_parts, ...out.labour_items, ...out.painting_items];
  if (Math.abs(sum(all.map(it => it.total_amount)) - gross) > (computed ? Math.max(1, all.length * 0.01) : Math.max(5, gross * 0.001))) return { ok: false, reason: 'rows do not add up to the grand total' };
  return { ok: true, data: out };
}
