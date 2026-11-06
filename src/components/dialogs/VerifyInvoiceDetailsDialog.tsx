'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  initialBillNo: string;
  initialBillDate: string;
  initialBillTotal: number;
  onConfirm: (data: { billNo: string; billDate: string; billTotal: number }) => void;
  onCancel: () => void;
}

export function VerifyInvoiceDetailsDialog({
  open,
  initialBillNo,
  initialBillDate,
  initialBillTotal,
  onConfirm,
  onCancel,
}: Props) {
  const [billNo, setBillNo] = useState(initialBillNo || '');
  const [billDate, setBillDate] = useState(initialBillDate || '');
  const [billTotal, setBillTotal] = useState(initialBillTotal > 0 ? String(initialBillTotal) : '');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleProceed = () => {
    const trimmedNo = billNo.trim();
    const trimmedDate = billDate.trim();
    const parsedTotal = parseFloat(billTotal);

    if (!trimmedNo) {
      setError('Please enter the Workshop Bill / Invoice Number.');
      return;
    }
    if (!trimmedDate) {
      setError('Please enter the Bill Date.');
      return;
    }
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setError('Please enter a valid positive Total Bill Amount.');
      return;
    }
    if (!acknowledged) {
      setError('Please confirm that you have manually verified these details.');
      return;
    }

    setError(null);
    onConfirm({
      billNo: trimmedNo,
      billDate: trimmedDate,
      billTotal: parsedTotal,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Verify Workshop Invoice Details</h3>
              <p className="text-xs text-muted-foreground">Mandatory surveyor check before issuing Bill Check Report</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="text-xs text-muted-foreground leading-relaxed">
            Insurance guidelines require the surveyor to physically/visually verify the workshop&apos;s tax invoice
            number, date, and final billed amount before generating the official Bill Check document.
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1 block">
                Bill / Invoice No. <span className="text-destructive">*</span>
              </Label>
              <Input
                value={billNo}
                onChange={(e) => {
                  setBillNo(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. INV-2024-890"
                className="h-9 text-sm font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1 block">
                  Bill Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={billDate}
                  onChange={(e) => {
                    setBillDate(e.target.value);
                    setError(null);
                  }}
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1 block">
                  Workshop Total (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  value={billTotal}
                  onChange={(e) => {
                    setBillTotal(e.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="h-9 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* Acknowledgement Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border cursor-pointer hover:bg-muted/60 transition-colors mt-2">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 rounded border-input h-4 w-4 cursor-pointer accent-primary"
            />
            <span className="text-xs text-foreground leading-snug select-none">
              I confirm that I have verified the <strong>Bill Number</strong>, <strong>Date</strong>, and <strong>Total Amount</strong> against the official invoice issued by the workshop.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onCancel} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleProceed}
            className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!acknowledged || !billNo.trim() || !billDate.trim()}
          >
            <CheckCircle2 size={14} />
            Verify & Proceed
          </Button>
        </div>
      </div>
    </div>
  );
}
