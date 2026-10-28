'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Check, X, Sparkles, RefreshCw, Zap, Loader2, CheckCircle2 } from 'lucide-react';
import { summariseExtraction, hasLineItems } from '@/lib/ai/extraction-summary';
import { describeFinding, countRows, type Finding } from '@/lib/ai/row-check';

interface AIReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReScan?: (feedback: string) => void;
  title: string;
  data: any;
  evidenceImages?: string[];
  /** Unresolved row/gross findings — renders the "Check before applying" card. */
  findings?: Finding[];
  onSmartFix?: () => void;
  /** Non-empty while Smart Fix is running; shown inline in the card. */
  smartFixProgress?: string;
  smartFixed?: boolean;
}

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function CheckCard({ findings, onSmartFix, progress, fixed, rows }: {
  findings: Finding[]; onSmartFix?: () => void; progress: string; fixed: boolean; rows: number;
}) {
  if (progress) {
    return (
      <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 flex items-center gap-2 text-sm font-medium">
        <Loader2 size={16} className="animate-spin shrink-0" /> {progress}
      </div>
    );
  }
  if (findings.length === 0) {
    if (!fixed) return null;
    return (
      <div className="mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 size={16} className="shrink-0" /> No remaining findings — {rows} {rows === 1 ? 'row' : 'rows'}
      </div>
    );
  }
  return (
    <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50">
      <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2">Check before applying</div>
      <ul className="text-sm text-amber-950 font-medium space-y-1 list-disc pl-4">
        {findings.map((f, i) => <li key={i}>{describeFinding(f)}</li>)}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-amber-800">
          {fixed ? 'Check the page in the Evidence Viewer or describe the fix below' : 'Smart Fix re-reads only the pages above'}
        </span>
        {onSmartFix && (
          <button
            onClick={onSmartFix}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-all active:scale-95 shrink-0"
          >
            <Zap size={14} />Smart Fix
          </button>
        )}
      </div>
    </div>
  );
}


