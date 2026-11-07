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
import { pullSecretsFromCloud, pushSecretsToCloud } from '@/lib/firebase/sync-secrets';
import {
  addToSyncQueue,
  getSyncQueue,
  removeSyncItem,
  getClaim,
  getPushedAt,
} from '@/lib/storage/indexeddb';
import { flushDriveQueue, silentlyRestoreDriveToken, backupProfileToDrive, restoreProfileFromDrive, getDriveToken } from '@/lib/drive';
import { isSandbox } from '@/lib/sandbox';

export const TAB_SWITCH_COALESCE_MS = 15_000;

export function useCloudSync() {
  const { user, isAuthenticated, activeWorkspaceUid, isTeamMember } = useAuthStore();
  const effectiveUid = activeWorkspaceUid || user?.uid || '';
  const { currentClaim } = useClaimStore();
  const { profile } = useProfileStore();
  const { isOnline, setSaveStatus, activeTab } = useUIStore();
  const isSyncingFullRef = useRef(false);
  const profileSyncReadyRef = useRef(false);
  const profileTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tabSwitchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDrainingRef = useRef(false);
  const driveRestoreAttemptedRef = useRef(false);

  // Always-fresh refs — safe to read inside effects with stable deps
  const currentClaimRef = useRef<ClaimData | null>(currentClaim);
  const prevClaimRef = useRef<ClaimData | null>(null);
  const userRef = useRef(user);
  const isAuthRef = useRef(isAuthenticated);
  const effectiveUidRef = useRef(effectiveUid);
  const isTeamMemberRef = useRef(isTeamMember);
  currentClaimRef.current = currentClaim;
  userRef.current = user;
  isAuthRef.current = isAuthenticated;
  effectiveUidRef.current = effectiveUid;
  isTeamMemberRef.current = isTeamMember;

  // Stable ref to the milestone push fn (avoids stale closures in effects)
  // opts.mirrorToDrive lets background callers (staleness timer) skip the
  // Drive replica write; milestone callers omit it and default to mirroring.
  const milestonePushRef = useRef(async (_claim: ClaimData, _uid: string, _opts?: { mirrorToDrive?: boolean }) => {});
  milestonePushRef.current = async (claim: ClaimData, uid: string, opts?: { mirrorToDrive?: boolean }) => {
    if (isSandbox()) return;
    // Root-cause dirty guard: every milestone caller (2a/2b/2d) routes
    // through here, so one check covers all of them. Same definition as
    // sync-guard.ts selectDirtyClaims — never pushed, or edited since.
    const pushedAt = await getPushedAt(claim.id);
    const isDirty = !pushedAt || claim.updatedAt > pushedAt;
    if (!isDirty) {
      logger.log(`[useCloudSync] Skipping push — claim ${claim.id} has no unpushed changes.`);
      return;
    }
    if (!navigator.onLine) {
      await addToSyncQueue('claim-backup', { claimId: claim.id, uid });
      setSaveStatus('queued');
      logger.log(`[useCloudSync] Offline — claim ${claim.id} queued.`);
      return;
    }
    setSaveStatus('saving');
    try {
      await pushClaimToCloud(uid, claim, opts);
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
    if (isSandbox()) return;
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
    if (isSandbox()) return;
    if (isAuthenticated && user && !isSyncingFullRef.current) {
      isSyncingFullRef.current = true;
      (async () => {
        try {
          logger.log('[useCloudSync] Login sync started...');

          if (!isTeamMember) {
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

          // AI keys + signature + stamp, owner-only docs. Own try: a failure here
          // must not hold up claim sync.
          try {
            await pullSecretsFromCloud(user.uid);
          } catch (err) {
            logger.error('[useCloudSync] Keys/signature/stamp sync failed:', err);
          }

          } else {
            // Team member: Pull firm owner's profile so senior surveyor's details appear on reports
            if (effectiveUid) {
              await pullProfileFromCloud(effectiveUid);
            }
          }

          // Allow profile useEffect (Section 4) to push changes only after initial pull.
          // Prevents an empty new-device profile from overwriting Firestore on login.
          profileSyncReadyRef.current = true;
          useUIStore.getState().setLoginSyncDone(true);

          // Capture timestamp BEFORE sync so any claims edited during sync are caught next time
          const syncTargetUid = effectiveUid || user.uid;
          const sinceTimestamp = getLastSyncTimestamp(syncTargetUid);
          const syncStartedAt = new Date().toISOString();

          // Delete tombstoned claims from cloud BEFORE pulling so the pull
          // can't resurrect anything the user just deleted.
          await syncTombstones(syncTargetUid);
          await syncDeltaToCloud(syncTargetUid, sinceTimestamp);
          await pullClaimsFromCloud(syncTargetUid, sinceTimestamp);

          // Only update the timestamp after both push and pull succeed
          setLastSyncTimestamp(syncTargetUid, syncStartedAt);
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
      useUIStore.getState().setLoginSyncDone(false);
    }
  }, [isAuthenticated, user, effectiveUid, isTeamMember]);

  // ─── 2a. Milestone: Tab switch ───────────────────────────
  // Push current claim whenever the surveyor moves to a different tab.
  // Debounced with 15s quiet window so rapid tab navigation coalesces into 1 write.
  const tabInitRef = useRef(false);
  useEffect(() => {
    if (!tabInitRef.current) { tabInitRef.current = true; return; } // skip mount
    const claim = currentClaimRef.current;
    const uid = effectiveUidRef.current || userRef.current?.uid;
    if (!claim || !uid || !isAuthRef.current) return;

    if (tabSwitchTimerRef.current) {
      clearTimeout(tabSwitchTimerRef.current);
    }
    tabSwitchTimerRef.current = setTimeout(() => {
      tabSwitchTimerRef.current = null;
      const latestClaim = currentClaimRef.current;
      const latestUid = effectiveUidRef.current || userRef.current?.uid;
      if (!latestClaim || !latestUid || !isAuthRef.current) return;
      milestonePushRef.current(latestClaim, latestUid);
    }, TAB_SWITCH_COALESCE_MS);

    return () => {
      if (tabSwitchTimerRef.current) {
        clearTimeout(tabSwitchTimerRef.current);
        tabSwitchTimerRef.current = null;
      }
    };
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 2b. Milestone: Claim switch ────────────────────────
  // Push the claim being left when the surveyor opens a different claim.
  // Flushes any coalesced tab-switch push immediately.
  useEffect(() => {
    const prev = prevClaimRef.current;
    prevClaimRef.current = currentClaim;
    if (!prev || prev.id === currentClaim?.id) return;
    if (tabSwitchTimerRef.current) {
      clearTimeout(tabSwitchTimerRef.current);
      tabSwitchTimerRef.current = null;
    }
    const uid = effectiveUidRef.current || userRef.current?.uid;
    if (!uid || !isAuthRef.current) return;
    milestonePushRef.current(prev, uid);
  }, [currentClaim?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 2c. Milestone: Page close / refresh ────────────────
  // Queue for next-login drain (can't await async in beforeunload).
  // Flushes any coalesced tab-switch push immediately before unload.
  useEffect(() => {
    const handler = () => {
      const hadPendingTimer = Boolean(tabSwitchTimerRef.current);
      if (tabSwitchTimerRef.current) {
        clearTimeout(tabSwitchTimerRef.current);
        tabSwitchTimerRef.current = null;
      }
      const claim = currentClaimRef.current;
      const uid = effectiveUidRef.current || userRef.current?.uid;
      if (!claim || !uid) return;
      if (hadPendingTimer && isAuthRef.current) {
        milestonePushRef.current(claim, uid);
      }
      addToSyncQueue('claim-backup', { claimId: claim.id, uid }).catch(err => {
        logger.error('[useCloudSync] beforeunload queue failed — claim may not sync:', err);
      });
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ─── 2d. Milestone: Tab hidden / app backgrounded ───────
  // visibilitychange fires reliably BEFORE the page is frozen or closed
  // (unlike beforeunload, which can only queue locally). We attempt a real
  // cloud push here so a surveyor who just switches tabs or minimises the
  // window — then walks to another computer — has their latest state in the
  // vault. Flushes any coalesced tab-switch push immediately.
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== 'hidden') return;
      if (tabSwitchTimerRef.current) {
        clearTimeout(tabSwitchTimerRef.current);
        tabSwitchTimerRef.current = null;
      }
      const claim = currentClaimRef.current;
      const uid = effectiveUidRef.current || userRef.current?.uid;
      if (!claim || !uid || !isAuthRef.current) return;
      milestonePushRef.current(claim, uid);
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // ─── 2e. Staleness Safety Net: periodic dirty-claim push ─
  // Milestones (2a/2b/2d) cover tab/claim switches, but a surveyor who
  // leaves a single claim open and idle for a long stretch never triggers
  // one. Poll in the background and push if dirty — mirrorToDrive: false
  // so the Drive replica doesn't churn on every 5-minute tick (same flag
  // pattern as syncDeltaToCloud in sync.ts). Skips entirely when offline;
  // milestones already own queueing, so this timer never queues.
  const STALENESS_PUSH_INTERVAL_MS = 300_000; // 5 minutes
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      const claim = currentClaimRef.current;
      const uid = effectiveUidRef.current || userRef.current?.uid;
      if (!claim || !uid || !isAuthRef.current) return;
      if (!navigator.onLine) return;
      milestonePushRef.current(claim, uid, { mirrorToDrive: false });
    }, STALENESS_PUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // ─── 3. Drain Sync Queue on Reconnect ────────────────────
  useEffect(() => {
    if (isSandbox() || !isAuthenticated || !user || !isOnline || isDrainingRef.current) return;

    isDrainingRef.current = true;
    (async () => {
      try {
        const syncTargetUid = effectiveUid || user.uid;
        // Deletions made offline are queued as local tombstones. Flush them on
        // reconnect — waiting for the next login leaves a deleted claim alive
        // in the cloud, and visible in Cloud Vault, for the rest of the day.
        try {
          await syncTombstones(syncTargetUid);
        } catch (err) {
          logger.error('[useCloudSync] Pending tombstone flush failed:', err);
        }

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
            const payload = item.payload as { claimId: string; uid?: string };
            const claim = await getClaim(payload.claimId);
            if (claim) {
            const targetUid = payload.uid || syncTargetUid;
            await pushClaimToCloud(targetUid, claim);
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
  }, [isOnline, isAuthenticated, user, effectiveUid, setSaveStatus]);

  // ─── 4. Debounced Profile Sync on Profile Changes ─────────
  // Only fires after the initial pull completes (profileSyncReadyRef = true).
  // Debounced 3s to avoid a write storm while the user types in profile fields.
  useEffect(() => {
    if (isSandbox() || !isAuthenticated || !user || !profile || !profileSyncReadyRef.current || isTeamMember) return;

    if (profileTimerRef.current) clearTimeout(profileTimerRef.current);

    profileTimerRef.current = setTimeout(() => {
      pushProfileToCloud(user.uid, profile).catch(err => {
        logger.error('[useCloudSync] Profile cloud push failed:', err);
      });
      pushSecretsToCloud(user.uid, profile).catch(err => {
        logger.error('[useCloudSync] Keys/signature/stamp push failed:', err);
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
  }, [isAuthenticated, user, profile, isTeamMember]);
}
