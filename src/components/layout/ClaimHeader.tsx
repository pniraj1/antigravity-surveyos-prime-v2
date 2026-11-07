'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import { isSandbox } from '@/lib/sandbox';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { pushClaimToCloud } from '@/lib/firebase/sync';
import { flushDriveQueue, backupAllPendingToDrive } from '@/lib/drive';
import { getDriveQueueCount } from '@/lib/storage/indexeddb';
import { DRIVE_QUEUE_EVENT } from '@/lib/drive/queue-events';
import {
  Cloud,
  Loader2,
  CheckCircle2,
  RotateCcw,
  HelpCircle,
  Check,
} from 'lucide-react';
import { setCompletedInScan } from '@/lib/drive/scan-status-sync';
import { completionPatch } from '@/lib/drive/scan-status';
import { ClaimFolderButton } from '@/components/layout/ClaimFolderButton';
import { StorageSafetyPopover } from '@/components/layout/StorageSafetyPopover';

export function ClaimHeader() {
  const storeClaim = useClaimStore((s) => s.currentClaim);
  const currentClaim =
    (typeof useClaimStore?.getState === 'function' ? useClaimStore.getState().currentClaim : null) ??
    storeClaim;

  const storeUpdateClaim = useClaimStore((s) => s.updateClaim);
  const updateClaim =
    (typeof useClaimStore?.getState === 'function' ? useClaimStore.getState().updateClaim : null) ??
    storeUpdateClaim ??
    (() => {});

  const storeUser = useAuthStore((s) => s.user);
  const user =
    (typeof useAuthStore?.getState === 'function' ? useAuthStore.getState().user : null) ??
    storeUser;

  const storeSaveStatus = useUIStore((s) => s.saveStatus);
  const saveStatus =
    (typeof useUIStore?.getState === 'function' ? useUIStore.getState().saveStatus : null) ??
    storeSaveStatus ??
    'idle';

  const storeSetSaveStatus = useUIStore((s) => s.setSaveStatus);
  const setSaveStatus =
    (typeof useUIStore?.getState === 'function' ? useUIStore.getState().setSaveStatus : null) ??
    storeSetSaveStatus ??
    (() => {});

  const storeIsDriveConnected = useUIStore((s) => s.isDriveConnected);
  const isDriveConnected =
    (typeof useUIStore?.getState === 'function' ? useUIStore.getState().isDriveConnected : null) ??
    storeIsDriveConnected ??
    false;

  const storeDriveEmail = useUIStore((s) => s.driveEmail);
  const driveEmail =
    (typeof useUIStore?.getState === 'function' ? useUIStore.getState().driveEmail : null) ??
    storeDriveEmail ??
    '';

  const storeIsOnline = useUIStore((s) => s.isOnline);
  const isOnline =
    (typeof useUIStore?.getState === 'function' ? useUIStore.getState().isOnline : null) ??
    storeIsOnline ??
    true;

  const [saving, setSaving] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [driveQueueCount, setDriveQueueCount] = useState(0);

  // Keep track of pending Drive uploads
  useEffect(() => {
    let alive = true;
    const refreshQueue = () => {
      getDriveQueueCount()
        .then((n) => {
          if (alive) setDriveQueueCount(n);
        })
        .catch(() => {});
    };
    refreshQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener(DRIVE_QUEUE_EVENT, refreshQueue);
      window.addEventListener('online', refreshQueue);
    }
    return () => {
      alive = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener(DRIVE_QUEUE_EVENT, refreshQueue);
        window.removeEventListener('online', refreshQueue);
      }
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (isSandbox()) {
      toast.success('Sandbox: Changes saved locally (no cloud sync needed)');
      return;
    }
    if (!user || !currentClaim || saving) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      // Step 1: Push claim data to Firestore
      const res = await pushClaimToCloud(user.uid, currentClaim);
      if (res.conflicted) {
        // The cloud refused the write — nothing was saved. Say so plainly, and
        // skip the Drive backups below, which would imply success.
        setSaveStatus('error');
        toast.error(
          'NOT saved — a newer version of this report exists in the cloud. Your changes are kept in the Recovered tab.',
          { duration: 12000 },
        );
        return;
      }
      setSaveStatus('saved');

      // Also catch up any claims whose Drive backup is missing/stale, so a single
      // Save & Sync leaves everything backed up. Background + duplicate-safe.
      void backupAllPendingToDrive();

      // Step 2: Flush Drive photo queue if Drive is linked
      if (isDriveConnected) {
        const pending = await getDriveQueueCount().catch(() => 0);
        if (pending > 0) {
          let flushed = 0;
          let driveError = false;
          try {
            flushed = await flushDriveQueue();
          } catch {
            driveError = true;
          }
          if (driveError) {
            toast.success('Saved to Cloud Vault · Drive sync failed (photos queued)');
          } else if (flushed > 0) {
            toast.success(
              `Cloud Vault saved · ${flushed} photo${flushed > 1 ? 's' : ''} synced to Drive`
            );
          } else {
            toast.success('Saved to Cloud Vault · Drive photos pending (retry later)');
          }
        } else {
          toast.success('Saved to Cloud Vault · Drive up to date');
        }
      } else {
        toast.success('Saved to Cloud Vault');
      }
    } catch {
      setSaveStatus('queued');
      toast.error('Save failed — queued for next sync');
    } finally {
      setSaving(false);
    }
  }, [user, currentClaim, saving, setSaveStatus, isDriveConnected]);

  if (!currentClaim) return null;

  const completed = !!currentClaim.completedAt;
  const toggleCompleted = () => {
    const at = new Date().toISOString();
    updateClaim(completionPatch(!completed, at));
    void setCompletedInScan(currentClaim, !completed, at); // Scan's status file; quiet when unlinked or offline
  };

  const reg  = currentClaim.vehicle?.registrationNumber || '—';
  const name = currentClaim.policy?.insuredName || '';

  // Single unified status pill state derivation:
  // 1. [↻ Saving...] (pulsing indicator while writing to Firestore/Drive)
  // 2. [● Saved to Laptop] (when offline or local only)
  // 3. [✓ All Changes Saved] (subtle emerald check icon + clean badge when synced and online)
  const isCurrentlySaving = saving || saveStatus === 'saving';
  const isOfflineOrLocal = !isOnline || saveStatus === 'unsynced' || saveStatus === 'queued';

  let pillIcon = <Check size={12} className="text-emerald-500 shrink-0" />;
  let pillText = 'All Changes Saved';
  let pillClass =
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20';
  let pillTooltip = 'All changes saved to laptop and cloud vault (click for details)';

  if (isCurrentlySaving) {
    pillIcon = <Loader2 size={12} className="animate-spin text-sky-500 shrink-0" />;
    pillText = 'Saving...';
    pillClass =
      'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/20';
    pillTooltip = 'Saving changes to local storage and cloud...';
  } else if (isOfflineOrLocal) {
    pillIcon = <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />;
    pillText = 'Saved to Laptop';
    pillClass =
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20';
    pillTooltip = 'Saved locally to your computer. Click to view storage tiers & sync.';
  }

  return (
    <div
      className="sticky top-0 z-40 flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-2 text-xs bg-card border-b border-border"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <Cloud size={12} className="text-primary shrink-0" />
      <span className="font-medium tracking-wide text-primary">
        {currentClaim.reportNo || 'Draft'}
      </span>
      {isSandbox() && (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/40">
          SANDBOX (NO LOGIN REQUIRED)
        </span>
      )}
      <span className="text-muted-foreground hidden sm:inline">·</span>
      <span className="font-medium truncate max-w-[120px] sm:max-w-[180px] text-muted-foreground">{reg}</span>
      {name && (
        <>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <span className="truncate max-w-[140px] sm:max-w-[200px] text-muted-foreground hidden sm:inline">{name}</span>
        </>
      )}

      <ClaimFolderButton />

      <div className="flex-1" />

      {/* Completion toggle */}
      <button
        onClick={toggleCompleted}
        className="flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-[10px] font-medium uppercase tracking-wide transition-all hover:opacity-80 min-h-[44px] sm:min-h-0 border border-border cursor-pointer"
      >
        {completed ? <RotateCcw size={12} /> : <CheckCircle2 size={12} />}
        {completed ? 'Reopen' : 'Mark completed'}
      </button>

      {/* Unified Storage & Safety Status Pill & Popover */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsPopoverOpen((prev) => !prev)}
          aria-expanded={isPopoverOpen}
          aria-haspopup="dialog"
          className={`flex items-center gap-1.5 px-3 py-2.5 sm:px-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-[10px] font-medium tracking-wide transition-all min-h-[44px] sm:min-h-0 border cursor-pointer ${pillClass}`}
          title={pillTooltip}
        >
          {pillIcon}
          <span>{pillText}</span>
        </button>

        <StorageSafetyPopover
          isOpen={isPopoverOpen}
          onClose={() => setIsPopoverOpen(false)}
          claimId={currentClaim.id}
          gDriveFolderId={currentClaim.gDriveFolderId}
          driveConnected={isDriveConnected}
          driveEmail={driveEmail}
          driveQueueCount={driveQueueCount}
          cloudSyncStatus={saveStatus}
          isOnline={isOnline}
          isSaving={saving}
          onSyncNow={handleSave}
        />
      </div>

      {/* Help & Guide */}
      <button
        onClick={() => useUIStore.getState().setHelpDialogOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-[10px] font-medium transition-all hover:bg-muted min-h-[44px] sm:min-h-0 border border-border text-muted-foreground hover:text-foreground cursor-pointer"
        title="Help & Guide"
        aria-label="Help & Guide"
      >
        <HelpCircle size={14} className="text-primary" />
        <span className="hidden sm:inline">Help</span>
      </button>
    </div>
  );
}
