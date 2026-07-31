import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'SurveyOS Sync — Never Lose Track of a Document Again | Motor SurveyOS',
  description:
    'Motor insurance surveyors waste 1–2 hours daily chasing documents across WhatsApp. SurveyOS Sync gives you one screen to track every pending document across every active claim — and send reminders in one tap.',
  alternates: {
    canonical: 'https://motorsurveyos-in.web.app/blog/surveyos-sync',
  },
  openGraph: {
    title: 'SurveyOS Sync — Never Lose Track of a Document Again',
    description:
      'One screen. Every pending document. Across every claim. SurveyOS Sync is the document tracking and reminder system built for IRDAI motor insurance surveyors.',
    url: 'https://motorsurveyos-in.web.app/blog/surveyos-sync',
    siteName: 'Motor SurveyOS',
    type: 'article',
    locale: 'en_IN',
    images: [{ url: '/images/sync-infographic.png', width: 1456, height: 816, alt: 'SurveyOS Sync Before and After' }],
  },
};

const faqs = [
  {
    q: 'What is SurveyOS Sync?',
    a: 'SurveyOS Sync is a Telegram Mini App that helps IRDAI-licensed motor insurance surveyors track which documents are pending, received, or rejected across all their active claims — and send reminders to the insured or garage in one tap.',
  },
  {
    q: 'How does the Reminders screen work?',
    a: 'The Reminders screen is a single dashboard that lists every pending and rejected document across all your active claims. From there you can tap "Send Reminder" to notify the right contact, or tap "Upload Link" to share a fresh document upload link via WhatsApp or SMS.',
  },
  {
    q: 'What document statuses does SurveyOS Sync track?',
    a: 'Every document slot has one of three statuses: PENDING (requested, not yet received), RECEIVED (uploaded and accepted), or REJECTED (uploaded but wrong or unclear — triggers a re-submission reminder).',
  },
  {
    q: 'Does the insured need to install any app?',
    a: 'No. The insured or garage receives a simple web link over WhatsApp or SMS. They open it in their phone browser and upload the document. No app download required on their end.',
  },
  {
    q: 'How does SurveyOS Sync connect to Motor SurveyOS?',
    a: 'Once documents are marked RECEIVED in SurveyOS Sync, they feed into Motor SurveyOS where the AI engine reads the RC book, driving licence, and policy document — auto-filling your survey report. No manual data entry.',
  },
  {
    q: 'Is SurveyOS Sync free?',
    a: 'SurveyOS Sync is included with every Motor SurveyOS subscription at ₹799/month. The 14-day free trial covers both tools.',
  },
];

