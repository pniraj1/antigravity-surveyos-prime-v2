import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | Motor SurveyOS',
  description: 'Terms of service for Motor SurveyOS and SurveyOS Sync.',
  alternates: { canonical: 'https://motorsurveyos-in.web.app/terms' },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F3] font-sans text-slate-900">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-black/5 bg-[#F5F5F3]/90 backdrop-blur-xl">
        <Link href="/landing" className="text-sm font-black text-slate-900 tracking-tight">Motor SurveyOS</Link>
        <Link href="/landing" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm">
          Start Free Trial
        </Link>
      </nav>

      <article className="max-w-2xl mx-auto px-5 py-16">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Legal</div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-slate-400 text-xs mb-10">Last updated: 31 July 2026 · Effective: 31 July 2026 · Version 2026-07-31</p>

        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">1. Acceptance</h2>
            <p>By creating an account or using Motor SurveyOS or SurveyOS Sync ("the Services"), you agree to these Terms. If you do not agree, do not use the Services. The Services are intended for IRDAI-licensed motor insurance surveyors and loss assessors in India. These Terms are an agreement between you and <strong>SurveyOS, a sole proprietorship of Niraj Patil, Pune, India</strong>, which operates Motor SurveyOS.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">2. Eligibility</h2>
            <p>You must hold a valid IRDAI surveyor or loss assessor licence to use the Services. By registering, you confirm that your IRDAI licence is current and that you are legally permitted to conduct motor insurance surveys in India.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">3. Subscription and Payment</h2>
            <p className="mb-3">Motor SurveyOS is offered on a subscription basis: ₹799 per month, ₹2,199 per quarter, or ₹7,990 per year. Every new account starts with a 14-day free trial (28 days when you sign up with a referral code); no credit card is required for the trial. At the end of the trial, continued access requires a paid subscription. Prices are in Indian Rupees; no additional tax is currently charged.</p>
            <p>SurveyOS Sync is included with your Motor SurveyOS subscription at no additional cost.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="space-y-2 pl-4">
              {[
                'Use the Services for any purpose other than legitimate motor insurance survey work',
                'Upload documents belonging to clients without their knowledge or consent',
                'Attempt to reverse engineer, copy, or resell the Services',
                'Use the Services to generate fraudulent or misleading survey reports',
                'Share your account credentials with others',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-amber-400 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">5. AI-Generated Content</h2>
            <p>Motor SurveyOS uses AI to extract data from documents and assist in report generation. You are responsible for reviewing all AI-generated content before submitting any report to an insurance company. SurveyOS does not guarantee the accuracy of AI extraction and is not liable for errors in submitted reports.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">6. Data and Documents</h2>
            <p>You retain ownership of all data and documents you upload. By uploading documents, you grant SurveyOS a limited, temporary licence to process them for the purpose of providing the Services. We do not claim ownership of your data. See our <Link href="/privacy" className="text-amber-600 hover:underline">Privacy Policy</Link> for details on data handling.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">7. Termination</h2>
            <p>You may cancel your account at any time by emailing <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>. We reserve the right to suspend or terminate accounts that violate these Terms, with or without notice.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, SurveyOS is not liable for any indirect, incidental, or consequential damages arising from your use of the Services. Our total liability for any claim shall not exceed the amount you paid in the 3 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">9. Governing Law</h2>
            <p>These Terms are governed by the laws of India. Any dispute arising out of or in connection with them is subject to the exclusive jurisdiction of the courts of Pune, Maharashtra.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">10. Contact</h2>
            <p>For any questions about these Terms, contact us at <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-black/5 text-xs text-slate-400 flex gap-4">
          <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
          <Link href="/landing" className="hover:text-slate-600 transition-colors">Back to Home</Link>
        </div>
      </article>
    </div>
  );
}
