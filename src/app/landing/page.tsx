'use client';

import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import {
  ArrowRight, Cloud, Camera, Shield, FileText, ChevronRight, Play,
  Zap, Cpu, Clock, Lock, ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';

import Logo from '@/components/ui/Logo';
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
  const [chapter, setChapter] = useState(0);
  const router = useRouter();
  // isPending removed — SubscriptionGuard at / handles pending users now

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
    if (isAuthenticated && !authLoading) router.push('/dashboard');
  }, [isAuthenticated, authLoading, router]);

  // Existing users: Sign In via Google OAuth (full-page redirect)
  const handleSignIn = () => {
    if (isAuthenticated) { router.push('/dashboard'); return; }
    sessionStorage.setItem('surveyos_auth_intent', 'signin');
    signInWithGoogle();
  };

  // New users / CTAs: route to dedicated signup page
  const handleAction = () => {
    if (isAuthenticated) { router.push('/dashboard'); return; }
    sessionStorage.setItem('surveyos_auth_intent', 'signup');
    router.push('/signup');
  };

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
        <Logo variant="light" size="sm" />
        {isAuthenticated ? (
          <button
            onClick={() => router.push('/dashboard')}
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
              aria-label="Start 30-Day Free Trial"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm"
            >
              Start 30-Day Free Trial <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
        )}
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
              aria-label={isAuthenticated ? 'Enter Dashboard' : 'Start 30-Day Free Trial'}
              className="w-full sm:w-auto relative inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 hover:scale-[1.03] active:scale-95 transition-all shadow-xl shadow-amber-500/20 overflow-hidden group"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="z-10 relative">{isAuthenticated ? 'Enter Dashboard' : 'Start 30-Day Free Trial'}</span>
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
          className="w-full max-w-5xl mx-auto mt-16 z-20 pointer-events-none hidden md:block"
        >
          <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl shadow-amber-500/20 bg-white/10 backdrop-blur-sm">
            <Image
              src="/images/dashboard-mockup.png"
              alt="SurveyOS Prime Dashboard"
              width={1200}
              height={800}
              className="w-full h-auto object-cover"
              priority
            />
          </div>
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

            <h3 className="text-base font-black text-slate-900 leading-snug mb-2 whitespace-pre-line">
              {ch.heading}
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              {ch.body}
            </p>

            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r`}
                style={{ color: `rgb(${ch.glow})` }}>
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
            {FEATURES.map((f, i) => (
              <div key={i} className="flex flex-col gap-2 p-3 rounded-xl bg-black/[0.02] border border-black/5 hover:bg-black/[0.04] transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${f.bg} ${f.color}`}>
                  {f.icon}
                </div>
                <div className="text-xs font-bold text-slate-900">{f.title}</div>
                <div className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
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

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <div className="text-center text-xs text-slate-500 pt-4 pb-2 relative z-10">
          <Logo variant="light" size="sm" className="justify-center mb-3" />
          © {new Date().getFullYear()} Motor SurveyOS. Engineered for Surveyors.
        </div>

      </motion.div>
    </div>
  );
}

