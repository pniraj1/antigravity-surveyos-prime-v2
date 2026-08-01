import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'About | Motor SurveyOS',
  description: 'Motor SurveyOS is built for independent IRDAI-licensed surveyors in India, by someone who works alongside them.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <MarketingShell
      eyebrow="About"
      title="Built for the surveyor, not the insurer"
      subtitle="Most insurance software is sold to companies. This one is built for the person doing the survey."
    >
      <section>
        <h2 className="text-h3 font-bold text-slate-900 mb-4">Why it exists</h2>
        <p>
          An independent motor surveyor spends more time transcribing documents than assessing damage.
          Registration certificates, driving licences and policy schedules all say the same things in
          different layouts, and every one of them gets typed out by hand into a report.
        </p>
        <p className="mt-3">
          Motor SurveyOS reads those documents and drafts the report, so the surveyor spends their time on
          the judgement only they can make.
        </p>
      </section>

      <section>
        <h2 className="text-h3 font-bold text-slate-900 mb-4">The assessment stays yours</h2>
        <p>
          The AI extracts, reconciles and flags. It does not decide. Every figure in a report is reviewed
          and signed off by the licensed surveyor, whose name and IRDAI licence appear on it. We build the
          software this way deliberately: the professional responsibility for an assessment is not something
          a tool can hold.
        </p>
      </section>

      <section>
        <h2 className="text-h3 font-bold text-slate-900 mb-4">How we treat your data</h2>
        <ul className="space-y-2 pl-4">
          {[
            'Claim records are stored in India, in Google Cloud’s Mumbai region.',
            'Photographs never reach our servers — they stay on your device and in your own Google Drive.',
            'AI extraction runs with your own API key, from your browser to the provider. We store nothing from it.',
            'Only you can read your claims. Not other surveyors, and not us in the ordinary course of running the service.',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-slate-400 flex-shrink-0">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-h3 font-bold text-slate-900 mb-4">Who we are</h2>
        <div className="p-4 rounded-xl border border-black/5 bg-white/60">
          <p className="font-semibold text-slate-900 mb-1">SurveyOS, a sole proprietorship of Niraj Patil, Pune, India</p>
          <p className="mt-1">
            Contact: <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
