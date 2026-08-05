'use client';

import { useState } from 'react';
import { AlertCircle, Trash2, Link2, PlusCircle } from 'lucide-react';
import type { ExtraBillItem, AssessmentRow } from '@/types';

interface Props {
  extraBillItems: ExtraBillItem[];
  assessmentRows: AssessmentRow[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onLink: (extraId: string, rowId: string) => void;
  onPromote: (extraId: string) => void;
  fmt: (n: number) => string;
}

export function ExtraBillItemsPanel({
  extraBillItems, assessmentRows, onDelete, onClearAll, onLink, onPromote, fmt,
}: Props) {
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  if (extraBillItems.length === 0) return null;

  const total = extraBillItems.reduce((s, i) => s + (i.amount || 0), 0);
  const candidates = assessmentRows.filter(r =>
    r.particulars.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-2xl overflow-hidden bg-white border-2 border-status-danger">
      <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-border bg-status-danger/10">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-status-danger flex-shrink-0" style={{ marginTop: 2 }} />
          <div>
            <div className="text-sm font-medium text-status-danger">
              ⚠ Bill Items Not Matched to the Assessment ({extraBillItems.length})
            </div>
            <div className="text-xs mt-0.5 text-status-danger">
              Usually the workshop worded an item differently — use <strong>Link</strong> to attach it to the
              right row. If it is genuinely new, <strong>Add</strong> puts it in the Final Report as Not Allowed
              for you to decide on.
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm(`Discard all ${extraBillItems.length} unmatched items, totalling ${fmt(total)}? This cannot be undone.`)) onClearAll();
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all hover:opacity-90 bg-status-danger text-white"
        >
          <Trash2 size={14} />
          Clear All
        </button>
      </div>

      {extraBillItems.map((item) => (
        <div key={item.id} className="border-b border-border last:border-b-0">
          <div className="px-6 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{item.description}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {item.partNumber ? `Part ${item.partNumber} · ` : ''}{item.section} · taxable {fmt(item.taxableAmount)} · GST {item.gstPercent}%
              </div>
            </div>
            <div className="text-sm font-medium text-status-danger whitespace-nowrap">{fmt(item.amount)}</div>

            <button
              onClick={() => { setLinkingId(linkingId === item.id ? null : item.id); setSearch(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary text-primary hover:bg-primary/10 transition-colors"
              title="Attach this bill line to an item already in the assessment"
            >
              <Link2 size={13} />
              Link
            </button>

            <button
              onClick={() => {
                if (confirm(`Add "${item.description}" to the Final Report as Not Allowed? You can then allow it and enter your assessed figure.`)) onPromote(item.id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-neutral-50 transition-colors"
              title="Add as a new item in the Final Report"
            >
              <PlusCircle size={13} />
              Add
            </button>

            <button
              onClick={() => { if (confirm(`Discard "${item.description}" (${fmt(item.amount)})?`)) onDelete(item.id); }}
              className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-status-danger/10 text-status-danger"
              title="Discard this item"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {linkingId === item.id && (
            <div className="px-6 pb-4 bg-neutral-50">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search assessment items…"
                className="w-full px-3 py-2 rounded-lg text-sm border border-border outline-none mb-2"
              />
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-white">
                {candidates.length === 0 && (
                  <div className="px-3 py-3 text-xs text-muted-foreground">No matching assessment items.</div>
                )}
                {candidates.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { onLink(item.id, r.id); setLinkingId(null); }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50 border-b border-border last:border-b-0"
                  >
                    <span className="text-xs font-medium text-foreground truncate">{r.particulars || '—'}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {r.section} · assessed {fmt(r.assessed)}{r.allowed ? '' : ' · not allowed'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="px-6 py-3 flex items-center justify-between border-t border-status-danger/30 bg-status-danger/10">
        <div className="text-xs font-medium uppercase tracking-widest text-status-danger">Unmatched Total</div>
        <div className="text-sm font-medium text-status-danger">{fmt(total)}</div>
      </div>
    </div>
  );
}
