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
import { pullProfileFromCloud } from '@/lib/firebase/sync';

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
        // Open the surveyor's personal IndexedDB BEFORE updating
        // Zustand. This ensures no component reads claims before
        // the DB connection is ready.
        //
        // initUserDB also runs a one-time migration from the old
        // shared "surveyos-v2" database on the first login after
        // this update is deployed.
        await initUserDB(user.uid);

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

        setUser(user);
      } else {
        // ── LOGOUT ─────────────────────────────────────────────
        await closeUserDB();
        resetAllState();
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [setUser]);
}
