import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Products | Motor SurveyOS',
  description: 'Motor SurveyOS and SurveyOS Sync — two tools built for IRDAI-licensed motor insurance surveyors in India. AI-powered reports and document tracking in one ecosystem.',
  alternates: { canonical: 'https://motorsurveyos-in.web.app/products' },
};

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F3] font-sans text-slate-900">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-black/5 bg-[#F5F5F3]/90 backdrop-blur-xl">
        <Link href="/landing" className="text-sm font-black text-slate-900 tracking-tight">Motor SurveyOS</Link>
        <Link href="/landing" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm">
          Start Free Trial
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-5 py-16">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Our Products</div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 leading-tight">
          Two tools. One complete survey workflow.
        </h1>
        <p className="text-slate-600 text-base leading-relaxed mb-14 max-w-xl">
          Motor SurveyOS handles AI-powered report generation. SurveyOS Sync handles document collection and tracking. Together they cover the full workflow — from first document request to final report export.
        </p>

        {/* Product 1 */}
        <div className="rounded-2xl bg-white border border-black/5 shadow-sm overflow-hidden mb-6">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />
          <div className="p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <div className="text-base font-black text-slate-900">Motor SurveyOS</div>
                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">AI Report Platform · Web</div>
              </div>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              The main survey platform. Upload an RC book, driving licence, or policy document and the AI extracts every field automatically. Generate a complete, professional survey report in under 10 minutes. Exports directly to your Google Drive.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {['AI document extraction (OCR)', 'Auto Google Drive sync', 'LLM conflict reconciliation', 'Offline-first caching', 'Smart photo compression', 'Final report PDF export'].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-2xl font-black text-amber-500">₹799</span>
              <span className="text-slate-400 text-sm">/month · 14-day free trial</span>
            </div>
            <Link href="/landing" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-gray-900 bg-amber-400 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform">
              Start Free Trial →
            </Link>
          </div>
        </div>

        {/* Product 2 */}
        <div className="rounded-2xl bg-white border border-black/5 shadow-sm overflow-hidden mb-14">
          <div className="h-1.5 bg-gradient-to-r from-[#26A5E4] to-[#1a8bc4]" />
          <div className="p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#26A5E4]/10 border border-[#26A5E4]/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="12" fill="#26A5E4" />
                  <path d="M17.707 7.293l-2.12 10.007c-.157.695-.568.867-1.152.54l-3.18-2.344-1.535 1.477c-.17.17-.312.312-.64.312l.228-3.24 5.892-5.323c.256-.228-.056-.354-.397-.126L6.29 13.88l-3.122-.975c-.678-.212-.692-.678.142-.999l12.197-4.703c.565-.205 1.058.126.2 1.09z" fill="white" />
                </svg>
              </div>
              <div>
                <div className="text-base font-black text-slate-900 flex items-center gap-2">
                  SurveyOS Sync
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#26A5E4]/10 text-[#26A5E4] border border-[#26A5E4]/20">TELEGRAM</span>
                </div>
                <div className="text-[10px] font-bold text-[#26A5E4] uppercase tracking-widest">Document Tracker · Telegram Mini App</div>
              </div>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              A Telegram Mini App that shows you every pending document across every active claim — in one screen. Create a claim, define what documents are needed, send upload links to the insured or garage via WhatsApp, and track status in real time. Send reminders in one tap when documents are overdue.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {['Pending documents across all claims', 'One-tap WhatsApp reminders', 'Upload links — no app needed', 'PENDING / RECEIVED / REJECTED tracking', 'Contacts per claim', 'Integrates with Motor SurveyOS'].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#26A5E4] flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-sm font-black text-slate-600">Included with Motor SurveyOS</span>
            </div>
            <a href="https://t.me/surveyos_sync_bot" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:scale-[1.02] active:scale-95 transition-transform"
              style={{ backgroundColor: '#26A5E4' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="white" fillOpacity="0.2"/><path d="M17.707 7.293l-2.12 10.007c-.157.695-.568.867-1.152.54l-3.18-2.344-1.535 1.477c-.17.17-.312.312-.64.312l.228-3.24 5.892-5.323c.256-.228-.056-.354-.397-.126L6.29 13.88l-3.122-.975c-.678-.212-.692-.678.142-.999l12.197-4.703c.565-.205 1.058.126.2 1.09z" fill="white"/></svg>
              Open in Telegram →
            </a>
          </div>
        </div>

        {/* How they connect */}
        <div className="rounded-2xl bg-slate-900 text-white p-8 mb-8">
          <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-3">How They Work Together</div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm">
            <div className="flex-1 text-slate-300 leading-relaxed">
              Collect documents in <span className="text-white font-bold">SurveyOS Sync</span> → AI reads them in <span className="text-white font-bold">Motor SurveyOS</span> → Report ready in 10 minutes.
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            {['Documents collected', 'AI auto-fills fields', 'Report exported to Drive'].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider">{step}</div>
                </div>
                {i < 2 && <div className="text-slate-600 text-lg">→</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 py-6 border-t border-black/5">
          <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
          <span className="mx-3">·</span>
          <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
          <span className="mx-3">·</span>
          <Link href="/blog/surveyos-sync" className="hover:text-slate-600 transition-colors">Blog</Link>
        </div>
      </div>
    </div>
  );
}
