'use client';
import { Suspense, type ReactNode } from 'react';
import { motion } from 'framer-motion';

function Placeholder() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0D1B2A 0%, #1E293B 50%, #0D1B2A 100%)' }}
    >
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-4 border-white/10 border-t-amber-500 rounded-full mx-auto mb-4"
        />
        <p className="text-white/30 text-xs font-semibold tracking-[0.25em] uppercase">
          Loading Scene
        </p>
      </div>
    </motion.div>
  );
}

export function SceneLoader({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Placeholder />}>{children}</Suspense>;
}
