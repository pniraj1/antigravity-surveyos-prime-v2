// AI-free row reader for digital estimate PDFs: pdf.js text items (x/y) → line-item rows.
// Rows are anchored on the serial-number column; each row owns the vertical band halfway
// to its neighbours, so wrapped text and split numbers ("8,845." / "76") stay with their row.

export interface PdfToken { s: string; x: number; y: number; w: number }   // y grows upward (pdf.js)
export type Field = 'sr_no' | 'part_number' | 'description' | 'hsn_sac' | 'quantity' | 'unit_price' | 'taxable_amount' | 'total_amount' | 'gst_percent';
export interface RawRow { sr: number; page: number; cells: Partial<Record<Field, string>>; text: string }   // page 0-based
export interface NonItemLine { page: number; text: string; nums: number[] }

const MONEY = /^(\d{1,3}(,\d{2,3})+(\.\d{1,2})?|\d+(\.\d{1,2})?)$/;
const SERIAL_WORD = /^(srl|s\.?no\.?|sr|seq\.?|s)$/i;
const HEADER_SYNONYMS: Record<string, Field> = {
  'part number': 'part_number', 'part no': 'part_number', 'part #': 'part_number',
  'description': 'description', 'particulars': 'description', 'part description': 'description',
  'labour description': 'description', 'part labor description': 'description',
  'hsn': 'hsn_sac', 'hsn/sac': 'hsn_sac',
  'qty': 'quantity', 'qty.': 'quantity',
  'rate': 'unit_price', 'rate/unit': 'unit_price', 'part amt': 'unit_price', 'labour amt': 'unit_price',
  'taxable': 'taxable_amount', 'labor': 'taxable_amount', 'labour': 'taxable_amount',   // Maruti: labour amount sits under bare "Labor"
  'total': 'total_amount', 'amount': 'total_amount', 'ins.amt': 'total_amount', 'ins share amount': 'total_amount', 'total amt': 'total_amount',
  'tax%': 'gst_percent', 'tax %': 'gst_percent',
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
    const l = lines.find(l => Math.abs(l[0].y - t.y) <= 2);
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
    while (/^[\d,]*\d[.,]$/.test(cur.s)) {
      const top = cur;
      const below = sorted.find(b => !used.has(b) && b !== top && /^[\d,.]+$/.test(b.s) && top.y - b.y > 0 && top.y - b.y < 14
        && b.x < top.x + top.w + 2 && b.x + b.w > top.x - 2);
      if (!below) break;
      used.add(below);
      cur = { s: cur.s + below.s, x: cur.x, y: cur.y, w: Math.max(cur.w, below.w) };
    }
    out.push(cur);
  }
  return out;
}

interface Column { field: Field | null; start: number; end: number }

/** Header = first line with a serial word and Qty; synonyms may span adjacent tokens. */
function findHeader(toks: PdfToken[]): { y: number; cols: Column[] } | null {
  const line = linesOf(toks).find(l => l.some(t => SERIAL_WORD.test(t.s)) && l.some(t => /^qty\.?$/i.test(t.s)));
  if (!line) return null;
  const groups: { field: Field | null; x: number }[] = [];
  for (let i = 0; i < line.length;) {
    let field: Field | null = null, n = 1;
    for (const k of [3, 2, 1]) {
      if (i + k > line.length) continue;
      const f = HEADER_SYNONYMS[line.slice(i, i + k).map(t => t.s.toLowerCase()).join(' ')];
      if (f) { field = f; n = k; break; }
    }
    if (!field && SERIAL_WORD.test(line[i].s)) field = 'sr_no';
    groups.push({ field, x: line[i].x });
    i += n;
  }
  const cols = groups.map((g, i) => ({ field: g.field, start: i === 0 ? -Infinity : g.x, end: i + 1 < groups.length ? groups[i + 1].x : Infinity }));
  return { y: line[0].y, cols };
}

const byReading = (a: PdfToken, b: PdfToken) => (b.y - a.y) || (a.x - b.x);

/** Serial tokens near the leftmost integer column, below the header, continuing the sequence. */
function anchorsOf(toks: PdfToken[], headerY: number, prev: number): { anchors: PdfToken[]; last: number } {
  const ints = toks.filter(t => /^\d{1,3}$/.test(t.s) && t.y < headerY);
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

function rowCells(band: PdfToken[], anchor: PdfToken, cols: Column[]): Partial<Record<Field, string>> {
  const perField = new Map<Field, string[]>();
  for (const c of cols) {
    if (!c.field) continue;
    const text = band.filter(t => { const m = t.x + t.w / 2; return m >= c.start && m < c.end; }).sort(byReading).map(t => t.s).join(' ');
    perField.set(c.field, [...(perField.get(c.field) ?? []), text]);
  }
  const cells: Partial<Record<Field, string>> = {};
  for (const [f, texts] of perField) { const v = pickCell(texts); if (v) cells[f] = v; }
  cells.sr_no = anchor.s;
  return cells;
}

export function readRows(pages: PdfToken[][]): { rows: RawRow[]; nonItemLines: NonItemLine[] } | { declined: string } {
  const rows: RawRow[] = [];
  const nonItemLines: NonItemLine[] = [];
  let cols: Column[] | null = null;   // a page without its own header reuses the previous one
  let prev = 0;
  for (let p = 0; p < pages.length; p++) {
    const toks = repairNumbers(pages[p]);
    const header = findHeader(toks);
    if (header) cols = header.cols;
    const { anchors, last } = cols ? anchorsOf(toks, header?.y ?? Infinity, prev) : { anchors: [], last: prev };
    prev = last;
    const bands = anchors.map((a, i) => {
      const gapUp = i > 0 ? (anchors[i - 1].y - a.y) / 2 : null;
      const gapDn = i + 1 < anchors.length ? (a.y - anchors[i + 1].y) / 2 : null;
      const up = gapUp ?? gapDn ?? 8;
      return { a, hi: a.y + up, lo: a.y - (gapDn ?? up) };
    });
    for (const { a, hi, lo } of bands) {
      const band = toks.filter(t => t.y < hi && t.y >= lo);
      rows.push({ sr: Number(a.s), page: p, cells: rowCells(band.filter(t => t !== a), a, cols!), text: [...band].sort(byReading).map(t => t.s).join(' ') });
    }
    for (const l of linesOf(toks)) {
      if (bands.some(b => l[0].y < b.hi && l[0].y >= b.lo)) continue;
      nonItemLines.push({ page: p, text: l.map(t => t.s).join(' '), nums: l.map(t => parseMoney(t.s)).filter((n): n is number => n !== null) });
    }
  }
  if (!cols) return { declined: 'no header line with a serial and Qty column found' };
  if (!rows.length) return { declined: 'no serial-numbered rows found under the header' };
  return { rows, nonItemLines };
}
