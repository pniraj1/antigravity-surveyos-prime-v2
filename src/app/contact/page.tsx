import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Contact & Grievance Redressal | Motor SurveyOS',
  description: 'How to reach Motor SurveyOS for support, and how to raise a data protection grievance.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <MarketingShell
      eyebrow="Contact"
      title="Get in touch"
      subtitle="We are a small team and read every message ourselves."
    >
      <section>
        <h2 className="text-h3 font-bold text-slate-900 mb-4">Support</h2>
        <p>
          For help with the software, your subscription or a payment, email{' '}
          <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>.
          We reply within one working day.
        </p>
      </section>

      <section>
        <h2 className="text-h3 font-bold text-slate-900 mb-4">Who you are dealing with</h2>
        <div className="p-4 rounded-xl border border-black/5 bg-white/60">
          <p className="font-semibold text-slate-900 mb-1">SurveyOS, a sole proprietorship of Niraj Patil, Pune, India</p>
          <p className="mt-1">Motor SurveyOS is operated by SurveyOS. Any agreement you enter into for the use of this software is with the proprietor named above.</p>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-bold text-slate-900 mb-4">Grievance Redressal</h2>
        <p className="mb-3">
          Under India&apos;s Digital Personal Data Protection Act 2023, you may raise any complaint about how
          your personal data has been handled with our Grievance Officer.
        </p>
        <div className="p-4 rounded-xl border border-black/5 bg-white/60">
          <p><strong className="text-slate-900">Grievance Officer</strong>, Motor SurveyOS</p>
          <p>Email: <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a></p>
          <p className="mt-2 text-slate-500">We acknowledge every complaint within 72 hours and aim to resolve it within 30 days.</p>
        </div>
        <p className="mt-3">
          If you are not satisfied with our response, you may escalate the matter to the{' '}
          <strong>Data Protection Board of India</strong>.
        </p>
      </section>

      <section>
        <h2 className="text-h3 font-bold text-slate-900 mb-4">If your details appear in a survey</h2>
        <p>
          If you are an insured person or a third party whose details appear in a motor survey, please
          contact your insurer or the surveyor appointed to your claim. They decide what happens to that
          data; we only hold it on their behalf. If you write to us directly, we pass your request to the
          relevant surveyor and confirm to you that we have done so.
        </p>
      </section>
    </MarketingShell>
  );
}
