// ═══════════════════════════════════════════════════════════
// LOGOUT STATE RESET
//
// Wipes all user-specific state when a surveyor logs out.
// Called by useAuth.ts before setUser(null) so that the next
// surveyor who logs in on the same device starts completely clean.
//
// WHAT THIS CLEARS:
//   1. Drive localStorage keys (token, expiry, folder cache, root ID)
//   2. Drive connection UI state (isDriveConnected, driveEmail)
//   3. In-memory claim list and current claim (Zustand claim store)
//   4. Surveyor profile from Zustand + localStorage
//
// WHAT THIS DOES NOT CLEAR:
//   • IndexedDB — the user's personal "surveyos-v2-{uid}" database
//     is closed (not deleted) by closeUserDB() in indexeddb.ts.
//     All claims, sync queue, and Drive upload queue remain intact
//     and are accessible again when the same surveyor logs back in.
//   • Firestore — cloud data is never touched on logout.
//   • Drive files already uploaded — those live in Google Drive.
//
// PENDING DRIVE UPLOADS:
//   Any files sitting in the IndexedDB driveQueue are NOT lost.
//   They will be retried automatically the next time the same
//   surveyor logs in and their Drive token is restored.
//   If a different surveyor logs in, they have their own queue.
// ═══════════════════════════════════════════════════════════

import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';

/**
 * Wipes all user-specific client-side state on logout.
 *
 * Call order in useAuth.ts:
 *   1. await closeUserDB()   — close IndexedDB connection
 *   2. resetAllState()       — clear tokens, stores, localStorage
 *   3. setUser(null)         — clear Firebase auth from Zustand
 */
export function resetAllState(): void {
  // ── 1. Drive localStorage keys ───────────────────────────
  // The OAuth access token and the root Drive folder ID are
  // device-level cache entries — must be cleared so Surveyor B
  // doesn't inherit Surveyor A's Drive connection.
  const driveKeysToRemove = [
    'surveyos_drive_token',
    'surveyos_drive_token_expiry',
    'surveyos_drive_root',        // root "SurveyOS" folder ID cache
  ];

  try {
    driveKeysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear all per-claim Drive folder cache keys (surveyos_drive_folder_{claimId})
    Object.keys(localStorage)
      .filter(k => k.startsWith('surveyos_drive_folder_'))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* localStorage unavailable in some test environments */ }

  // ── 2. Drive UI state in Zustand (persisted via partialize) ──
  // isDriveConnected and driveEmail are saved to localStorage by
  // the Zustand persist middleware. Calling setDriveConnected clears
  // both the in-memory state and the persisted value.
  useUIStore.getState().setDriveConnected(false, '');

  // ── 3. In-memory claim store ─────────────────────────────
  // claimsList and currentClaim live only in Zustand memory.
  // The underlying IndexedDB data is untouched — it will be
  // reloaded from the correct user's DB on next login.
  useClaimStore.getState().resetStore();

  // ── 4. Surveyor profile ──────────────────────────────────
  // Profile is persisted to localStorage under 'surveyos-profile'.
  // resetProfile() clears both the in-memory state and the
  // localStorage entry, so Surveyor B sees a blank profile until
  // their own profile is pulled from Firestore on login.
  useProfileStore.getState().resetProfile();
}
