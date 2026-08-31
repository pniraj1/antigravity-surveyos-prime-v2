// ═══════════════════════════════════════════════════════════
// UIIC PORTAL SUMMARY
// The figures United India's surveyor portal asks for, in its shape.
// Spec: docs/superpowers/specs/2026-08-31-uiic-portal-summary-design.md
// ═══════════════════════════════════════════════════════════

import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import { getDepreciationRate } from './depreciation';
import { computeRowNet } from './row-net';
import { aggregateGst } from './gst-bands';

/** One row of the portal's GST table: a rate and its taxable amount. */
export interface UiicGstSlab {
  rate: number;
  amount: number;
}

export interface UiicPortalSummary {
  /** The portal's four parts boxes. Amounts are BEFORE depreciation. */
  parts: {
    ageBasedDep: number; // portal: ageBasedDep — metal
    dep50: number;       // portal: dep50       — plastic, rubber, tyres
    dep30: number;       // portal: dep30       — fibreglass
    nilDep: number;      // portal: nilDep      — glass, plus every disposal part
  };
  /** portal: gst28AmountP … gst0AmountP. Amounts are AFTER depreciation. */
  partsGst: UiicGstSlab[];
  labour: {
    labour: number;
    paint: number;
    lessPaintDep: number;
    totalLabour: number; // portal: labourCharge
  };
  /** portal: gst18AmountL, gst0AmountL. */
  labourGst: UiicGstSlab[];
  /** What rounding the four buckets to rupees costs against the exact sum. */
  tieOut: { rounded: number; exact: number; delta: number };
}

const rupees = (n: number) => Math.round(n);

/**
 * Collapses `aggregateGst`'s bands into one row per rate.
 *
 * `aggregateGst` bands by `hsnSac|rate` because the printed GST summary shows
 * the HSN. The portal has one field per rate, so several HSN codes at 18% are
 * one number here.
 */
function slabsByRate(
  rows: AssessmentRow[],
  depRateFor: (row: AssessmentRow) => number,
): UiicGstSlab[] {
  const byRate = new Map<number, number>();
  for (const band of aggregateGst(rows, depRateFor).bands) {
    byRate.set(band.rate, (byRate.get(band.rate) ?? 0) + band.base);
  }
  return Array.from(byRate.entries())
    .map(([rate, amount]) => ({ rate, amount: rupees(amount) }))
    .sort((a, b) => a.rate - b.rate);
}

/**
 * Builds the portal's assessment figures from the claim's rows.
 *
 * The parts boxes carry the amount BEFORE depreciation and the GST table
 * carries it AFTER. That asymmetry is deliberate: the portal's own help text
 * says "User should enter full amount for all parts. The system will calculate
 * depreciated amount automatically", while the GST it wants is on the net
 * assessed figure. Do not make the two consistent.
 */
export function uiicPortalSummary(
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
): UiicPortalSummary {
  const allowed = rows.filter((r) => r.allowed);

  const depRateFor = (r: AssessmentRow) =>
    r.depOverride !== undefined
      ? r.depOverride
      : getDepreciationRate(r.partType, ageMonths, depType);

  const netOf = (r: AssessmentRow) => computeRowNet(r, depRateFor(r)).netBeforeGst;

  const partRows = allowed.filter((r) => r.section === 'parts');
  const labourRows = allowed.filter((r) => r.section === 'labour');
  const paintRows = allowed.filter((r) => r.section === 'paint');

  let ageBasedDep = 0;
  let dep50 = 0;
  let dep30 = 0;
  let nilDep = 0;

  for (const r of partRows) {
    // Disposal first, and before the nil-depreciation policy. Both send the row
    // to nilDep, but only this branch keeps the disposal percentage — testing
    // the policy first would enter the full price of a used part.
    if (r.isDisposal) {
      nilDep += netOf(r);
      continue;
    }
    if (depType === 'nil') {
      nilDep += r.assessed;
      continue;
    }
    switch (r.partType) {
      case 'metal':
        ageBasedDep += r.assessed;
        break;
      case 'plastic':
        dep50 += r.assessed;
        break;
      case 'fiberglass':
        dep30 += r.assessed;
        break;
      default:
        nilDep += r.assessed;
    }
  }

  const labour = labourRows.reduce((sum, r) => sum + netOf(r), 0);
  const paint = paintRows.reduce((sum, r) => sum + r.assessed, 0);
  const paintNet = paintRows.reduce((sum, r) => sum + netOf(r), 0);

  const exact = ageBasedDep + dep50 + dep30 + nilDep;
  const rounded = rupees(ageBasedDep) + rupees(dep50) + rupees(dep30) + rupees(nilDep);

  return {
    parts: {
      ageBasedDep: rupees(ageBasedDep),
      dep50: rupees(dep50),
      dep30: rupees(dep30),
      nilDep: rupees(nilDep),
    },
    partsGst: slabsByRate(partRows, depRateFor),
    labour: {
      labour: rupees(labour),
      paint: rupees(paint),
      lessPaintDep: rupees(paint - paintNet),
      totalLabour: rupees(labour + paintNet),
    },
    labourGst: slabsByRate([...labourRows, ...paintRows], depRateFor),
    tieOut: { rounded, exact, delta: rounded - exact },
  };
}
