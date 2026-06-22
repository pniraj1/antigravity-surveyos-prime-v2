'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getAllClaims } from '@/lib/storage/indexeddb';
import { useProfileStore } from '@/stores/profile-store';
import {
  filterClaimsForExport,
  generateIRDAISummary,
  getCurrentFY,
  getFYLabel,
  IRDAIExportOptions,
} from '@/lib/reports/irdai-summary-builder';
import { calculateFeeSummary } from '@/lib/calculations/fees';
import { ClaimData } from '@/types/claim';
import { X, FileSpreadsheet, Loader2, Calendar, Archive, Filter } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const FY_OPTIONS = [2022, 2023, 2024, 2025, 2026].map(y => ({
  value: y,
  label: `FY ${getFYLabel(y)}`,
}));

export function IRDAISummaryDialog({ onClose }: Props) {
  const { profile } = useProfileStore();

  const [allClaims, setAllClaims] = useState<ClaimData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const [financialYear, setFinancialYear] = useState(getCurrentFY());
  const [includeArchived, setIncludeArchived] = useState(true);
  const [surveyTypeFilter, setSurveyTypeFilter] = useState<'all' | 'spot' | 'final'>('all');

  // Load all claims from IndexedDB on mount
  useEffect(() => {
    getAllClaims()
      .then(claims => setAllClaims(claims))
      .catch(() => setError('Failed to load claims from storage.'))
      .finally(() => setLoading(false));
  }, []);

  // Live preview stats
  const filtered = useMemo(() => {
    if (!allClaims.length) return [];
    return filterClaimsForExport(allClaims, { financialYear, includeArchived, surveyTypeFilter });
  }, [allClaims, financialYear, includeArchived, surveyTypeFilter]);

  const totalFees = useMemo(() => {
    return filtered.reduce((sum, claim) => {
      try {
        const fs = calculateFeeSummary(claim.feeBill);
        return sum + (fs.grandTotal || 0);
      } catch {
        return sum;
      }
    }, 0);
  }, [filtered]);

  async function handleExport() {
    if (!profile) {
      setError('Surveyor profile not loaded. Please complete your profile first.');
      return;
    }
    setExporting(true);
    setError('');
    try {
      const options: IRDAIExportOptions = { financialYear, includeArchived, surveyTypeFilter };
      const claimsToExport = filterClaimsForExport(allClaims, options);
      await generateIRDAISummary(claimsToExport, profile, options);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const fyLabel = getFYLabel(financialYear);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl bg-card border border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'var(--color-status-success-tint)' }}>
              <FileSpreadsheet size={18} style={{ color: 'var(--color-status-success)' }} />
            </div>
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest" style={{ color: 'var(--color-neutral-900)' }}>
                Export Annual Summary
              </h2>
              <p className="text-xs mt-0.5 text-muted-foreground">IRDAI Annual Return — Excel Workbook</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:bg-white/10 text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Financial Year */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest mb-2 text-muted-foreground">
              <Calendar size={12} /> Financial Year
            </label>
            <select
              value={financialYear}
              onChange={e => setFinancialYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-sm font-medium outline-none"
              style={{ background: 'var(--color-neutral-50)', color: 'var(--color-neutral-900)', border: '1px solid var(--color-neutral-200)' }}
            >
              {FY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} style={{ background: 'var(--color-neutral-50)' }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Survey Type Filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest mb-2 text-muted-foreground">
              <Filter size={12} /> Survey Type
            </label>
            <div className="flex gap-2">
              {(['all', 'spot', 'final'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setSurveyTypeFilter(type)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-medium capitalize transition-all"
                  style={{
                    background: surveyTypeFilter === type ? 'var(--color-status-success-tint)' : 'var(--color-neutral-50)',
                    color: surveyTypeFilter === type ? 'var(--color-status-success)' : 'var(--color-neutral-400)',
                    border: `1px solid ${surveyTypeFilter === type ? 'var(--color-status-success)' : 'var(--color-neutral-200)'}`,
                  }}
                >
                  {type === 'all' ? 'All' : type === 'spot' ? 'Spot' : 'Final'}
                </button>
              ))}
            </div>
          </div>

          {/* Include Archived */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <Archive size={12} /> Include Archived Claims
            </label>
            <button
              onClick={() => setIncludeArchived(v => !v)}
              className="relative w-10 h-5 rounded-full transition-all"
              style={{ background: includeArchived ? 'var(--color-status-success)' : 'var(--color-neutral-400)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow"
                style={{ left: includeArchived ? '1.25rem' : '0.125rem' }}
              />
            </button>
          </div>

          {/* Preview Stats */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: 'var(--color-neutral-50)', border: '1px solid var(--color-neutral-200)' }}
          >
            <p className="text-xs font-medium uppercase tracking-widest mb-3 text-muted-foreground">
              Preview — FY {fyLabel}
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Loading claims…</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Claims matched</p>
                  <p className="text-xl font-medium" style={{ color: 'var(--color-neutral-900)' }}>{filtered.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total fees</p>
                  <p className="text-xl font-medium" style={{ color: 'var(--color-status-success)' }}>
                    ₹{totalFees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'var(--color-status-danger-tint)', color: 'var(--color-status-danger)', border: '1px solid var(--color-status-danger)' }}>
              {error}
            </p>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={exporting || loading || filtered.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium uppercase tracking-widest transition-all disabled:opacity-40"
            style={{ background: 'var(--color-status-success-tint)', color: 'var(--color-status-success)', border: '1px solid var(--color-status-success)' }}
          >
            {exporting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating Excel…
              </>
            ) : (
              <>
                <FileSpreadsheet size={15} />
                Export FY {fyLabel}
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Downloads a 4-sheet Excel workbook: Claim Register · Insurer-wise · Month-wise · Analytics
          </p>
        </div>
      </div>
    </div>
  );
}
