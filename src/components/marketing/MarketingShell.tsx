import Link from 'next/link';

/** Every marketing + legal route. The footer renders this list verbatim. */
export const MARKETING_LINKS: { href: string; label: string }[] = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/refund', label: 'Refund Policy' },
];

interface MarketingShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Wide layout for content pages; narrow (default) reads better for legal text. */
  wide?: boolean;
}

export function MarketingShell({ eyebrow, title, subtitle, children, wide = false }: MarketingShellProps) {
  return (
    <div className="min-h-screen bg-[#F5F5F3] font-sans text-slate-900">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-black/5 bg-[#F5F5F3]/90 backdrop-blur-xl">
        <Link href="/landing" className="text-sm font-black text-slate-900 tracking-tight">Motor SurveyOS</Link>
        <div className="flex items-center gap-5">
          <Link href="/features" className="hidden sm:block text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">Features</Link>
          <Link href="/pricing" className="hidden sm:block text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">Pricing</Link>
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm">
            Start Free Trial
          </Link>
        </div>
      </nav>

      {/* Narrow column is capped near 65-75 characters — the readable line
          length. Wide is for grids and screenshots, not for prose. */}
      <article className={`${wide ? 'max-w-5xl' : 'max-w-[68ch]'} mx-auto px-5 py-20`}>
        <div className="text-caption font-semibold text-amber-700 uppercase tracking-[0.18em] mb-4">{eyebrow}</div>
        <h1 className="text-h1 font-bold text-slate-900 mb-4">{title}</h1>
        {subtitle && <p className="text-lead text-slate-600 mb-14">{subtitle}</p>}

        {/* Body copy is regular weight by default. Bold is for emphasis, and
            emphasis means nothing when everything already has it. */}
        <div className="space-y-14 text-body font-normal text-slate-700">{children}</div>

        <div className="mt-20 pt-8 border-t border-slate-200 text-caption text-slate-600 flex flex-wrap gap-x-6 gap-y-3">
          {MARKETING_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-amber-700 transition-colors">{l.label}</Link>
          ))}
        </div>
      </article>
    </div>
  );
}
