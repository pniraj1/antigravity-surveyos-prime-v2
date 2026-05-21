'use client';

import { useEffect, useRef } from 'react';
import { motion, MotionValue, useMotionValueEvent } from 'framer-motion';

/** Chapter colour palettes for Narrative Sync (Approach B) */
const CHAPTER_TINTS: Record<number, { color: string; glow: string; label: string }> = {
  0: { color: 'rgba(245,158,11,0.15)',  glow: '245,158,11',   label: 'Capture'  }, // amber
  1: { color: 'rgba(59,130,246,0.15)',  glow: '59,130,246',   label: 'Analyse'  }, // blue
  2: { color: 'rgba(16,185,129,0.15)',  glow: '16,185,129',   label: 'Deliver'  }, // emerald
};

interface CinematicVideoProps {
  scrollYProgress: MotionValue<number>;
  scrollY: MotionValue<number>;
  chapter: number;
}

export default function CinematicVideo({ scrollYProgress, scrollY, chapter }: CinematicVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tint = CHAPTER_TINTS[chapter] ?? CHAPTER_TINTS[0];

  // ── B: Narrative Sync — drive video playback from scroll visibility ──────────────
  useMotionValueEvent(scrollY, 'change', (latest) => {
    const video = videoRef.current;
    if (!video) return;
    
    // Video starts fading in after scrollY > 100, so we play it then.
    if (latest > 100) {
      if (video.paused) {
        video.play().catch(() => {});
      }
    } else {
      if (!video.paused) {
        video.pause();
        // Reset to beginning when we go back to Phase 1
        video.currentTime = 0;
      }
    }
  });

  // Pause on mount — start paused until scroll makes it visible
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }, []);

  return (
    /**
     * ── mask-image on the OUTER container ──────────────────────────────────
     * This is the key to a real dissolve: the CSS mask clips the video's own
     * pixels to alpha=0 on the left edge, then ramps to alpha=1 by ~22%.
     * No background-color paint, no fake overlay — the video genuinely
     * becomes transparent, letting whatever is behind it (the section bg /
     * the left column) show through seamlessly.
     */
    <div className="relative w-full h-full overflow-visible">
      {/* ── Dark bleed extending LEFT into the page content ── */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-0"
        style={{
          left: '-20vw',
          width: '20vw',
          background: 'linear-gradient(to right, transparent 0%, rgba(2,6,23,0.6) 60%, rgba(2,6,23,0.95) 100%)',
        }}
      />

      {/* ── Inner fade to blend the video's hard edge ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(to right, rgba(2,6,23,0.95) 0%, rgba(2,6,23,0.3) 15%, transparent 35%)',
        }}
      />

      {/* ── Video element ──────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        src="/hero-cinematic.mp4"
        muted
        playsInline
        loop
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0"
        style={{ willChange: 'transform' }}
      />

      {/* ── B: Chapter colour-grade overlay ───────────────────────────────── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ backgroundColor: tint.color }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        style={{ mixBlendMode: 'multiply' }}
      />

      {/*
       * ── A: Chapter glow that SPILLS LEFTWARD beyond the video edge ────────
       * The ellipse is anchored at x=-20% (outside the left boundary of this
       * div). Because the outer wrapper has overflow-visible, the glow
       * actually renders into the left content column — coloured light
       * radiating from the video's edge into the text area.
       */}
      <motion.div
        className="absolute pointer-events-none"
        animate={{
          background: `radial-gradient(ellipse 55% 60% at -20% 50%, rgba(${tint.glow},0.35) 0%, transparent 70%)`,
        }}
        transition={{ duration: 1.1, ease: 'easeInOut' }}
        style={{ inset: 0, overflow: 'visible' }}
      />

      {/* ── Top/bottom vignette for cinematic letterbox feel ─────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 18%, transparent 82%, rgba(0,0,0,0.35) 100%)',
        }}
      />

      {/* ── Chapter label badge ───────────────────────────────────────────── */}
      <motion.div
        key={chapter}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="absolute bottom-8 right-8 pointer-events-none z-10"
      >
        <div
          className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-sm"
          style={{
            color: `rgb(${tint.glow})`,
            borderColor: `rgba(${tint.glow},0.35)`,
            background: `rgba(${tint.glow},0.1)`,
          }}
        >
          {tint.label}
        </div>
      </motion.div>

      {/* ── Scroll progress spine on right edge ───────────────────────────── */}
      <div className="absolute right-0 top-8 bottom-8 w-px bg-white/10 pointer-events-none z-10">
        <motion.div
          className="w-full rounded-full origin-top"
          animate={{ backgroundColor: `rgb(${tint.glow})` }}
          transition={{ duration: 0.8 }}
          style={{ height: '100%', scaleY: scrollYProgress }}
        />
      </div>
    </div>
  );
}
