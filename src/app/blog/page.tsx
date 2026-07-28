import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog | Motor SurveyOS',
  description: 'Guides, product updates, and insights for IRDAI-licensed motor insurance surveyors in India.',
  alternates: { canonical: 'https://motorsurveyos-in.web.app/blog' },
};

const POSTS = [
  {
    href: '/blog/surveyos-sync',
    tag: 'Product',
    title: 'Never Lose Track of a Document Again',
    desc: 'How SurveyOS Sync helps surveyors track every pending document across all claims and send reminders in one tap.',
    readTime: '3 min read',
    date: '19 Jun 2026',
  },
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-[#F5F5F3] font-sans text-slate-900">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-black/5 bg-[#F5F5F3]/90 backdrop-blur-xl">
        <Link href="/landing" className="text-sm font-black text-slate-900 tracking-tight">Motor SurveyOS</Link>
        <Link href="/landing" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm">
          Start Free Trial
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-16">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Blog</div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Insights for Surveyors</h1>
        <p className="text-slate-500 text-sm mb-12">Guides, product updates, and tips for IRDAI-licensed motor insurance surveyors.</p>

        <div className="space-y-4">
          {POSTS.map((post) => (
            <Link key={post.href} href={post.href} className="block group">
              <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-600">{post.tag}</span>
                  <span className="text-[10px] text-slate-400">{post.readTime} · {post.date}</span>
                </div>
                <h2 className="text-base font-black text-slate-900 mb-2 group-hover:text-amber-600 transition-colors leading-snug">{post.title}</h2>
                <p className="text-sm text-slate-500 leading-relaxed">{post.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
