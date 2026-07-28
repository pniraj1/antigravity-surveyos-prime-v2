import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Motor SurveyOS — AI Motor Insurance Survey Platform | Motor SurveyOS',
  description:
    'Motor SurveyOS is an AI-powered survey platform for IRDAI-licensed motor insurance surveyors. Auto-extracts RC, DL, and policy data. Generates complete survey reports in under 10 minutes. ₹799/month.',
  alternates: { canonical: 'https://motorsurveyos-in.web.app/products/motor-surveyos' },
  openGraph: {
    title: 'Motor SurveyOS — AI Motor Insurance Survey Platform',
    description: 'Generate complete motor insurance survey reports in under 10 minutes. AI reads your RC, DL, and policy docs automatically. 30-day free trial.',
    url: 'https://motorsurveyos-in.web.app/products/motor-surveyos',
    siteName: 'Motor SurveyOS',
    type: 'website',
    locale: 'en_IN',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Motor SurveyOS' }],
  },
};

const STEPS = [
  {
    n: '01',
    title: 'Upload your documents',
    body: 'Drop in the RC book, driving licence, and insurance policy — photos, scans, or PDFs. The AI engine reads them immediately.',
  },
  {
    n: '02',
    title: 'AI fills every field',
    body: 'Registration number, engine number, chassis number, owner name, policy number, insurer — every field auto-populated with 99.9% accuracy. No typing.',
  },
  {
    n: '03',
    title: 'LLM spots conflicts',
    body: 'The reconciliation engine compares data across documents. If the DL name doesn\'t match the policy, it flags it before you sign off.',
  },
  {
    n: '04',
    title: 'Add photos',
    body: 'Upload damage photos directly. SurveyOS compresses them and maps them to the right sections of your report automatically.',
  },
  {
    n: '05',
    title: 'Export the report',
    body: 'One tap generates a complete, professional PDF survey report and pushes it to your Google Drive. Ready to submit.',
  },
];

const FEATURES = [
  { title: 'AI Document Extraction', body: 'Reads RC books, driving licences, and insurance policies in seconds. OCR + LLM combination for near-perfect accuracy.', stat: '99.9%', statLabel: 'accuracy' },
  { title: 'Report Generation', body: 'Complete, professional survey reports generated in under 10 minutes — down from 2+ hours of manual work.', stat: '10 min', statLabel: 'average' },
  { title: 'Google Drive Sync', body: 'Reports and documents pushed silently to your own Google Drive in the background. Zero manual filing. Zero third-party storage.', stat: '0', statLabel: 'breaches' },
  { title: 'LLM Reconciliation', body: 'Cross-references data from multiple documents. Highlights every mismatch between DL, RC, and policy before you submit.', stat: '100%', statLabel: 'cross-checked' },
  { title: 'Offline First', body: 'No signal at the garage? SurveyOS caches your work securely and syncs everything when you reconnect.', stat: '0', statLabel: 'data lost' },
  { title: 'Smart Photo Engine', body: 'Upload heavy damage photos. Automatic compression and intelligent placement into the correct report section.', stat: '80%', statLabel: 'size reduction' },
];

const FAQS = [
  { q: 'Which documents can Motor SurveyOS read?', a: 'RC books (Registration Certificates), driving licences, insurance policy documents, and FIR copies. Supports photos, scans, and PDFs.' },
  { q: 'How accurate is the AI extraction?', a: 'Our AI extraction achieves 99.9% accuracy on standard motor insurance documents. All extracted data is shown to you for review before the report is generated.' },
  { q: 'Where are my reports stored?', a: 'Reports are pushed directly to your own Google Drive account. We do not store your reports or client documents on our servers.' },
  { q: 'Does it work without internet?', a: 'Yes. Motor SurveyOS is offline-first. You can complete a survey without internet and all data syncs automatically when you reconnect.' },
  { q: 'Is it IRDAI compliant?', a: 'Motor SurveyOS is built specifically for IRDAI-licensed motor surveyors and loss assessors. Reports follow standard industry format. You retain full professional responsibility for submitted reports.' },
  { q: 'What is the pricing?', a: '₹799/month after a 30-day free trial. No credit card required for the trial. The plan includes unlimited claims, reports, AI extraction, and Google Drive sync.' },
];

