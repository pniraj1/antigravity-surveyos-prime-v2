'use client';

import { Clock } from 'lucide-react';

interface TrialBadgeProps {
  daysLeft: number;
}

export function TrialBadge({ daysLeft }: TrialBadgeProps) {
  const color =
    daysLeft <= 5
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : daysLeft <= 10
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

  return (
    <div
      className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold backdrop-blur-sm ${color}`}
    >
      <Clock size={14} />
      <span>Trial: {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</span>
    </div>
  );
}
