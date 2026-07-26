import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Motor SurveyOS',
  description: 'Privacy policy for Motor SurveyOS and SurveyOS Sync. How we handle your data under India\'s DPDP Act 2023.',
  alternates: { canonical: 'https://motorsurveyos.web.app/privacy' },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-black text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-xs mb-10">Last updated: 25 July 2026 · Effective: 25 July 2026 · Version 2026-07-25</p>

        <div className="mb-10 p-5 rounded-2xl border border-black/5 bg-white/60">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">In short</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {[
              'Your claim data is stored in India (Mumbai region) and is visible only to you.',
              'Photographs never reach our servers — they stay on your device and in your own Google Drive.',
              'AI document extraction runs with your own API key, directly from your browser to the AI provider. We do not store what is processed.',
              'For claim data we act on your instructions only. We do not sell data, and we do not use insured persons’ identities to build our own products.',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-amber-400 flex-shrink-0">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">1. Who We Are</h2>
            <p>Motor SurveyOS is operated by SurveyOS (contact: <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>). We provide AI-powered motor insurance survey software and document tracking tools for IRDAI-licensed surveyors and loss assessors in India.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">2. What Data We Collect</h2>
            <p className="mb-3">We collect only what is necessary to provide our services:</p>
            <ul className="space-y-2 pl-4">
              {[
                'Google account information (name, email address) collected at sign-in via Google OAuth',
                'IRDAI licence number and surveyor verification details submitted during registration',
                'Insurance claim data you create within the platform (vehicle numbers, contact details, document names)',
                'Documents you upload for AI extraction (RC books, driving licences, insurance policies)',
                'Usage data (pages visited, features used) for product improvement',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-amber-400 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">3. How We Use Your Data</h2>
            <ul className="space-y-2 pl-4">
              {[
                'To authenticate your account and verify your IRDAI licence status',
                'To process documents through our AI extraction engine',
                'To sync generated reports and documents to your Google Drive',
                'To send you product updates and important service communications',
                'To comply with legal obligations under applicable Indian law',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-amber-400 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">4. Document Storage</h2>
            <p className="mb-3">We do not permanently store your client documents on our servers. Documents uploaded for AI extraction are processed in memory and the extracted data is returned to you. Final reports and documents are exported directly to <strong>your own Google Drive</strong> account — we do not retain copies.</p>
            <p>SurveyOS Sync stores documents via the Telegram Bot API, which is subject to <a href="https://telegram.org/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">Telegram's Privacy Policy</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">5. Third-Party Services</h2>
            <p className="mb-3">We use the following third-party services:</p>
            <ul className="space-y-2 pl-4">
              {[
                'Google Firebase — authentication and database',
                'Google Drive API — report and document export',
                'Google Gemini / AI APIs — document data extraction',
                'Telegram Bot API — SurveyOS Sync document handling',
                'Cloudflare Workers — backend API infrastructure',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-amber-400 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">6. Our Role: Two Different Relationships</h2>
            <p className="mb-3">The law treats these two situations differently, and it matters for how your data is handled:</p>
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-black/5 bg-white/60">
                <p className="font-black text-slate-900 text-sm mb-1">Your account — we are the Data Fiduciary</p>
                <p>Your name, email, IRDAI licence number and subscription details are ours to look after. We decide how they are used, and you can exercise all of your DPDP rights with us directly.</p>
              </div>
              <div className="p-4 rounded-xl border border-black/5 bg-white/60">
                <p className="font-black text-slate-900 text-sm mb-1">Claim data — we are a Data Processor</p>
                <p>Details of insured persons, drivers and third parties are processed <strong>only on your instructions</strong>, so that you can produce your survey report. We do not decide what happens to that data, we do not use it for our own purposes, and we do not sell or share it.</p>
              </div>
            </div>
            <p className="mt-3">Insured persons and third parties never use Motor SurveyOS and cannot give consent to us directly. Their data reaches us because an insurer appointed a licensed surveyor, and that surveyor uses our software. Every surveyor confirms this appointment when they register.</p>
            <p className="mt-3">Our internal analysis features (used to suggest repair-cost benchmarks) deliberately exclude all identifying details — no names, phone numbers, policy numbers or vehicle registration numbers.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">7. Where Your Data Is Stored</h2>
            <p className="mb-3">Claim records, account details and our processing servers are hosted on Google Cloud infrastructure in the <strong>Mumbai region (asia-south1), India</strong>.</p>
            <p>Some data necessarily leaves India because of features you choose to use:</p>
            <ul className="space-y-2 pl-4 mt-3">
              {[
                'AI document extraction — documents are sent from your browser directly to the AI provider you selected, using your own API key. We are not in the middle of this and store nothing from it.',
                'Google Drive backup — files go to your own Google account, under your own Google settings.',
                'SurveyOS Sync (optional) — documents collected through the Telegram bot are held on Telegram’s servers.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-amber-400 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">8. SurveyOS Sync (Optional)</h2>
            <p>SurveyOS Sync is a <strong>separate product</strong> with its own Telegram bot, which you may choose to connect to Motor SurveyOS. It is off by default. Connecting it means documents your clients send to the bot are stored on Telegram&apos;s servers and can be pulled into your claims. You can disconnect at any time from your Profile, which immediately revokes the link. If you never connect it, none of this applies to you.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">9. Your Rights Under DPDP Act 2023</h2>
            <p className="mb-3">Under India's Digital Personal Data Protection Act 2023, you have the right to:</p>
            <ul className="space-y-2 pl-4">
              {[
                'Access the personal data we hold about you',
                'Correct inaccurate or incomplete personal data',
                'Request erasure of your personal data',
                'Withdraw consent for data processing at any time',
                'Nominate a person to exercise your rights on your behalf',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-amber-400 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">To exercise any of these rights over your own account, email <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>. We respond within 72 hours.</p>

            <div className="mt-4 p-4 rounded-xl border border-black/5 bg-white/60">
              <p className="font-black text-slate-900 text-sm mb-1">If you are an insured person or a third party</p>
              <p>If your details appear in a motor survey and you want to see, correct or erase them, please contact <strong>your insurer</strong> or the surveyor appointed to your claim. They decide what happens to that data; we only hold it on their behalf and are not permitted to alter or release it on our own initiative. If you contact us directly, we will pass your request to the relevant surveyor and tell you we have done so.</p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">10. Data Retention</h2>
            <ul className="space-y-2 pl-4">
              {[
                'Claim records — kept until the surveyor deletes them. Surveyors control their own claims and may delete any of them at any time.',
                'Account details — kept while the account is active, and erased within 30 days of account deletion.',
                'Documents in your Google Drive — governed by your own Google account; deleting your Motor SurveyOS account does not delete them.',
                'Internal cost-benchmark records — contain no identifying details, and are removed when the claim they were derived from is deleted.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-amber-400 flex-shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">Where a law or IRDAI regulation requires records to be kept for longer, we retain them for that period only.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">11. Grievance Redressal</h2>
            <p className="mb-3">If you have a complaint about how your personal data has been handled, contact our Grievance Officer:</p>
            <div className="p-4 rounded-xl border border-black/5 bg-white/60">
              <p><strong className="text-slate-900">Grievance Officer</strong>, Motor SurveyOS</p>
              <p>Email: <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a></p>
              <p className="mt-2 text-slate-500">We acknowledge every complaint within 72 hours and aim to resolve it within 30 days.</p>
            </div>
            <p className="mt-3">If you are not satisfied with our response, you may escalate your complaint to the <strong>Data Protection Board of India</strong>.</p>
          </section>

          <section>
            <h2 className="text-base font-black text-slate-900 mb-3">12. Changes to This Policy</h2>
            <p>If we make a material change, we will update the version and date at the top of this page and notify signed-in surveyors in the app. The version recorded against your account reflects the wording you agreed to when you registered.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-black/5 text-xs text-slate-400 flex gap-4">
          <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
          <Link href="/landing" className="hover:text-slate-600 transition-colors">Back to Home</Link>
        </div>
      </article>
    </div>
  );
}
