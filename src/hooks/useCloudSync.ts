// ═══════════════════════════════════════════════════════════
// CLOUD SYNC HOOK — Layer 2 (Firestore) + Layer 3 (Queue Drain)
// - Pushes to Firestore only on milestones (tab switch, claim switch, page close)
// - Queues failed pushes when offline; drains automatically on reconnect
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import type { ClaimData } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { logger } from '@/lib/utils/logger';
import {
  pushClaimToCloud,
  pullClaimsFromCloud,
  syncDeltaToCloud,
  syncTombstones,
  pullProfileFromCloud,
  pushProfileToCloud,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from '@/lib/firebase/sync';
import {
  addToSyncQueue,
  getSyncQueue,
  removeSyncItem,
  getClaim,
} from '@/lib/storage/indexeddb';
import { flushDriveQueue, silentlyRestoreDriveToken, backupProfileToDrive, restoreProfileFromDrive, getDriveToken } from '@/lib/drive';

export function useCloudSync() {
  const { user, isAuthenticated } = useAuthStore();
  const { currentClaim } = useClaimStore();
  const { profile } = useProfileStore();
  const { isOnline, setSaveStatus, activeTab } = useUIStore();
  const isSyncingFullRef = useRef(false);
  const profileSyncReadyRef = useRef(false);
  const profileTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDrainingRef = useRef(false);
  const driveRestoreAttemptedRef = useRef(false);

  // Always-fresh refs — safe to read inside effects with stable deps
  const currentClaimRef = useRef<ClaimData | null>(currentClaim);
  const prevClaimRef = useRef<ClaimData | null>(null);
  const userRef = useRef(user);
  const isAuthRef = useRef(isAuthenticated);
  currentClaimRef.current = currentClaim;
  userRef.current = user;
  isAuthRef.current = isAuthenticated;

  // Stable ref to the milestone push fn (avoids stale closures in effects)
  const milestonePushRef = useRef(async (_claim: ClaimData, _uid: string) => {});
  milestonePushRef.current = async (claim: ClaimData, uid: string) => {
    if (!navigator.onLine) {
      await addToSyncQueue('claim-backup', { claimId: claim.id, uid });
      setSaveStatus('queued');
      logger.log(`[useCloudSync] Offline — claim ${claim.id} queued.`);
      return;
    }
    setSaveStatus('saving');
    try {
      await pushClaimToCloud(uid, claim);
      setSaveStatus('saved');
      logger.log(`[useCloudSync] Milestone push: claim ${claim.id}`);
    } catch (err) {
      logger.error('[useCloudSync] Milestone push failed:', err);
      await addToSyncQueue('claim-backup', { claimId: claim.id, uid });
      setSaveStatus('queued');
    }
  };

  // ─── Online/offline → store sync ─────────────────────────
  useEffect(() => {
    const { setOnline } = useUIStore.getState();
    const onOnline  = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ─── 0. Silent Drive token restore on page load ───────────
  // If Drive was linked in a previous session (isDriveConnected persisted in
  // localStorage), silently re-acquire a token without a popup so the user
  // doesn't have to re-link Drive on every refresh.
  const { isDriveConnected } = useUIStore();
  useEffect(() => {
    if (isDriveConnected && !driveRestoreAttemptedRef.current) {
      driveRestoreAttemptedRef.current = true;
      const attempt = () => silentlyRestoreDriveToken().then(success => {
        // If silent restore failed AND no valid token in localStorage, Drive is truly disconnected
        if (!success && !getDriveToken()) {
          useUIStore.getState().setDriveConnected(false);
        }
      }).catch(() => {
        if (!getDriveToken()) useUIStore.getState().setDriveConnected(false);
      });
      // @ts-ignore
      if (typeof google !== 'undefined' && google?.accounts?.oauth2) {
        attempt();
      } else {
        const timeout = setTimeout(attempt, 2000);
        return () => clearTimeout(timeout);
      }
    }
  }, [isDriveConnected]);

  // ─── 1. Delta Sync on Login ───────────────────────────────
  // Reads lastSyncTimestamp from localStorage to push/pull only claims
  // that changed since the last successful sync. Falls back to full
  // sync on first login on this device (timestamp is null).
  useEffect(() => {
    if (isAuthenticated && user && !isSyncingFullRef.current) {
      isSyncingFullRef.current = true;
      (async () => {
        try {
          logger.log('[useCloudSync] Login sync started...');

          // Restore profile: Drive first (has signatures), then Firestore (has latest text)
          const driveProfile = await restoreProfileFromDrive();
          if (driveProfile) {
            logger.log('[useCloudSync] Restored profile from Google Drive.');
            useProfileStore.getState().updateProfile(driveProfile);
          }

          const remoteProfile = await pullProfileFromCloud(user.uid);
          if (!remoteProfile && !driveProfile) {
            logger.log('[useCloudSync] No remote profile — pushing local profile.');
            await pushProfileToCloud(user.uid, profile);
          }

          // Allow profile useEffect (Section 4) to push changes only after initial pull.
          // Prevents an empty new-device profile from overwriting Firestore on login.
          profileSyncReadyRef.current = true;

          // Capture timestamp BEFORE sync so any claims edited during sync are caught next time
          const sinceTimestamp = getLastSyncTimestamp(user.uid);
          const syncStartedAt = new Date().toISOString();

          // Delete tombstoned claims from cloud BEFORE pulling so the pull
          // can't resurrect anything the user just deleted.
          await syncTombstones(user.uid);
          await syncDeltaToCloud(user.uid, sinceTimestamp);
          await pullClaimsFromCloud(user.uid, sinceTimestamp);

          // Only update the timestamp after both push and pull succeed
          setLastSyncTimestamp(user.uid, syncStartedAt);
          logger.log(`[useCloudSync] Login sync complete. Next sync will be delta from ${syncStartedAt}.`);
        } catch (err) {
          logger.error('[useCloudSync] Login sync failed:', err);
          // Reset so next login retries rather than skipping
          isSyncingFullRef.current = false;
        }
      })();
    } else if (!isAuthenticated) {
      isSyncingFullRef.current = false;
      profileSyncReadyRef.current = false;
    }
  }, [isAuthenticated, user]);

  // ─── 2a. Milestone: Tab switch ───────────────────────────
  // Push current claim whenever the surveyor moves to a different tab.
  const tabInitRef = useRef(false);
  useEffect(() => {
    if (!tabInitRef.current) { tabInitRef.current = true; return; } // skip mount
    const claim = currentClaimRef.current;
    const uid = userRef.current?.uid;
    if (!claim || !uid || !isAuthRef.current) return;
    milestonePushRef.current(claim, uid);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 2b. Milestone: Claim switch ────────────────────────
  // Push the claim being left when the surveyor opens a different claim.
  useEffect(() => {
    const prev = prevClaimRef.current;
    prevClaimRef.current = currentClaim;
    if (!prev || prev.id === currentClaim?.id) return;
    const uid = userRef.current?.uid;
    if (!uid || !isAuthRef.current) return;
    milestonePushRef.current(prev, uid);
  }, [currentClaim?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 2c. Milestone: Page close / refresh ────────────────
  // Queue for next-login drain (can't await async in beforeunload).
  useEffect(() => {
    const handler = () => {
      const claim = currentClaimRef.current;
      const uid = userRef.current?.uid;
      if (!claim || !uid) return;
      addToSyncQueue('claim-backup', { claimId: claim.id, uid }).catch(() => {});
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ─── 3. Drain Sync Queue on Reconnect ────────────────────
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

        logger.log(`[useCloudSync] Draining ${claimItems.length} queued item(s)...`);
        setSaveStatus('saving');

        for (const item of claimItems) {
          try {
            const payload = item.payload as { claimId: string; uid: string };
            const claim = await getClaim(payload.claimId);
            if (claim) {
              await pushClaimToCloud(payload.uid, claim);
              await removeSyncItem(item.id);
              logger.log(`[useCloudSync] Queue item ${item.id} synced and removed.`);
            } else {
              await removeSyncItem(item.id);
            }
          } catch (err) {
            logger.error(`[useCloudSync] Failed to drain item ${item.id}:`, err);
          }
        }

        setSaveStatus('saved');
        logger.log('[useCloudSync] Queue drain complete.');
      } catch (err) {
        logger.error('[useCloudSync] Queue drain failed:', err);
      } finally {
        isDrainingRef.current = false;
      }

      flushDriveQueue().catch(err => {
        logger.error('[useCloudSync] Drive queue drain failed:', err);
      });
    })();
  }, [isOnline, isAuthenticated, user, setSaveStatus]);

  // ─── 4. Debounced Profile Sync on Profile Changes ─────────
  // Only fires after the initial pull completes (profileSyncReadyRef = true).
  // Debounced 3s to avoid a write storm while the user types in profile fields.
  useEffect(() => {
    if (!isAuthenticated || !user || !profile || !profileSyncReadyRef.current) return;

    if (profileTimerRef.current) clearTimeout(profileTimerRef.current);

    profileTimerRef.current = setTimeout(() => {
      pushProfileToCloud(user.uid, profile).catch(err => {
        logger.error('[useCloudSync] Profile cloud push failed:', err);
      });
      // SECURITY NOTE: backupProfileToDrive writes API keys to the user's own Drive.
      // This is intentional for multi-device restore. See sync.ts pushProfileToCloud
      // for the full security note.
      backupProfileToDrive(profile).catch(err => {
        logger.error('[useCloudSync] Profile drive backup failed:', err);
      });
    }, 3000);

    return () => {
      if (profileTimerRef.current) clearTimeout(profileTimerRef.current);
    };
  }, [isAuthenticated, user, profile]);
}
