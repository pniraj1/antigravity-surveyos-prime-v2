'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { HardDrive, Trash2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  getStorageUsageSummary,
  clearDriveQueue,
  clearRecoveredClaims,
  type StorageSummary,
} from '@/lib/storage/indexeddb';

export function StorageCleanerSection() {
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStorageUsageSummary();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read storage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleCleanUp = async () => {
    setCleaning(true);
    try {
      const mb = summary ? (summary.driveQueueBytes / (1024 * 1024)).toFixed(2) : '0.00';
      await clearDriveQueue();
      await clearRecoveredClaims();
      toast.success(`Cleaned up ${mb} MB of cached queue items and recovery snapshots.`);
      await fetchSummary();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clean storage';
      toast.error(msg);
    } finally {
      setCleaning(false);
    }
  };

  const queueMB = summary ? (summary.driveQueueBytes / (1024 * 1024)).toFixed(2) : '0.00';
  const hasCleanableItems = summary ? summary.driveQueueCount > 0 || summary.recoveredClaimsCount > 0 : false;

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border" style={{ background: 'var(--color-neutral-100)' }}>
        <div className="flex items-center gap-2">
          <HardDrive size={14} className="text-primary" />
          <span className="text-sm font-medium text-foreground">Browser Storage &amp; Memory</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', border: '1px solid var(--color-neutral-200)' }}>
            IndexedDB
          </span>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Refresh storage statistics"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Error message if reading storage fails */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-status-danger-tint border border-status-danger/15">
            <AlertCircle size={14} className="text-status-danger flex-shrink-0" />
            <span className="text-xs font-medium text-status-danger">{error}</span>
          </div>
        )}

        {/* 3 Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Saved Claims */}
          <div className="rounded-xl p-3 border border-border" style={{ background: 'var(--color-neutral-50)' }}>
            <div className="text-[9px] font-medium uppercase tracking-[0.18em] mb-1 text-muted-foreground">
              Saved Claims
            </div>
            <div className="text-sm font-medium text-foreground">
              {summary !== null ? `${summary.claimsCount} claims` : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Active reports in database
            </div>
          </div>

          {/* Pending Drive Queue */}
          <div className="rounded-xl p-3 border border-border" style={{ background: 'var(--color-neutral-50)' }}>
            <div className="text-[9px] font-medium uppercase tracking-[0.18em] mb-1 text-muted-foreground">
              Pending Drive Queue
            </div>
            <div className="text-sm font-medium text-foreground">
              {summary !== null ? `${summary.driveQueueCount} files (${queueMB} MB)` : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Queued upload files
            </div>
          </div>

          {/* Recovery Snapshots */}
          <div className="rounded-xl p-3 border border-border" style={{ background: 'var(--color-neutral-50)' }}>
            <div className="text-[9px] font-medium uppercase tracking-[0.18em] mb-1 text-muted-foreground">
              Recovery Snapshots
            </div>
            <div className="text-sm font-medium text-foreground">
              {summary !== null ? `${summary.recoveredClaimsCount} snapshots` : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Superseded backup clones
            </div>
          </div>
        </div>

        {/* Reassuring copy box */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border" style={{ background: 'var(--color-neutral-50)' }}>
          <CheckCircle2 size={15} className="text-status-success flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Safe cleanup:</strong> This action clears stuck background upload queues and superseded recovery snapshots to prevent browser storage quota errors. Your active saved claims and reports are <strong className="text-foreground">never deleted</strong>.
          </p>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            {hasCleanableItems
              ? `${summary?.driveQueueCount ?? 0} queued files and ${summary?.recoveredClaimsCount ?? 0} snapshots can be safely cleared.`
              : 'IndexedDB cache is clean.'}
          </div>
          <button
            onClick={handleCleanUp}
            disabled={cleaning || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-sm disabled:opacity-50"
            style={{
              background: 'var(--color-status-danger-tint, #fee2e2)',
              color: 'var(--color-status-danger, #ef4444)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              cursor: cleaning || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {cleaning ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Trash2 size={13} />
            )}
            <span>{cleaning ? 'Cleaning…' : 'Clean Up Storage'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
