import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { TRIAL_DAYS, REFERRAL_TRIAL_BONUS_DAYS } from '@/lib/subscription/plans';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions | Motor SurveyOS',
  description: 'Answers about trials, payment, data storage, AI extraction and SurveyOS Sync.',
  alternates: { canonical: '/faq' },
};

const GROUPS: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: 'Getting started',
    items: [
      { q: 'Who can use Motor SurveyOS?', a: 'IRDAI-licensed surveyors and loss assessors practising in India. Every registration is reviewed manually against the licence details you provide before the account is activated.' },
      { q: 'How long is the free trial?', a: `${TRIAL_DAYS} days with full access, or ${TRIAL_DAYS + REFERRAL_TRIAL_BONUS_DAYS} days if you sign up using another surveyor's referral code. No credit card is required.` },
      { q: 'Why does approval take time?', a: 'Because a human checks it. We verify the licence details in each request before granting access, which usually takes less than a working day.' },
    ],
  },
  {
    heading: 'Payment',
    items: [
      { q: 'How do I pay?', a: 'By UPI. The renewal screen shows the UPI ID and the amount; you pay from any UPI app, then submit the transaction ID (and optionally a screenshot) in the app.' },
      { q: 'How long does verification take?', a: 'Usually a few hours. Until it is verified, your account shows the payment as under review so you know it has been received.' },
      { q: 'What happens when my subscription expires?', a: 'The account becomes read-only. Every claim stays visible and nothing is deleted; you simply cannot create or edit until you renew.' },
      { q: 'Can I get a refund?', a: 'Paid periods are non-refundable, which is why the free trial exists. You can cancel at any time and keep access to the end of the period you paid for.' },
    ],
  },
  {
    heading: 'Your data',
    items: [
      { q: 'Where is my data stored?', a: 'Claim records and account details are held in Google Cloud’s Mumbai region, in India. Photographs are never uploaded to our servers.' },
      { q: 'Can other surveyors see my claims?', a: 'No. Access rules are enforced per account at the database level, so a claim is readable only by the surveyor who created it.' },
      { q: 'What happens to my documents?', a: 'Documents you send for AI extraction go from your browser directly to the AI provider using your own key, and we keep no copy. Finished reports go to your own Google Drive.' },
      { q: 'How do I delete my account?', a: 'Email us and we erase your personal data within 30 days. Files already exported to your Google Drive stay in your Drive, under your control.' },
    ],
  },
  {
    heading: 'AI and reports',
    items: [
      { q: 'Do I need my own API key?', a: 'Yes, for document extraction. You add a free Google Gemini or Groq key in your profile, so your document processing runs on your own account and stays under your control.' },
      { q: 'How accurate is the extraction?', a: 'Good enough to draft from, never good enough to sign blindly. Every extracted field is shown for review, discrepancies between documents are flagged, and the assessment remains yours.' },
      { q: 'Which reports can it produce?', a: 'Spot survey, final survey, re-inspection and valuation reports, plus fee bills, in PDF, printable HTML, Word and Excel formats.' },
    ],
  },
  {
    heading: 'SurveyOS Sync',
    items: [
      { q: 'What is SurveyOS Sync?', a: 'A separate, optional product: a Telegram bot your clients can send claim documents to, which you can then pull into a claim inside Motor SurveyOS.' },
      { q: 'Do I have to use it?', a: 'No. It is off unless you connect it, and you can disconnect at any time from your profile. If you never connect it, no document of yours passes through it.' },
    ],
  },
  {
    heading: 'Referrals',
    items: [
      { q: 'How does the referral scheme work?', a: `Share your referral code from your profile. The surveyor who signs up with it gets ${REFERRAL_TRIAL_BONUS_DAYS} extra trial days, and once their first payment is verified you get 30 days added to your own subscription.` },
      { q: 'Is there a limit?', a: 'No. Every referred surveyor whose first payment is verified extends your subscription by another 30 days.' },
    ],
  },
];

export default function FaqPage() {
  const all = GROUPS.flatMap((g) => g.items);
  return (
    <MarketingShell
      eyebrow="Support"
      title="Frequently asked questions"
      subtitle="If your question is not here, email surveyosprime@gmail.com and we will answer it."
    >
      {GROUPS.map((group) => (
        <section key={group.heading}>
          <h2 className="text-base font-black text-slate-900 mb-3">{group.heading}</h2>
          <div className="space-y-4">
            {group.items.map((f) => (
              <div key={f.q}>
                <p className="font-bold text-slate-900">{f.q}</p>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: all.map((f) => ({
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
