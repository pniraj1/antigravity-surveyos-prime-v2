# Authentication

## Current Implementation

- **What it does:** Manages Firebase Google Sign-In authentication with a multi-gate flow: AuthGate blocks unauthenticated users, SubscriptionGuard checks subscription status, and DriveGateScreen requires Google Drive linking before accessing the main app.
- **Key files:**
  - `src/components/auth/AuthGate.tsx` — Route protection wrapper; checks Firebase auth state, redirects to login
  - `src/components/auth/DriveGateScreen.tsx` — Post-login gate requiring Google Drive connection
  - `src/lib/firebase/auth.ts` — Firebase auth service (`signInWithGoogle`, `signOutUser`)
  - `src/stores/auth-store.ts` — Zustand store for user object, loading state, `isAuthenticated` flag
  - `src/components/layout/SubscriptionGuard.tsx` — Subscription status check between auth and app
  - `firestore.rules` — Access control: `isAdmin()` role-based, `status == 'active'` check
- **Dependencies:** Firebase Auth (`signInWithPopup`, `signOut`), Zustand, Next.js navigation

## Known Issues / What Went Wrong

- No session timeout — user stays logged in indefinitely once authenticated
- Race condition on first login (fixed 2026-04-14): profile sometimes not created before redirect
- Google Drive OAuth token stored in localStorage (`surveyos_drive_token`) — not secure

## Improvement Ideas

- Add role system beyond active/pending/dismissed (admin, surveyor, reviewer)
- Session timeout after 24h inactivity
- Multi-factor authentication for admin accounts
- Audit log for login events
- Move Drive token to secure httpOnly cookie or encrypted IndexedDB

## Technical Debt

- `AuthSyncWrapper.tsx` sits in `src/components/` root instead of `layout/`
- `src/lib/auth/` only has one function (`resetAllState`) — could merge into auth-store

## Related

- [[Admin_Dashboard]] — manages user approval flow
- [[Subscription_System]] — tied to auth status
- [[Cloud_Sync]] — depends on auth for Firestore access
