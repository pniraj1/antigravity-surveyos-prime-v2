// ═══════════════════════════════════════════════════════════
// AUTO-SAVE HOOK — Layer 1 (IndexedDB) + Cloud Trigger
// - Instantly saves to IndexedDB on every change
// - Triggers cloud push via saveStatus signal after 2s debounce
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { saveClaim } from '@/lib/storage/indexeddb';

/**
 * Layer 1: Instant IndexedDB save on every claim change.
 * Layer trigger: Sets saveStatus to 'saving' → 'saved' after cloud push.
 * 
 * @param debounceMs How long to wait after last change before signalling cloud push (default 2000ms)
 */
export function useAutoSave(debounceMs = 2000) {
  const { currentClaim, isDirty, markClean } = useClaimStore();
  const { setSaveStatus } = useUIStore();
  const cloudTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentClaim || !isDirty) return;
    if (lastSavedRef.current === currentClaim.updatedAt) return;

    // ── Layer 1: Instant local save ─────────────────────
    setSaveStatus('saving');
    saveClaim(currentClaim)
      .then(() => {
        lastSavedRef.current = currentClaim.updatedAt;
        markClean(); // Signals useCloudSync to begin cloud push
        console.log(`[AutoSave] Claim ${currentClaim.id} saved to IndexedDB`);
      })
      .catch(err => {
        console.error('[AutoSave] IndexedDB save failed:', err);
        setSaveStatus('idle');
      });

    // ── Cloud Trigger: debounced signal ─────────────────
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    cloudTimerRef.current = setTimeout(() => {
      // useCloudSync will react to the clean state and push to Firestore
    }, debounceMs);

    return () => {
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    };
  }, [currentClaim, isDirty, debounceMs, markClean, setSaveStatus]);
}
