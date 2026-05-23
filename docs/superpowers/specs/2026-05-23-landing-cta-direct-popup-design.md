# Design: Landing Page CTA — Direct Google Popup

**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** Single function change in `src/app/landing/page.tsx`

---

## Problem

Clicking "Start 30-Day Free Trial" on the landing page triggers a 3-hop redirect chain:
1. `router.push('/signup')` — navigates away
2. `/signup` renders null (blank screen) while redirecting to `/access-request`
3. `/access-request` finally shows the Google sign-in button

Users see a blank screen and think nothing happened.

---

## Solution

Call `signInWithGoogle()` directly from `handleAction`. The Google popup opens in place — no navigation, no blank screen. After auth, `onAuthStateChanged` → `pending` profile → SubscriptionGuard redirects to `/access-request` → registration form shown.

---

## Change

**File:** `src/app/landing/page.tsx`

**Before:**
```tsx
const handleAction = () => {
  if (isAuthenticated) { router.push('/'); return; }
  router.push('/signup');
};
```

**After:**
```tsx
const handleAction = () => {
  if (isAuthenticated) { router.push('/'); return; }
  signInWithGoogle();
};
```

---

## What stays intact

- `/signup` still redirects to `/access-request` — marketing links unaffected
- `/access-request` SignInPanel works for unauthenticated users from marketing links
- `handleSignIn` ("Sign In" nav button) unchanged

---

## Success Criteria

- [ ] Clicking "Start 30-Day Free Trial" opens Google popup immediately (no page navigation)
- [ ] After auth, user lands on `/access-request` registration form
- [ ] Authenticated users clicking the button still go to `/` (dashboard)
- [ ] "Sign In" button in nav still works correctly
- [ ] `/signup` marketing links still redirect to `/access-request` SignInPanel
