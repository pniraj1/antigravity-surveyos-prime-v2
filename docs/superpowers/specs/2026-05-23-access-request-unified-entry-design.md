# Design: Unified Entry Point via /access-request

**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** `/signup` deprecation, `/access-request` three-state flow, logout fix

---

## Problem

1. "Start 30-Day Free Trial" navigates to `/signup` which just shows a Google button — an unnecessary extra page for landing page users.
2. `/signup` URL is shared in marketing links and must keep working.
3. After logout on the access-request page, Firebase session is not cleared and no redirect happens — user is stuck in a broken half-state.

---

## Solution

Make `/access-request` the single, unified entry point for all new users — whether they arrive from the landing page CTA, a marketing link, or `/signup`. The page handles three states in sequence without any navigation between them.

---

## Architecture

### 1. `/signup` → redirect to `/access-request`

`src/app/signup/page.tsx` is repurposed to a redirect-only component:

```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/access-request'); }, [router]);
  return null;
}
```

All existing marketing links (`/signup`) continue to work — users land on `/access-request` transparently.

### 2. `/access-request` — three states, one page

**State detection logic (top of `AccessRequestPage`):**

```
if (!isAuthenticated)          → render <SignInPanel />
else if (accessRequestSubmitted) → render <ConfirmationPanel />
else                           → render <RegistrationForm />
```

All three states use the same `<SplitLayout>` wrapper (dark left, light right), so the left panel never changes regardless of state.

#### State 1 — Unauthenticated: `<SignInPanel />`

Rendered in the right panel. Contains:
- Step badge: "Step 1 of 2 · Create your account"
- Heading: "Get Started"
- Subtext: "Sign in with Google to begin your 30-day free trial."
- "Continue with Google" button (same amber gradient style as rest of page)
- Legal note: "One Google account → One SurveyOS profile."

On click: calls `signInWithGoogle()` (popup). After popup auth succeeds, `onAuthStateChanged` fires → `isAuthenticated` flips to `true` → same page re-renders into State 2 (RegistrationForm). **No navigation needed.**

#### State 2 — Authenticated, form not submitted: `<RegistrationForm />`  *(existing)*

No changes to this component. Already implemented.

#### State 3 — Authenticated, form submitted: `<ConfirmationPanel />`  *(existing)*

No changes to this component. Already implemented.

### 3. Logout fix — exit Firebase and redirect

**Problem:** `signOutUser()` is called but no `await` and no redirect. User stays on `/access-request` in a broken state.

**Fix:** Replace all logout `onClick` handlers on the page with an async handler:

```tsx
const handleLogout = async () => {
  await signOutUser();
  router.replace('/landing');
};
```

Apply this to all four logout buttons:
- Mobile strip logout (left panel, mobile)
- Desktop nav logout (left panel, desktop)  
- Confirmation panel mobile footer logout
- Registration form mobile footer logout

After logout:
1. Firebase session cleared
2. `onAuthStateChanged` fires with `null` → `resetAllState()` runs → Zustand stores wiped
3. `router.replace('/landing')` navigates user to the public landing page

---

## Data Flow

```
Landing page CTA clicked
  → signInWithGoogle() [popup, no navigation]
  → popup auth succeeds
  → onAuthStateChanged(user) → profile bootstrap → setUser()
  → SubscriptionGuard: pending → router.replace('/access-request')
  → /access-request: isAuthenticated=true, not submitted → show form

Marketing link /signup visited
  → redirect to /access-request
  → isAuthenticated=false → show sign-in card
  → user clicks Google → popup → same flow as above

User clicks Logout on /access-request
  → await signOutUser() → Firebase session cleared
  → onAuthStateChanged(null) → resetAllState() → setUser(null)
  → router.replace('/landing') → public landing page
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/signup/page.tsx` | Replace with redirect-only component |
| `src/app/access-request/page.tsx` | Add `SignInPanel` state, fix logout handlers |

---

## Out of Scope

- No changes to SubscriptionGuard
- No changes to `signInWithGoogle()` or `useAuth.ts`
- No changes to `LandingPage` CTA (it already calls `router.push('/signup')` which will redirect to `/access-request` — acceptable, or can be updated to `router.push('/access-request')` as a minor cleanup)

---

## Success Criteria

- [ ] `/signup` URL redirects to `/access-request` without a visible flash
- [ ] Unauthenticated user on `/access-request` sees Google sign-in card in the split-panel layout
- [ ] After Google popup auth, same page transitions to the registration form without navigation
- [ ] Logout on `/access-request` clears Firebase session and lands user on `/landing`
- [ ] All existing flows (landing page CTA, marketing links, already-authenticated users) work correctly
