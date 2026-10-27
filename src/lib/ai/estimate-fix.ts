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
export type EstimateFixSource = 'estimate' | 'supplementary';
export interface EstimateFixPlan {
  missing: AssessmentRow[];
  changed: EstimateFixChange[];
  /** Which estimate the re-read was of. Absent means the original estimate. */
  source?: EstimateFixSource;
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

// Supplementary serials restart at 1, so serials only mean something within one family.
const inFamily = (r: AssessmentRow, source: EstimateFixSource) =>
  (r.source === 'supplementary') === (source === 'supplementary');

export function planEstimateFix(
  sheetRows: AssessmentRow[],
  reReadRows: AssessmentRow[],
  source: EstimateFixSource = 'estimate',
): EstimateFixPlan {
  const claimed = new Set<string>();
  const matchOf = new Map<string, AssessmentRow>(); // re-read id -> sheet row
  const free = (s: AssessmentRow, r: AssessmentRow) => s.section === r.section && !claimed.has(s.id);

  // Description first: with no printed serials the importer numbers rows by position, so a
  // serial match would mispair everything after one dropped or added row.
  const byName = (r: AssessmentRow) =>
    sheetRows.find((s) => free(s, r) && norm(s.particulars) === norm(r.particulars));
  const bySerial = (r: AssessmentRow) =>
    r.srNo === undefined
      ? undefined
      : sheetRows.find((s) => free(s, r) && inFamily(s, source) && s.srNo === r.srNo);

  for (const finder of [byName, bySerial]) {
    for (const r of reReadRows) {
      if (matchOf.has(r.id)) continue;
      const s = finder(r);
      if (s) {
        claimed.add(s.id);
        matchOf.set(r.id, s);
      }
    }
  }

  // A multi-page re-read can return the whole sheet once per page. A row the sheet already
  // holds (same section, description and estimate) is never "missing", and repeats of one
  // genuinely new row are proposed once.
  const onSheet = (r: AssessmentRow) =>
    sheetRows.some(
      (s) => s.section === r.section && norm(s.particulars) === norm(r.particulars) && Math.abs(s.estimated - r.estimated) <= 0.5,
    );
  // A re-read row that already matched a sheet row (changed or unchanged) names that row. Its
  // repeat copies are not new rows, even when the re-read changed the estimate (sheet 200 -> 250).
  const keyOf = (r: AssessmentRow) => `${r.section}|${norm(r.particulars)}|${r.estimated.toFixed(2)}`;
  const matchedKeys = new Set(reReadRows.filter((r) => matchOf.has(r.id)).map(keyOf));
  const seen = new Set<string>();
  const missing: AssessmentRow[] = [];
  const changed: EstimateFixChange[] = [];
  for (const r of reReadRows) {
    const s = matchOf.get(r.id);
    if (s) {
      if (differs(s, r)) changed.push({ rowId: s.id, before: pick(s), after: pick(r) });
      continue;
    }
    const key = keyOf(r);
    if (onSheet(r) || matchedKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    missing.push(r);
  }
  // Only a supplementary plan carries its source; the default plan keeps its original shape.
  return source === 'supplementary' ? { missing, changed, source } : { missing, changed };
}

function insertMissing(rows: AssessmentRow[], add: AssessmentRow, source: EstimateFixSource): AssessmentRow[] {
  const lastIndex = (pred: (r: AssessmentRow) => boolean) => {
    for (let i = rows.length - 1; i >= 0; i--) if (pred(rows[i])) return i;
    return -1;
  };
  const sameSection = (r: AssessmentRow) => r.section === add.section;
  const sameFamily = (r: AssessmentRow) => sameSection(r) && inFamily(r, source);
  const serial = add.srNo;
  // Only rows of the same family anchor: the other family's serials mean something else.
  const anchor = lastIndex(
    (r) =>
      sameFamily(r) &&
      (serial === undefined || (r.srNo !== undefined && r.srNo < serial)),
  );
  let at = anchor + 1;
  if (anchor === -1) {
    // ponytail: a serial lower than every numbered row goes to the section start; upgrade if sheets get exotic
    const first = rows.findIndex(sameFamily);
    if (first !== -1 && serial !== undefined) at = first;
    else {
      const end = lastIndex(sameFamily);
      const sectionEnd = end === -1 ? lastIndex(sameSection) : end;
      at = sectionEnd === -1 ? rows.length : sectionEnd + 1;
    }
  }
  const row: AssessmentRow = { ...add, source };
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
    const next: AssessmentRow = { ...row, ...c.after };
    delete next.reReadNote; // no undefined key: Firestore rejects it
    if (Math.abs(row.assessed - c.before.estimated) < 0.01) {
      return { ...next, assessed: c.after.estimated };
    }
    return {
      ...next,
      reReadNote: `Estimate re-read changed ₹${c.before.estimated} → ₹${c.after.estimated}`,
    };
  });

  const adds = plan.missing
    .filter((m) => picks.missingIds.includes(m.id) && !rows.some((r) => r.id === m.id)) // idempotent
    .sort((a, b) => (a.srNo ?? Infinity) - (b.srNo ?? Infinity));
  for (const m of adds) out = insertMissing(out, m, plan.source ?? 'estimate');
  return out;
}