export default function MotorSurveyOSPage() {
  return (
    <>
      <Script
        id="json-ld-product"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Motor SurveyOS',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web, Android, iOS',
            description: 'AI-powered motor insurance survey platform for IRDAI-licensed surveyors in India. Auto-extracts RC, DL, and policy data. Generates complete survey reports in under 10 minutes.',
            url: 'https://motorsurveyos-in.web.app/products/motor-surveyos',
            offers: { '@type': 'Offer', price: '799', priceCurrency: 'INR', description: '30-day free trial then ₹799/month' },
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
            mainEntity: FAQS.map(({ q, a }) => ({
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
          <Link href="/landing" className="text-sm font-black text-slate-900 tracking-tight">Motor SurveyOS</Link>
          <div className="flex items-center gap-3">
            <Link href="/products" className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">Products</Link>
            <Link href="/landing" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm">
              Start Free Trial
            </Link>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto px-5 py-16">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-8">
            <Link href="/landing" className="hover:text-amber-500 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-amber-500 transition-colors">Products</Link>
            <span>/</span>
            <span className="text-slate-600">Motor SurveyOS</span>
          </div>

          {/* Hero */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">AI Survey Platform · Web</div>
                <h1 className="text-xl font-black text-slate-900 leading-tight">Motor SurveyOS</h1>
              </div>
            </div>

            <p className="text-3xl md:text-4xl font-black text-slate-900 leading-tight mb-6">
              From documents to<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">final report in 10 minutes.</span>
            </p>

            <p className="text-slate-600 text-base leading-relaxed mb-8 max-w-xl">
              Motor SurveyOS reads your RC books, driving licences, and insurance policies with AI — filling every form field automatically. What used to take 2+ hours of manual work now takes under 10 minutes.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/landing" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-amber-500/20">
                Start 30-Day Free Trial →
              </Link>
              <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-700 rounded-xl border border-black/10 hover:bg-slate-900 hover:text-white transition-all">
                Compare Products
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-16">
            {[
              { val: '10 min', label: 'Report time', sub: 'down from 2+ hours' },
              { val: '99.9%', label: 'Accuracy', sub: 'on standard documents' },
              { val: '₹799', label: 'Per month', sub: '30-day free trial' },
            ].map(({ val, label, sub }) => (
              <div key={label} className="rounded-2xl bg-white border border-black/5 shadow-sm p-5 text-center">
                <div className="text-2xl font-black text-amber-500 mb-1">{val}</div>
                <div className="text-xs font-black text-slate-900 mb-0.5">{label}</div>
                <div className="text-[10px] text-slate-400">{sub}</div>
              </div>
            ))}
          </div>

          {/* How it works */}
          <h2 className="text-xl font-black text-slate-900 mb-6">How It Works</h2>
          <div className="space-y-3 mb-16">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="flex gap-4 p-5 rounded-2xl bg-white border border-black/5 shadow-sm">
                <div className="text-2xl font-black text-amber-400/40 leading-none flex-shrink-0 w-8">{n}</div>
                <div>
                  <div className="text-sm font-black text-slate-900 mb-1">{title}</div>
                  <div className="text-sm text-slate-500 leading-relaxed">{body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Report Gallery */}
          <div className="mb-16">
            <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Actual Output</div>
            <h2 className="text-xl font-black text-slate-900 mb-2">What the Reports Look Like</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Every report is generated from the data you enter — no blank fields, no guesswork. These are real rendered outputs from Motor SurveyOS.
            </p>

            {/* Assessment Tab */}
            <div className="mb-6 rounded-2xl overflow-hidden border border-black/5 shadow-md">
              <div className="bg-slate-50 px-5 py-3 border-b border-black/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900">Assessment Tab</div>
                  <div className="text-[10px] text-slate-400">AI-filled damage grid — part type, depreciation, GST, allowed/disallowed, net totals</div>
                </div>
                <div className="text-[10px] font-black px-2 py-1 rounded-full bg-slate-900/10 text-slate-700 border border-slate-200">APP</div>
              </div>
              <Image
                src="/images/report-assessment.png"
                alt="Motor SurveyOS Assessment Tab — showing damage grid with 11 line items, part types, depreciation rates, assessed values and net payable loss of ₹87,382"
                width={2560}
                height={1800}
                className="w-full block"
                unoptimized
              />
            </div>

            {/* Spot Report */}
            <div className="mb-6 rounded-2xl overflow-hidden border border-black/5 shadow-md">
              <div className="bg-slate-50 px-5 py-3 border-b border-black/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900">Spot Survey Report</div>
                  <div className="text-[10px] text-slate-400">Generated at accident scene — documents, driver & damage verified on the spot</div>
                </div>
                <div className="text-[10px] font-black px-2 py-1 rounded-full bg-amber-400/15 text-amber-700 border border-amber-400/25">SPOT</div>
              </div>
              <Image
                src="/images/report-spot-hero.png"
                alt="Motor SurveyOS Spot Survey Report — vehicle particulars, driver verification, accident details and damage at spot"
                width={2360}
                height={1400}
                className="w-full block"
                unoptimized
              />
            </div>

            {/* Final PDF Report */}
            <div className="rounded-2xl overflow-hidden border border-black/5 shadow-md">
              <div className="bg-slate-50 px-5 py-3 border-b border-black/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900">Final Survey Report — PDF</div>
                  <div className="text-[10px] text-slate-400">Export-ready PDF with full assessment, GST breakdown, net payable loss and surveyor signature</div>
                </div>
                <div className="text-[10px] font-black px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">PDF</div>
              </div>
              <Image
                src="/images/report-final-pdf.png"
                alt="Motor SurveyOS Final Survey Report PDF — policy details, vehicle info, damage assessment table, net payable loss and surveyor signature block"
                width={2480}
                height={3508}
                className="w-full block"
                unoptimized
              />
            </div>
          </div>

          {/* Features */}
          <h2 className="text-xl font-black text-slate-900 mb-6">What's Included</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
            {FEATURES.map(({ title, body, stat, statLabel }) => (
              <div key={title} className="rounded-2xl bg-white border border-black/5 shadow-sm p-5">
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-xl font-black text-amber-500">{stat}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{statLabel}</span>
                </div>
                <div className="text-sm font-black text-slate-900 mb-1.5">{title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{body}</div>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="rounded-2xl bg-slate-900 text-white p-8 mb-16">
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4">Pricing</div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-black text-amber-400">₹799</span>
              <span className="text-slate-400 text-sm">/month</span>
              <span className="ml-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30">30 DAYS FREE</span>
            </div>
            <p className="text-slate-400 text-sm mb-6">Everything included. No credit card required to start.</p>
            <div className="grid grid-cols-2 gap-2 mb-8">
              {[
                'Unlimited claims & reports',
                'AI document extraction',
                'Google Drive auto-sync',
                'LLM reconciliation',
                'Offline-first support',
                'SurveyOS Sync included',
                'Smart photo engine',
                'Priority support',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/landing" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform">
              Start Free Trial — No Card Needed →
            </Link>
          </div>

          {/* FAQ */}
          <h2 className="text-xl font-black text-slate-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3 mb-12">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm">
                <div className="text-sm font-black text-slate-900 mb-2">{q}</div>
                <div className="text-sm text-slate-500 leading-relaxed">{a}</div>
              </div>
            ))}
          </div>

          {/* Also see */}
          <div className="rounded-2xl bg-[#26A5E4]/5 border border-[#26A5E4]/15 p-6">
            <div className="text-[10px] font-black text-[#26A5E4] uppercase tracking-widest mb-2">Also in the Ecosystem</div>
            <div className="text-sm font-black text-slate-900 mb-1">SurveyOS Sync — Document Tracker</div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Track every pending document across all your active claims. Send reminders in one tap via Telegram. Included with your subscription.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://t.me/surveyos_sync_bot" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-xl hover:scale-[1.02] transition-transform"
                style={{ backgroundColor: '#26A5E4' }}>
                Open in Telegram →
              </a>
              <Link href="/blog/surveyos-sync" className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
                Read how it works →
              </Link>
            </div>
          </div>

        </div>

        <footer className="text-center text-xs text-slate-400 py-8 border-t border-black/5">
          <div className="flex items-center justify-center gap-4 mb-2">
            <Link href="/products" className="hover:text-slate-600 transition-colors">Products</Link>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <Link href="/blog" className="hover:text-slate-600 transition-colors">Blog</Link>
          </div>
          © {new Date().getFullYear()} Motor SurveyOS · Built for IRDAI-licensed surveyors in India
        </footer>
      </div>
    </>
  );
}
