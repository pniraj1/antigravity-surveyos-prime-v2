'use client';
import { useMotionValue, useMotionTemplate, motion } from 'framer-motion';
import type { MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HeroHighlightProps {
  children: ReactNode;
  className?: string;
}

export function HeroHighlight({ children, className }: HeroHighlightProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function onMouseMove({ currentTarget, clientX, clientY }: MouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const spotlight = useMotionTemplate`radial-gradient(200px circle at ${mouseX}px ${mouseY}px, rgba(212,175,55,0.13), transparent 80%)`;

  return (
    <div
      className={cn(
        'group relative w-full',
        '[background-image:radial-gradient(#E2E6EA_1px,transparent_1px)] [background-size:24px_24px]',
        className
      )}
      onMouseMove={onMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spotlight }}
      />
      {children}
    </div>
  );
}
