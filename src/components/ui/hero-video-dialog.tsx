'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HeroVideoDialogProps {
  videoSrc: string;
  thumbnailSrc?: string;
  thumbnailAlt?: string;
  className?: string;
}

export function HeroVideoDialog({
  videoSrc,
  thumbnailSrc,
  thumbnailAlt = 'Watch demo video',
  className,
}: HeroVideoDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'group relative flex items-center gap-3 cursor-pointer',
          className
        )}
        aria-label="Watch demo video"
      >
        {/* Play button */}
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40 backdrop-blur-sm transition-colors group-hover:bg-amber-500/30">
          <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-amber-500/30" />
          {/* Triangle */}
          <svg
            className="h-5 w-5 text-amber-400 translate-x-0.5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="text-sm font-medium text-amber-200 group-hover:text-amber-100 transition-colors">
          Watch Demo
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={videoSrc}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={thumbnailAlt}
              />
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                aria-label="Close video"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
