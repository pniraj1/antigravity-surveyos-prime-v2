/**
 * LegalPageShell — shared chrome for /privacy, /terms, /refund, /contact.
 *
 * EDIT: change branding, footer copy, and link list in ONE place here.
 * Page bodies live in src/app/{privacy,terms,refund,contact}/page.tsx.
 */

'use client';

import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { ArrowLeft } from 'lucide-react';

interface LegalPageShellProps {
  title: string;
  /** Date string shown under the H1, e.g. "Last updated: 8 May 2026". */
  lastUpdated: string;
  children: React.ReactNode;
}

export default function LegalPageShell({ title, lastUpdated, children }: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans flex flex-col">
      {/* ── Top nav ── */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-4 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Logo variant="light" size="md" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back home
        </Link>
      </nav>

      {/* ── Page body ── */}
      <main className="flex-1 max-w-3xl mx-auto px-6 lg:px-8 py-16 w-full">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-2">
            {title}
          </h1>
          <p className="text-sm text-gray-500">{lastUpdated}</p>
        </div>

        {/*
         * Prose styling: each page passes children that use plain <h2>, <h3>, <p>, <ul>.
         * The CSS below gives them readable defaults without pulling in @tailwindcss/typography.
         */}
        <div className="legal-prose text-gray-700 text-[15px] leading-relaxed space-y-4">
          {children}
        </div>
      </main>

      {/* ── Footer (mirrors landing footer) ── */}
      <footer className="py-10 px-6 border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-500 mb-4">
            <Link href="/privacy" className="hover:text-amber-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-amber-600 transition-colors">Terms of Service</Link>
            <Link href="/refund" className="hover:text-amber-600 transition-colors">Refund Policy</Link>
            <Link href="/contact" className="hover:text-amber-600 transition-colors">Contact</Link>
          </div>
          <p className="text-center text-xs text-gray-400">
            © {new Date().getFullYear()} SurveyOS Prime. Engineered for Surveyors.
          </p>
        </div>
      </footer>

      {/*
       * Inline prose styles. Edit selectors here if you want different
       * heading sizes / spacing across all four legal pages at once.
       */}
      <style>{`
        .legal-prose h2 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0D1B2A;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          letter-spacing: -0.01em;
        }
        .legal-prose h3 {
          font-size: 1rem;
          font-weight: 700;
          color: #0D1B2A;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .legal-prose p { margin-bottom: 0.75rem; }
        .legal-prose ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .legal-prose li { margin-bottom: 0.25rem; }
        .legal-prose a {
          color: #B8860B;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .legal-prose a:hover { color: #8B6508; }
        .legal-prose strong { color: #0D1B2A; font-weight: 700; }
        .legal-prose .placeholder {
          background: #FFF8E1;
          border-left: 3px solid #D4AF37;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #8B6508;
          margin: 0.5rem 0;
          border-radius: 0 4px 4px 0;
        }
      `}</style>
    </div>
  );
}
