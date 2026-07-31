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

      <article className={`${wide ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-5 py-16`}>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{eyebrow}</div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mb-10">{subtitle}</p>}
        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">{children}</div>

        <div className="mt-12 pt-6 border-t border-black/5 text-xs text-slate-400 flex flex-wrap gap-4">
          {MARKETING_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-slate-600 transition-colors">{l.label}</Link>
          ))}
        </div>
      </article>
    </div>
  );
}