function AuditCard({ audit }: { audit?: { tax_posture?: string; columns_detected?: string[]; reconciliation_note?: string; warnings?: string[] } }) {
  if (!audit) return null;
  const hasWarnings = (audit.warnings?.length ?? 0) > 0;
  const isExclusive = audit.tax_posture?.toLowerCase().includes('exclusive');
  return (
    <div className={'mb-4 p-3 rounded-lg border ' + (hasWarnings ? 'border-amber-200 bg-amber-50/70 text-amber-950' : 'border-emerald-200 bg-emerald-50/70 text-emerald-950')}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
          <Sparkles size={14} className={hasWarnings ? 'text-amber-600' : 'text-emerald-600'} />
          AI Audit &amp; Tax Deduction
        </div>
        {audit.tax_posture && (
          <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full border ' + (isExclusive ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200')}>
            {isExclusive ? 'GST Extra (Taxable Rates)' : 'Tax Inclusive (Gross Rates)'}
          </span>
        )}
      </div>

      {audit.reconciliation_note && (
        <p className="text-xs leading-relaxed font-medium mb-1.5 text-zinc-800">
          {audit.reconciliation_note}
        </p>
      )}

      {audit.columns_detected && audit.columns_detected.length > 0 && (
        <div className="text-[11px] text-zinc-600 flex flex-wrap gap-1 items-center mb-1.5">
          <span className="font-semibold text-zinc-700">Columns:</span>
          {audit.columns_detected.map((col, i) => (
            <span key={i} className="bg-white/80 px-1.5 py-0.5 rounded border border-zinc-200 text-[10px]">
              {col}
            </span>
          ))}
        </div>
      )}

      {hasWarnings && (
        <div className="mt-2 pt-2 border-t border-amber-200/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1">Audit Warnings</div>
          <ul className="text-xs text-amber-900 list-disc pl-4 space-y-0.5">
            {audit.warnings?.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AIReviewDialog({ isOpen, onClose, onConfirm, onReScan, title, data, evidenceImages = [], findings = [], onSmartFix, smartFixProgress = '', smartFixed = false }: AIReviewDialogProps) {
  const [feedback, setFeedback] = useState('');

  if (!isOpen) return null;

  // Line-item documents get a totals block to check against the printed last
  // page. See extraction-summary.ts for why counts matter as much as amounts.
  const summary = hasLineItems(title) ? summariseExtraction(data) : null;

  // Flatten sample data for display
  const displayFields = Object.entries(data || {})
    .filter(([k, v]) => k !== "_audit" && !/_(page|file)$/.test(k) && (typeof v === 'string' || typeof v === 'number'))
    .map(([k, v]) => ({
      key: k.replace(/_/g, ' ').toUpperCase(),
      value: String(v)
    }));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <Card className={`w-full ${evidenceImages.length > 0 ? 'max-w-5xl' : 'max-w-lg'} shadow-2xl border-primary/20 overflow-hidden flex flex-col max-h-[85vh]`}>
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Sparkles size={20} className="text-primary animate-pulse" />
            AI Review: {title.toUpperCase()}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-medium">
            Review the extracted details before applying them to the claim form.
          </p>
        </CardHeader>

        <CardContent className={`p-0 flex-1 overflow-hidden flex flex-col ${evidenceImages.length > 0 ? 'md:flex-row' : ''}`}>
          {evidenceImages.length > 0 && (
            <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-border/40 bg-zinc-100/50 flex flex-col">
              <div className="p-3 bg-zinc-100 border-b border-border/40 font-semibold text-xs text-muted-foreground flex items-center justify-between">
                <span>EVIDENCE VIEWER</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-zinc-200">
                  {evidenceImages.length} PAGE{evidenceImages.length > 1 ? 'S' : ''}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[40vh] md:max-h-[60vh] bg-zinc-200/50">
                {evidenceImages.map((img, i) => (
                  <img 
                    key={i} 
                    src={img}
                    alt={`Evidence Page ${i + 1}`} 
                    className="w-full rounded-md shadow-md border border-zinc-200 bg-white" 
                  />
                ))}
              </div>
            </div>
          )}

          <div className={`w-full ${evidenceImages.length > 0 ? 'md:w-1/2' : ''} h-full max-h-[50vh] md:max-h-[60vh] p-6 overflow-y-auto`}>
            {summary && (
              <div className="mb-5 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  Read from this document
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ['Spare parts', summary.parts],
                      ['Labour', summary.labour],
                      ['Painting', summary.painting],
                    ].map(([label, group]) => {
                      const g = group as { count: number; taxable: number };
                      return (
                        <tr key={label as string}>
                          <td className="py-0.5 text-muted-foreground">{label as string}</td>
                          <td className="py-0.5 text-right tabular-nums">{g.count} items</td>
                          <td className="py-0.5 text-right tabular-nums font-medium">₹{INR.format(g.taxable)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-border/60">
                      <td className="pt-1.5 font-medium">Gross total</td>
                      <td className="pt-1.5 text-right tabular-nums text-muted-foreground">
                        {summary.totalItems} items
                      </td>
                      <td className="pt-1.5 text-right tabular-nums font-semibold">
                        {summary.gross == null ? '—' : `₹${INR.format(summary.gross)}`}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  Confirm the item count and gross total against the last page of the bill.
                  Items on later pages are the usual miss.
                </p>

                {onReScan && (
                  <button
                    type="button"
                    onClick={() => onReScan(
                      'The item count or totals do not match the printed bill. Re-read every page, including the last, and return ALL line items.'
                    )}
                    className="mt-2 text-[11px] font-medium underline underline-offset-2 text-primary"
                  >
                    Something is off — rescan
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4">
              <AuditCard audit={data?._audit} />
              <CheckCard findings={findings} onSmartFix={onSmartFix} progress={smartFixProgress} fixed={smartFixed} rows={countRows(data)} />

              {displayFields.length > 0 ? (
                displayFields.map((field, i) => (
                  <div key={i} className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {field.key}
                    </span>
                    <span className="text-sm font-semibold text-foreground bg-zinc-50 px-2 py-1 rounded border border-zinc-100">
                      {field.value || '—'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground italic">
                  No compatible fields found for preview.
                </div>
              )}
              
              {(data?.spare_parts?.length > 0 || data?.labour_items?.length > 0 || data?.painting_items?.length > 0) && (
                <div className="mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                   <div className="text-[10px] font-bold text-blue-700 uppercase mb-2">Extracted Items Summary</div>
                   <div className="text-xs text-blue-900 font-medium flex flex-wrap gap-4">
                     {data?.spare_parts?.length > 0 && <span>• {data.spare_parts.length} Parts</span>}
                     {data?.labour_items?.length > 0 && <span>• {data.labour_items.length} Labour</span>}
                     {data?.painting_items?.length > 0 && <span>• {data.painting_items.length} Paint</span>}
                   </div>
                </div>
              )}
              
              <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <label className="text-[10px] font-bold text-zinc-600 uppercase mb-2 block tracking-wider">
                  Data missing or incorrect? Tell AI to fix it
                </label>
                <div className="relative">
                  <textarea 
                    className="w-full text-sm p-3 pb-10 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none bg-white"
                    rows={3}
                    placeholder="E.g. 'Items between line 2 and 42 are missing, please pull those lines' or 'Column 3 is Net Amount...'"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && feedback.trim() && onReScan && !smartFixProgress) {
                        e.preventDefault();
                        onReScan(feedback);
                        setFeedback('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (onReScan && feedback.trim()) {
                        onReScan(feedback);
                        setFeedback('');
                      }
                    }}
                    disabled={!feedback.trim() || !!smartFixProgress}
                    className="absolute bottom-2 right-2 flex justify-center items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded text-[10px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={12} />
                    Update Extraction
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between items-center gap-3 bg-muted/30 p-4 border-t border-border">
          <div className="text-[10px] text-muted-foreground bg-white px-2 py-1 rounded border border-border">
            ONE-BY-ONE PROCESSING ENABLED
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-all active:scale-95"
            >
              <X size={16} />
              Discard
            </button>
            <button
              onClick={onConfirm}
              disabled={!!smartFixProgress}
              className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={16} />
              Apply Fields
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
