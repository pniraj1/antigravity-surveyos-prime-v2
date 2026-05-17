'use client';

import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import {
  ArrowRight, Cloud, Camera, Shield, FileText, ChevronRight, Play,
  Zap, Cpu, Clock, Lock
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import DemoSection from '@/components/landing/DemoSection';
import PricingSection from '@/components/landing/PricingSection';
import CinematicVideo from '@/components/landing/CinematicVideo';

/* ─────────────────────────────────────────────────────────────────────────────
   GLASS CARD — reusable glassmorphic container for the left content rail
───────────────────────────────────────────────────────────────────────────── */
function GlassCard({
  children,
  className = '',
  id,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      id={id}
      className={`relative rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl ${className}`}
      style={{
        background: 'rgba(10, 10, 18, 0.72)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CHAPTER DATA
───────────────────────────────────────────────────────────────────────────── */
const CHAPTERS = [
  {
    tag: 'Capture',
    glow: '245,158,11',
    bg: 'bg-amber-400/10 border-amber-400/20',
    tagClass: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    heading: 'Scan any document.\nExtract every field.',
    body: 'Our AI engine reads Registration Certificates, Driving Licences, and Policies in seconds — filling every form field with 99.9% accuracy. No more manual transcription.',
    stat: '99.9%',
    statLabel: 'Extraction accuracy',
    icon: <FileText size={20} className="text-amber-400" />,
  },
  {
    tag: 'Analyse',
    glow: '59,130,246',
    bg: 'bg-blue-400/10 border-blue-400/20',
    tagClass: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
    heading: 'Draft complete\nreports in 10 minutes.',
    body: 'What used to take a surveyor 2+ hours now completes in under 10 minutes. LLM reconciliation spots conflicts between documents and flags them before you sign off.',
    stat: '10 min',
    statLabel: 'Average report time',
    icon: <Clock size={20} className="text-blue-400" />,
  },
  {
    tag: 'Deliver',
    glow: '16,185,129',
    bg: 'bg-emerald-400/10 border-emerald-400/20',
    tagClass: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    heading: 'Secure, private,\nzero third-party storage.',
    body: 'Every file goes directly to your own Google Drive. We store nothing. No third-party databases, no data exposure — your client\'s information belongs only to you.',
    stat: '0',
    statLabel: 'Third-party breaches',
    icon: <Lock size={20} className="text-emerald-400" />,
  },
];

const FEATURES = [
  { icon: <FileText size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'AI Document Reading', desc: 'Instantly reads RC, DL, and Policies. Flawless OCR fills forms automatically.' },
  { icon: <Camera size={20} />, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', title: 'Smart Photo Engine', desc: 'Upload heavy damage photos. SurveyOS compresses them and maps to a beautiful PDF.' },
  { icon: <Cloud size={20} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', title: 'Auto Drive Sync', desc: 'Files silently pushed to your Google Drive in the background. Zero manual filing.' },
  { icon: <Cpu size={20} />, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', title: 'LLM Reconciliation', desc: 'Spots conflicts between DL and policies instantly, highlights every mismatch.' },
  { icon: <Shield size={20} />, color: 'text-rose-400', bg: 'bg-rose-400/10 border-rose-400/20', title: 'Offline First', desc: 'No signal at the garage? SurveyOS caches securely and syncs on reconnect.' },
  { icon: <Zap size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', title: 'Lightning Fast', desc: 'Zero load times, native-like performance on any device.' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { isAuthenticated, loading: authLoading } = useAuthStore();
  const { profile } = useProfileStore();
  const [signingIn, setSigningIn] = useState(false);
  const [chapter, setChapter] = useState(0);
  const router = useRouter();
  const isPending = profile?.subscriptionStatus === 'pending';

  // Drive video from page-level scroll (whole page, not a section)
  const { scrollYProgress } = useScroll();

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const next = latest > 0.66 ? 2 : latest > 0.33 ? 1 : 0;
    if (next !== chapter) setChapter(next);
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading && !isPending) router.push('/');
  }, [isAuthenticated, authLoading, isPending, router]);

  const handleAction = async () => {
    if (isAuthenticated) { router.push('/'); return; }
    setSigningIn(true);
    try { await signInWithGoogle(); }
    catch (e) { console.error('Sign in failed', e); }
    finally { setSigningIn(false); }
  };

  const tint = CHAPTERS[chapter];

  return (
    <div className="min-h-screen bg-[#07070f] text-white font-sans selection:bg-amber-500/20 overflow-x-hidden">

      {/* ── STICKY NAV ─────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/8"
        style={{
          width: '30%',
          background: 'rgba(7,7,15,0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <Logo variant="dark" size="sm" />
        <button
          onClick={handleAction}
          disabled={signingIn}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
        >
          {signingIn ? <Loader2 size={12} className="animate-spin" /> : isAuthenticated ? 'Dashboard' : 'Start Free'}
          {!signingIn && <ArrowRight size={12} />}
        </button>
      </nav>

      {/* ── OUTER SHELL: flex row ──────────────────────────────────────────── */}
      <div className="flex min-h-screen">

        {/* ══════════════════════════════════════════════════════════════════
            LEFT RAIL — 30% — All page content scrolls here as glass cards
        ══════════════════════════════════════════════════════════════════ */}
        <div
          className="w-[30%] flex-shrink-0 relative z-10 flex flex-col gap-4 px-4 pt-24 pb-16"
          style={{ minHeight: '100vh' }}
        >

          {/* ── Chapter glow bleeding from the right into this panel ──────── */}
          {/* This is painted BEHIND the cards via z-index */}
          <motion.div
            className="fixed top-0 left-0 pointer-events-none"
            animate={{
              background: `radial-gradient(ellipse 120% 80% at 100% 50%, rgba(${tint.glow},0.18) 0%, transparent 60%)`,
            }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            style={{ width: '30%', height: '100vh', zIndex: 1 }}
          />

          {/* ── 1. HERO CARD ─────────────────────────────────────────────── */}
          <GlassCard className="p-7 flex flex-col gap-5 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/25 text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] w-fit">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
              </span>
              Motor SurveyOS Prime
            </div>

            <h1 className="text-2xl font-black tracking-tight leading-[1.15] text-white">
              Motor surveying,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                powered by AI.
              </span>
            </h1>

            <p className="text-sm text-gray-400 leading-relaxed">
              Automatically extracts data from RC, DL, and Policies. Drafts final reports in minutes — not hours.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleAction}
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {signingIn ? <Loader2 size={16} className="animate-spin" /> : isAuthenticated ? 'Enter Dashboard' : 'Start Free Trial'}
                {!signingIn && <ChevronRight size={16} />}
              </button>
              <button
                onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-gray-300 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
              >
                <Play size={14} className="text-amber-400" />
                Watch Demo
              </button>
            </div>
          </GlassCard>

          {/* ── 2. METRICS CARD ──────────────────────────────────────────── */}
          <GlassCard className="p-5 grid grid-cols-3 gap-3 relative z-10">
            {[
              { val: '10', unit: 'min', label: 'Report time', color: 'text-amber-400' },
              { val: '99.9', unit: '%', label: 'Accuracy', color: 'text-blue-400' },
              { val: '0', unit: '', label: 'Breaches', color: 'text-emerald-400' },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <div className={`text-xl font-black ${m.color}`}>
                  {m.val}<span className="text-xs">{m.unit}</span>
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">{m.label}</div>
              </div>
            ))}
          </GlassCard>

          {/* ── 3. CHAPTER CARDS (How it Works) ─────────────────────────── */}
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 relative z-10">
            How it works
          </div>

          {CHAPTERS.map((ch, i) => (
            <GlassCard
              key={i}
              className={`p-5 relative z-10 transition-all duration-500 ${chapter === i ? 'ring-1' : 'opacity-70'}`}
            >
              {/* Active indicator */}
              {chapter === i && (
                <motion.div
                  layoutId="chapterActive"
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ boxShadow: `inset 0 0 0 1px rgba(${ch.glow},0.35), 0 0 24px rgba(${ch.glow},0.12)` }}
                />
              )}

              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${ch.bg}`}>
                  {ch.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${ch.tagClass}`}>
                  {ch.tag}
                </span>
              </div>

              <h3 className="text-base font-black text-white leading-snug mb-2 whitespace-pre-line">
                {ch.heading}
              </h3>

              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                {ch.body}
              </p>

              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r`}
                  style={{ color: `rgb(${ch.glow})` }}>
                  {ch.stat}
                </span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{ch.statLabel}</span>
              </div>
            </GlassCard>
          ))}

          {/* ── 4. FEATURES CARD ─────────────────────────────────────────── */}
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 relative z-10" id="features">
            Features
          </div>

          <GlassCard className="p-5 relative z-10">
            <div className="grid grid-cols-2 gap-3">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${f.bg} ${f.color}`}>
                    {f.icon}
                  </div>
                  <div className="text-xs font-bold text-white">{f.title}</div>
                  <div className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* ── 5. PRICING CARD ──────────────────────────────────────────── */}
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 relative z-10" id="pricing">
            Pricing
          </div>

          <GlassCard className="p-5 relative z-10">
            <div className="mb-4">
              <div className="text-white font-black text-lg">SurveyOS Prime</div>
              <div className="text-gray-400 text-xs mt-1">Everything included. No hidden fees.</div>
            </div>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-3xl font-black text-amber-400">₹999</span>
              <span className="text-gray-500 text-sm">/month</span>
            </div>
            {[
              'Unlimited claims & reports',
              'AI document extraction (OCR)',
              'Auto Google Drive sync',
              'LLM reconciliation engine',
              'Offline-first mobile support',
              'Priority support',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                <div className="w-4 h-4 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                </div>
                <span className="text-xs text-gray-300">{item}</span>
              </div>
            ))}
            <button
              onClick={handleAction}
              disabled={signingIn}
              className="w-full mt-5 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50"
            >
              {signingIn ? <Loader2 size={16} className="animate-spin" /> : 'Get Started Now'}
              {!signingIn && <ArrowRight size={16} />}
            </button>
          </GlassCard>

          {/* ── 6. CTA CARD ──────────────────────────────────────────────── */}
          <GlassCard
            className="p-6 text-center relative z-10 overflow-hidden"
            style={{ background: `rgba(${tint.glow},0.08)` } as React.CSSProperties}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ background: `radial-gradient(ellipse 80% 60% at 50% 100%, rgba(${tint.glow},0.25) 0%, transparent 70%)` }}
              transition={{ duration: 1 }}
            />
            <h2 className="text-lg font-black text-white mb-2 relative z-10">
              Ready to transform your workflow?
            </h2>
            <p className="text-xs text-gray-400 mb-5 relative z-10">
              Join thousands of surveyors delivering superior assessments in record time.
            </p>
            <button
              onClick={handleAction}
              disabled={signingIn}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg disabled:opacity-50 relative z-10"
            >
              {signingIn ? <Loader2 size={16} className="animate-spin" /> : 'Open SurveyOS Prime'}
              {!signingIn && <ArrowRight size={16} />}
            </button>
          </GlassCard>

          {/* ── FOOTER ───────────────────────────────────────────────────── */}
          <div className="text-center text-xs text-gray-600 pt-4 pb-2 relative z-10">
            <Logo variant="dark" size="sm" className="justify-center mb-3" />
            © {new Date().getFullYear()} SurveyOS Prime. Engineered for Surveyors.
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            RIGHT — 70% — Sticky cinematic video backdrop
        ══════════════════════════════════════════════════════════════════ */}
        <div
          className="fixed top-0 right-0 w-[70%] h-screen z-0 pointer-events-none"
        >
          <CinematicVideo scrollYProgress={scrollYProgress} chapter={chapter} />
        </div>

      </div>
    </div>
  );
}
