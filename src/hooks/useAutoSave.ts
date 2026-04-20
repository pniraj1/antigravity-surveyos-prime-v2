// ═══════════════════════════════════════════════════════════
// AUTO-SAVE HOOK — Layer 1 (IndexedDB) + Cloud Trigger
// - Instantly saves to IndexedDB on every change
// - Triggers cloud push via saveStatus signal after 2s debounce
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { saveClaim } from '@/lib/storage/indexeddb';
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
        logger.log(`[AutoSave] Claim ${currentClaim.id} saved to IndexedDB`);
      })
      .catch(err => {
        logger.error('[AutoSave] IndexedDB save failed:', err);
      });
  }, [currentClaim, isDirty, markClean]);
}
