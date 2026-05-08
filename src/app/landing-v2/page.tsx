'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { signInWithGoogle } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { logger } from '@/lib/utils/logger';

import Logo from '@/components/ui/Logo';
import DemoSection from '@/components/landing/DemoSection';
import PricingSection from '@/components/landing/PricingSection';

import { AnimatedGradientText } from '@/components/ui/animated-gradient-text';
import { Spotlight } from '@/components/ui/spotlight';
import { Particles } from '@/components/ui/particles';
import { HeroVideoDialog } from '@/components/ui/hero-video-dialog';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { ShootingStars } from '@/components/ui/shooting-stars';

import { ScrollJourney } from '@/components/landing-v2/ScrollJourney';
import { BentoFeatures } from '@/components/landing-v2/BentoFeatures';
import { SceneLoader } from '@/components/landing-v2/SceneLoader';

const HeroScene = dynamic(
  () => import('@/components/landing-v2/HeroScene').then((m) => m.HeroScene),
  { ssr: false }
);

const MiniRobotScene = dynamic(
  () => import('@/components/landing-v2/MiniRobotScene').then((m) => m.MiniRobotScene),
  { ssr: false }
);

// ── FadeIn helper ──────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Metrics bar ────────────────────────────────────────────────────────────
function MetricsBar() {
  return (
    <section className="py-20 border-y border-gray-100 bg-white relative z-10">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 text-center">
        {[
          { value: '10',  unit: 'mins',     sub: 'Average Report Time', note: 'Down from 2+ hours manually' },
          { value: '80',  unit: 'KB',       sub: 'Pristine Images',     note: '5MB photos auto-compressed' },
          { value: '0',   unit: 'Breaches', sub: 'Data Secured',        note: 'Zero 3rd party databases' },
        ].map(({ value, unit, sub, note }, idx) => (
          <motion.div
            key={sub}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="py-8 md:py-0"
          >
            <div className="text-5xl font-black text-gray-900 mb-2">
              {value} <span className="text-2xl text-amber-500">{unit}</span>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{sub}</p>
            <p className="text-xs text-gray-400 mt-2">{note}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function LandingV2() {
  const { isAuthenticated, loading: authLoading } = useAuthStore();
  const [signingIn, setSigningIn] = useState(false);
  const router = useRouter();
  const heroScrollRef = useRef<number>(0);

  useEffect(() => {
    if (isAuthenticated && !authLoading) router.replace('/dashboard/');
  }, [isAuthenticated, authLoading, router]);

  const handleAction = async () => {
    if (isAuthenticated) { router.push('/dashboard/'); return; }
    setSigningIn(true);
    try { await signInWithGoogle(); }
    catch (error) { logger.error('Sign in failed', error); }
    finally { setSigningIn(false); }
  };

  return (
    <div className="min-h-screen bg-[#060F1A] text-white selection:bg-amber-500/20 font-sans">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="relative z-50 flex items-center justify-between px-6 lg:px-12 py-4 bg-[#060F1A]/80 backdrop-blur-xl border-b border-white/5 sticky top-0">
        <Logo variant="dark" size="md" />
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/50">
          <a href="#how"      className="hover:text-amber-400 transition-colors">How it works</a>
          <a href="#features" className="hover:text-amber-400 transition-colors">Features</a>
          <a href="#pricing"  className="hover:text-amber-400 transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleAction}
            className="hidden sm:block text-sm font-semibold text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            {isAuthenticated ? 'Dashboard' : 'Login'}
          </button>
          <button
            onClick={handleAction}
            disabled={signingIn}
            className="group inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[#060F1A] bg-amber-500 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
          >
            {signingIn
              ? <Loader2 size={16} className="animate-spin" />
              : <span>{isAuthenticated ? 'Go to App' : 'Launch App'}</span>
            }
            {!signingIn && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
          </button>
        </div>
      </nav>

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative h-screen min-h-[680px] flex flex-col items-center justify-center overflow-hidden">
          {/* 3D Canvas */}
          <div className="absolute inset-0">
            <SceneLoader>
              <HeroScene scrollProgressRef={heroScrollRef} />
            </SceneLoader>
          </div>

          {/* 21st.dev overlays */}
          <Spotlight className="-top-40 -left-20" fill="#F59E0B" />
          <Particles className="z-[2]" quantity={60} color="#F59E0B" size={0.4} staticity={60} />

          {/* Gradient so copy is readable */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#060F1A]/40 via-transparent to-[#060F1A]/80 pointer-events-none z-[3]" />

          {/* Copy */}
          <div className="relative z-[4] flex flex-col items-center text-center px-6 max-w-5xl mx-auto">
            <FadeIn delay={0.2}>
              <AnimatedGradientText className="mb-8">
                <span className="mr-2">✦</span> INTRODUCING SURVEYOS PRIME
              </AnimatedGradientText>
            </FadeIn>

            <FadeIn delay={0.35}>
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter leading-[1.05] mb-6 text-white">
                Motor surveying,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                  powered by AI.
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.5} className="max-w-2xl mb-10">
              <p className="text-lg md:text-xl text-white/60 font-medium leading-relaxed">
                SurveyOS Prime automatically extracts data from RC, DL, and Policies,
                and drafts final reports in minutes — not hours.
              </p>
            </FadeIn>

            <FadeIn delay={0.65} className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={handleAction}
                disabled={signingIn}
                className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-[#060F1A] bg-amber-500 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-amber-500/25 disabled:opacity-50 cursor-pointer"
              >
                {signingIn
                  ? <Loader2 size={20} className="animate-spin" />
                  : (isAuthenticated ? 'Enter Dashboard' : 'Start Free Trial')
                }
                {!signingIn && <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />}
              </button>
              <HeroVideoDialog
                videoSrc="https://www.youtube.com/embed/dQw4w9WgXcQ"
                thumbnailAlt="SurveyOS Prime demo video"
              />
            </FadeIn>
          </div>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[4] flex flex-col items-center gap-2"
          >
            <span className="text-white/25 text-xs tracking-widest uppercase">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-px h-10 bg-gradient-to-b from-white/20 to-transparent"
            />
          </motion.div>
        </section>

        {/* ── Scroll Journey (sticky 3D) ─────────────────────────────────────── */}
        <ScrollJourney />

        {/* ── Metrics ───────────────────────────────────────────────────────── */}
        <MetricsBar />

        {/* ── Bento Features ────────────────────────────────────────────────── */}
        <section id="features">
          <BentoFeatures />
        </section>

        {/* ── Demo Section + ShootingStars ──────────────────────────────────── */}
        <div className="relative">
          <ShootingStars className="z-0" starColor="#D4AF37" minDelay={2000} maxDelay={5000} />
          <DemoSection onCta={handleAction} />
        </div>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <div id="pricing">
          <PricingSection onCta={handleAction} />
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="relative py-32 px-6 lg:px-12 text-center overflow-hidden bg-[#05050A] text-white">
          <BackgroundBeams />
          <div className="relative z-10 max-w-3xl mx-auto">
            <MiniRobotScene />
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-black tracking-tight mt-8 mb-6"
            >
              Ready to revolutionize<br />your workflow?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-xl text-white/40 mb-10"
            >
              Deliver superior assessments in record time.
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              onClick={handleAction}
              disabled={signingIn}
              className="inline-flex items-center justify-center gap-2 px-10 py-5 text-lg font-bold text-[#05050A] bg-amber-500 rounded-full hover:scale-105 transition-transform shadow-[0_0_50px_rgba(245,158,11,0.3)] disabled:opacity-50 cursor-pointer"
            >
              {signingIn ? <Loader2 size={24} className="animate-spin" /> : 'Open SurveyOS Prime'}
              {!signingIn && <ArrowRight size={20} />}
            </motion.button>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-white/5 bg-[#05050A]">
        <div className="max-w-6xl mx-auto">
          <Logo variant="dark" size="sm" className="justify-center mb-6" />
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/30 mb-5">
            <Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms"   className="hover:text-amber-400 transition-colors">Terms of Service</Link>
            <Link href="/refund"  className="hover:text-amber-400 transition-colors">Refund Policy</Link>
            <Link href="/contact" className="hover:text-amber-400 transition-colors">Contact</Link>
          </div>
          <p className="text-center text-sm text-white/20">
            © {new Date().getFullYear()} SurveyOS Prime. Engineered for Surveyors.
          </p>
        </div>
      </footer>
    </div>
  );
}
