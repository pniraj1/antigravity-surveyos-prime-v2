'use client';

import React, { useMemo, useState } from 'react';
import { uiicPortalSummary, type UiicGstSlab } from '@/lib/calculations/uiic-portal-summary';
import { projectForBillCheck } from '@/lib/reports/bill-check-projection';
import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import { X, Check, Copy, ClipboardList } from 'lucide-react';

interface Props {
  rows: AssessmentRow[];
  ageMonths: number;
  depType: DepreciationType;
  onClose: () => void;
}

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * One portal field: its label, its value, a tick to keep your place, and a
 * copy button.
 *
 * The tick matters more than the copy. 45 of the portal's inputs carry
 * onpaste="return false;", including every money field here, so these numbers
 * get typed by hand down a long form.
 */
function Field({ label, value }: { label: string; value: number }) {
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(String(value)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => undefined,
    );
  };

  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
        done ? 'opacity-45' : 'hover:bg-muted/40'
      }`}
    >
      <button
        onClick={() => setDone((d) => !d)}
        aria-label={done ? `Mark ${label} not entered` : `Mark ${label} entered`}
        className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          done ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
        }`}
      >
        {done && <Check size={13} />}
      </button>
      <span className="flex-1 text-xs text-muted-foreground leading-snug">{label}</span>
      <span className="font-mono text-base font-semibold tabular-nums">{money(value)}</span>
      <button
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function GstTable({ title, slabs }: { title: string; slabs: UiicGstSlab[] }) {
  if (!slabs.length) return null;
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold text-muted-foreground px-3 pb-1">{title}</div>
      {slabs.map((s) => (
        <Field key={s.rate} label={`${s.rate}% — Amount`} value={s.amount} />
      ))}
    </div>
  );
}

export function UIICSummaryDialog({ rows, ageMonths, depType, onClose }: Props) {
  const [source, setSource] = useState<'assessment' | 'billcheck'>('assessment');

  const summary = useMemo(() => {
    const basis = source === 'billcheck' ? projectForBillCheck(rows) : rows;
    return uiicPortalSummary(basis, ageMonths, depType);
  }, [rows, ageMonths, depType, source]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl bg-card border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" />
            <span className="text-sm font-semibold">United India — Portal Entry</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
            {(['assessment', 'billcheck'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  source === s ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
                }`}
              >
                {s === 'assessment' ? 'Assessment' : 'Bill Check'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2">
          <div className="text-[11px] font-semibold text-muted-foreground px-3 pt-2 pb-1">
            PARTS — enter the full amount, the portal depreciates
          </div>
          <Field
            label="Vehicle Age Based Depreciation (Excluding GST)"
            value={summary.parts.ageBasedDep}
          />
          <Field
            label="Parts at 50% Depreciation (rubber, nylon, plastic, tyres and tubes, batteries, air bags) (Excluding GST)"
            value={summary.parts.dep50}
          />
          <Field
            label="Parts at 30% Depreciation (fibre glass components) (Excluding GST)"
            value={summary.parts.dep30}
          />
          <Field
            label="Parts at Nil Depreciation (parts made of glass) (Excluding GST)"
            value={summary.parts.nilDep}
          />

          <GstTable title="GST — PARTS (amount after depreciation)" slabs={summary.partsGst} />

          <div className="text-[11px] font-semibold text-muted-foreground px-3 pt-4 pb-1">
            LABOUR
          </div>
          <Field label="Labour" value={summary.labour.labour} />
          <Field label="Paint" value={summary.labour.paint} />
          <Field label="Less: Paint Depreciation" value={summary.labour.lessPaintDep} />
          <div className="border-t border-border my-1" />
          <Field
            label="Labour Charges (Excluding GST) — total"
            value={summary.labour.totalLabour}
          />

          <GstTable title="GST — LABOUR (amount after depreciation)" slabs={summary.labourGst} />

          {Math.abs(summary.tieOut.delta) >= 0.005 && (
            <div className="mt-3 mx-3 mb-1 px-3 py-2 rounded-lg bg-muted/50 text-[11px] text-muted-foreground">
              Rounding the four boxes differs from the exact total by{' '}
              <span className="font-mono font-semibold">{money(summary.tieOut.delta)}</span>. Absorb
              it in excess or salvage.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
