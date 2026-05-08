# Signup & Registration Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the existing partial registration flow by adding City/State fields, replacing the full-screen confirmation block with a read-only dashboard + live approval banner, and wiring a Firestore `onSnapshot` listener so approval unlocks the app in real time.

**Architecture:** The core gating already exists in `SubscriptionGuard` (blocks on `subscriptionStatus === 'pending'`) and `AccessRequestForm` (writes to Firestore). We extend the form with two new fields, replace `AccessRequestConfirmation`'s full-screen block with a non-blocking `PendingApprovalBanner` rendered above the dashboard, and add a Firestore listener in `AuthGate` that updates `subscriptionStatus` live when the admin approves.

**Tech Stack:** Next.js App Router, Firebase Firestore (`onSnapshot`, `doc`, `setDoc`), Zustand (`useProfileStore`, `useAuthStore`), Tailwind CSS / inline styles matching existing navy+gold design system.

---

## File Map

| File | Change |
|---|---|
| `src/types/vehicle.ts` | Add `city` and `state` to `SurveyorProfile` interface |
| `src/stores/profile-store.ts` | Add `city` and `state` to `DEFAULT_PROFILE` |
| `src/components/layout/AccessRequestForm.tsx` | Add City + State fields; add `signedUpAt` to Firestore payload |
| `src/components/auth/PendingApprovalBanner.tsx` | **New** — sticky amber banner shown above dashboard while pending |
| `src/components/auth/AuthGate.tsx` | Add `onSnapshot` listener; render `PendingApprovalBanner` when pending; remove `AccessRequestConfirmation` render path |
| `src/components/layout/SubscriptionGuard.tsx` | Remove `AccessRequestConfirmation` render (moved to AuthGate as banner) |
| `src/components/admin/AdminDashboard.tsx` | Show City + State in signups card |

---

## Task 0: Add city and state to SurveyorProfile type and DEFAULT_PROFILE

**Files:**
- Modify: `src/types/vehicle.ts`
- Modify: `src/stores/profile-store.ts`

`city` and `state` are not yet in the `SurveyorProfile` type. Without this, TypeScript will reject the `updateProfile({ city, state })` calls in Task 1.

- [ ] **Step 1: Add city and state to SurveyorProfile interface**

In `src/types/vehicle.ts`, find the `SurveyorProfile` interface (line 124). Add the two optional fields after `mobile: string`:

```ts
export interface SurveyorProfile {
  name: string;
  qualifications: string;
  licenceNumber: string;
  licenceExpiry: string;
  iiislaNumber: string;
  code: string;
  categories: string;
  mobile: string;
  city?: string;   // ← add
  state?: string;  // ← add
  email: string;
  // ... rest unchanged
```

- [ ] **Step 2: Add city and state to DEFAULT_PROFILE**

In `src/stores/profile-store.ts`, find `DEFAULT_PROFILE` and add after `mobile: ''`:

```ts
const DEFAULT_PROFILE: SurveyorProfile = {
  // ...
  mobile: '',
  city: '',    // ← add
  state: '',   // ← add
  email: '',
  // ... rest unchanged
```

- [ ] **Step 3: Commit**

```bash
git add src/types/vehicle.ts src/stores/profile-store.ts
git commit -m "feat: add city and state fields to SurveyorProfile type and DEFAULT_PROFILE"
```

---

## Task 1: Add City + State to AccessRequestForm

**Files:**
- Modify: `src/components/layout/AccessRequestForm.tsx`

- [ ] **Step 1: Add city and state to local state**

In `AccessRequestForm`, add two new state variables after the existing ones (around line 58):

```tsx
const [city, setCity]   = useState('');
const [state, setState] = useState('');
```

- [ ] **Step 2: Update the `isValid` check to include city and state**

Replace line 67:
```tsx
// Before
const isValid = name.trim().length >= 2 && irdai.trim().length >= 3 && phone.trim().length >= 7;

// After
const isValid =
  name.trim().length >= 2 &&
  irdai.trim().length >= 3 &&
  phone.trim().length >= 7 &&
  city.trim().length >= 2 &&
  state.trim().length >= 2;
```

- [ ] **Step 3: Add city and state to the Firestore payload**

In `handleSubmit`, update the `payload` object (around line 77) to include the new fields:

```tsx
const payload = {
  name:                   name.trim(),
  irdaiLicence:           irdai.trim().toUpperCase(),
  mobile:                 phone.trim(),
  city:                   city.trim(),
  state:                  state.trim(),
  email,
  accessRequestSubmitted: true,
  signedUpAt:             Timestamp.now(),   // ← was missing
  updatedAt:              Timestamp.now(),
};
```

- [ ] **Step 4: Add city and state to the local profile update**

