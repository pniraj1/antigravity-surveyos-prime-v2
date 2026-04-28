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
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '2px solid #ef4444' }}>
      <div className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid #F0F2F5', background: 'rgba(239,68,68,0.06)' }}>
        <div className="flex items-start gap-3">
          <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="text-sm font-black" style={{ color: '#b91c1c' }}>
              ⚠ Extra Bill Items — Not in Assessment ({extraBillItems.length})
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#7f1d1d' }}>
              The workshop billed for these items but they were NOT in the Assessment. Review carefully — these may be unauthorized additions.
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm(`Clear all ${extraBillItems.length} extra bill items? This cannot be undone.`)) onClearAll();
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all hover:opacity-90"
          style={{ background: '#dc2626', color: '#fff' }}
        >
          <Trash2 size={14} />
          Clear All
        </button>
      </div>

      <div
        className="px-6 py-3 grid gap-3 text-[9px] font-black uppercase tracking-[0.15em]"
        style={{ gridTemplateColumns: '2fr 120px 120px 40px', borderBottom: '1px solid #E2E6EA', color: '#8D99AE', background: '#FAFAFA' }}
      >
        <span>Description</span>
        <span>Category</span>
        <span>Amount (₹)</span>
        <span></span>
      </div>

      {extraBillItems.map((item) => (
        <div
          key={item.id}
          className="px-6 py-3 grid gap-3 items-center"
          style={{
            gridTemplateColumns: '2fr 120px 120px 40px',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            margin: '6px 12px',
            background: 'rgba(239,68,68,0.04)',
          }}
        >
          <div className="text-sm font-semibold" style={{ color: '#0D1B2A' }}>{item.description}</div>
          <div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: '#F0F2F5', color: '#4A4E69' }}>
              {item.category || '—'}
            </span>
          </div>
          <div className="text-sm font-bold" style={{ color: '#b91c1c' }}>{fmt(item.amount)}</div>
          <button
            onClick={() => { if (confirm('Delete this extra bill item?')) onDelete(item.id); }}
            className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-red-100"
            style={{ color: '#dc2626' }}
            title="Delete item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div
        className="px-6 py-3 grid gap-3"
        style={{ gridTemplateColumns: '2fr 120px 120px 40px', background: 'rgba(239,68,68,0.08)', borderTop: '1px solid #fecaca' }}
      >
        <div className="text-xs font-black uppercase tracking-widest" style={{ color: '#b91c1c' }}>Extra Billed Total</div>
        <div />
        <div className="text-sm font-black" style={{ color: '#b91c1c' }}>
          {fmt(extraBillItems.reduce((s, i) => s + (i.amount || 0), 0))}
        </div>
        <div />
      </div>
    </div>
  );
}
