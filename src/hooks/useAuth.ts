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
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';
import { initUserDB, closeUserDB } from '@/lib/storage/indexeddb';
import { resetAllState } from '@/lib/auth/resetAllState';

export function useAuth() {
  const setUser = useAuthStore(s => s.setUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
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
            createdAt: Timestamp.now(),
          });
          profileStatus = 'pending';
        } else {
          profileStatus = currentSnap.data()?.subscriptionStatus ?? 'pending';
        }

        // ── Write to newSignups if user is still pending ──────
        // Done in a separate try/catch so a rules or network error
        // here never blocks the login flow. Admin sees them regardless.
        if (profileStatus === 'pending') {
          try {
            const signupRef = doc(db, 'newSignups', user.uid);
            await setDoc(signupRef, {
              email: user.email ?? '',
              displayName: user.displayName ?? '',
              signedUpAt: Timestamp.now(),
              status: 'pending',
            }, { merge: true }); // merge:true so re-logins don't reset timestamp
          } catch {
            // Non-fatal — admin can still see the user via profile collection
          }
        }

        setUser(user);
      } else {
        // ── LOGOUT ─────────────────────────────────────────────
        // Close the database BEFORE clearing auth state so no
        // in-flight read/write races with the next user's login.
        await closeUserDB();
        // Wipe all user-specific state: Drive tokens, claim list,
        // profile. Surveyor B will start with a completely clean slate.
        resetAllState();
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [setUser]);
}
