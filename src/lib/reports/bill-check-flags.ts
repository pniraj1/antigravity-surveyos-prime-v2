import type { AssessmentRow } from '@/types/assessment';

/**
 * What the Bill Check screen has noticed and the surveyor has not yet answered.
 *
 * Screen only — none of this is ever printed. It is a check for the surveyor,
 * not a statement to the insurer, and it is resolved or accepted before the
 * report exists.
 *
 * Lives beside the projection rather than under lib/calculations so bill-check
 * logic stays together and the dependency runs reports → calculations, never
 * back.
 */
export type BillFlagKind =
  | 'billed-below'     // cap bit; the claim already dropped
  | 'billed-above'     // the assessment holds; the surveyor may raise it
  | 'billed-rejected'  // the workshop billed for something rejected at survey
  | 'ambiguous';       // the bill was read with low confidence

export interface BillFlag {
  rowId: string;
  kind: BillFlagKind;
  /** Blocks printing until the row is verified. */
  blocking: boolean;
  estimate: number;
  assessed: number;
  billed: number;
  /** billed − assessed. Negative when the bill came in lower. */
  delta: number;
  heading: string;
  detail: string;
}

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rs = (n: number) => `₹${INR.format(n)}`;

/**
 * Every row where the bill and the assessment disagree, plus the two advisory
 * cases the screen already detects and never showed.
 *
 * A row with no billed figure does not appear here: that is the pending gate's
 * business, and flagging it twice would say the same thing in two voices.
 */
export function billCheckFlags(rows: AssessmentRow[]): BillFlag[] {
  const flags: BillFlag[] = [];

  for (const r of rows) {
    const billed = r.billedTaxable;

    if (r.allowed === false) {
      if ((billed ?? 0) > 0) {
        flags.push({
          rowId: r.id,
          kind: 'billed-rejected',
          blocking: false,
          estimate: r.estimated,
          assessed: 0,
          billed: billed ?? 0,
          delta: billed ?? 0,
          heading: 'The workshop billed for an item you rejected',
          detail:
            `You disallowed this at final survey. The invoice bills ${rs(billed ?? 0)} for it. ` +
            `It carries no liability — the report shows it as billed against rejected items, ` +
            `so the insurer sees the claim was made and refused.`,
        });
      }
      continue;
    }

    if (r.billStatus === 'not-in-bill' || billed === undefined) continue;

    if (billed !== r.assessed && !r.billVerified) {
      const below = billed < r.assessed;
      // The estimate is what tells you WHY the bill differs, and it changes the
      // advice: a surveyor who allowed the estimate in full is looking at an
      // underpriced estimate, not a workshop pushing back on a cut.
      const allowedInFull = r.assessed >= r.estimated;
      flags.push({
        rowId: r.id,
        kind: below ? 'billed-below' : 'billed-above',
        blocking: true,
        estimate: r.estimated,
        assessed: r.assessed,
        billed,
        delta: billed - r.assessed,
        heading: below
          ? 'The workshop billed less than you allowed'
          : 'Priced higher than the estimate you assessed from',
        detail: below
          ? `You allowed ${rs(r.assessed)} and the invoice shows ${rs(billed)}. ` +
            `The claim is capped at the billed figure, so it now reads ${rs(billed)}. ` +
            `Check the bill was read correctly.`
          : allowedInFull
          ? `You allowed the estimate in full at ${rs(r.assessed)}. The workshop has invoiced ` +
            `${rs(billed)}, which suggests the estimate underpriced this item. ` +
            `The claim holds at ${rs(r.assessed)} unless you raise it.`
          : `You reduced this from the estimate of ${rs(r.estimated)} to ${rs(r.assessed)} at ` +
            `final survey, and the invoice has come back at ${rs(billed)}. ` +
            `The claim holds at ${rs(r.assessed)} unless you raise it.`,
      });
      continue;
    }

    if (r.billRemarks?.startsWith('Ambiguous match')) {
      flags.push({
        rowId: r.id,
        kind: 'ambiguous',
        blocking: false,
        estimate: r.estimated,
        assessed: r.assessed,
        billed,
        delta: billed - r.assessed,
        heading: 'This line was matched to the invoice with low confidence',
        detail: 'Check the billed figure against the bill before issuing.',
      });
    }
  }

  return flags;
}

export interface InvoiceReconciliation {
  /** Σ over billed rows of (billedTaxable + its own GST). */
  lineTotal: number;
  invoiceTotal: number;
  /** Absolute difference. */
  gap: number;
  reconciles: boolean;
}

/**
 * The invoice total the surveyor typed against the sum of the line items.
 *
 * No discounts exist in this domain, so a gap is always an error — a line
 * missed or misread when the bill was read. That means this warning has no
 * legitimate source of false positives, which is what makes it worth heeding.
 *
 * An invoice total of zero means it has not been entered yet, so nothing is
 * asserted about it.
 */
export function reconcileInvoice(rows: AssessmentRow[], invoiceTotal: number): InvoiceReconciliation {
  const lineTotal = rows.reduce((s, r) => {
    if (r.billedTaxable === undefined) return s;
    const gst = r.isDisposal ? 0 : (r.gst ?? 18) / 100;
    return s + r.billedTaxable * (1 + gst);
  }, 0);
  const gap = Math.abs(lineTotal - invoiceTotal);
  return {
    lineTotal,
    invoiceTotal,
    gap,
    reconciles: invoiceTotal === 0 || gap <= 1,
  };
}