In `handleSubmit`, update the `updateProfile` call (around line 97):

```tsx
updateProfile({
  name:                   name.trim(),
  irdaiLicence:           irdai.trim().toUpperCase(),
  mobile:                 phone.trim(),
  city:                   city.trim(),
  state:                  state.trim(),
  email,
  accessRequestSubmitted: true,
});
```

- [ ] **Step 5: Add City and State Field components to the JSX**

Add the two new `<Field>` elements after the Phone field (around line 189), before the Email field:

```tsx
<Field
  label="City"
  value={city}
  onChange={setCity}
  placeholder="e.g. Pune"
  icon={<MapPin size={10} />}
  hint="The city where you primarily operate."
/>

<Field
  label="State"
  value={state}
  onChange={setState}
  placeholder="e.g. Maharashtra"
  icon={<MapPin size={10} />}
  hint="Your state of operation."
/>
```

- [ ] **Step 6: Import MapPin icon**

Add `MapPin` to the existing lucide-react import at the top of the file:

```tsx
import {
  Shield, User, Phone, Mail, FileText, Loader2,
  CheckCircle2, Lock, ArrowRight, AlertCircle, MapPin,
} from 'lucide-react';
```

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/AccessRequestForm.tsx
git commit -m "feat: add city, state fields and signedUpAt to AccessRequestForm"
```

---

## Task 2: Create PendingApprovalBanner

**Files:**
- Create: `src/components/auth/PendingApprovalBanner.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';

import { Clock } from 'lucide-react';

/**
 * PendingApprovalBanner
 * Sticky top banner shown on the dashboard when the user's registration
 * is submitted but not yet approved by the admin.
 * Disappears automatically when AuthGate detects status = 'approved' via onSnapshot.
 */
