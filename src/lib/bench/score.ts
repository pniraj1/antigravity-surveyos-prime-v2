import { SECTIONS } from '../ai/row-check';
import { COUNTS_AGAINST_MODEL, type BenchError, type BenchRow, type EstimateSpan, type PdfProfile } from './types';

const TIE = 1; // ₹1 tolerance
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function toBenchRows(data: unknown): BenchRow[] {
  const out: BenchRow[] = [];
  const d = (data ?? {}) as Record<string, unknown>;
  for (const section of SECTIONS) {
    const list = d[section];
    if (!Array.isArray(list)) continue;
    for (const r of list as Record<string, unknown>[]) {
      const sr = num(r.sr_no);
      out.push({
        section,
        srNo: sr !== null && Number.isInteger(sr) && sr > 0 ? sr : null,
        description: String(r.description ?? ''),
        qty: num(r.quantity),
        rate: num(r.unit_price),
        amount: num(r.total_amount) ?? num(r.amount) ?? 0,
        taxable: num(r.taxable_amount),
        discount: num(r.discount_amount) ?? num(r.discount),
        page: (typeof r._page === 'number' ? r._page : 0) + 1,
      });
    }
  }
  return out;
}

/** Rows of one estimate, minus rows on unreadable pages. */
function inSpan(rows: BenchRow[], e: EstimateSpan, p: PdfProfile): BenchRow[] {
  return rows.filter(r => r.page >= e.firstPage && r.page <= e.lastPage && !p.unreadablePages.includes(r.page));
}

const err = (type: BenchError['type'], estimate: string, page: number | null, srNo: number | null, detail: string): BenchError =>
  ({ type, estimate, page, srNo, detail });

export function selfCheck(rows: BenchRow[], profile: PdfProfile): BenchError[] {
  const errors: BenchError[] = [];
  for (const e of profile.estimates) {
    const mine = inSpan(rows, e, profile);
    const basis = (r: BenchRow) => (e.totalsBasis === 'taxable' ? (r.taxable ?? 0) : r.amount);
    const sum = (list: BenchRow[]) => list.reduce((s, r) => s + basis(r), 0);
    if (e.grandTotal !== null && Math.abs(sum(mine) + (e.adjustment ?? 0) - e.grandTotal) > TIE) {
      errors.push(err('totals_mismatch', e.label, null, null, `rows add to ${sum(mine)}, printed ${e.grandTotal}`));
    }
    for (const s of SECTIONS) {
      const secRows = mine.filter(r => r.section === s);
      const sub = e.subtotals?.[s];
      if (sub !== undefined && Math.abs(sum(secRows) - sub) > TIE) {
        errors.push(err('totals_mismatch', e.label, null, null, `${s} rows add to ${sum(secRows)}, printed ${sub}`));
      }
      const seen = new Map<number, BenchRow>();
      let prev: BenchRow | undefined;
      for (const r of secRows) {
        if (r.srNo === null) continue;
        if (seen.has(r.srNo)) errors.push(err('serial_gap', e.label, r.page, r.srNo, `${s} serial ${r.srNo} repeats`));
        seen.set(r.srNo, r);
      }
      const nums = [...seen.keys()].sort((a, b) => a - b);
      for (let n = 1; n <= (nums[nums.length - 1] ?? 0); n++) {
        if (seen.has(n)) { prev = seen.get(n); continue; }
        errors.push(err('serial_gap', e.label, prev?.page ?? seen.get(nums.find(x => x > n)!)!.page, n, `${s} serial ${n} missing`));
      }
    }
    for (const r of mine) {
      if (r.qty !== null && r.rate !== null && r.taxable !== null && !r.discount && Math.abs(r.qty * r.rate - r.taxable) > TIE) {
        errors.push(err('wrong_amount', e.label, r.page, r.srNo, `${r.qty} x ${r.rate} != taxable ${r.taxable}`));
      }
    }
  }
  return errors;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

function sameDesc(a: BenchRow, b: BenchRow): boolean {
  const x = norm(a.description), y = norm(b.description);
  return x === y || (x !== '' && y !== '' && (x.includes(y) || y.includes(x))) || lev(x, y) <= 3;
}
const sameRow = (a: BenchRow, b: BenchRow) => sameDesc(a, b) && Math.abs(a.amount - b.amount) <= TIE;

export function compareToReference(rows: BenchRow[], ref: BenchRow[], profile: PdfProfile): BenchError[] {
  const errors: BenchError[] = [];
  for (const e of profile.estimates) {
    const cand = inSpan(rows, e, profile), want = inSpan(ref, e, profile);
    const pairOf = new Map<number, number>(); // cand index -> ref index
    const refTaken = new Set<number>();
    cand.forEach((c, ci) => {
      const wi = want.findIndex((w, i) => !refTaken.has(i) && w.section === c.section && sameRow(c, w));
      if (wi >= 0) { refTaken.add(wi); pairOf.set(ci, wi); }
    });
    const lostRef = want.map((_, i) => i).filter(i => !refTaken.has(i));
    const lostCand = cand.map((_, i) => i).filter(i => !pairOf.has(i));
    for (const ci of lostCand) {
      const c = cand[ci];
      const dup = [...pairOf.keys()].some(k => cand[k].section === c.section && sameRow(cand[k], c));
      const near = lostRef.find(i => want[i].section === c.section && sameDesc(c, want[i]) && !refTaken.has(i));
      if (dup) errors.push(err('duplicated', e.label, c.page, c.srNo, `"${c.description}" read twice`));
      else if (near !== undefined) {
        refTaken.add(near);
        errors.push(err('wrong_amount', e.label, c.page, c.srNo, `"${c.description}" ${c.amount}, expected ${want[near].amount}`));
      } else errors.push(err('invented', e.label, c.page, c.srNo, `"${c.description}" not in reference`));
    }
    for (const wi of lostRef.filter(i => !refTaken.has(i))) {
      errors.push(err('missed', e.label, want[wi].page, want[wi].srNo, `"${want[wi].description}" not read`));
    }
    const order = [...pairOf.entries()].sort((a, b) => a[0] - b[0]);
    const bad = order.findIndex((p, i) => i > 0 && p[1] < order[i - 1][1]);
    if (bad >= 0) errors.push(err('wrong_order', e.label, cand[order[bad][0]].page, cand[order[bad][0]].srNo, 'rows are in a different order than the reference'));
  }
  return errors;
}

export function passes(errors: BenchError[]): boolean {
  return !errors.some(e => COUNTS_AGAINST_MODEL.has(e.type));
}
