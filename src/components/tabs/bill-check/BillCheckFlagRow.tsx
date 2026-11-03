'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { BillFlag } from '@/lib/reports/bill-check-flags';
import { scorePair, sideConflicts } from '@/lib/reports/bill-match-score';
import type { AssessmentRow, ExtraBillItem } from '@/types';

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

/** A description word by word, the words that clash (LH vs RH) tinted red. */
function Words({ text, clash }: { text: string; clash: Set<string> }) {
  return (
    <>
      {text.split(/\s+/).filter(Boolean).map((w, i) => (
        <span
          key={i}
          className={clash.has(w.toLowerCase()) ? 'text-status-danger bg-status-danger/10 rounded px-1' : undefined}
        >
          {w}{' '}
        </span>
      ))}
    </>
  );
}

/**
 * Detail for a doubtful auto-match: the estimate row and the bill line it was
 * matched to, side by side, so the surveyor can see at a glance what clashes.
 */
export function BillCheckMatchDetail({
  flag, row, serial, extraBillItems, colSpan, onConfirm, onUnlink, onUseOther,
}: {
  flag: BillFlag;
  row: AssessmentRow;
  serial: number | undefined;
  extraBillItems: ExtraBillItem[];
  colSpan: number;
  onConfirm: () => void;
  onUnlink: () => void;
  onUseOther: (extraId: string) => void;
}) {
  const match = row.refMatch;
  const clash = match ? sideConflicts(row.particulars, match.bill.description) : new Set<string>();
  const others = extraBillItems
    .map(extra => ({ extra, score: scorePair(row, extra).score }))
    // Below MIN_SCORE on purpose: the right line may be one the matcher refused.
    .filter(o => o.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  return (
    <div
      className="px-6 py-4"
      style={{
        gridColumn: `span ${colSpan}`,
        borderLeft: '4px solid var(--color-status-warning)',
        background: 'var(--color-neutral-50)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <Info size={16} className="text-status-warning shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{flag.heading}</div>

          {match ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs" style={{ maxWidth: '80ch' }}>
                <div className="rounded-lg border border-border p-2.5">
                  <div className="text-muted-foreground">Estimate row {serial ?? '—'}</div>
                  <div className="mt-1 font-medium text-foreground"><Words text={row.particulars} clash={clash} /></div>
                  <div className="mt-1 text-foreground">{rs(flag.assessed)}</div>
                </div>
                <div className="rounded-lg border border-border p-2.5">
                  <div className="text-muted-foreground">Bill item {match.bill.srNo ?? '—'}</div>
                  <div className="mt-1 font-medium text-foreground"><Words text={match.bill.description} clash={clash} /></div>
                  <div className={Math.abs(match.bill.taxableAmount - flag.assessed) <= 1 ? 'mt-1 text-status-success' : 'mt-1 text-foreground'}>
                    {rs(match.bill.taxableAmount)}
                  </div>
                </div>
              </div>
              <p className="text-xs mt-2 text-muted-foreground">
                {match.score}% match{match.reasons.length > 0 && ` · ${match.reasons.join(' · ')}`}
              </p>
            </>
          ) : (
            <p className="text-xs mt-2.5 text-muted-foreground" style={{ maxWidth: '62ch', lineHeight: 1.6 }}>
              {flag.detail}
            </p>
          )}

          {match && others.length > 0 && (
            <div className="mt-3 text-xs">
              <div className="text-muted-foreground">Other bill lines that could fit</div>
              {others.map(({ extra, score }) => (
                <div key={extra.id} className="flex items-center gap-2 mt-1 text-foreground">
                  <span>Bill {extra.srNo ?? '—'} · {extra.description} · {rs(extra.taxableAmount)} · {score}%</span>
                  <button
                    onClick={() => onUseOther(extra.id)}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium border border-border text-foreground"
                  >
                    Use this
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={onConfirm}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground"
            >
              Right line
            </button>
            {match && (
              <button
                onClick={onUnlink}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground"
              >
                Wrong line — unlink
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
