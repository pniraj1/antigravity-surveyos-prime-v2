'use client';
import { cn } from '@/lib/utils';

interface AnimatedGradientTextProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedGradientText({ children, className }: AnimatedGradientTextProps) {
  return (
    <div
      className={cn(
        'relative mx-auto flex max-w-fit items-center justify-center rounded-full',
        'bg-white/40 px-4 py-1.5 backdrop-blur-sm',
        'shadow-[inset_0_-6px_10px_#8fdfff1f] transition-shadow duration-500',
        'hover:shadow-[inset_0_-6px_10px_#8fdfff3f]',
        className
      )}
    >
      <span
        className="animate-gradient-text inline bg-[linear-gradient(to_right,#F59E0B,#D4AF37,#F59E0B)] bg-[length:300%] bg-clip-text text-xs font-bold text-transparent"
      >
        {children}
      </span>
    </div>
  );
}
