import type { AssessmentRow, ClaimData } from '@/types';

export interface PreambleInputs {
  appointingOffice?: string;
  insurerName?: string;
  placeOfSurvey?: string;
  /** Estimate total inclusive of GST */
  estimateTotal: number;
  /** Net assessed loss */
  assessedTotal: number;
}

/** Format a number as "Rs. 1,180.00" using Indian digit grouping. */
function rs(n: number): string {
  const v = Number(n) || 0;
  return `Rs. ${v.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Estimate total inclusive of GST. Mirrors calculateAssessmentSummary's
 * estimate logic: every row's estimated amount plus its GST, except disposal
 * rows which carry no GST. No `allowed` filter, to match summary.totalEstimated.
 */
export function estimateTotalInclGst(rows: AssessmentRow[]): number {
  return rows.reduce((sum, r) => {
    const gstFactor = r.isDisposal ? 1 : 1 + ((r.gst ?? 18) / 100);
    return sum + (r.estimated || 0) * gstFactor;
  }, 0);
}

/** Build the default Final Survey narrative paragraph from explicit inputs. */
export function composeFinalSurveyPreamble(i: PreambleInputs): string {
  const instructedBy = (i.appointingOffice || i.insurerName || 'the insurer').trim();
  const place = (i.placeOfSurvey || 'the workshop').trim();
  return (
    `As per instructions received from ${instructedBy} to conduct the final survey of the ` +
    `Insured Vehicle (I.V.) at ${place}, the undersigned has visited the Garage/Workshop & ` +
    `snapped few photos before and after dismantling the vehicle & carried out the survey. ` +
    `The Insured/Repairer has submitted the estimate for ${rs(i.estimateTotal)}. ` +
    `After discussion with the Insured/Repairer, the loss has been finally assessed for ` +
    `${rs(i.assessedTotal)}, which is subject to the Policy Terms and Conditions. ` +
    `The loss has been worked out in detail as follows.`
  );
}

/** Convenience wrapper: derive the narrative from a claim + computed totals. */
export function preambleFromClaim(
  claim: ClaimData,
  estimateTotal: number,
  assessedTotal: number,
): string {
  return composeFinalSurveyPreamble({
    appointingOffice: claim.policy?.appointingOffice,
    insurerName: claim.policy?.insurerName,
    placeOfSurvey: claim.accident?.placeOfSurvey,
    estimateTotal,
    assessedTotal,
  });
}

export interface BillCheckPreambleInputs {
  appointingOffice?: string;
  insurerName?: string;
  /** Workshop's invoice total, inclusive of GST. */
  billTotal: number;
  /** Net liability this report allows. */
  allowedTotal: number;
}

/** Build the default Bill Check narrative paragraph from explicit inputs. */
export function composeBillCheckPreamble(i: BillCheckPreambleInputs): string {
  const instructedBy = (i.appointingOffice || i.insurerName || 'the insurer').trim();
  return (
    `As per instructions received from ${instructedBy}, the undersigned has verified the ` +
    `final invoice submitted by the Insured/Repairer against the assessment recorded in our ` +
    `Final Survey Report. The Insured/Repairer has billed ${rs(i.billTotal)}. On verification ` +
    `of the invoice against the assessed items, the liability has been finally assessed for ` +
    `${rs(i.allowedTotal)}, which is subject to the Policy Terms and Conditions. ` +
    `The verification has been worked out in detail as follows.`
  );
}

/** Convenience wrapper: derive the Bill Check narrative from a claim. */
export function billCheckPreambleFromClaim(
  claim: ClaimData,
  allowedTotal: number,
): string {
  return composeBillCheckPreamble({
    appointingOffice: claim.policy?.appointingOffice,
    insurerName: claim.policy?.insurerName,
    billTotal: claim.billCheck?.billTotal || 0,
    allowedTotal,
  });
}
