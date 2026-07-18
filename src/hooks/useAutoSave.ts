// ═══════════════════════════════════════════════════════════
// AUTO-SAVE HOOK — Layer 1 (IndexedDB) + Cloud Trigger
// - Instantly saves to IndexedDB on every change
// - Triggers cloud push via saveStatus signal after 2s debounce
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { saveClaim, StorageFullError } from '@/lib/storage/indexeddb';
import { logger } from '@/lib/utils/logger';

/**
 * Layer 1: Instant IndexedDB save on every claim change.
 * Layer trigger: Sets saveStatus to 'saving' → 'saved' after cloud push.
 * 
 * @param debounceMs How long to wait after last change before signalling cloud push (default 2000ms)
 */
export function useAutoSave() {
  const { currentClaim, isDirty, markClean } = useClaimStore();
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentClaim || !isDirty) return;
    if (lastSavedRef.current === currentClaim.updatedAt) return;

    saveClaim(currentClaim)
      .then(() => {
        lastSavedRef.current = currentClaim.updatedAt;
        markClean();
        // Cloud push only happens on milestones — flip 'saved' to 'unsynced' so the
        // status bar doesn't keep claiming the cloud copy is current while the
        // surveyor keeps editing. Don't stomp 'saving'/'queued'/'error', which the
        // sync layer owns.
        if (useUIStore.getState().saveStatus === 'saved') {
          useUIStore.getState().setSaveStatus('unsynced');
        }
        logger.log(`[AutoSave] Claim ${currentClaim.id} saved to IndexedDB`);
      })
      .catch(err => {
        if (err instanceof StorageFullError) {
          toast.error(
            'Storage full — delete old claims to free space. Changes are not saved.',
            { duration: 8000, id: 'storage-full' }
          );
        }
        logger.error('[AutoSave] IndexedDB save failed:', err);
      });
  }, [currentClaim, isDirty, markClean]);
}
