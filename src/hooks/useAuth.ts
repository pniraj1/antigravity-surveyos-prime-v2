// ═══════════════════════════════════════════════════════════
// AUTH HOOK — Firebase Auth State Observer
//
// Keeps the Zustand auth store in sync with Firebase Auth.
// Also manages the per-user IndexedDB lifecycle:
//
//   LOGIN  → initUserDB(uid)  opens the surveyor's personal database
//   LOGOUT → closeUserDB()   closes the database and clears the singleton
//
// WHY HERE:
//   onAuthStateChanged is the single authoritative source of truth for
//   who is logged in. Wiring DB init/close here guarantees the database
//   is always in the correct state relative to auth — no race conditions,
//   no extra flags needed elsewhere.
//
// USER IDs (Firebase UIDs):
//   Format: 28-character alphanumeric string e.g. "QCgRlZdGF3etljVitH8xq3KsTqB2"
//   • Unique per Google account globally
//   • Permanent — does NOT change if the surveyor changes their email
//   • Used as the IndexedDB name suffix: "surveyos-v2-{uid}"
//   • Safe to use for subscription management and account suspension
//     (set { suspended: true } on the Firestore profile/{uid} document)
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';
import { initUserDB, closeUserDB } from '@/lib/storage/indexeddb';
import { resetAllState } from '@/lib/auth/resetAllState';
import { isExpired } from '@/lib/subscription/status';
import { pullProfileFromCloud, flushAllPendingToCloud } from '@/lib/firebase/sync';
import {
  readActiveSession,
  claimSession,
  releaseSession,
  isSessionFresh,
  isSessionMine,
} from '@/lib/firebase/session';
import { logger } from '@/lib/utils/logger';

const FORCE_SESSION_KEY = 'surveyos_force_session';

