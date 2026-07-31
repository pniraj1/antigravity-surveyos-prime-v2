import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { TRIAL_DAYS } from '@/lib/subscription/plans';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy | Motor SurveyOS',
  description: 'How subscription cancellations and refunds work at Motor SurveyOS.',
  alternates: { canonical: '/refund' },
};

export default function RefundPage() {
  return (
    <MarketingShell
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      subtitle="Last updated: 31 July 2026 · Effective: 31 July 2026"
    >
      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">1. Your free trial is the evaluation period</h2>
        <p>
          Every account begins with a {TRIAL_DAYS}-day free trial with full access to all features, and no
          credit card is required. We ask you to satisfy yourself during the trial that Motor SurveyOS suits
          your practice, because paid periods are non-refundable.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">2. Paid subscriptions are non-refundable</h2>
        <p>
          Once a subscription period has been paid for and activated, the amount is non-refundable, whether
          the period is monthly, quarterly or yearly, and whether or not the software is used during it.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">3. You can cancel at any time</h2>
        <p>
          There is no lock-in and no cancellation fee. Simply do not submit a payment for the next period.
          Your access continues to the end of the period you have already paid for, after which the account
          becomes read-only: existing claims remain visible and nothing is deleted.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">4. Payment problems</h2>
        <p>
          If a payment was made but not credited, if an incorrect amount was transferred, or if a period was
          activated for the wrong duration, write to{' '}
          <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>{' '}
          with the UPI transaction ID. Genuine payment errors are corrected by adjusting your subscription
          period. We acknowledge such requests within 72 hours.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">5. If we end your access</h2>
        <p>
          If we suspend or terminate an account for a reason other than a breach of our Terms of Service,
          we refund the unused portion of the current paid period.
        </p>
      </section>
    </MarketingShell>
  );
}
