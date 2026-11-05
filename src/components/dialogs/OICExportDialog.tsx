'use client';

import React, { useMemo, useState } from 'react';
import {
  exportOicAssessmentExcel,
  oicAssessmentRows,
  oicPaintingSummary,
  type OicGstType,
} from '@/lib/reports/oic-assessment-excel';
import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import type { ClaimData } from '@/types/claim';
import { buildPortalPacket } from '@/lib/portal/packet';
import {
  isExtensionPresent,
  sendPacketToExtension,
  readyLine,
  NOT_INSTALLED_LINE,
} from '@/lib/portal/extension-bridge';
import { X, FileSpreadsheet, Download, Loader2, Send, Info } from 'lucide-react';

interface Props {
  claim: ClaimData;
  claimNo: string;
  rows: AssessmentRow[];
  ageMonths: number;
  depType: DepreciationType;
  onClose: () => void;
}

const formatDateToDDMMYYYY = (d: string | null | undefined): string => {
  if (!d) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}-${month}-${year}`;
  }
  const parts = d.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD -> DD-MM-YYYY
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return d;
  }
  return d;
};

export function OICExportDialog({ claim, claimNo, rows, ageMonths, depType, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Gate: Bill check must be confirmed
  const [billCheckDone, setBillCheckDone] = useState(false);
  const isNilDep = depType === 'nil';

  // Invoice parameters for Sheet 1
  const initialInvNo =
    claim?.repairer?.invoiceNumber ||
    claim?.repairer?.estimateNumber ||
    (claimNo ? `INV-${claimNo.slice(-4)}` : 'INV-01');

  const initialInvDate = formatDateToDDMMYYYY(
    claim?.repairer?.invoiceDate || claim?.repairer?.estimateDate,
  );

  const [invoiceNumber, setInvoiceNumber] = useState(initialInvNo);
  const [invoiceDate, setInvoiceDate] = useState(initialInvDate);
  const [gstType, setGstType] = useState<OicGstType>('CGST/SGST');

  // Extension bridge state
  const [extPresent] = useState(() => isExtensionPresent());
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [sendError, setSendError] = useState('');

  const sendToExtension = async () => {
    setSendState('sending');
    setSendError('');
    try {
      const packet = await buildPortalPacket(claim, { ageMonths });
      const r = await sendPacketToExtension(packet);
      if (r.ok) {
        setSendState('sent');
      } else {
        setSendState('failed');
        setSendError(r.reason);
      }
    } catch (e) {
      setSendState('failed');
      setSendError(e instanceof Error ? e.message : String(e));
    }
  };

  const { sheetRows, rowError } = useMemo(() => {
    try {
      return {
        sheetRows: oicAssessmentRows(rows, ageMonths, depType, invoiceNumber),
        rowError: '',
      };
    } catch (e) {
      return {
        sheetRows: [],
        rowError: e instanceof Error ? e.message : 'Rows could not be prepared.',
      };
    }
  }, [rows, ageMonths, depType, invoiceNumber]);

  const painting = useMemo(() => oicPaintingSummary(rows), [rows]);

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      await exportOicAssessmentExcel(claimNo, rows, ageMonths, depType, {
        invoiceNumber,
        invoiceDate,
        gstType,
      });
    } catch {
      setError('Could not build the Excel file. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl bg-card border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
              <FileSpreadsheet size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">
                Oriental Insurance — Assessment Upload
              </span>
              <span className="text-[11px] text-muted-foreground">
                {isNilDep ? 'Nil Depreciation policy' : 'Standard policy'} — 9400ExcelOICL format
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Bill Check Gate Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/60 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={billCheckDone}
              onChange={(e) => setBillCheckDone(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs leading-relaxed">
              <span className="font-semibold text-foreground">
                Bill amounts verified and bill check complete
              </span>{' '}
              <span className="text-muted-foreground">
                for this claim. The file carries every row&apos;s billed figure; before the bill check
                those are all zero.
              </span>
            </span>
          </label>

          {billCheckDone && (
            <>
              {/* 1. Sheet 1: Invoice Details */}
              <div className="space-y-2 p-3.5 rounded-xl border border-border/80 bg-background/50">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  1 · INVOICE DETAILS (Sheet 1: Invoice)
                </div>
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <label
                      htmlFor="oic-inv-no"
                      className="block text-[11px] font-medium text-muted-foreground mb-1"
                    >
                      Invoice Number
                    </label>
                    <input
                      id="oic-inv-no"
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="oic-inv-date"
                      className="block text-[11px] font-medium text-muted-foreground mb-1"
                    >
                      Invoice Date
                    </label>
                    <input
                      id="oic-inv-date"
                      type="text"
                      placeholder="DD-MM-YYYY"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="oic-gst-type"
                      className="block text-[11px] font-medium text-muted-foreground mb-1"
                    >
                      GST Type
                    </label>
                    <select
                      id="oic-gst-type"
                      value={gstType}
                      onChange={(e) => setGstType(e.target.value as OicGstType)}
                      className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="CGST/SGST">CGST/SGST</option>
                      <option value="IGST">IGST</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Sheet 2: Items & Painting Treatment */}
              <div className="space-y-2 p-3.5 rounded-xl border border-border/80 bg-background/50">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  2 · ITEMS & PAINTING (Sheet 2: Items)
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{sheetRows.length} items</span> prepared
                  for upload.
                </div>

                {painting.totalAssessed > 0 && (
                  <div className="p-2.5 rounded-lg bg-indigo-500/5 border border-indigo-500/15 text-xs space-y-1">
                    <div className="font-semibold text-indigo-700 dark:text-indigo-400">
                      Painting statutory translation:
                    </div>
                    {isNilDep ? (
                      <div className="text-muted-foreground text-[11px]">
                        Included as 1 consolidated <span className="font-medium text-foreground">Labour Charge</span> line at 0% depreciation (₹{painting.totalAssessed.toFixed(2)}).
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-[11px]">
                        Split into <span className="font-medium text-foreground">75% Labour</span> (₹{painting.labourPart.toFixed(2)} at 0% dep) and <span className="font-medium text-foreground">25% Paint Material</span> (₹{painting.materialPart.toFixed(2)} at 50% dep) to show the statutory 12.5% deduction on OIC without manual math.
                      </div>
                    )}
                  </div>
                )}

                {rowError && <div className="text-xs text-destructive">{rowError}</div>}

                <button
                  onClick={download}
                  disabled={busy || sheetRows.length === 0 || !!rowError}
                  className="mt-2 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Download Excel
                </button>
                {error && <div className="mt-1.5 text-xs text-destructive">{error}</div>}
              </div>

              {/* 3. Send to Extension */}
              {extPresent ? (
                <div className="space-y-2 p-3.5 rounded-xl border border-border/80 bg-background/50">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    3 · SEND TO PORTAL EXTENSION
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sends claim details and assessment directly to the SurveyOS extension. Open this claim on Oriental Insurance portal and click <span className="font-semibold text-foreground">Fill</span>.
                  </div>
                  <button
                    onClick={sendToExtension}
                    disabled={sendState === 'sending' || !!rowError}
                    className="mt-1 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {sendState === 'sending' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {sendState === 'sending' ? 'Sending…' : 'Send to extension'}
                  </button>
                  {sendState === 'sent' && (
                    <div className="text-xs text-emerald-700 font-medium">
                      {readyLine('oic', claimNo)}
                    </div>
                  )}
                  {sendState === 'failed' && (
                    <div className="text-xs text-destructive">{sendError}</div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                  {NOT_INSTALLED_LINE}
                </div>
              )}
            </>
          )}

          {/* Guidance note */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
            <Info size={14} className="shrink-0 mt-0.5 text-indigo-500" />
            <div>
              On the Oriental portal: Navigate to <span className="font-semibold text-foreground">Motor Surveyor OD assessment</span> $\rightarrow$ Proceed to <span className="font-semibold text-foreground">Step 4 (Assessment of Loss)</span> $\rightarrow$ Click <span className="font-semibold text-foreground">Upload Excel</span> and select this file.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
