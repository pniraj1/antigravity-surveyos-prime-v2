// Pure planner for "fix from estimate": compares an AI re-read of the estimate
// with the surveyor's sheet and proposes missing and changed rows. It never
// removes a row and never overwrites an edited assessed figure without a note.

import type { AssessmentRow } from '@/types/assessment';

type FixFields = Pick<AssessmentRow, 'estimated' | 'gst' | 'quantity' | 'particulars' | 'partType'>;

export interface EstimateFixChange {
  rowId: string;
  before: FixFields;
  after: FixFields;
}
export interface EstimateFixPlan {
  missing: AssessmentRow[];
  changed: EstimateFixChange[];
}
export interface EstimateFixPicks {
  missingIds: string[];
  changedRowIds: string[];
}

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
const pick = (r: AssessmentRow): FixFields => ({
  estimated: r.estimated,
  gst: r.gst,
  quantity: r.quantity,
  particulars: r.particulars,
  partType: r.partType,
});

const differs = (a: AssessmentRow, b: AssessmentRow): boolean =>
  Math.abs(a.estimated - b.estimated) > 0.5 ||
  a.gst !== b.gst ||
  (a.quantity ?? 1) !== (b.quantity ?? 1) ||
  norm(a.particulars) !== norm(b.particulars) ||
  a.partType !== b.partType;

/** The sheet in the AI's "previous data" shape, so a re-read can see what is already there. */
export function sheetToEstimateData(rows: AssessmentRow[]): {
  spare_parts: object[];
  labour_items: object[];
  painting_items: object[];
} {
  const toItem = (r: AssessmentRow) => ({
    sr_no: r.srNo,
    description: r.particulars,
    taxable_amount: r.estimated,
    gst_percent: r.gst,
    quantity: r.quantity,
  });
  const of = (section: AssessmentRow['section']) => rows.filter((r) => r.section === section).map(toItem);
  return { spare_parts: of('parts'), labour_items: of('labour'), painting_items: of('paint') };
}

export function planEstimateFix(sheetRows: AssessmentRow[], reReadRows: AssessmentRow[]): EstimateFixPlan {
  const claimed = new Set<string>();
  const matchOf = new Map<string, AssessmentRow>(); // re-read id -> sheet row
  const free = (s: AssessmentRow, r: AssessmentRow) => s.section === r.section && !claimed.has(s.id);

  // Serial numbers first, so a description match can't steal a row another serial owns.
  const bySerial = (r: AssessmentRow) =>
    r.srNo === undefined ? undefined : sheetRows.find((s) => free(s, r) && s.srNo === r.srNo);
  const byName = (r: AssessmentRow) =>
    sheetRows.find((s) => free(s, r) && norm(s.particulars) === norm(r.particulars));

  for (const finder of [bySerial, byName]) {
    for (const r of reReadRows) {
      if (matchOf.has(r.id)) continue;
      const s = finder(r);
      if (s) {
        claimed.add(s.id);
        matchOf.set(r.id, s);
      }
    }
  }

  const missing: AssessmentRow[] = [];
  const changed: EstimateFixChange[] = [];
  for (const r of reReadRows) {
    const s = matchOf.get(r.id);
    if (!s) missing.push(r);
    else if (differs(s, r)) changed.push({ rowId: s.id, before: pick(s), after: pick(r) });
  }
  return { missing, changed };
}

function insertMissing(rows: AssessmentRow[], add: AssessmentRow): AssessmentRow[] {
  const lastIndex = (pred: (r: AssessmentRow) => boolean) => {
    for (let i = rows.length - 1; i >= 0; i--) if (pred(rows[i])) return i;
    return -1;
  };
  const sameSection = (r: AssessmentRow) => r.section === add.section;
  const anchor =
    add.srNo === undefined
      ? lastIndex(sameSection)
      : lastIndex((r) => sameSection(r) && r.srNo !== undefined && r.srNo < add.srNo!);
  // ponytail: a serial lower than every numbered row goes to the section start; upgrade if sheets get exotic
  const first = rows.findIndex(sameSection);
  let at = anchor + 1;
  if (anchor === -1) at = first === -1 ? rows.length : add.srNo === undefined ? rows.length : first;
  const prev = anchor === -1 ? undefined : rows[anchor];
  const row = { ...add, source: prev?.source ?? ('estimate' as const) };
  return [...rows.slice(0, at), row, ...rows.slice(at)];
}

export function applyEstimateFix(
  rows: AssessmentRow[],
  plan: EstimateFixPlan,
  picks: EstimateFixPicks,
): AssessmentRow[] {
  const changes = new Map(
    plan.changed.filter((c) => picks.changedRowIds.includes(c.rowId)).map((c) => [c.rowId, c]),
  );
  let out = rows.map((row) => {
    const c = changes.get(row.id);
    if (!c) return row;
    const { reReadNote: _old, ...rest } = row;
    if (Math.abs(row.assessed - c.before.estimated) < 0.01) {
      return { ...rest, ...c.after, assessed: c.after.estimated };
    }
    return {
      ...rest,
      ...c.after,
      reReadNote: `Estimate re-read changed ₹${c.before.estimated} → ₹${c.after.estimated}`,
    };
  });

  const adds = plan.missing
    .filter((m) => picks.missingIds.includes(m.id))
    .sort((a, b) => (a.srNo ?? Infinity) - (b.srNo ?? Infinity));
  for (const m of adds) out = insertMissing(out, m);
  return out;
}
