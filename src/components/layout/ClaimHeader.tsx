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
          const flushed = await flushDriveQueue().catch(() => 0);
          if (flushed > 0) {
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
      className="sticky top-0 z-40 flex items-center gap-3 px-5 py-2 text-xs"
      style={{ background: '#0D1B2A', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <Cloud size={12} style={{ color: '#D4AF37', flexShrink: 0 }} />
      <span className="font-bold tracking-wide" style={{ color: '#D4AF37' }}>
        {currentClaim.reportNo || 'Draft'}
      </span>
      <span style={{ color: '#4A5568' }}>·</span>
      <span className="font-medium truncate max-w-[120px]" style={{ color: '#8D99AE' }}>{reg}</span>
      {name && (
        <>
          <span style={{ color: '#4A5568' }}>·</span>
          <span className="truncate max-w-[140px]" style={{ color: '#8D99AE' }}>{name}</span>
        </>
      )}

      <div className="flex-1" />

      {isDirty && (
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold"
          style={{ background: 'rgba(217,119,6,0.18)', color: '#FBBF24' }}
        >
          • Unsaved
        </span>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all hover:opacity-80 disabled:opacity-50"
        style={{ background: '#D4AF37', color: '#0D1B2A' }}
      >
        {saving
          ? <Loader2 size={10} className="animate-spin" />
          : <Cloud size={10} />}
        Save &amp; Sync
      </button>
    </div>
  );
}
