'use client';

import React, { useState } from 'react';
import {
  X,
  ClipboardPaste,
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { extractPaymentAdviceFromText } from '@/lib/ai/payment-advice-extractor';
import type { ExtractedPaymentAdvice } from '@/types/payment-reconciliation';
import { toast } from 'sonner';

export interface PasteAdviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdviceExtracted: (advice: ExtractedPaymentAdvice) => void;
}

const SAMPLE_PAYMENT_EMAIL = `Dear Surveyor,

Payment has been disbursed towards your professional fees as per the following details:

Insurer: The New India Assurance Co. Ltd.
UTR / Ref No: CMS202611180921
Payment Date: 2026-11-18
Account Credited: A/C ending in 4092

Line Item Breakdown:
1. Claim No: 31010031240100001234
   Vehicle No: MH-12-AB-1234
   Professional Fee: Rs. 2,500.00
   CGST (9%): Rs. 225.00
   SGST (9%): Rs. 225.00
   TDS (10% u/s 194J): Rs. 250.00
   Net Disbursed: Rs. 2,700.00

Thank you,
Motor Claims Department
New India Assurance`;

export function PasteAdviceModal({
  isOpen,
  onClose,
  onAdviceExtracted,
}: PasteAdviceModalProps) {
  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  if (!isOpen) return null;

  const handleInsertSample = () => {
    setText(SAMPLE_PAYMENT_EMAIL);
  };

  const handleParse = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.warning('Please paste payment advice or intimation email text first.');
      return;
    }

    setIsParsing(true);
    try {
      const advice = await extractPaymentAdviceFromText(trimmed, 'Pasted Email Advice');

      if (!advice || !advice.claims || advice.claims.length === 0) {
        toast.warning(
          'Could not find structured claim or fee items in the pasted text. Please verify the text contains a claim number, vehicle number, or amount.'
        );
        return;
      }

      onAdviceExtracted(advice);
      toast.success(
        `Extracted ${advice.claims.length} payment line item(s)${
          advice.utrNumber ? ` (UTR: ${advice.utrNumber})` : ''
        }`
      );
      setText('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse text';
      toast.error(`Extraction failed: ${msg}`);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-advice-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl transition-all">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div>
              <h3 id="paste-advice-title" className="text-base font-semibold text-neutral-900">
                Paste Payment Advice / Intimation
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Copy text from your insurer payment email or bank SMS and paste it below
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg hover:bg-neutral-100 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Guidance Banner */}
        <div className="mt-4 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span>AI extracts </span>
            <strong className="text-neutral-800">UTR number, payment date, claim numbers, fee amounts, and TDS</strong>
            <span>. Works instantly with zero Google API setup.</span>
          </div>
        </div>

        {/* Text Input Area */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="advice-text-input" className="text-xs font-medium text-neutral-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-neutral-500" />
              <span>Email Body / Remittance Advice Text</span>
            </label>
            <button
              type="button"
              onClick={handleInsertSample}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 hover:underline"
            >
              <Sparkles className="w-3 h-3" />
              <span>Insert sample advice</span>
            </button>
          </div>

          <textarea
            id="advice-text-input"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste insurer payment remittance email here (e.g., UTR, Claim No, Vehicle Reg No, Professional Fee, TDS)..."
            className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-xs font-mono text-neutral-800 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-y leading-relaxed"
          />
        </div>

        {/* Actions Footer */}
        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isParsing}
            className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleParse}
            disabled={isParsing || !text.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Extracting & Matching...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Extract & Match Payment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
