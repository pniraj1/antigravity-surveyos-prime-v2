//
// Missed-row detection for estimates and final bills. Dealer software prints a
// serial number on every row and a gross at the end; section subtotals vary by
// format and are often not printed at all, so they are never checked here.
// Rows carry 0-based `_page` (and `_pageEnd` for a multi-page vision chunk) so a
// gap can be pinned to the page that needs a re-read.

export type Finding =
  | { kind: 'gap'; srNos: number[]; pages: number[] }
  | { kind: 'gross'; rows: number; printed: number };

export interface Gap { srNo: number; pages: number[] }

export interface RowCheck {
  gaps: Gap[];
  duplicates: number[];
  grossMismatch?: { rows: number; printed: number };
  /** ≥ 80 % of rows carry an integer sr_no — otherwise the gap check is skipped. */
  serialsUsable: boolean;
  /**
   * True only when the duplicate ratio is low enough that a duplicate really
   * is a repeated row, not the model numbering 1,2,3… itself per page (an
   * unnumbered document read one page per call). Dropping duplicates when
   * this is false would delete every row after the first page.
   */
  duplicatesDroppable: boolean;
}

export const SECTIONS = ['spare_parts', 'labour_items', 'painting_items'] as const;
type Section = typeof SECTIONS[number];

interface Row { sr_no?: unknown; total_amount?: unknown; _page?: number; _pageEnd?: number; [k: string]: unknown }

const SERIAL_COVERAGE = 0.8;
export const ONE_RUN_MAX_DUP_RATIO = 0.1;
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function rowsOf(data: unknown, s: Section): Row[] {
  const v = (data as Record<string, unknown> | null)?.[s];
  return Array.isArray(v) ? (v as Row[]) : [];
}

function serial(r: Row): number | null {
  const n = Number(r.sr_no);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function pagesOf(r: Row): number[] {
  if (typeof r._page !== 'number') return [];
  const end = typeof r._pageEnd === 'number' ? r._pageEnd : r._page;
  return Array.from({ length: end - r._page + 1 }, (_, i) => r._page! + i);
}

/** Same tolerance as the old math check: ₹5 floor, 0.1 % above ₹5,000. */
function tolerance(expected: number): number { return Math.max(5, expected * 0.001); }

function gapsIn(list: Row[]): Gap[] {
  const present = list.map(r => ({ sr: serial(r), r })).filter((x): x is { sr: number; r: Row } => x.sr !== null)
    .sort((a, b) => a.sr - b.sr);
  const gaps: Gap[] = [];
  for (let i = 1; i < present.length; i++) {
    const a = present[i - 1], b = present[i];
    if (b.sr <= a.sr + 1) continue;
    const pages = [...new Set([...pagesOf(a.r), ...pagesOf(b.r)])].sort((x, y) => x - y);
    for (let n = a.sr + 1; n < b.sr; n++) gaps.push({ srNo: n, pages });
  }
  return gaps;
}

function duplicatesIn(list: Row[]): number[] {
  const seen = new Set<number>(), dup = new Set<number>();
  for (const r of list) { const s = serial(r); if (s === null) continue; if (seen.has(s)) dup.add(s); seen.add(s); }
  return [...dup].sort((a, b) => a - b);
}

function perSectionMode(data: unknown): boolean {
  const startingAtOne = SECTIONS.filter(s => {
    const serials = rowsOf(data, s).map(serial).filter((n): n is number => n !== null);
    return serials.length > 0 && Math.min(...serials) === 1;
  });
  return startingAtOne.length >= 2;
}

/** Digits of `n` (commas removed, integer part) appear in some page text. */
function grossPrinted(n: number, pageTexts?: string[]): boolean {
  if (!pageTexts) return true;                              // vision: nothing to verify against
  const needle = String(Math.trunc(n));                     // "226860" — integer part, so 2,26,860.85 matches
  return pageTexts.some(t => t.replace(/,/g, '').includes(needle));
}

export function countRows(data: unknown): number {
  return SECTIONS.reduce((n, s) => n + rowsOf(data, s).length, 0);
}

export function rowCheck(data: unknown, pageTexts?: string[]): RowCheck {
  const all = SECTIONS.flatMap(s => rowsOf(data, s));
  const numbered = all.filter(r => serial(r) !== null).length;
  const serialsUsable = all.length > 0 && numbered / all.length >= SERIAL_COVERAGE;

  let gaps: Gap[] = [], duplicates: number[] = [], duplicatesDroppable = false;
  if (serialsUsable) {
    if (perSectionMode(data)) {
      let sectionNumbered = 0, sectionDuplicates = 0;
      for (const s of SECTIONS) {
        const rows = rowsOf(data, s);
        sectionNumbered += rows.filter(r => serial(r) !== null).length;
        sectionDuplicates += duplicatesIn(rows).length;
      }
      gaps = SECTIONS.flatMap(s => gapsIn(rowsOf(data, s)));
      duplicates = [...new Set(SECTIONS.flatMap(s => duplicatesIn(rowsOf(data, s))))].sort((a, b) => a - b);
      duplicatesDroppable = sectionDuplicates / Math.max(1, sectionNumbered) <= ONE_RUN_MAX_DUP_RATIO;
    } else {
      duplicates = duplicatesIn(all);
      // ponytail: a heavily duplicated union that does not start at 1 per section
      // is an unknown numbering scheme — the model numbered rows itself per
      // page. Report duplicates, skip gaps, and don't drop them either.
      duplicatesDroppable = duplicates.length / Math.max(1, numbered) <= ONE_RUN_MAX_DUP_RATIO;
      gaps = duplicatesDroppable ? gapsIn(all) : [];
    }
  }

  const d = data as Record<string, unknown> | null;
  const printed = Number(d?.gross_amount) || Number(d?.total_amount) || 0;
  const rows = all.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const check: RowCheck = { gaps, duplicates, serialsUsable, duplicatesDroppable };
  if (printed > 0 && rows > 0 && Math.abs(rows - printed) > tolerance(printed) && grossPrinted(printed, pageTexts)) {
    check.grossMismatch = { rows, printed };
  }
  return check;
}

function mapSections<T>(data: T, fn: (rows: Row[], s: Section) => Row[]): T {
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const s of SECTIONS) if (Array.isArray(out[s])) out[s] = fn(out[s] as Row[], s);
  return out as T;
}

