import type { ClaimData } from '@/types';
import type { AssessmentRow, BillCheckDetails, EstimateHeads, ExtraBillItem } from '@/types/assessment';
import type { RowUpdate } from './ref-paste';

export type { RowUpdate } from './ref-paste';

/** True when the claim's assessment was built from the final bill (UIIC from-bill mode). */
export function isFromBill(claim: { billCheck?: { baseDocument?: string } } | null | undefined): boolean {
  return claim?.billCheck?.baseDocument === 'final-bill';
}

export interface UploadLabels {
  doc: 'Workshop bill' | 'Estimate';
  amount: 'Billed' | 'Estimated';
  itemNo: 'Bill Item No.' | 'Est. Item No.';
  base: 'Estimate' | 'Billed';
  comparison: 'Estimate vs assessment comparison' | 'Bill vs assessment comparison';
}

/** What the document uploaded in Bill Check is called: the estimate on from-bill claims, else the workshop bill. */
export function uploadLabels(claim: { billCheck?: { baseDocument?: string } } | null | undefined): UploadLabels {
  return isFromBill(claim)
    ? { doc: 'Estimate', amount: 'Estimated', itemNo: 'Est. Item No.', base: 'Billed', comparison: 'Bill vs assessment comparison' }
    : { doc: 'Workshop bill', amount: 'Billed', itemNo: 'Bill Item No.', base: 'Estimate', comparison: 'Estimate vs assessment comparison' };
}

/** The row billed at its own figures (from-bill mode). */
export function selfBilled(row: AssessmentRow): Pick<AssessmentRow, 'billedTaxable' | 'billedAmount' | 'billStatus'> {
  return {
    billedTaxable: row.estimated,
    billedAmount: Math.round(row.estimated * (1 + (row.gst ?? 18) / 100)),
    billStatus: 'in-bill',
  };
}

/** Allowed rows whose billed figures are not their own figures yet. */
export function selfBillUpdates(rows: AssessmentRow[]): RowUpdate[] {
  const out: RowUpdate[] = [];
  for (const row of rows) {
    if (!row.allowed) continue;
    const own = selfBilled(row);
    if (row.billedTaxable === own.billedTaxable && row.billedAmount === own.billedAmount && row.billStatus === own.billStatus) continue;
    out.push({ id: row.id, updates: own });
  }
  return out;
}

/** From-bill claims: billed is always the row's own figure, so a changed estimated re-bills it. */
export function fromBillSelfBillUpdates(claim: ClaimData): RowUpdate[] {
  return isFromBill(claim) ? selfBillUpdates(claim.assessmentRows) : [];
}

/** A Final Bill read that did not start in Bill Check must not become the estimate of a from-bill claim. */
export function finalBillReadBlocked(claim: ClaimData | null | undefined, key: string, originTab: string | null | undefined): boolean {
  return key === 'final-bill' && isFromBill(claim) && originTab !== 'bill-check';
}

/** Ids of the lines rows hold (bill or also). */
export function heldLineIds(rows: AssessmentRow[]): Set<string> {
  return new Set(rows.flatMap((r) => [r.refMatch?.bill, ...(r.refMatch?.also ?? [])]).filter((l): l is ExtraBillItem => !!l).map((l) => l.id));
}

/** Rows setBillCheckUpload(kind) would change (refs cleared, billed figures replaced or cleared). */
export function rowsLostOnSwitch(claim: ClaimData, kind: 'final-bill' | 'estimate'): number {
  const fromBill = isFromBill(claim);
  if (kind === 'estimate' ? fromBill : !fromBill) return 0;
  const selfIds = new Set(kind === 'estimate' ? selfBillUpdates(claim.assessmentRows).map((u) => u.id) : []);
  return claim.assessmentRows.filter((r) =>
    r.refSrNo != null
    || (kind === 'estimate' ? selfIds.has(r.id) : r.allowed && (r.billedTaxable != null || r.billedAmount != null)),
  ).length;
}

