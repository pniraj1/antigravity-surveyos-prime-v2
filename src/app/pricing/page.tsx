import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { PLANS, TRIAL_DAYS, REFERRAL_TRIAL_BONUS_DAYS, REFERRER_REWARD_DAYS } from '@/lib/subscription/plans';

export const metadata: Metadata = {
  title: 'Pricing | Motor SurveyOS',
  description: `Motor survey software for IRDAI surveyors. ${TRIAL_DAYS}-day free trial, then simple monthly, quarterly or yearly plans. No credit card required.`,
  alternates: { canonical: '/pricing' },
};

const FAQS = [
  { q: 'How do I pay?', a: 'Pay by UPI to the ID shown on your renewal screen, then submit the transaction ID in the app. Your access is restored once the payment is verified, usually within a few hours.' },
  { q: 'What happens when my trial ends?', a: 'Your account becomes read-only. Existing claims stay visible and nothing is deleted — you simply cannot create or edit until you subscribe.' },
  { q: 'Can I cancel?', a: 'Yes, any time. Cancelling stops future payments; your access continues until the end of the period you have already paid for.' },
  { q: 'Do you charge GST?', a: 'No additional tax is currently charged. The price you see is the price you pay.' },
  { q: 'Is there a refund?', a: 'Paid periods are non-refundable — the free trial is the evaluation period. See our Refund Policy for details.' },
];

export default function PricingPage() {
  return (
    <MarketingShell
      eyebrow="Pricing"
      title="One claim pays for months of SurveyOS"
      subtitle={`A single motor survey fee covers your subscription several times over. Start with ${TRIAL_DAYS} days free — ${TRIAL_DAYS + REFERRAL_TRIAL_BONUS_DAYS} days with a referral code.`}
      wide
    >
      <section className="grid gap-4 sm:grid-cols-3 not-prose">
        {PLANS.map((plan, i) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-6 flex flex-col ${i === PLANS.length - 1 ? 'border-amber-400 bg-white shadow-md' : 'border-black/10 bg-white/60'}`}
          >
            <div className="text-caption font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">{plan.label}</div>
            <div className="text-3xl font-black text-slate-900">₹{plan.amount.toLocaleString('en-IN')}</div>
            <div className="text-caption text-slate-600 mt-1">
              {plan.months === 1 ? 'per month' : `for ${plan.months} months`}
            </div>
            {plan.note && <div className="text-caption font-semibold text-emerald-700 mt-2">{plan.note}</div>}
            <Link
              href="/signup"
              className="mt-6 text-center px-4 py-2.5 rounded-full text-xs font-bold bg-amber-400 text-slate-900 hover:scale-105 transition-transform"
            >
              Start Free Trial
            </Link>
          </div>
        ))}
      </section>

      <section>
        <p className="text-caption text-slate-600">
          Prices are in Indian Rupees. No additional tax is currently charged. No credit card is required for the trial.
        </p>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
        <h2 className="text-h3 font-bold text-slate-900 mb-3">Refer a surveyor, you both gain</h2>
        <p>
          Share your referral code from the app. They get {REFERRAL_TRIAL_BONUS_DAYS} extra trial days
          ({TRIAL_DAYS + REFERRAL_TRIAL_BONUS_DAYS} instead of {TRIAL_DAYS}), and when their first payment is
          verified you get {REFERRER_REWARD_DAYS} days added to your own subscription. No cap.
        </p>
      </section>

      <section>
        <h2 className="text-h3 font-bold text-slate-900 mb-4">Pricing questions</h2>
        <div className="space-y-4">
          {FAQS.map((f) => (
            <div key={f.q}>
              <p className="font-semibold text-slate-900 mb-1">{f.q}</p>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </MarketingShell>
  );
}
