# Unified /access-request Entry Point Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/access-request` the single entry point for all new users — handling unauthenticated, pending, and confirmed states — while fixing the logout flow.

**Architecture:** Two files change. `/signup` becomes a transparent redirect. `/access-request` gains a `SignInPanel` for unauthenticated users (rendered inside the existing `SplitLayout`) and a shared `handleLogout` async function that properly awaits Firebase signout before navigating to `/landing`.

**Tech Stack:** Next.js 16 App Router, Firebase Auth (signInWithPopup), Zustand (`useAuthStore`), Tailwind CSS, Lucide icons.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/signup/page.tsx` | **Replace** | Redirect-only: sends all visitors to `/access-request` |
| `src/app/access-request/page.tsx` | **Modify** | Add `SignInPanel` state; add `handleLogout`; wire up all 4 logout buttons |

---

### Task 1: Replace `/signup` with a redirect-only component

**Files:**
- Modify: `src/app/signup/page.tsx`

- [ ] **Step 1: Replace the entire file content**

Open `src/app/signup/page.tsx` and replace everything with:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /signup is kept alive for marketing links.
 * All visitors are transparently redirected to /access-request,
 * which handles unauthenticated, pending, and confirmed states.
 */
export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/access-request');
  }, [router]);
  return null;
}
```

- [ ] **Step 2: Verify the build still compiles**

```bash
cd "SurveyOS-Prime-V2"
npx next build
```

