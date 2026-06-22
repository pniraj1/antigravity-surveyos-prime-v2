import { cn } from '@/lib/utils';
import { stageVariant } from '@/lib/claims/stage-variant';

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const variant = stageVariant(stage);
  const muted = variant === 'default';
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', className)}
      style={{
        color: muted ? 'var(--color-neutral-600)' : 'var(--color-neutral-900)',
        background: 'var(--color-neutral-100)',
      }}
    >
      {stage}
    </span>
  );
}
