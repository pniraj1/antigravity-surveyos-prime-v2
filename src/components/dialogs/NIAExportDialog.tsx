'use client';

import React, { useMemo, useState } from 'react';
import {
  exportNiaAssessmentExcel,
  niaAssessmentRows,
  niaPainting,
} from '@/lib/reports/nia-assessment-excel';
import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import { X, Check, Copy, FileSpreadsheet, Download, Loader2 } from 'lucide-react';

interface Props {
  claimNo: string;
  rows: AssessmentRow[];
  ageMonths: number;
  depType: DepreciationType;
  onClose: () => void;
}

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One painting figure: label, value, a tick to keep your place, a copy button. */
function Field({ label, value }: { label: string; value: number }) {
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(value.toFixed(2)).then(
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

export function NIAExportDialog({ claimNo, rows, ageMonths, depType, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { sheetRows, rowError } = useMemo(() => {
    try {
      return { sheetRows: niaAssessmentRows(rows, ageMonths, depType), rowError: '' };
    } catch (e) {
      return { sheetRows: [], rowError: e instanceof Error ? e.message : 'Rows could not be prepared.' };
    }
  }, [rows, ageMonths, depType]);
  const painting = useMemo(() => niaPainting(rows), [rows]);

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      await exportNiaAssessmentExcel(claimNo, rows, ageMonths, depType);
    } catch {
      setError('Could not build the Excel file. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl bg-card border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-primary" />
            <span className="text-sm font-semibold">New India — Assessment Upload</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground px-3 pb-1">
              1 · UPLOAD — Primary Assessment Template
            </div>
            <div className="px-3 text-xs text-muted-foreground">
              {sheetRows.length} rows: parts and labour. Paint is entered separately below.
            </div>
            {rowError && <div className="px-3 text-xs text-destructive">{rowError}</div>}
            <button
              onClick={download}
              disabled={busy || sheetRows.length === 0 || !!rowError}
              className="mt-2 mx-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download Excel
            </button>
            {error && <div className="mt-2 px-3 text-xs text-destructive">{error}</div>}
          </div>

          <div>
            <div className="text-[11px] font-semibold text-muted-foreground px-3 pb-1">
              2 · PAINTING — work details &quot;Consolidated&quot;
            </div>
            <Field label="Painting Charges — Estimated" value={painting.estimate} />
            <Field label="Painting Charges — Assessed" value={painting.assessed} />
          </div>

          <div className="mx-3 px-3 py-2 rounded-lg bg-muted/50 text-[11px] text-muted-foreground">
            On the portal: upload the file, click <span className="font-semibold">Validate</span>,
            then type the two painting figures. The portal fills depreciation and GST itself.
          </div>
        </div>
      </div>
    </div>
  );
}
