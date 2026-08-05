import type { AssessmentRow } from '@/types/assessment';
import { computeRowNet } from './row-net';

export interface GstBand {
  /** HSN code for parts, SAC for labour and paint. Blank when the row has none. */
  hsnSac: string;
  /** Full GST rate for this band, e.g. 18 or 28. */
  rate: number;
  /** Taxable base after depreciation. */
  base: number;
  cgst: number;
  sgst: number;
  /** base + cgst + sgst */
  amount: number;
}

export interface GstAggregate {
  bands: GstBand[];
  base: number;
  cgst: number;
  sgst: number;
  amount: number;
}

/**
 * Groups rows into GST bands for the report's GST SUMMARY.
 *
 * GST is per item — `row.gst` — never a hardcoded 18%. CGST and SGST are
 * always equal, each half the row's rate, so a 28% item splits 14/14.
 *
 * The taxable base is the assessed amount after depreciation, which is what
 * the specimen's "DEPRECIATED AMOUNT" column holds.
 *
 * Disposal rows carry no GST: their net already includes the disposal
 * percentage, and they land in a 0% band so section totals stay correct.
 */
export function aggregateGst(
  rows: AssessmentRow[],
  depRateFor: (row: AssessmentRow) => number
): GstAggregate {
  const byBand = new Map<string, GstBand>();

  for (const r of rows) {
    const { isDisposal, netBeforeGst } = computeRowNet(r, depRateFor(r));
    const rate = isDisposal ? 0 : (r.gst || 0);
    const hsnSac = r.hsnSac || '';
    const key = `${hsnSac}|${rate}`;

    const half = netBeforeGst * (rate / 2) / 100;

    const existing = byBand.get(key);
    if (existing) {
      existing.base += netBeforeGst;
      existing.cgst += half;
      existing.sgst += half;
      existing.amount += netBeforeGst + half * 2;
    } else {
      byBand.set(key, {
        hsnSac,
        rate,
        base: netBeforeGst,
        cgst: half,
        sgst: half,
        amount: netBeforeGst + half * 2,
      });
    }
  }

  const bands = Array.from(byBand.values()).sort((a, b) => a.rate - b.rate);

  return {
    bands,
    base: bands.reduce((s, b) => s + b.base, 0),
    cgst: bands.reduce((s, b) => s + b.cgst, 0),
    sgst: bands.reduce((s, b) => s + b.sgst, 0),
    amount: bands.reduce((s, b) => s + b.amount, 0),
  };
}
