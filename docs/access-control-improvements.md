# Access Control & User Onboarding — Planned Improvements

## Problem
Any Google account can sign in. Brand new users with no Firestore profile get undefined behavior — may bypass subscription guard.

## Proposed Changes

### 1. Auto-create pending profile on first login
- File: `src/hooks/useAuth.ts`
- On first login, write `subscriptionStatus: 'pending'` to Firestore

### 2. Add pending screen to SubscriptionGuard
- File: `src/components/layout/SubscriptionGuard.tsx`
- Show "Your account is pending approval" for `status === 'pending'`

### 3. New signups queue in Admin Dashboard
- File: `src/components/admin/AdminDashboard.tsx`
- Show new signups, one-click approve button

### 4. Add `pending` to subscriptionStatus type
- Wherever `SurveyorProfile` type is defined
- Add `'pending'` to the union type

### 5. Harden Firestore rules
- File: `firestore.rules`
- Replace hardcoded admin UID with `isAdmin()` function reading from profile doc

## End Result
No unknown person can access the app. New user signs in → pending screen → admin approves → access granted.
