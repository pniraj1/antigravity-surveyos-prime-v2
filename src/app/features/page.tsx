import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Features | AI Motor Survey Software | Motor SurveyOS',
  description: 'Automatic document extraction, spot and final survey reports, offline-first storage, Google Drive backup and fee bills — everything an IRDAI surveyor needs.',
  alternates: { canonical: '/features' },
};

const FEATURES: { title: string; body: string; image?: string }[] = [
  {
    title: 'Read documents instead of typing them',
    body: 'Point the app at a registration certificate, driving licence or policy schedule and the fields arrive filled in. Conflicting values between documents are flagged for you rather than silently accepted, so mismatches surface before they reach the insurer.',
    image: 'report-assessment.png',
  },
  {
    title: 'Spot survey reports in minutes',
    body: 'Capture damage at the site, list the affected parts, and the spot report assembles itself — driver particulars, licence verification, accident details and the damage schedule, in the format insurers expect.',
    image: 'report-spot.png',
  },
  {
    title: 'Final survey reports that reconcile themselves',
    body: 'Assessment rows carry estimate and assessed values per part, with depreciation and material splits totalled for you. The final report, the fee bill and the summary all read from the same figures, so they cannot disagree.',
    image: 'report-final.png',
  },
  {
    title: 'Every format an insurer asks for',
    body: 'The same claim exports as a PDF, a printable HTML report, a Word document or an Excel sheet. Re-inspection and valuation reports use the same data, so nothing is re-entered.',
    image: 'report-final-pdf.png',
  },
  {
    title: 'Works when the network does not',
    body: 'Claims are stored on the device first, so a basement parking lot or a highway with no signal does not stop a survey. Everything syncs to your cloud vault when the connection returns.',
  },
  {
    title: 'Backed up to your own Google Drive',
    body: 'Finished reports and photographs are exported to your own Drive account, in folders per claim. They are yours: we cannot read them, and they remain if you ever stop using the software.',
  },
  {
    title: 'Documents collected over Telegram',
    body: 'SurveyOS Sync is an optional companion: your client sends the RC or licence to a Telegram bot, and it appears in the app ready to attach to a claim. Connect it if it suits how you work, ignore it if it does not.',
  },
  {
    title: 'Fee bills and professional fees',
    body: 'Your fee schedule lives in your profile and drives the fee bill for each claim, so billing follows the survey instead of being rebuilt in a spreadsheet afterwards.',
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell
      eyebrow="Features"
      title="Everything the survey needs, nothing it does not"
      subtitle="Built around how an independent motor surveyor actually works — on site, often offline, and answerable for every figure."
      wide
    >
      {FEATURES.map((f, i) => (
        <section key={f.title} className="grid gap-6 sm:grid-cols-2 items-center">
          <div className={i % 2 === 1 ? 'sm:order-2' : ''}>
            <h2 className="text-base font-black text-slate-900 mb-2">{f.title}</h2>
            <p>{f.body}</p>
          </div>
          {f.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/images/${f.image}`}
              alt={f.title}
              className="rounded-xl border border-black/10 shadow-sm w-full"
              loading="lazy"
            />
          ) : (
            <div className="rounded-xl border border-black/5 bg-white/60 p-6 text-xs text-slate-400">
              Included in every plan.
            </div>
          )}
        </section>
      ))}

      <section className="text-center pt-4">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 px-6 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 transition-transform"
        >
          See pricing
        </Link>
      </section>
    </MarketingShell>
  );
}
