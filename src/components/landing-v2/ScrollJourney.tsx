'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValueEvent, type MotionValue } from 'framer-motion';
import { FileText, Cpu, FileCheck2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { SceneLoader } from './SceneLoader';

const HeroScene = dynamic(
  () => import('./HeroScene').then((m) => m.HeroScene),
  { ssr: false }
);

// ── Act data ───────────────────────────────────────────────────────────────

const ACTS = [
  {
    title: 'AI Reads Every Document',
    desc: 'RC Book, Driving Licence, Insurance Policy — every field extracted with 99.9% accuracy in seconds.',
    Icon: FileText,
    accentColor: 'text-amber-400',
    row1: ['RC: MH12AB1234', 'Engine: K12B1234567', 'Chassis: MA3EF1S00178234'],
    row2: ['IDV: ₹4,50,000', 'Valid Until: 31/03/2026', 'Fuel: Diesel'],
  },
  {
    title: 'AI Learns & Cross-Checks',
    desc: 'Conflicts between documents surface instantly. The AI robot logs every finding in real time.',
    Icon: Cpu,
    accentColor: 'text-blue-400',
    row1: ['Owner name: MATCH ✓', 'DL validity: VALID ✓', 'Policy active: YES ✓'],
    row2: ['Conflicts found: 0', 'Fields verified: 18', 'Accuracy: 99.9%'],
  },
  {
    title: 'Report Ready in Seconds',
    desc: 'A submission-ready survey report is generated and pushed to your Google Drive automatically.',
    Icon: FileCheck2,
    accentColor: 'text-green-400',
    row1: ['CLM-2024-001234', 'Assessment: ₹85,420', 'Surveyor: R.S. Joshi'],
    row2: ['Status: DRAFT', 'PDF: Ready', 'Drive: Synced ✓'],
  },
] as const;

// ── Parallax card row ──────────────────────────────────────────────────────

function ParallaxRow({ items, yMotion, accent }: { items: readonly string[]; yMotion: MotionValue<number>; accent: string }) {
  const y = useSpring(yMotion, { stiffness: 200, damping: 30, mass: 0.5 });
  return (
    <motion.div style={{ y }} className="flex gap-3 flex-nowrap">
      {items.map((item) => (
        <div
          key={item}
          className={`bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap backdrop-blur-sm ${accent}`}
        >
          {item}
        </div>
      ))}
    </motion.div>
  );
}

// ── Step dots ──────────────────────────────────────────────────────────────

function StepDots({ active }: { active: number }) {
  return (
    <div className="flex items-center gap-3">
      {ACTS.map((_, i) => (
        <motion.div
          key={i}
          animate={{ width: i === active ? 24 : 8, opacity: i === active ? 1 : 0.3 }}
          className="h-2 rounded-full bg-amber-500"
        />
      ))}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export function ScrollJourney() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<number>(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    scrollProgressRef.current = v;
  });

  const actProgress = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [0, 1, 2, 2]);
  const row1Y = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const row2Y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const sceneOpacity = useTransform(scrollYProgress, [0.75, 1], [1, 0]);

  return (
    <section ref={containerRef} className="relative h-[280vh]" id="how">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#060F1A]">
        {/* 3D canvas */}
        <motion.div className="absolute inset-0" style={{ opacity: sceneOpacity }}>
          <SceneLoader>
            <HeroScene scrollProgressRef={scrollProgressRef} />
          </SceneLoader>
        </motion.div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060F1A] via-[#060F1A]/40 to-transparent pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-end pb-12 px-6 lg:px-16 max-w-7xl mx-auto">
          <motion.div
            key={Math.round(actProgress.get())}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8"
          >
            <StepDots active={Math.round(actProgress.get())} />
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mt-4 mb-3">
              {ACTS[Math.min(Math.round(actProgress.get()), 2)].title}
            </h2>
            <p className="text-white/50 text-lg max-w-xl">
              {ACTS[Math.min(Math.round(actProgress.get()), 2)].desc}
            </p>
          </motion.div>

          {/* Parallax card rows */}
          <div className="space-y-3 overflow-hidden pb-2">
            <ParallaxRow
              items={ACTS[Math.min(Math.round(actProgress.get()), 2)].row1}
              yMotion={row1Y}
              accent={ACTS[Math.min(Math.round(actProgress.get()), 2)].accentColor}
            />
            <ParallaxRow
              items={ACTS[Math.min(Math.round(actProgress.get()), 2)].row2}
              yMotion={row2Y}
              accent="text-white/60"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
