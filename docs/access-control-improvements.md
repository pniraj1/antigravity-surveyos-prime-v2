# Access Control & User Onboarding — Improvements

Status: **COMPLETED** (2026-04-14)

---

## Problem (was)

Any Google account could sign in. Brand new users with no Firestore profile got undefined behavior — the subscription guard read `profile.subscriptionStatus` which was `undefined`, potentially allowing strangers in.

---

## What Was Implemented

### 1. `pending` subscription status
- **File:** `src/types/vehicle.ts:177`
- Added `'pending'` to `subscriptionStatus` union type
- `subscriptionExpiry` changed to `string | null` to support unactivated accounts

### 2. Auto-create pending profile on first login
- **File:** `src/hooks/useAuth.ts`
- On `onAuthStateChanged`, if Firestore profile doesn't exist → creates it with `subscriptionStatus: 'pending'`
- Also writes a record to `newSignups/{uid}` collection so admin can see it

### 3. Pending screen in SubscriptionGuard
- **File:** `src/components/layout/SubscriptionGuard.tsx`
- Yellow clock screen: "Account Pending Approval"
- Shows user's email, contact support button
- Separate from the red "suspended/expired" screen

### 4. Default profile changed to pending
- **File:** `src/stores/profile-store.ts:55`
- `DEFAULT_PROFILE.subscriptionStatus` changed from `'active'` to `'pending'`
- `DEFAULT_PROFILE.subscriptionExpiry` changed from `'2099-12-31'` to `null`

### 5. New Signups tab in Admin Dashboard
- **File:** `src/components/admin/AdminDashboard.tsx`
- Two-tab dashboard: "All Surveyors" + "New Signups"
- New Signups tab shows all pending users from `newSignups` Firestore collection
- One-click **Approve**: sets `status: 'active'`, sets expiry, removes from queue
- One-click **Dismiss**: removes from queue without activating
- Default expiry date picker (1 year from today)

### 6. Hardened Firestore rules
- **File:** `firestore.rules`
- Replaced hardcoded UID (`QCgRlZdGF3etljVitH8xq3KsTqB2`) with role-based `isAdmin()` function
- `isAdmin()` reads `isAdmin` flag from the user's own Firestore profile
- Added `newSignups` collection rules (user creates own, admin manages)

---

## Remaining (not yet implemented)

- Email notification to admin when new signup arrives
- Email notification to user when their account is approved
- UI for promoting a user to admin (currently done directly in Firestore)