/** Tag every row of a chunk's fragment with the 0-based page range it came from. */
export function tagRows<T>(fragment: T, first: number, last: number): T {
  return mapSections(fragment, rows => rows.map(r => last > first ? { ...r, _page: first, _pageEnd: last } : { ...r, _page: first }));
}

export function stripPageTags<T>(data: T): T {
  return mapSections(data, rows => rows.map(({ _page, _pageEnd, ...rest }) => rest));
}

/** Keep the first row per serial within each section. */
export function dropDuplicates<T>(data: T): T {
  return mapSections(data, rows => {
    const seen = new Set<number>();
    return rows.filter(r => { const s = serial(r); if (s === null) return true; if (seen.has(s)) return false; seen.add(s); return true; });
  });
}

/** Insert rows from `fragment` whose serial is absent from every section of `data`. Never replaces. */
export function mergeBySerial<T>(data: T, fragment: unknown): T {
  const have = new Set(SECTIONS.flatMap(s => rowsOf(data, s).map(serial)).filter((n): n is number => n !== null));
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const s of SECTIONS) {
    const fresh = rowsOf(fragment, s).filter(r => { const n = serial(r); if (n === null || have.has(n)) return false; have.add(n); return true; });
    if (fresh.length) out[s] = [...rowsOf(data, s), ...fresh];
  }
  return out as T;
}

export function toFindings(check: RowCheck): Finding[] {
  const out: Finding[] = [];
  if (check.gaps.length) {
    out.push({
      kind: 'gap',
      srNos: check.gaps.map(g => g.srNo),
      pages: [...new Set(check.gaps.flatMap(g => g.pages))].sort((a, b) => a - b),
    });
  }
  if (check.grossMismatch) out.push({ kind: 'gross', ...check.grossMismatch });
  return out;
}

function list(ns: number[]): string {
  return ns.length <= 1 ? String(ns[0] ?? '') : `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
}

export function describeFinding(f: Finding): string {
  if (f.kind === 'gross') return `Rows add up to ₹${INR.format(f.rows)} but the bill says ₹${INR.format(f.printed)}`;
  const one = f.srNos.length === 1;
  const pages = f.pages.map(p => p + 1);
  const where = pages.length === 0 ? '' : pages.length === 1 ? ` (page ${pages[0]})` : ` (pages ${pages.join(', ')})`;
  return `${one ? 'Row' : 'Rows'} ${list(f.srNos)} ${one ? 'looks' : 'look'} missing${where}`;
}
