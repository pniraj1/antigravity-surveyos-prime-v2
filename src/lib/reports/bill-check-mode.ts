import type { ClaimData } from '@/types';
import type { AssessmentRow, BillCheckDetails } from '@/types/assessment';
import type { RowUpdate } from './ref-paste';

export type { RowUpdate } from './ref-paste';

/** True when the claim's assessment was built from the final bill (UIIC from-bill mode). */
export function isFromBill(claim: { billCheck?: { baseDocument?: string } } | null | undefined): boolean {
  return claim?.billCheck?.baseDocument === 'final-bill';
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
