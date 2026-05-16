'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { pushClaimToCloud } from '@/lib/firebase/sync';
import { flushDriveQueue } from '@/lib/drive';
import { getDriveQueueCount } from '@/lib/storage/indexeddb';
import { Cloud, Loader2 } from 'lucide-react';

export function ClaimHeader() {
  const { currentClaim, isDirty } = useClaimStore();
  const { user } = useAuthStore();
  const { setSaveStatus, isDriveConnected } = useUIStore();
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!user || !currentClaim || saving) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      // Step 1: Push claim data to Firestore
      await pushClaimToCloud(user.uid, currentClaim);
      setSaveStatus('saved');

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

  const reg  = currentClaim.vehicle?.registrationNumber || '—';
  const name = currentClaim.policy?.insuredName || '';

  return (
    <div
      className="sticky top-0 z-40 flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-2 text-xs"
      style={{ background: '#0D1B2A', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <Cloud size={12} className="text-[#D4AF37] shrink-0" />
      <span className="font-bold tracking-wide text-[#D4AF37]">
        {currentClaim.reportNo || 'Draft'}
      </span>
      <span className="text-[#4A5568] hidden sm:inline">·</span>
      <span className="font-medium truncate max-w-[120px] sm:max-w-[180px] text-[#8D99AE]">{reg}</span>
      {name && (
        <>
          <span className="text-[#4A5568] hidden sm:inline">·</span>
          <span className="truncate max-w-[140px] sm:max-w-[200px] text-[#8D99AE] hidden sm:inline">{name}</span>
        </>
      )}

      <div className="flex-1" />

      {isDirty && (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[rgba(217,119,6,0.18)] text-[#FBBF24]">
          • Unsaved
        </span>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-[10px] font-black uppercase tracking-wide transition-all hover:opacity-80 disabled:opacity-50 min-h-[44px] sm:min-h-0 bg-[#D4AF37] text-[#0D1B2A]"
      >
        {saving
          ? <Loader2 size={12} className="animate-spin" />
          : <Cloud size={12} />}
        Save &amp; Sync
      </button>
    </div>
  );
}