export function PendingApprovalBanner() {
  return (
    <div
      className="w-full flex items-center justify-center gap-3 px-4 py-3 text-xs font-bold"
      style={{
        background: 'linear-gradient(90deg, rgba(212,175,55,0.15), rgba(212,175,55,0.08))',
        borderBottom: '1px solid rgba(212,175,55,0.3)',
        color: '#0D1B2A',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <Clock size={14} style={{ color: '#D4AF37', flexShrink: 0 }} />
      <span style={{ color: '#7a6010' }}>
        <strong>Your account is under review.</strong>
        {' '}You can explore the app, but actions are locked until the admin approves your registration.
        Typical approval time: 1–2 business days.
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/auth/PendingApprovalBanner.tsx
git commit -m "feat: add PendingApprovalBanner component"
```

---

## Task 3: Add onSnapshot listener to AuthGate + render banner

**Files:**
- Modify: `src/components/auth/AuthGate.tsx`

The goal: after the user is authenticated, set up a Firestore `onSnapshot` listener on `users/{uid}/profile/current`. When `subscriptionStatus` changes to `'active'`, update the profile store so `SubscriptionGuard` stops blocking. When `status` is `'pending'` and `accessRequestSubmitted` is true, render the `PendingApprovalBanner` above the children instead of a full-screen block.

- [ ] **Step 1: Add Firestore imports and profile store import**

At the top of `AuthGate.tsx`, add the new imports:

```tsx
import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useProfileStore } from '@/stores/profile-store';
import { PendingApprovalBanner } from './PendingApprovalBanner';
```

- [ ] **Step 2: Add the onSnapshot listener inside AuthGate**

Inside the `AuthGate` function body, after the existing `useAuthStore` and `usePathname` hooks, add:

```tsx
const { user } = useAuthStore();
const updateProfile = useProfileStore((s) => s.updateProfile);
const unsubRef = useRef<(() => void) | null>(null);

useEffect(() => {
  // Only listen when authenticated
  if (!user?.uid) return;

  // Clean up any previous listener
  if (unsubRef.current) unsubRef.current();

  const profileRef = doc(db, 'users', user.uid, 'profile', 'current');

  // Note: we do NOT read profile.subscriptionStatus from the closure here
  // because it would be stale. Instead we always push the server value into
  // the store and let Zustand deduplicate if it hasn't changed.
  unsubRef.current = onSnapshot(profileRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.subscriptionStatus) {
      updateProfile({ subscriptionStatus: data.subscriptionStatus });
    }
  });

  return () => {
    if (unsubRef.current) unsubRef.current();
  };
}, [user?.uid, updateProfile]);
```

- [ ] **Step 3: Render PendingApprovalBanner above children when pending and submitted**

In the final authenticated render block of `AuthGate` (the `return <>{children}</>` at the bottom), replace it with:

```tsx
// Authenticated — render the full application
// If pending + submitted, show the read-only dashboard with the approval banner
const isPendingWithSubmission =
  profile.subscriptionStatus === 'pending' && profile.accessRequestSubmitted;

return (
  <>
    {isPendingWithSubmission && <PendingApprovalBanner />}
    {children}
  </>
);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/AuthGate.tsx
git commit -m "feat: add Firestore onSnapshot listener to AuthGate for live approval + PendingApprovalBanner"
```

---

## Task 4: Remove AccessRequestConfirmation full-screen block from SubscriptionGuard

**Files:**
- Modify: `src/components/layout/SubscriptionGuard.tsx`

Now that `AuthGate` renders the pending banner above the dashboard, the full-screen `AccessRequestConfirmation` block in `SubscriptionGuard` is redundant. We remove it so the dashboard renders underneath the banner.

- [ ] **Step 1: Remove the AccessRequestConfirmation render path**

Find the `isPending` block (around line 33–39):

```tsx
// Before
if (isPending) {
  if (!profile.accessRequestSubmitted) {
    return <AccessRequestForm />;
  }
  return <AccessRequestConfirmation />;
}
```

Replace with:

```tsx
// After — submitted users see the read-only dashboard with PendingApprovalBanner (in AuthGate)
if (isPending) {
  if (!profile.accessRequestSubmitted) {
    return <AccessRequestForm />;
  }
  // Submitted but not yet approved: fall through to render children.
  // PendingApprovalBanner is injected above the layout by AuthGate.
  return <>{children}</>;
}
```

- [ ] **Step 2: Remove unused AccessRequestConfirmation import**

Update the import at the top of `SubscriptionGuard.tsx`:

```tsx
// Before
import { AccessRequestForm, AccessRequestConfirmation } from './AccessRequestForm';

// After
import { AccessRequestForm } from './AccessRequestForm';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/SubscriptionGuard.tsx
git commit -m "refactor: replace AccessRequestConfirmation full-screen block with read-only dashboard passthrough"
```

---

## Task 5: Show City + State in AdminDashboard signups tab

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`

- [ ] **Step 1: Add city and state to the NewSignup interface**

Find the `NewSignup` interface (around line 69) and add the two new fields:

```tsx
interface NewSignup {
  uid: string;
  email: string;
  displayName: string;
  name: string;
  irdaiLicence: string;
  mobile: string;
  city?: string;      // ← add
  state?: string;     // ← add
  signedUpAt: Timestamp;
  updatedAt?: Timestamp;
  status: string;
}
```

- [ ] **Step 2: Map city and state in fetchSignups**

In `fetchSignups` (around line 237), add the two new fields to the push call:

```tsx
results.push({
  uid: docSnap.id,
  email: data.email || '',
  displayName: data.displayName || data.name || '',
  name: data.name || data.displayName || '',
  irdaiLicence: data.irdaiLicence || '',
  mobile: data.mobile || '',
  city: data.city || '',       // ← add
  state: data.state || '',     // ← add
  signedUpAt: data.signedUpAt,
  updatedAt: data.updatedAt,
  status: data.status || 'pending',
});
```

- [ ] **Step 3: Display city and state in the signup card JSX**

Find where the signup cards render the details (search for `irdaiLicence` in the JSX). Add city and state below mobile, following the same pattern as existing detail rows:

```tsx
{signup.city && (
  <span className="text-xs text-gray-500">
    {signup.city}{signup.state ? `, ${signup.state}` : ''}
  </span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminDashboard.tsx
git commit -m "feat: display city and state in AdminDashboard signup cards"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Start the dev server**
```bash
npm run dev
```

- [ ] **Step 2: Test new user registration flow**
  - Open an incognito window → go to `http://localhost:3000/login`
  - Sign in with a Google account that has never registered
  - Confirm `AccessRequestForm` appears
  - Confirm City + State fields are present and required (submit button stays disabled until all 5 fields filled)
  - Fill all fields and submit
  - Confirm the dashboard loads with `PendingApprovalBanner` visible at the top
  - Confirm claim creation and other actions are blocked (SubscriptionGuard still active)

- [ ] **Step 3: Test real-time approval**
  - Keep the pending dashboard open
  - Open AdminDashboard in another tab (logged in as admin)
  - Go to the Signups tab
  - Confirm the new signup appears with Name, IRDAI, Mobile, City, State
  - Click Approve
  - Switch back to the pending tab — confirm the banner disappears and full access is restored **without a page refresh**

- [ ] **Step 4: Test returning pending user**
  - Sign out and sign back in with the same pending account
  - Confirm the dashboard loads with the banner (not the old full-screen confirmation block)

- [ ] **Step 5: Final commit if any fixes were made during testing**
```bash
git add -p
git commit -m "fix: signup registration flow manual test fixes"
```