export default function SurveyOSSyncBlog() {
  return (
    <>
      <Script
        id="json-ld-article"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'SurveyOS Sync — Never Lose Track of a Document Again',
            description:
              'How IRDAI motor insurance surveyors can track every pending document across every active claim and send reminders in one tap with SurveyOS Sync.',
            author: { '@type': 'Organization', name: 'Motor SurveyOS' },
            publisher: {
              '@type': 'Organization',
              name: 'Motor SurveyOS',
              url: 'https://motorsurveyos-in.web.app',
            },
            image: 'https://motorsurveyos-in.web.app/images/sync-infographic.png',
            datePublished: '2026-06-19',
            dateModified: '2026-06-19',
            url: 'https://motorsurveyos-in.web.app/blog/surveyos-sync',
            mainEntityOfPage: 'https://motorsurveyos-in.web.app/blog/surveyos-sync',
          }),
        }}
      />
      <Script
        id="json-ld-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          }),
        }}
      />

      <div className="min-h-screen bg-[#F5F5F3] font-sans text-slate-900">

        {/* Nav */}
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-black/5 bg-[#F5F5F3]/90 backdrop-blur-xl">
          <Link href="/landing" className="text-sm font-black text-slate-900 tracking-tight">
            Motor SurveyOS
          </Link>
          <Link
            href="/landing"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm"
          >
            Start Free Trial
          </Link>
        </nav>

        <article className="max-w-4xl mx-auto px-5 py-16">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-8">
            <Link href="/landing" className="hover:text-amber-500 transition-colors">Home</Link>
            <span>/</span>
            <span>Blog</span>
            <span>/</span>
            <span className="text-slate-600">SurveyOS Sync</span>
          </div>

          {/* Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-[11px] font-black text-amber-600 uppercase tracking-widest mb-6">
            Product · Document Tracking
          </div>

          {/* Headline */}
          <h1 className="text-3xl md:text-4xl font-black leading-tight text-slate-900 mb-4">
            Never Lose Track of a Document Again
          </h1>

          <p className="text-slate-500 text-sm mb-6">
            Published 19 June 2026 · 3 min read · Motor SurveyOS Team
          </p>

          {/* Hook */}
          <p className="text-lg text-slate-700 leading-relaxed mb-10 max-w-2xl">
            The average IRDAI motor insurance surveyor spends <strong>1–2 hours every day</strong> chasing documents — scrolling through WhatsApp chats, sending manual reminders, and mentally tracking what is still missing across 10+ active claims. SurveyOS Sync fixes this with one screen.
          </p>

          {/* Hero Infographic */}
          <div className="rounded-2xl overflow-hidden border border-black/5 shadow-xl mb-12">
            <Image
              src="/images/sync-infographic.png"
              alt="SurveyOS Sync before and after: chaotic WhatsApp document chasing vs organised one-screen tracking with reminders"
              width={1456}
              height={816}
              className="w-full h-auto"
              priority
            />
          </div>

          {/* The Reminders Screen */}
          <h2 className="text-xl font-black text-slate-900 mb-4">The Reminders Screen — The Heart of Sync</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            Every surveyor's biggest problem is not collecting documents — it is <em>knowing what is still missing</em>. The Reminders screen solves this. It aggregates every pending and rejected document across all your active claims into a single view, sorted by claim.
          </p>
          <p className="text-slate-700 leading-relaxed mb-10">
            From one screen you can see: which claim is stuck, which document is overdue, and whether a previous submission was rejected and why. No switching between chats. No mental accounting. One tap fires the reminder directly to the right contact.
          </p>

          {/* Three states */}
          <h2 className="text-xl font-black text-slate-900 mb-5">Three States. Total Clarity.</h2>
          <div className="grid grid-cols-3 gap-3 mb-12">
            {[
              { color: 'bg-amber-400', label: 'PENDING', desc: 'Document requested. Waiting on the insured or garage.' },
              { color: 'bg-emerald-500', label: 'RECEIVED', desc: 'Document uploaded and accepted. Slot is cleared.' },
              { color: 'bg-red-500', label: 'REJECTED', desc: 'Wrong or blurry document. Reminder auto-ready for one-tap resend.' },
            ].map(({ color, label, desc }) => (
              <div key={label} className="p-4 rounded-2xl bg-white border border-black/5 shadow-sm">
                <div className={`w-3 h-3 rounded-full ${color} mb-3`} />
                <div className="text-xs font-black text-slate-900 mb-1">{label}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>

          {/* Integration */}
          <div className="rounded-2xl bg-slate-900 text-white p-6 mb-12">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3">Integrated with Motor SurveyOS</div>
            <p className="text-sm leading-relaxed text-slate-300">
              Once every document slot turns green in SurveyOS Sync, open Motor SurveyOS. The AI engine reads the RC book, driving licence, and policy — auto-filling every field in your survey report. What used to take 2 hours of manual entry now takes <strong className="text-white">under 10 minutes</strong>. Sync handles the document chaos. Motor SurveyOS handles the report.
            </p>
          </div>

          {/* FAQ */}
          <h2 className="text-xl font-black text-slate-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3 mb-12">
            {faqs.map(({ q, a }) => (
              <div key={q} className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm">
                <div className="font-bold text-slate-900 text-sm mb-2">{q}</div>
                <div className="text-slate-600 text-sm leading-relaxed">{a}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="rounded-2xl bg-amber-400/10 border border-amber-400/20 p-8 text-center">
            <h3 className="text-lg font-black text-slate-900 mb-2">
              Stop chasing. Start tracking.
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              SurveyOS Sync is included in every Motor SurveyOS plan. 14-day free trial, no credit card required.
            </p>
            <Link
              href="/landing"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg"
            >
              Start 14-Day Free Trial
            </Link>
          </div>

        </article>

        <footer className="text-center text-xs text-slate-400 py-8 border-t border-black/5">
          © {new Date().getFullYear()} Motor SurveyOS · Built for IRDAI-licensed surveyors in India
        </footer>
      </div>
    </>
  );
}
