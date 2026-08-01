'use client';

import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import {
  ArrowRight, Cloud, Camera, Shield, FileText, ChevronRight, Play,
  Zap, Cpu, Clock, Lock, ChevronDown, Bell
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { logger } from '@/lib/utils/logger';

import Logo from '@/components/ui/Logo';
import CinematicVideo from '@/components/landing/CinematicVideo';

/* ─────────────────────────────────────────────────────────────────────────────
   TELEGRAM LOGO SVG
───────────────────────────────────────────────────────────────────────────── */
function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#26A5E4" />
      <path
        d="M17.707 7.293l-2.12 10.007c-.157.695-.568.867-1.152.54l-3.18-2.344-1.535 1.477c-.17.17-.312.312-.64.312l.228-3.24 5.892-5.323c.256-.228-.056-.354-.397-.126L6.29 13.88l-3.122-.975c-.678-.212-.692-.678.142-.999l12.197-4.703c.565-.205 1.058.126.2 1.09z"
        fill="white"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRODUCTS DROPDOWN
───────────────────────────────────────────────────────────────────────────── */
function ProductsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Products
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="absolute top-full left-0 mt-2 w-56 rounded-2xl border border-black/8 shadow-xl overflow-hidden z-50"
          style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}
        >
          <div className="p-1.5">
            <Link
              href="/products/motor-surveyos"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-400/10 transition-colors group"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center flex-shrink-0">
                <Zap size={14} className="text-amber-500" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900 group-hover:text-amber-600 transition-colors">Motor SurveyOS</div>
                <div className="text-[10px] text-slate-400">AI survey reporting platform</div>
              </div>
            </Link>

            <a
              href="https://t.me/surveyos_sync_bot"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#26A5E4]/10 transition-colors group"
            >
              <div className="w-7 h-7 rounded-lg bg-[#26A5E4]/10 border border-[#26A5E4]/20 flex items-center justify-center flex-shrink-0">
                <TelegramIcon size={16} />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900 group-hover:text-[#26A5E4] transition-colors flex items-center gap-1">
                  SurveyOS Sync
                  <span className="text-[8px] font-black px-1 py-0.5 rounded bg-[#26A5E4]/10 text-[#26A5E4]">TELEGRAM</span>
                </div>
                <div className="text-[10px] text-slate-400">Document tracking & reminders</div>
              </div>
            </a>
          </div>

          <div className="border-t border-black/5 px-4 py-2">
            <Link
              href="/products"
              onClick={() => setOpen(false)}
              className="text-[10px] font-bold text-slate-400 hover:text-amber-500 transition-colors flex items-center gap-1"
            >
              Compare all products <ChevronRight size={10} />
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   GLASS CARD — reusable glassmorphic container for the left content rail
───────────────────────────────────────────────────────────────────────────── */
function GlassCard({
  children,
  className = '',
  id,
  style,
  onClick,
  role,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  role?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      id={id}
      role={role}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`relative rounded-2xl border border-black/5 backdrop-blur-xl shadow-xl ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.65)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
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
    statColor: 'text-amber-400',
    icon: <FileText size={20} className="text-amber-400" />,
  },
  {
    tag: 'Analyse',
    glow: '245,158,11',
    bg: 'bg-amber-400/10 border-amber-400/20',
    tagClass: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    heading: 'Draft complete\nreports in 10 minutes.',
    body: 'What used to take a surveyor 2+ hours now completes in under 10 minutes. LLM reconciliation spots conflicts between documents and flags them before you sign off.',
    stat: '10 min',
    statLabel: 'Average report time',
    statColor: 'text-amber-400',
    icon: <Clock size={20} className="text-amber-400" />,
  },
  {
    tag: 'Deliver',
    glow: '245,158,11',
    bg: 'bg-amber-400/10 border-amber-400/20',
    tagClass: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    heading: 'Secure, private,\nzero third-party storage.',
    body: 'Every file goes directly to your own Google Drive. We store nothing. No third-party databases, no data exposure — your client\'s information belongs only to you.',
    stat: '0',
    statLabel: 'Third-party breaches',
    statColor: 'text-emerald-500', // emerald kept ONLY here — green = safe is a universal data signal
    icon: <Lock size={20} className="text-amber-400" />,
  },
];

const FEATURES = [
  { icon: <FileText size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'AI Document Reading', desc: 'Instantly reads RC, DL, and Policies. Flawless OCR fills forms automatically.' },
  { icon: <Camera size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'Smart Photo Engine', desc: 'Upload heavy damage photos. SurveyOS compresses them and maps to a beautiful PDF.' },
  { icon: <Cloud size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'Auto Drive Sync', desc: 'Files silently pushed to your Google Drive in the background. Zero manual filing.' },
  { icon: <Cpu size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'LLM Reconciliation', desc: 'Spots conflicts between DL and policies instantly, highlights every mismatch.' },
  { icon: <Shield size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'Offline First', desc: 'No signal at the garage? SurveyOS caches securely and syncs on reconnect.' },
  { icon: <Zap size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'Lightning Fast', desc: 'Zero load times, native-like performance on any device.' },
  { icon: <Bell size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'SurveyOS Sync', desc: 'Track every pending document across all claims. Send reminders in one tap via Telegram.', href: '/blog/surveyos-sync' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { isAuthenticated, loading: authLoading } = useAuthStore();
  const { profile } = useProfileStore();
  const [chapter, setChapter] = useState(0);
  const router = useRouter();
  const isPending = profile?.subscriptionStatus === 'pending';

  const { scrollY, scrollYProgress } = useScroll();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Framer Motion mappings for Phase 1 -> Phase 2 transition
  // Delay the split until hero is scrolled past (approx 700px)
  const videoWidthDesktop = useTransform(scrollY, [600, 1000], ['100vw', '70vw']);
  const navWidthDesktop = useTransform(scrollY, [600, 1000], ['100%', '30%']);
  
  // Conditionally apply widths based on viewport size
  const videoWidth = isMobile ? '100vw' : videoWidthDesktop;
  const navWidth = isMobile ? '100%' : navWidthDesktop;
  
  // Hero section transforms (fade out faster so video can fade in)
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 500], [1, 0.95]);
  const heroY = useTransform(scrollY, [0, 500], [0, -50]);

  // Left panel transforms
  const leftPanelOpacity = useTransform(scrollY, [600, 1000], [0, 1]);
  const leftPanelX = useTransform(scrollY, [600, 1000], [-50, 0]);

  // Video transforms (fade in during transition to Phase 2)
  const videoOpacity = useTransform(scrollY, [300, 700], [0, 1]);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const next = latest > 0.8 ? 2 : latest > 0.4 ? 1 : 0;
    if (next !== chapter) setChapter(next);
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading && !isPending) router.push('/');
  }, [isAuthenticated, authLoading, isPending, router]);

  // Sign In and every CTA do the same thing: open the Google popup directly —
  // no page navigation needed. After auth, onAuthStateChanged fires → the
  // redirect effect above takes over (or SubscriptionGuard sends a pending
  // profile to /access-request).
  const handleSignIn = () => {
    if (isAuthenticated) { router.push('/'); return; }
    signInWithGoogle().catch((err: { code?: string }) => {
      // Previously fire-and-forget: a rejected popup vanished silently and the
      // button just looked dead. Cancelling is not an error worth shouting about.
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      logger.error('[Landing] Google sign-in failed:', err);
      toast.error(
        err?.code === 'auth/popup-blocked'
          ? 'Your browser blocked the sign-in pop-up. Allow pop-ups for this site and try again.'
          : 'Sign-in failed. Please check your connection and try again.'
      );
    });
  };

  const handleAction = handleSignIn;

  const tint = CHAPTERS[chapter];

  return (
    <div className="min-h-screen bg-[#F5F5F3] text-slate-900 font-sans selection:bg-amber-500/20 overflow-x-hidden">

      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      {/* ── STICKY NAV ─────────────────────────────────────────────────────── */}
      <motion.nav
        className="fixed top-0 left-0 z-50 flex items-center justify-between px-6 py-4 border-b border-black/5"
        style={{
          width: navWidth,
          background: 'rgba(245,245,243,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <Link href="/landing" aria-label="Motor SurveyOS Home">
          <Logo variant="light" size="sm" />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/features" className="hidden md:block text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors">Features</Link>
          <Link href="/pricing" className="hidden md:block text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors">Pricing</Link>
          <ProductsDropdown />
          {isAuthenticated ? (
            <button
              onClick={() => router.push('/')}
              aria-label="Dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm"
            >
              Dashboard <ArrowRight size={12} aria-hidden="true" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSignIn}
                aria-label="Sign In"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 rounded-full border border-black/15 hover:bg-slate-900 hover:text-white active:scale-95 transition-all"
              >
                Sign In
              </button>
              <button
                onClick={handleAction}
                aria-label="Start 14-Day Free Trial"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm"
              >
                Start 14-Day Free Trial <ArrowRight size={12} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </motion.nav>

      {/* ── FIXED CINEMATIC VIDEO BACKGROUND ───────────────────────────────── */}
      <motion.div
        className="fixed top-0 right-0 h-screen z-0 pointer-events-none"
        style={{ width: videoWidth, opacity: videoOpacity }}
      >
        <CinematicVideo scrollYProgress={scrollYProgress} scrollY={scrollY} chapter={chapter} />
      </motion.div>


      {/* ── PHASE 1: FULL SCREEN HERO ──────────────────────────────────────── */}
      <motion.div 
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="relative min-h-[120vh] w-full flex flex-col items-center pt-32 px-4 pb-32 bg-mesh-gradient"
      >
        <div className="absolute inset-0 bg-tech-grid opacity-[0.03] pointer-events-none" />
        
        <div className="relative z-20 flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Tag */}
          <motion.div 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
             className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-black/5 text-[11px] font-black text-amber-600 uppercase tracking-[0.2em] shadow-sm mb-8"
          >
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
               <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
             </span>
             Motor SurveyOS
          </motion.div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] text-slate-900 mb-6">
             <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>Motor surveying, </motion.span>
             <br />
             <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
               powered by AI.
             </motion.span>
          </h1>

          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mb-10"
          >
            Automatically extracts data from RC, DL, and Policies. Drafts final reports in minutes — not hours.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <button
              onClick={handleAction}
              aria-label={isAuthenticated ? 'Enter Dashboard' : 'Start 14-Day Free Trial'}
              className="w-full sm:w-auto relative inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 hover:scale-[1.03] active:scale-95 transition-all shadow-xl shadow-amber-500/20 overflow-hidden group"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="z-10 relative">{isAuthenticated ? 'Enter Dashboard' : 'Start 14-Day Free Trial'}</span>
              <ArrowRight size={16} className="z-10 relative" aria-hidden="true" />
            </button>
            
            <button
              onClick={() => {
                 window.scrollTo({ top: window.innerHeight * 1.2, behavior: 'smooth' });
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold text-slate-900 rounded-xl border border-black/10 hover:bg-slate-900 hover:text-white transition-all backdrop-blur-md"
            >
              <Play size={16} />
              Watch Demo
            </button>
          </motion.div>
        </div>

        {/* Dashboard Image Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 1 }}
          className="w-full max-w-5xl mx-auto mt-16 z-20 hidden md:block"
        >
          <button
            onClick={handleAction}
            aria-label={isAuthenticated ? 'Enter Dashboard' : 'Start Free Trial'}
            className="w-full group relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl shadow-amber-500/20 bg-white/10 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <Image
              src="/images/dashboard-mockup.png"
              alt="SurveyOS Prime Dashboard — click to get started"
              width={1200}
              height={800}
              className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.01]"
              priority
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-6 py-3 bg-amber-400 text-gray-900 text-sm font-bold rounded-full shadow-lg">
                {isAuthenticated ? 'Enter Dashboard' : 'Start Free Trial'}
              </span>
            </div>
          </button>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-12 flex flex-col items-center gap-2 text-slate-500"
        >
          <span className="text-[10px] uppercase tracking-widest font-bold">Scroll to explore</span>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
            <ChevronDown size={20} />
          </motion.div>
        </motion.div>
      </motion.div>


      {/* ── PHASE 2: LEFT CONTENT RAIL ─────────────────────────────────────── */}
      <motion.div
        className="w-full md:w-[30%] relative z-10 flex flex-col gap-4 px-4 pb-16 pt-32"
        style={{ opacity: leftPanelOpacity, x: leftPanelX }}
      >
        {/* ── Chapter glow bleeding from the right into this panel ──────── */}
        <motion.div
          className="fixed top-0 left-0 pointer-events-none w-full md:w-[30%]"
          animate={{
            background: `radial-gradient(ellipse 120% 80% at 100% 50%, rgba(${tint.glow},0.18) 0%, transparent 60%)`,
          }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{ height: '100vh', zIndex: 1 }}
        />

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
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{m.label}</div>
            </div>
          ))}
        </GlassCard>

        {/* ── 3. CHAPTER CARDS (How it Works) ─────────────────────────── */}
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 relative z-10 mt-4">
          How it works
        </div>

        {CHAPTERS.map((ch, i) => (
          <GlassCard
            key={i}
            role="button"
            aria-label={`View ${ch.tag} chapter`}
            onClick={() => setChapter(i)}
            className={`p-5 relative z-10 transition-all duration-500 cursor-pointer ${chapter === i ? 'ring-1' : 'opacity-70 hover:opacity-90'}`}
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

            <h3 className="text-base font-black text-slate-900 leading-snug mb-2 whitespace-pre-line">
              {ch.heading}
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              {ch.body}
            </p>

            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black ${ch.statColor}`}>
                {ch.stat}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{ch.statLabel}</span>
            </div>
          </GlassCard>
        ))}

        {/* ── 4. FEATURES CARD ─────────────────────────────────────────── */}
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 relative z-10 mt-4" id="features">
          Features
        </div>

        <GlassCard className="p-5 relative z-10">
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => {
              const tile = (
                <div className={`flex flex-col gap-2 p-3 rounded-xl border transition-colors h-full ${'href' in f ? 'bg-amber-400/5 border-amber-400/15 hover:bg-amber-400/10 hover:border-amber-400/30' : 'bg-black/[0.02] border-black/5 hover:bg-black/[0.04]'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${f.bg} ${f.color}`}>
                    {f.icon}
                  </div>
                  <div className="text-xs font-bold text-slate-900">{f.title}</div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</div>
                  {'href' in f && (
                    <div className="text-[10px] font-bold text-amber-500 mt-auto pt-1 flex items-center gap-0.5">
                      Read more <ChevronRight size={10} />
                    </div>
                  )}
                </div>
              );
              return 'href' in f ? (
                <Link key={i} href={(f as typeof f & { href: string }).href} className="flex">
                  {tile}
                </Link>
              ) : (
                <button key={i} onClick={handleAction} className="flex text-left w-full">
                  {tile}
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* ── 5. PRICING CARD ──────────────────────────────────────────── */}
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 relative z-10 mt-4" id="pricing">
          Pricing
        </div>

        <GlassCard className="p-5 relative z-10">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <div className="text-slate-900 font-black text-lg">Motor SurveyOS</div>
              <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-400/20 border border-amber-400/40 rounded-full">30 Days Free</span>
            </div>
            <div className="text-slate-500 text-xs mt-1">Everything included. No credit card required.</div>
          </div>
          <div className="flex items-baseline gap-1 mb-5">
            <span className="text-3xl font-black text-amber-500">₹799</span>
            <span className="text-slate-500 text-sm">/month</span>
          </div>
          {[
            'Unlimited claims & reports',
            'AI document extraction (OCR)',
            'Auto Google Drive sync',
            'LLM reconciliation engine',
            'Offline-first mobile support',
            'Priority support',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 py-1.5 border-b border-black/5 last:border-0">
              <div className="w-4 h-4 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </div>
              <span className="text-xs text-slate-700">{item}</span>
            </div>
          ))}
          <button
            onClick={handleAction}
            aria-label="Get Started Now"
            className="w-full mt-5 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform"
          >
            Get Started Now <ArrowRight size={16} aria-hidden="true" />
          </button>
        </GlassCard>

        {/* ── 6. CTA CARD ──────────────────────────────────────────────── */}
        <GlassCard
          className="p-6 text-center relative z-10 overflow-hidden mt-4"
          style={{ background: `rgba(${tint.glow},0.08)` } as React.CSSProperties}
        >
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ background: `radial-gradient(ellipse 80% 60% at 50% 100%, rgba(${tint.glow},0.25) 0%, transparent 70%)` }}
            transition={{ duration: 1 }}
          />
          <h2 className="text-lg font-black text-slate-900 mb-2 relative z-10">
            Ready to transform your workflow?
          </h2>
          <p className="text-xs text-slate-600 mb-5 relative z-10">
            Join thousands of surveyors delivering superior assessments in record time.
          </p>
          <button
            onClick={handleAction}
            aria-label="Open Motor SurveyOS"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg relative z-10"
          >
            Open Motor SurveyOS <ArrowRight size={16} aria-hidden="true" />
          </button>
        </GlassCard>

        {/* ── BLOG STRIP ───────────────────────────────────────────────── */}
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 relative z-10 mt-4">
          From the Blog
        </div>

        <Link href="/blog/surveyos-sync" className="relative z-10 block">
          <GlassCard className="p-5 hover:shadow-lg transition-shadow group cursor-pointer">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-600">
                Product
              </span>
              <span className="text-[9px] text-slate-400 font-bold">3 min read</span>
            </div>
            <h3 className="text-sm font-black text-slate-900 leading-snug mb-2 group-hover:text-amber-600 transition-colors">
              Never Lose Track of a Document Again
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              How SurveyOS Sync helps surveyors track every pending document across all claims and send reminders in one tap.
            </p>
            <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
              Read article <ChevronRight size={10} />
            </div>
          </GlassCard>
        </Link>

        {/* ── FOOTER ───────────────────────────────────────────────────────
            Opaque surface at z-20 on purpose. The cinematic video section
            paints dark scrims (rgba(2,6,23,.95)) at z-10, which were washing
            these links out at some scroll positions — legal links have to stay
            legible unconditionally, so the footer owns its own background. */}
        <div className="relative z-20 mt-6 rounded-2xl bg-[#F5F5F3] border border-black/5 px-5 py-8 text-center">
          <Link href="/landing" aria-label="Motor SurveyOS Home">
            <Logo variant="light" size="sm" className="justify-center mb-4" />
          </Link>

          {/* The only route from the landing page to the marketing and legal
              pages. The privacy notice in particular has to stay reachable. */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2.5 mb-5 text-[13px] font-medium text-slate-700">
            {[
              { href: '/features', label: 'Features' },
              { href: '/pricing', label: 'Pricing' },
              { href: '/about', label: 'About' },
              { href: '/faq', label: 'FAQ' },
              { href: '/contact', label: 'Contact' },
              { href: '/privacy', label: 'Privacy' },
              { href: '/terms', label: 'Terms' },
              { href: '/refund', label: 'Refunds' },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-amber-600 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Motor SurveyOS. Engineered for Surveyors.
          </p>
        </div>

      </motion.div>
    </div>
  );
}