Expected output: `✓ Compiled successfully` with `/signup` listed as a static route (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/signup/page.tsx
git commit -m "feat: redirect /signup to /access-request for unified entry"
```

---

### Task 2: Add `SignInPanel` to `/access-request`

**Files:**
- Modify: `src/app/access-request/page.tsx`

- [ ] **Step 1: Add `signInWithGoogle` and `useRouter` imports**

At the top of `src/app/access-request/page.tsx`, the current imports are:

```tsx
import { useState } from 'react';
import { doc, setDoc, Timestamp, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { signOutUser } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import Logo from '@/components/ui/Logo';
import {
  Shield, User, Phone, Mail, FileText, Loader2,
  CheckCircle2, ArrowRight, AlertCircle, Gift, LogOut, ChevronLeft,
} from 'lucide-react';
```

Replace with (adds `signInWithGoogle`, `useRouter`, `Loader2` already present):

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, Timestamp, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { signInWithGoogle, signOutUser } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import Logo from '@/components/ui/Logo';
import {
  Shield, User, Phone, Mail, FileText, Loader2,
  CheckCircle2, ArrowRight, AlertCircle, Gift, LogOut, ChevronLeft,
} from 'lucide-react';
```

- [ ] **Step 2: Add the `SignInPanel` component**

Insert the following component directly **before** the `// ─── Input field ─────` comment (i.e., before the `Field` function):

```tsx
// ─── State 1: Unauthenticated ─────────────────────────────────────────────────
function SignInPanel() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setSigningIn(true);
    setError('');
    try {
      await signInWithGoogle();
      // onAuthStateChanged fires automatically — this component
      // will unmount and AccessRequestPage re-renders the form.
    } catch {
      setError('Sign-in was cancelled or failed. Please try again.');
      setSigningIn(false);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6">

      {/* Step badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Step 1 of 2 · Create your account
      </div>

      {/* Heading */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[#0D1B2A] mb-1.5">
          Get Started
        </h1>
        <p className="text-sm font-medium text-[#8D99AE] leading-relaxed">
          Sign in with Google to begin your{' '}
          <strong className="text-amber-600">30-day free trial</strong>.
          No credit card needed.
        </p>
      </div>

      {/* Sign-in card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Google button */}
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: signingIn ? '#F0F2F5' : 'linear-gradient(135deg, #D4AF37, #f0d870)',
            color: signingIn ? '#8D99AE' : '#0D1B2A',
          }}
          onMouseEnter={e => { if (!signingIn) (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          {signingIn ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {signingIn ? 'Opening Google…' : 'Continue with Google'}
          {!signingIn && <ArrowRight size={15} />}
        </button>

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
        )}

        <p className="text-center text-[10px] font-semibold text-gray-400">
          One Google account → One SurveyOS profile.
          <br />Your IRDAI credentials are verified by our team before activation.
        </p>
      </div>

      {/* Back to website */}
      <div className="flex items-center gap-4 text-xs font-bold text-[#8D99AE]">
        <a href="/landing" className="hover:text-[#0D1B2A] transition-colors flex items-center gap-1">
          <ChevronLeft size={12} /> Back to website
        </a>
      </div>

    </div>
  );
}
```

- [ ] **Step 3: Wire `SignInPanel` into `AccessRequestPage`**

In `AccessRequestPage`, the component currently starts with:

```tsx
export default function AccessRequestPage() {
  const { user } = useAuthStore();
  const { profile, updateProfile } = useProfileStore();
```

Replace those two lines with:

```tsx
export default function AccessRequestPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { profile, updateProfile } = useProfileStore();
  const router = useRouter();
```

Then find the line near the top of the component body:

```tsx
  // Already submitted — show confirmation split-panel
  if (profile.accessRequestSubmitted) return <ConfirmationPanel />;
```

Replace it with:

```tsx
  // State 1: not signed in — show Google sign-in card inside split-panel
  if (!isAuthenticated) {
    return <SplitLayout right={<SignInPanel />} />;
  }

  // State 3: already submitted — show confirmation split-panel
  if (profile.accessRequestSubmitted) return <ConfirmationPanel />;
```

- [ ] **Step 4: Verify the build compiles**

```bash
npx next build
```

Expected: `✓ Compiled successfully` — no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/access-request/page.tsx
git commit -m "feat: add SignInPanel state to /access-request for unauthenticated users"
```

---

### Task 3: Fix all logout buttons

**Files:**
- Modify: `src/app/access-request/page.tsx`

- [ ] **Step 1: Add `handleLogout` to `AccessRequestPage`**

Inside `AccessRequestPage`, directly after the `router` declaration, add:

```tsx
  const handleLogout = async () => {
    await signOutUser();
    router.replace('/landing');
  };
```

- [ ] **Step 2: Fix logout buttons in `SplitLayout` left panel (mobile strip)**

Find the mobile logout button in `SplitLayout`:

```tsx
          <button
              onClick={() => signOutUser()}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              <LogOut size={15} /> Log Out
            </button>
```

`SplitLayout` doesn't have access to `handleLogout`. The cleanest fix: accept an `onLogout` prop.

Replace the `SplitLayout` function signature from:

```tsx
function SplitLayout({
  right,
}: {
  right: React.ReactNode;
}) {
```

with:

```tsx
function SplitLayout({
  right,
  onLogout,
}: {
  right: React.ReactNode;
  onLogout?: () => void;
}) {
```

Then replace **both** logout button `onClick` handlers inside `SplitLayout` (mobile strip and desktop nav) from `onClick={() => signOutUser()}` to `onClick={onLogout}`:

Mobile strip logout (inside `md:hidden` div):
```tsx
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              <LogOut size={15} /> Log Out
            </button>
```

Desktop nav logout (inside `hidden md:flex` div):
```tsx
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
              >
                <LogOut size={15} /> Log Out
              </button>
```

- [ ] **Step 3: Pass `onLogout` wherever `SplitLayout` is rendered**

There are three render sites:

**1. `ConfirmationPanel`** — find:
```tsx
    <SplitLayout right={
```
The `ConfirmationPanel` is defined outside `AccessRequestPage` so it can't use `handleLogout` directly. Add a prop to `ConfirmationPanel` too:

Replace `ConfirmationPanel` function signature from:
```tsx
function ConfirmationPanel() {
  const { profile } = useProfileStore();
```
to:
```tsx
function ConfirmationPanel({ onLogout }: { onLogout?: () => void }) {
  const { profile } = useProfileStore();
```

Then inside `ConfirmationPanel`, pass `onLogout` to `SplitLayout`:
```tsx
    <SplitLayout right={...} onLogout={onLogout} />
```

Also fix the two inline logout buttons inside `ConfirmationPanel`'s right panel (mobile footer):
```tsx
          <button onClick={onLogout} className="hover:text-[#0D1B2A] transition-colors flex items-center gap-1.5">
            <LogOut size={12} /> Log Out
          </button>
```

**2. `AccessRequestPage` — ConfirmationPanel render site:**

Find:
```tsx
  if (profile.accessRequestSubmitted) return <ConfirmationPanel />;
```
Replace with:
```tsx
  if (profile.accessRequestSubmitted) return <ConfirmationPanel onLogout={handleLogout} />;
```

**3. `AccessRequestPage` — SignInPanel render site:**

`SignInPanel` is unauthenticated so no logout button is needed there. No change needed.

**4. `AccessRequestPage` — form panel (bottom of file):**

Find the final `return`:
```tsx
  return <SplitLayout right={formPanel} />;
```
Replace with:
```tsx
  return <SplitLayout right={formPanel} onLogout={handleLogout} />;
```

Also fix the two inline logout buttons inside `formPanel` (mobile footer at the bottom of the form JSX):
```tsx
        <button onClick={handleLogout} className="hover:text-[#0D1B2A] transition-colors flex items-center gap-1.5">
          <LogOut size={12} /> Log Out
        </button>
```

- [ ] **Step 4: Verify the build compiles**

```bash
npx next build
```

Expected: `✓ Compiled successfully` — no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/access-request/page.tsx
git commit -m "fix: proper Firebase logout + redirect to /landing from access-request page"
```

---

### Task 4: Deploy and verify

- [ ] **Step 1: Deploy to staging**

```bash
npx firebase hosting:channel:deploy staging --expires 7d
```

Expected: `Channel URL (motorsurveyos): https://motorsurveyos--staging-48metw71.web.app`

- [ ] **Step 2: Verify — unauthenticated flow**

1. Open staging URL in an incognito window
2. Navigate to `/signup` → should silently redirect to `/access-request`
3. Right panel should show "Get Started" heading with "Continue with Google" amber button
4. Left dark panel should be visible with trust signals

- [ ] **Step 3: Verify — sign-in flow**

1. Click "Continue with Google" on `/access-request`
2. Google popup appears (no page navigation)
3. After auth, same page re-renders with the registration form (Name / IRDAI / Phone fields)
4. URL stays at `/access-request`

- [ ] **Step 4: Verify — logout flow**

1. While on `/access-request` (authenticated), click "Log Out"
2. Should navigate to `/landing`
3. User should be fully signed out (clicking "Sign In" again should show Google picker)

- [ ] **Step 5: Verify — landing page CTA**

1. From `/landing`, click "Start 30-Day Free Trial"
2. Should navigate to `/signup` → redirect to `/access-request` → show sign-in card
3. (Optional cleanup: update landing page to point directly to `/access-request` instead of `/signup`)

---

## Success Criteria Checklist

- [ ] `/signup` URL redirects to `/access-request` without a visible flash
- [ ] Unauthenticated user on `/access-request` sees Google sign-in card in the split-panel layout
- [ ] After Google popup auth, same page transitions to the registration form without navigation
- [ ] Logout on `/access-request` clears Firebase session and lands user on `/landing`
- [ ] All existing flows (landing page CTA, marketing links, already-authenticated users) work correctly
