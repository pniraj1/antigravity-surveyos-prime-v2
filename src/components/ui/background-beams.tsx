'use client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const BEAMS = [
  { x1: '10%', x2: '60%', delay: 0,   duration: 12 },
  { x1: '90%', x2: '40%', delay: 2.5, duration: 15 },
  { x1: '50%', x2: '10%', delay: 1,   duration: 10 },
  { x1: '50%', x2: '90%', delay: 5,   duration: 18 },
  { x1: '30%', x2: '70%', delay: 3,   duration: 14 },
  { x1: '70%', x2: '30%', delay: 7,   duration: 11 },
  { x1: '20%', x2: '80%', delay: 0.5, duration: 16 },
  { x1: '80%', x2: '20%', delay: 4,   duration: 13 },
];

export function BackgroundBeams({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bg-radial" cx="50%" cy="20%" r="70%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0D1B2A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0D1B2A" stopOpacity="0" />
            <stop offset="40%" stopColor="#F59E0B" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-radial)" />
        {BEAMS.map((b, i) => (
          <motion.line
            key={i}
            x1={b.x1} y1="0%" x2={b.x2} y2="100%"
            stroke="url(#beam-gradient)"
            strokeWidth="1.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 1, 0], opacity: [0, 0.5, 0] }}
            transition={{
              duration: b.duration,
              delay: b.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </svg>
    </div>
  );
}
