'use client';

import React from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Mail,
  Upload,
  Settings2,
  Loader2,
} from 'lucide-react';

export interface ReconciliationKPICardsProps {
  totalBilled: number;
  totalReceived: number;
  pendingAmount: number;
  pendingCount: number;
  totalTds: number;
  onCheckGmail: () => void;
  onUploadClick: () => void;
  onOpenSenders: () => void;
  isCheckingGmail?: boolean;
  isProcessingFile?: boolean;
}

function formatINR(val: number): string {
  return (val || 0).toLocaleString('en-IN');
}

export function ReconciliationKPICards({
  totalBilled,
  totalReceived,
  pendingAmount,
  pendingCount,
  totalTds,
  onCheckGmail,
  onUploadClick,
  onOpenSenders,
  isCheckingGmail = false,
  isProcessingFile = false,
}: ReconciliationKPICardsProps) {
  return (
    <div className="space-y-4">
      {/* Top Header & Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <span>Financial Cockpit</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Overview of surveyor fee bill receivables, bank credits, and tax deductions
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Check Gmail Button */}
          <button
            type="button"
            onClick={onCheckGmail}
            disabled={isCheckingGmail}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Scan connected Gmail account for insurer payment advices"
          >
            {isCheckingGmail ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mail className="w-3.5 h-3.5" />
            )}
            <span>Check Gmail</span>
          </button>

          {/* Drop Advice / File Upload Button */}
          <button
            type="button"
            onClick={onUploadClick}
            disabled={isProcessingFile}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-white hover:bg-neutral-50 text-foreground transition-colors shadow-sm"
            title="Upload payment advice PDF, text file, bank statement, or image"
          >
            {isProcessingFile ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>Drop Advice</span>
          </button>

          {/* Verified Senders Button */}
          <button
            type="button"
            onClick={onOpenSenders}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-white hover:bg-neutral-50 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            title="Configure verified insurer sender email addresses"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Verified Senders</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Billed */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Billed
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold tracking-tight text-foreground">
              ₹{formatINR(totalBilled)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Gross professional &amp; travel fees
            </p>
          </div>
        </div>

        {/* Card 2: Received in Bank */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Received in Bank
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold tracking-tight text-emerald-700">
              ₹{formatINR(totalReceived)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Settled insurer bank remittances
            </p>
          </div>
        </div>

        {/* Card 3: Pending Outstanding */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pending Outstanding
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold tracking-tight text-amber-700">
              ₹{formatINR(pendingAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {pendingCount} pending claim{pendingCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Card 4: TDS Deducted */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-blue-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              TDS Deducted
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold tracking-tight text-blue-700">
              ₹{formatINR(totalTds)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              u/s 194J (Form 26AS credit)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
