'use client';

import { AlertCircle, Trash2 } from 'lucide-react';
import type { ExtraBillItem } from '@/types';

interface Props {
  extraBillItems: ExtraBillItem[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  fmt: (n: number) => string;
}

export function ExtraBillItemsPanel({ extraBillItems, onDelete, onClearAll, fmt }: Props) {
  if (extraBillItems.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden bg-white border-2 border-status-danger">
      <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-border bg-status-danger/10">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-status-danger flex-shrink-0" style={{ marginTop: 2 }} />
          <div>
            <div className="text-sm font-medium text-status-danger">
              ⚠ Extra Bill Items — Not in Assessment ({extraBillItems.length})
            </div>
            <div className="text-xs mt-0.5 text-status-danger">
              The workshop billed for these items but they were NOT in the Assessment. Review carefully — these may be unauthorized additions.
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm(`Clear all ${extraBillItems.length} extra bill items? This cannot be undone.`)) onClearAll();
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all hover:opacity-90 bg-status-danger text-white"
        >
          <Trash2 size={14} />
          Clear All
        </button>
      </div>

      <div
        className="px-6 py-3 grid gap-3 text-[9px] font-medium uppercase tracking-[0.15em] border-b border-border text-muted-foreground bg-neutral-50"
        style={{ gridTemplateColumns: '2fr 120px 120px 40px' }}
      >
        <span>Description</span>
        <span>Category</span>
        <span>Amount (₹)</span>
        <span></span>
      </div>

      {extraBillItems.map((item) => (
        <div
          key={item.id}
          className="px-6 py-3 grid gap-3 items-center border-2 border-status-danger rounded-lg mx-3 my-1.5 bg-status-danger/5"
          style={{
            gridTemplateColumns: '2fr 120px 120px 40px',
          }}
        >
          <div className="text-sm font-medium text-foreground">{item.description}</div>
          <div>
            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider bg-neutral-100 text-muted-foreground">
              {item.category || '—'}
            </span>
          </div>
          <div className="text-sm font-medium text-status-danger">{fmt(item.amount)}</div>
          <button
            onClick={() => { if (confirm('Delete this extra bill item?')) onDelete(item.id); }}
            className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-status-danger/10 text-status-danger"
            title="Delete item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div
        className="px-6 py-3 grid gap-3 border-t border-status-danger/30 bg-status-danger/10"
        style={{ gridTemplateColumns: '2fr 120px 120px 40px' }}
      >
        <div className="text-xs font-medium uppercase tracking-widest text-status-danger">Extra Billed Total</div>
        <div />
        <div className="text-sm font-medium text-status-danger">
          {fmt(extraBillItems.reduce((s, i) => s + (i.amount || 0), 0))}
        </div>
        <div />
      </div>
    </div>
  );
}
