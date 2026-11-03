/**
 * How alike an estimate row and a bill line are, 0–100, with the reasons a
 * surveyor can read. Shared by the matcher (on upload) and the screen (ranking
 * candidates when the surveyor re-links by hand), so both agree on "likely".
 *
 * Pure: no store, no AI. The surveyor decides; this only says how sure the
 * pairing is and why.
 */

/** At or above: matched without asking. */
export const SURE_SCORE = 85;
/** Below: not matched at all; the line goes to unmatched bill items. */
export const MIN_SCORE = 40;
/** A doubtful match never scores above this, whatever else agrees. */
const CONFLICT_CAP = 45;

export interface PairRow {
  particulars: string;
  estimated?: number;
  assessed?: number;
  section?: string;
  partNumber?: string;
}

export interface PairBill {
  description: string;
  taxableAmount: number;
  section?: string;
  partNumber?: string;
}

export interface PairScore {
  score: number;
  reasons: string[];
}

// Position words decide which part it is. "LH"/"RH" are two letters, so a
// plain length filter used to drop them and score LH against RH as a match.
const SIDE: Record<string, string> = {
  lh: 'left', left: 'left', rh: 'right', right: 'right',
  front: 'front', frt: 'front', fr: 'front', rear: 'rear', rr: 'rear', back: 'rear',
  upper: 'upper', upr: 'upper', lower: 'lower', lwr: 'lower',
  inner: 'inner', inr: 'inner', outer: 'outer', otr: 'outer',
};
const OPPOSITES: [string, string][] = [['left', 'right'], ['front', 'rear'], ['upper', 'lower'], ['inner', 'outer']];
const NOISE = new Set(['assy', 'assembly', 'and', 'with', 'the', 'set', 'complete', 'comp', 'new']);

// The matcher scores every row against every line (400 × 400 on a big bill),
// so each description is split once.
// ponytail: unbounded, but keyed by distinct descriptions; an LRU if that ever grows.
const wordCache = new Map<string, string[]>();

function words(s: string): string[] {
  let w = wordCache.get(s);
  if (!w) {
    w = s.toLowerCase()
      .replace(/\b([lr])\s*\.\s*h\b\.?/g, '$1h')
      .split(/[^a-z0-9]+/)
      .filter(x => x && !NOISE.has(x) && (x.length > 2 || x in SIDE));
    wordCache.set(s, w);
  }
  return w;
}

/** Words as compared: side words collapse to one meaning (LH = LEFT). */
const tokens = (s: string) => new Set(words(s).map(w => SIDE[w] ?? w));

/** Raw words (lowercased) on either side that contradict the other: LH vs RH. */
export function sideConflicts(a: string, b: string): Set<string> {
  const ta = tokens(a);
  const tb = tokens(b);
  const clash = new Set<string>();
  for (const [x, y] of OPPOSITES) {
    const sa = [x, y].filter(v => ta.has(v));
    const sb = [x, y].filter(v => tb.has(v));
    if (sa.length && sb.length && !sa.some(v => sb.includes(v))) clash.add(x).add(y);
  }
  const out = new Set<string>();
  for (const w of [...words(a), ...words(b)]) if (clash.has(SIDE[w])) out.add(w);
  return out;
}

const OPPOSITE_LABEL: Record<string, string> = {
  left: 'Left vs right', front: 'Front vs rear', upper: 'Upper vs lower', inner: 'Inner vs outer',
};

const normPart = (s = '') => s.toLowerCase().replace(/[\s\-_.]/g, '');

export function scorePair(row: PairRow, bill: PairBill): PairScore {
  const rp = normPart(row.partNumber);
  if (rp && rp === normPart(bill.partNumber)) return { score: 100, reasons: ['Part no. matches'] };

  const reasons: string[] = [];
  const ta = tokens(row.particulars);
  const tb = tokens(bill.description);
  let shared = 0;
  ta.forEach(w => { if (tb.has(w)) shared += 1; });
  // Dice, not overlap-of-the-smaller: "BUMPER" is not a full match for
  // "FRONT BUMPER BRACKET".
  const desc = ta.size && tb.size ? (2 * shared) / (ta.size + tb.size) : 0;
  reasons.push(desc >= 0.99 ? 'Words match' : desc >= 0.5 ? 'Some words match' : 'Words differ');

  const sameSection = !row.section || !bill.section || row.section === bill.section;
  if (!sameSection) reasons.push('Different section');
  const sec = sameSection ? 1 : 0;

  const rowAmt = row.estimated || row.assessed || 0;
  let raw: number;
  if (rowAmt > 0 && bill.taxableAmount > 0) {
    const diff = Math.abs(bill.taxableAmount - rowAmt);
    const amt = diff <= 1 ? 1 : diff / rowAmt <= 0.05 ? 0.5 : 0;
    reasons.push(amt === 1 ? 'Amount matches' : amt ? 'Amount close' : 'Amount differs');
    raw = 0.55 * desc + 0.35 * amt + 0.1 * sec;
  } else {
    raw = 0.85 * desc + 0.15 * sec;
  }
  let score = Math.round(raw * 100);

  const clash = sideConflicts(row.particulars, bill.description);
  if (clash.size) {
    const kinds = new Set([...clash].map(w => SIDE[w]));
    for (const [x] of OPPOSITES) if (kinds.has(x)) reasons.unshift(OPPOSITE_LABEL[x]);
    score = Math.min(score, CONFLICT_CAP);
  }
  return { score, reasons };
}
