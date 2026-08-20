'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { BillFlag } from '@/lib/reports/bill-check-flags';

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rs = (n: number) => `₹${INR.format(n)}`;

/**
 * The mark sits in its own narrow column beside Sr, so one edge can be scanned
 * for every row wanting attention.
 */
export function BillCheckFlagMark({ flag, open, onToggle }: {
  flag: BillFlag; open: boolean; onToggle: () => void;
}) {
  const blocking = flag.blocking;
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      title={flag.heading}
      className="flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-bold"
      style={{
        background: blocking ? 'var(--color-status-danger)' : 'var(--color-status-warning)',
        color: '#fff',
      }}
    >
      {blocking ? '!' : '?'}
    </button>
  );
}

/**
 * Opened by clicking the mark, not by hovering. Hover cannot hold buttons you
 * need to press, vanishes on scroll, and does not exist on a tablet in a
 * workshop. This stays open until a decision is made.
 */
export function BillCheckFlagDetail({ flag, onConfirm, onRaise, colSpan }: {
  flag: BillFlag;
  onConfirm: () => void;
  onRaise: (amount: number) => void;
  colSpan: number;
}) {
  const blocking = flag.blocking;
  return (
    <div
      className="px-6 py-4"
      style={{
        gridColumn: `span ${colSpan}`,
        borderLeft: `4px solid ${blocking ? 'var(--color-status-danger)' : 'var(--color-status-warning)'}`,
        background: 'var(--color-neutral-50)',
      }}
    >
      <div className="flex items-start gap-2.5">
        {blocking
          ? <AlertTriangle size={16} className="text-status-danger shrink-0 mt-0.5" />
          : <Info size={16} className="text-status-warning shrink-0 mt-0.5" />}
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{flag.heading}</div>

          <div className="mt-2 grid gap-x-4 gap-y-1 text-xs" style={{ gridTemplateColumns: 'auto auto', width: 'fit-content' }}>
            <span className="text-muted-foreground">Estimate</span>
            <span className="text-right font-medium text-foreground">{rs(flag.estimate)}</span>
            <span className="text-muted-foreground">You allowed</span>
            <span className="text-right font-medium text-foreground">{rs(flag.assessed)}</span>
            <span className="text-muted-foreground">Invoice</span>
            <span className="text-right font-medium" style={{ color: blocking ? 'var(--color-status-danger)' : 'var(--color-status-warning)' }}>
              {rs(flag.billed)}
            </span>
          </div>

          <p className="text-xs mt-2.5 text-muted-foreground" style={{ maxWidth: '62ch', lineHeight: 1.6 }}>
            {flag.detail}
          </p>

          {(flag.kind === 'billed-below' || flag.kind === 'billed-above') && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onConfirm}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground"
              >
                Confirm {rs(flag.kind === 'billed-below' ? flag.billed : flag.assessed)}
              </button>
              <button
                onClick={() => onRaise(flag.billed)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground"
              >
                {flag.kind === 'billed-below' ? 'Allow a different amount' : `Raise to ${rs(flag.billed)}`}
              </button>
            </div>
          )}

          {!blocking && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onConfirm}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground"
              >
                Noted
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
