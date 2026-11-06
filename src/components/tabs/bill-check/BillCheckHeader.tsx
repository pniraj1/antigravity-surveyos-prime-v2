'use client';

import React from 'react';
import { Upload, PanelRightOpen, PanelRightClose, CheckCircle2, AlertTriangle, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SaveProgressButton } from '@/components/sync/SaveProgressButton';
import { UsePhoneFiles } from '@/components/documents/UsePhoneFiles';
import { ProviderToggle, DocModeToggle, ModelSelector, ProviderHealthBadge } from '@/components/ai/AIControls';
import type { DocType } from '@/types/documents';

const INVOICE_TYPES: readonly DocType[] = ['invoice'];

interface BcSummary {
  grandTotalBilled: number;
  netLiability: number;
  notInBillTotal: number;
}

interface Props {
  showEvidence: boolean;
  onToggleEvidence: () => void;
  showSummary?: boolean;
  onToggleSummary?: () => void;
  bcSummary: BcSummary;
  claimId: string | null;
  fmt: (n: number) => string;
  isProcessing?: boolean;
  isInvoiceVerified?: boolean;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhoneFile?: (file: File) => void;
}

export function BillCheckHeader({
  showEvidence,
  onToggleEvidence,
  showSummary = true,
  onToggleSummary = () => {},
  bcSummary,
  fmt,
  isProcessing = false,
  isInvoiceVerified = false,
  onFileUpload = () => {},
  onPhoneFile = () => {},
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5 shrink-0 bg-card border border-border px-3 py-2 rounded-xl shadow-xs">
      {/* Left side: Title, Invoice Verified Badge, Liability Preview */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <Receipt size={17} className="text-primary" />
          <h2 className="text-base font-semibold tracking-tight text-foreground">Bill Check</h2>
        </div>

        {/* Verification Status Badge */}
        {isInvoiceVerified ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
            <CheckCircle2 size={12} /> Invoice Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-700 border border-amber-500/30">
            <AlertTriangle size={12} /> Invoice Unverified
          </span>
        )}

        {/* Mini Summary Pill */}
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-md px-2.5 py-1">
          <span>
            Net Liability: <strong className="text-foreground">{fmt(bcSummary.netLiability)}</strong>
          </span>
          <span className="text-border">|</span>
          <span>
            Saving: <strong className="text-destructive">-{fmt(bcSummary.notInBillTotal)}</strong>
          </span>
        </div>
      </div>

      {/* Right side: AI controls & Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* AI extraction controls */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 border border-border/60 text-xs">
          <span className="text-[10px] font-medium mr-0.5 text-muted-foreground">AI</span>
          <ProviderToggle />
          <DocModeToggle />
          <ModelSelector />
          <ProviderHealthBadge />
        </div>

        <div className="flex items-center gap-1.5">
          {/* Upload Bill Button */}
          <div className="relative">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              accept="image/*,application/pdf"
              onChange={onFileUpload}
              disabled={isProcessing}
              title="Upload Final Workshop Bill"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 px-2.5 text-xs"
              tabIndex={-1}
              disabled={isProcessing}
            >
              <Upload size={14} />
              Upload Bill
            </Button>
          </div>

          {/* Use Phone Files */}
          <UsePhoneFiles
            types={INVOICE_TYPES}
            className="h-8 px-2.5 text-xs"
            disabled={isProcessing}
            onPick={(file) => void onPhoneFile(file)}
          />

          {/* Show / Hide Evidence */}
          <Button
            variant={showEvidence ? 'secondary' : 'outline'}
            size="sm"
            onClick={onToggleEvidence}
            className={`gap-1.5 h-8 px-2.5 text-xs ${showEvidence ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30' : ''}`}
          >
            {showEvidence ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            {showEvidence ? 'Hide Evidence' : 'Show Evidence'}
          </Button>

          {/* Show / Hide Summary */}
          <Button
            variant={showSummary ? 'secondary' : 'outline'}
            size="sm"
            onClick={onToggleSummary}
            className={`gap-1.5 h-8 px-2.5 text-xs ${showSummary ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30' : ''}`}
          >
            {showSummary ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            {showSummary ? 'Hide Summary' : 'Show Summary'}
          </Button>

          <SaveProgressButton className="h-8 px-2.5 text-xs" />
        </div>
      </div>
    </div>
  );
}
