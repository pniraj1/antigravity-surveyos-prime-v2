import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'danger';
const TONE: Record<Tone, { color: string; bg: string }> = {
  success: { color: 'var(--color-status-success)', bg: 'var(--color-status-success-tint)' },
  warning: { color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-tint)' },
  danger:  { color: 'var(--color-status-danger)',  bg: 'var(--color-status-danger-tint)' },
};

export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', className)}
      style={{ color: TONE[tone].color, background: TONE[tone].bg }}
    >
      {children}
    </span>
  );
}
