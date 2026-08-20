'use client';

import { AlertTriangle, Ban } from 'lucide-react';
import type { BillFlag, InvoiceReconciliation } from '@/lib/reports/bill-check-flags';

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const rs = (n: number) => `₹${INR.format(n)}`;

/**
 * Two concerns, two bars. The red one blocks Power Print; the amber one never
 * does — blocking on things the report already states correctly trains a
 * surveyor to click through warnings, including the ones that matter.
 */
export function BillCheckAttentionBanner({
  flags,
  reconciliation,
  onConfirmAllBelow,
  onKeepAllAbove,
}: {
  flags: BillFlag[];
  reconciliation: InvoiceReconciliation;
  onConfirmAllBelow: () => void;
  onKeepAllAbove: () => void;
}) {
  const below = flags.filter(f => f.kind === 'billed-below');
  const above = flags.filter(f => f.kind === 'billed-above');
  const rejected = flags.filter(f => f.kind === 'billed-rejected');
  const blocking = below.length + above.length;

  if (blocking === 0 && rejected.length === 0 && reconciliation.reconciles) return null;

  return (
    <div className="flex flex-col gap-2">
      {blocking > 0 && (
        <div className="flex gap-3 items-start p-3.5 rounded-xl border border-status-danger bg-status-danger/10">
          <Ban size={17} className="text-status-danger shrink-0 mt-0.5" />
          <div className="flex-1 text-xs" style={{ lineHeight: 1.6 }}>
            <div className="text-sm font-medium text-foreground mb-0.5">
              {blocking} item{blocking === 1 ? '' : 's'} need your decision before this bill check can be issued
            </div>
            {below.length > 0 && <>{below.length} billed below your assessment. </>}
            {above.length > 0 && <>{above.length} billed above it. </>}
            Printing is blocked until each has been looked at.
            <div className="flex gap-2 mt-2.5">
              {below.length > 0 && (
                <button onClick={onConfirmAllBelow} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground">
                  Confirm all {below.length} billed under
                </button>
              )}
              {above.length > 0 && (
                <button onClick={onKeepAllAbove} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground">
                  Keep my assessment on all {above.length}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {(!reconciliation.reconciles || rejected.length > 0) && (
        <div className="flex gap-3 items-start p-3.5 rounded-xl border border-status-warning bg-status-warning/10">
          <AlertTriangle size={17} className="text-status-warning shrink-0 mt-0.5" />
          <div className="flex-1 text-xs" style={{ lineHeight: 1.6 }}>
            {!reconciliation.reconciles && (
              <>
                <div className="text-sm font-medium text-foreground mb-0.5">
                  The line items don&apos;t add up to the invoice total
                </div>
                The invoice states <b>{rs(reconciliation.invoiceTotal)}</b>. The items total{' '}
                <b>{rs(reconciliation.lineTotal)}</b> — a gap of <b>{rs(reconciliation.gap)}</b>.
                A line was missed or misread when the bill was read.
              </>
            )}
            {rejected.length > 0 && (
              <div className={reconciliation.reconciles ? '' : 'mt-2'}>
                The workshop billed for {rejected.length} item{rejected.length === 1 ? '' : 's'} you
                rejected at final survey. {rejected.length === 1 ? 'It carries' : 'They carry'} no
                liability and the report shows {rejected.length === 1 ? 'it' : 'them'} as billed
                against rejected items.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