/** The confirm text for switching the upload kind, or null when nothing is lost or kind is already the mode. */
export function switchPrompt(claim: ClaimData, kind: 'final-bill' | 'estimate'): string | null {
  if (kind === (isFromBill(claim) ? 'estimate' : 'final-bill')) return null;
  const losing = rowsLostOnSwitch(claim, kind);
  if (losing === 0 && !(claim.extraBillItems?.length)) return null;
  if (losing === 0) {
    return kind === 'final-bill'
      ? 'Switch to Final bill? The estimate lines read so far will be cleared.'
      : 'Switch to Estimate? The bill lines read so far will be cleared.';
  }
  return kind === 'final-bill'
    ? `Switch to Final bill? The estimate numbers and billed amounts on ${losing} items will be cleared, because a final bill will now be read for them.`
    : `Switch to Estimate? The bill item numbers and billed amounts on ${losing} items will be replaced by the bill's own figures, and the bill lines read so far will be cleared.`;
}

/** Bill no. / date / total from the Estimate-tab read, only where the field is empty. */
export function billHeaderFromEstimate(claim: ClaimData): Partial<BillCheckDetails> {
  const est = claim.extractedData?.estimate;
  if (!est || typeof est !== 'object') return {};
  const e = est as Record<string, unknown>;
  const bc = claim.billCheck;
  const out: Partial<BillCheckDetails> = {};
  if (!bc?.billNo && typeof e.bill_number === 'string' && e.bill_number.trim()) out.billNo = e.bill_number.trim();
  if (!bc?.billDate && typeof e.estimate_date === 'string' && e.estimate_date.trim()) out.billDate = e.estimate_date.trim();
  if (!bc?.billTotal && typeof e.gross_amount === 'number' && e.gross_amount > 0) out.billTotal = e.gross_amount;
  return out;
}

type Head = keyof EstimateHeads;

/** The head a row's money counts under: labour/paint by section, parts by material (else plastic). */
function headOf(section: string, material: string | undefined): Head {
  if (section === 'labour') return 'labour';
  if (section === 'paint') return 'paint';
  return material === 'metal' || material === 'glass' || material === 'fiberglass' ? material : 'plastic';
}

/** Default heads: matched rows by the surveyor's category, unmatched lines by what was read. */
export function estimateHeads(claim: ClaimData): EstimateHeads {
  const out: EstimateHeads = { metal: 0, plastic: 0, glass: 0, fiberglass: 0, labour: 0, paint: 0 };
  for (const r of claim.assessmentRows) {
    if (r.estimateAmount != null) out[headOf(r.section, r.partType)] += r.estimateAmount;
  }
  const held = heldLineIds(claim.assessmentRows);
  for (const x of claim.extraBillItems ?? []) {
    if (held.has(x.id)) continue;
    out[headOf(x.section, x.material ?? 'metal')] += x.taxableAmount;
  }
  return out;
}

/** Lines read, incl. GST, against the estimate's printed total; null when no estimate lines exist. */
export function estimateTotals(claim: ClaimData): { linesInclGst: number; printed: number } | null {
  const lines = new Map<string, ExtraBillItem>();
  for (const r of claim.assessmentRows) {
    for (const l of [r.refMatch?.bill, ...(r.refMatch?.also ?? [])]) if (l) lines.set(l.id, l);
  }
  const extras = (claim.extraBillItems ?? []).filter((x) => !lines.has(x.id));
  if (!lines.size && !extras.length) return null;
  const sum = (a: Iterable<ExtraBillItem>) => [...a].reduce((t, l) => t + l.amount, 0);
  const total = (claim.extractedData?.['final-bill'] as { total_amount?: unknown } | undefined)?.total_amount;
  return { linesInclGst: sum(lines.values()) + sum(extras), printed: typeof total === 'number' ? total : 0 };
}

/** True when the UIIC dialog must ask: from-bill, estimate lines exist, no confirmed heads. */
export function needsEstimateHeads(claim: ClaimData): boolean {
  return isFromBill(claim) && !claim.billCheck?.estimateHeads && estimateTotals(claim) != null;
}
