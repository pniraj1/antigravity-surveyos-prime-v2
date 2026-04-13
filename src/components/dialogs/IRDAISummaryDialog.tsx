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
        className="relative w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: '#0D1B2A', border: '1px solid rgba(141,153,174,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(141,153,174,0.15)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <FileSpreadsheet size={18} style={{ color: '#22c55e' }} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: '#E0E0E0' }}>
                Export Annual Summary
              </h2>
              <p className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>IRDAI Annual Return — Excel Workbook</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:bg-white/10"
            style={{ color: '#8D99AE' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Financial Year */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#8D99AE' }}>
              <Calendar size={12} /> Financial Year
            </label>
            <select
              value={financialYear}
              onChange={e => setFinancialYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-sm font-semibold outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#E0E0E0', border: '1px solid rgba(141,153,174,0.2)' }}
            >
              {FY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} style={{ background: '#0D1B2A' }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Survey Type Filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#8D99AE' }}>
              <Filter size={12} /> Survey Type
            </label>
            <div className="flex gap-2">
              {(['all', 'spot', 'final'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setSurveyTypeFilter(type)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold capitalize transition-all"
                  style={{
                    background: surveyTypeFilter === type ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                    color: surveyTypeFilter === type ? '#22c55e' : '#8D99AE',
                    border: `1px solid ${surveyTypeFilter === type ? 'rgba(34,197,94,0.4)' : 'rgba(141,153,174,0.2)'}`,
                  }}
                >
                  {type === 'all' ? 'All' : type === 'spot' ? 'Spot' : 'Final'}
                </button>
              ))}
            </div>
          </div>

          {/* Include Archived */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#8D99AE' }}>
              <Archive size={12} /> Include Archived Claims
            </label>
            <button
              onClick={() => setIncludeArchived(v => !v)}
              className="relative w-10 h-5 rounded-full transition-all"
              style={{ background: includeArchived ? '#22c55e' : 'rgba(141,153,174,0.3)' }}
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
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(141,153,174,0.1)' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#8D99AE' }}>
              Preview — FY {fyLabel}
            </p>
            {loading ? (
              <div className="flex items-center gap-2" style={{ color: '#8D99AE' }}>
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Loading claims…</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs" style={{ color: '#8D99AE' }}>Claims matched</p>
                  <p className="text-xl font-black" style={{ color: '#E0E0E0' }}>{filtered.length}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#8D99AE' }}>Total fees</p>
                  <p className="text-xl font-black" style={{ color: '#22c55e' }}>
                    ₹{totalFees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={exporting || loading || filtered.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
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

          <p className="text-center text-xs" style={{ color: '#8D99AE' }}>
            Downloads a 4-sheet Excel workbook: Claim Register · Insurer-wise · Month-wise · Analytics
          </p>
        </div>
      </div>
    </div>
  );
}