export function useAuth() {
  const setUser = useAuthStore(s => s.setUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // ── INTENTIONAL LOGOUT GUARD ───────────────────────────
        // If the user explicitly logged out, block Firebase from
        // silently re-authenticating via a persistent Google browser
        // session. Clear the flag and force sign-out again.
        try {
          const intentionalLogout = localStorage.getItem('surveyos_intentional_logout') === 'true';
          if (intentionalLogout) {
            localStorage.removeItem('surveyos_intentional_logout');
            await signOut(auth);
            return; // do NOT proceed with login
          }
        } catch { /* localStorage unavailable in some test environments */ }

        // ── LOGIN ──────────────────────────────────────────────
        // Everything from here to setUser() is BOOTSTRAP: IndexedDB,
        // the session lock, and the Firestore profile. It is wrapped in
        // a single try/catch because none of it may gate authentication.
        //
        // WHY (the bug this fixes):
        //   setUser() is the ONLY thing that flips isAuthenticated and
        //   clears `loading` — nothing else calls setLoading. When a
        //   bootstrap step threw (typically a transient Firestore
        //   `unavailable` while the connection is still being
        //   established on the very first request), this async callback
        //   rejected, Firebase swallowed the rejection, and setUser()
        //   never ran. The user was signed in to Firebase but the UI
        //   stayed on the landing page forever with no error — they had
        //   to click Sign In two or three times until a warm connection
        //   let the chain complete.
        //
        // Bootstrap is best-effort; auth is not.
        try {
          // Open the surveyor's personal IndexedDB BEFORE updating
          // Zustand. This ensures no component reads claims before
          // the DB connection is ready.
          //
          // initUserDB also runs a one-time migration from the old
          // shared "surveyos-v2" database on the first login after
          // this update is deployed.
          await initUserDB(user.uid);

          // ── SINGLE-SESSION LOCK ────────────────────────────────
          // Block login if another device holds a LIVE session (fresh
          // heartbeat), unless the user explicitly chose "Force Sign In
          // Anyway" (sets FORCE_SESSION_KEY before re-authenticating).
          // Fails OPEN on any Firestore/offline error so a field surveyor
          // is never locked out by lack of signal — the heartbeat hook
          // claims the session once connectivity returns.
          try {
            let forced = false;
            try { forced = localStorage.getItem(FORCE_SESSION_KEY) === 'true'; } catch { /* ignore */ }

            if (forced) {
              try { localStorage.removeItem(FORCE_SESSION_KEY); } catch { /* ignore */ }
            } else {
              const existing = await readActiveSession(user.uid);
              if (existing && isSessionFresh(existing) && !isSessionMine(existing)) {
                useAuthStore.getState().setSessionConflict({
                  deviceHint: existing.deviceHint || 'another device',
                });
                await signOut(auth);
                return; // do NOT proceed with login
              }
            }

            await claimSession(user.uid);
            useAuthStore.getState().setSessionConflict(null);
          } catch (err) {
            logger.error('[useAuth] Session lock check failed (fail-open):', err);
          }

          // ── Profile bootstrap & migration ─────────────────────
          // All profiles must live at profile/current (not profile/main).
          // If a legacy profile/main doc exists, migrate it first.
          const currentRef = doc(db, 'users', user.uid, 'profile', 'current');
          const mainRef    = doc(db, 'users', user.uid, 'profile', 'main');

          const [currentSnap, mainSnap] = await Promise.all([
            getDoc(currentRef),
            getDoc(mainRef),
          ]);

          let profileStatus: string = 'pending';

          if (!currentSnap.exists() && mainSnap.exists()) {
            // ── Migrate: copy profile/main → profile/current ──
            const mainData = mainSnap.data();
            await setDoc(currentRef, mainData);
            await deleteDoc(mainRef);
            profileStatus = mainData?.subscriptionStatus ?? 'pending';
          } else if (!currentSnap.exists()) {
            // ── Brand new user: create pending profile ─────────
            await setDoc(currentRef, {
              subscriptionStatus: 'pending',
              subscriptionExpiry: null,
              isAdmin: false,
              email: user.email ?? '',
              displayName: user.displayName ?? '',
              accessRequestSubmitted: false,
              irdaiLicence: '',
              createdAt: Timestamp.now(),
            });
            profileStatus = 'pending';
          } else {
            profileStatus = currentSnap.data()?.subscriptionStatus ?? 'pending';
          }

          // ── Auto-transition expired trial/active → readonly ──────
          if (profileStatus === 'trial' || profileStatus === 'active') {
            const data = currentSnap.exists() ? currentSnap.data() : null;
            const expiryField = profileStatus === 'trial' ? data?.trialEndDate : data?.subscriptionExpiry;
            if (expiryField && isExpired(expiryField)) {
              try {
                await updateDoc(currentRef, { subscriptionStatus: 'readonly' });
                profileStatus = 'readonly';
              } catch { /* non-fatal — SubscriptionGuard will catch it client-side */ }
            }
          }

          // ── Write to newSignups if user is still pending AND hasn't submitted form yet ──
          // Guard with accessRequestSubmitted so dismissed users don't ghost-resurface
          // in the admin queue just by logging in again.
          if (profileStatus === 'pending') {
            try {
              const currentData = currentSnap.exists() ? currentSnap.data() : null;
              const alreadySubmitted = currentData?.accessRequestSubmitted === true;
              if (!alreadySubmitted) {
                const signupRef = doc(db, 'newSignups', user.uid);
                await setDoc(signupRef, {
                  email: user.email ?? '',
                  displayName: user.displayName ?? '',
                  signedUpAt: Timestamp.now(),
                  status: 'pending',
                }, { merge: true }); // merge:true so re-logins don't reset timestamp
              }
            } catch {
              // Non-fatal — admin can still see the user via profile collection
            }
          }

          // ── Auto-grant isAdmin for master admin UID ──────────────
          // Uses NEXT_PUBLIC_MASTER_ADMIN_UID from .env.local.
          // Self-heals if the Firestore field was accidentally overwritten.
          const masterAdminUid = process.env.NEXT_PUBLIC_MASTER_ADMIN_UID;
          if (masterAdminUid && user.uid === masterAdminUid) {
            const profileData = currentSnap.exists() ? currentSnap.data() : null;
            if (profileData?.isAdmin !== true) {
              try {
                await updateDoc(currentRef, { isAdmin: true });
              } catch { /* non-fatal — field will be set on next write */ }
            }
          }

          // ── Bootstrap profile store before marking as authenticated ──
          // pullProfileFromCloud writes isAdmin / subscriptionStatus into
          // Zustand BEFORE isAuthenticated flips to true, so SubscriptionGuard
          // sees the real admin flag on its very first render and does NOT
          // spuriously redirect the admin to /access-request.
          // The Firestore doc was just read above, so the SDK serves this from
          // its local cache — no extra network round-trip.
          await pullProfileFromCloud(user.uid);
        } catch (err) {
          // Bootstrap failed (offline, Firestore cold-start, IndexedDB blocked).
          // Log it and fall through to setUser anyway — a signed-in user must
          // never be stranded on the landing page with no way forward. The
          // profile store keeps its persisted value and SubscriptionGuard
          // resolves access from that; the next login refreshes it.
          logger.error('[useAuth] Post-login bootstrap failed (non-fatal):', err);
        }

        setUser(user);
      } else {
        // ── LOGOUT ─────────────────────────────────────────────
        // Release the session presence doc first (guarded so it won't
        // delete a session another device already force-claimed). The
        // store still holds the outgoing user here, so we can read uid.
        const uid = useAuthStore.getState().user?.uid;
        if (uid) {
          try {
            await flushAllPendingToCloud(uid);
          } catch (err) {
            logger.error('[useAuth] Pre-logout flush failed (non-fatal):', err);
          }
          await releaseSession(uid);
        }
        await closeUserDB();
        resetAllState();
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [setUser]);
}
