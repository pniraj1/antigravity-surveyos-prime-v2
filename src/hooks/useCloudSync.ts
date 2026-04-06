// ═══════════════════════════════════════════════════════════
// CLOUD SYNC HOOK — Layer 2 (Firestore) + Layer 3 (Queue Drain)
// - Pushes clean claims to Firestore with 2s debounce
// - Queues failed pushes when offline
// - Drains the queue automatically on reconnect
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import {
  pushClaimToCloud,
  pullClaimsFromCloud,
  syncAllLocalToCloud,
  pullProfileFromCloud,
  pushProfileToCloud,
} from '@/lib/firebase/sync';
import {
  addToSyncQueue,
  getSyncQueue,
  removeSyncItem,
  getClaim,
} from '@/lib/storage/indexeddb';

export function useCloudSync() {
  const { user, isAuthenticated } = useAuthStore();
  const { currentClaim, isDirty } = useClaimStore();
  const { profile } = useProfileStore();
  const { isOnline, setSaveStatus } = useUIStore();
  const isSyncingFullRef = useRef(false);
  const cloudTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDrainingRef = useRef(false);

  // ─── 1. Initial Full Sync on Login ────────────────────────
  useEffect(() => {
    if (isAuthenticated && user && !isSyncingFullRef.current) {
      isSyncingFullRef.current = true;
      (async () => {
        try {
          console.log('[useCloudSync] Initial full sync started...');
          const remoteProfile = await pullProfileFromCloud(user.uid);
          if (!remoteProfile) {
            console.log('[useCloudSync] No remote profile found, creating initial cloud profile.');
            await pushProfileToCloud(user.uid, profile);
          }
          await syncAllLocalToCloud(user.uid);
          await pullClaimsFromCloud(user.uid);
          console.log('[useCloudSync] Initial full sync complete.');
        } catch (err) {
          console.error('[useCloudSync] Initial sync failed:', err);
          isSyncingFullRef.current = false;
        }
      })();
    } else if (!isAuthenticated) {
      isSyncingFullRef.current = false;
    }
  }, [isAuthenticated, user]);

  // ─── 2. Layer 2: Debounced Firestore Push ─────────────────
  // Fires 2s after claim becomes "clean" (IndexedDB already saved)
  useEffect(() => {
    if (!isAuthenticated || !user || !currentClaim || isDirty) return;

    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);

    cloudTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        if (isOnline) {
          await pushClaimToCloud(user.uid, currentClaim);
          setSaveStatus('saved');
          console.log(`[useCloudSync] Pushed claim ${currentClaim.id} to Firestore.`);
        } else {
          // Offline — add to the sync queue for retry on reconnect
          await addToSyncQueue('claim-backup', { claimId: currentClaim.id, uid: user.uid });
          setSaveStatus('queued');
          console.log(`[useCloudSync] Offline — claim ${currentClaim.id} queued for sync.`);
        }
      } catch (err) {
        // Network error mid-push — queue it
        console.error('[useCloudSync] Cloud push failed, queuing:', err);
        await addToSyncQueue('claim-backup', { claimId: currentClaim.id, uid: user.uid });
        setSaveStatus('queued');
      }
    }, 2000);

    return () => {
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    };
  }, [isAuthenticated, user, currentClaim, isDirty, isOnline, setSaveStatus]);

  // ─── 3. Layer 3: Drain Sync Queue on Reconnect ────────────
  useEffect(() => {
    if (!isAuthenticated || !user || !isOnline || isDrainingRef.current) return;

    isDrainingRef.current = true;
    (async () => {
      try {
        const queue = await getSyncQueue();
        const claimItems = queue.filter(item => item.type === 'claim-backup');

        if (claimItems.length === 0) {
          isDrainingRef.current = false;
          return;
        }

        console.log(`[useCloudSync] Draining ${claimItems.length} queued item(s)...`);
        setSaveStatus('saving');

        for (const item of claimItems) {
          try {
            const payload = item.payload as { claimId: string; uid: string };
            // Fetch the full claim from IndexedDB (has latest data including photos locally)
            const claim = await getClaim(payload.claimId);
            if (claim) {
              await pushClaimToCloud(payload.uid, claim);
              await removeSyncItem(item.id);
              console.log(`[useCloudSync] Queue item ${item.id} synced and removed.`);
            } else {
              // Claim no longer exists locally — remove orphaned queue item
              await removeSyncItem(item.id);
            }
          } catch (err) {
            console.error(`[useCloudSync] Failed to drain item ${item.id}:`, err);
            // Leave it in the queue for next reconnect
          }
        }

        setSaveStatus('saved');
        console.log('[useCloudSync] Queue drain complete.');
      } catch (err) {
        console.error('[useCloudSync] Queue drain failed:', err);
      } finally {
        isDrainingRef.current = false;
      }
    })();
  }, [isOnline, isAuthenticated, user, setSaveStatus]);

  // ─── 4. Profile Sync on Profile Changes ───────────────────
  useEffect(() => {
    if (isAuthenticated && user && profile && isSyncingFullRef.current) {
      pushProfileToCloud(user.uid, profile).catch(err => {
        console.error('[useCloudSync] Profile cloud push failed:', err);
      });
    }
  }, [isAuthenticated, user, profile]);
}
