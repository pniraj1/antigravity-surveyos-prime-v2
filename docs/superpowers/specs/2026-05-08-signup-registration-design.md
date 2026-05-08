# Signup & Registration Flow — Design Spec

**Date:** 2026-05-08  
**Status:** Approved  
**Author:** Brainstorming session with Claude

---

## Problem

SurveyOS Prime has no signup or registration flow. `signInWithGoogle()` is the same function for new and returning users. Brand-new surveyors land directly on the dashboard with a completely blank profile — no name, no IRDAI licence, no details — making every PDF report they generate unusable for submission. There is also no mechanism for the admin to vet or approve new users before they access the app.

---

## Goals

1. Detect first-time users and collect minimum registration information.
2. Gate full app access behind admin approval.
3. Show new users a read-only preview of the dashboard while they wait — clearly communicating that approval is pending, not a bug.
4. Give the admin a simple approve/reject UI in the existing AdminDashboard.
5. Unlock access in real time when the admin approves (no page refresh required for the user).

---

## Approach: In-App Registration Wizard (Option A)

After Google sign-in, the app detects `isNewUser === true` from Firebase, shows a registration form inside the app (same visual style as `DriveGateScreen`), saves details to Firestore, then transitions to a read-only dashboard with a pending approval banner.

No separate `/register` route. No external form. Everything happens within the existing auth flow.

---

## User Flow

```
New User
  └─ "Continue with Google" → Firebase signInWithPopup
       └─ isNewUser === true
            ├─ Create Firestore doc: users/{uid} { status: 'pending', createdAt }
            └─ Render RegistrationForm (conditional render in AuthGate)
                 └─ Fields: Full Name, Mobile, IRDAI Licence No., City, State
                      └─ Submit → update Firestore doc with registration fields
                                  set accessRequestSubmitted: true
                           └─ Transition to Dashboard (read-only) + PendingApprovalBanner

Returning User
  └─ "Continue with Google" → Firebase signInWithPopup
       └─ isNewUser === false
            └─ Fetch users/{uid} from Firestore, read status
                 ├─ 'approved'  → full dashboard ✅
                 ├─ 'pending'   → read-only dashboard + PendingApprovalBanner
                 └─ 'rejected'  → RejectionScreen (contact email shown)

Admin
  └─ AdminDashboard → "Pending Registrations" section
       └─ Cards: Name, Mobile, IRDAI Licence, City, State, sign-up date
            └─ Approve button → status = 'approved', approvedAt = now
            └─ Reject button  → status = 'rejected'
                 └─ Firestore onSnapshot in AuthGate → user's UI updates live
```

---

## Firestore Schema

**Collection:** `users`  
**Document ID:** Firebase UID

```ts
interface UserDocument {
  // From Firebase Auth
  uid: string;
  email: string;
  displayName: string;

  // From Registration Form
  name: string;
  mobile: string;
  irdaiLicence: string;
  city: string;
  state: string;

  // Access control
  status: 'pending' | 'approved' | 'rejected';
  accessRequestSubmitted: boolean;

  // Timestamps
  createdAt: Timestamp;
  approvedAt: Timestamp | null;
}
```

---

## Components

### 1. `RegistrationForm`
**Path:** `src/components/auth/RegistrationForm.tsx`

- Shown when: authenticated user has no Firestore `users/{uid}` doc, or doc exists with `accessRequestSubmitted: false`
- Style: card layout matching `DriveGateScreen` (navy gradient icon, white card, gold CTA)
- Fields: Full Name, Mobile, IRDAI Licence Number, City, State
- Validation: all 5 fields required before submit is enabled
- On submit: writes to Firestore `users/{uid}`, sets `accessRequestSubmitted: true`, updates `registrationStatus` in auth store to `'pending'`
- Error state: shows inline error if Firestore write fails

### 2. `PendingApprovalBanner`
**Path:** `src/components/auth/PendingApprovalBanner.tsx`

- Shown when: `registrationStatus === 'pending'`
- Position: sticky top banner on the dashboard, above all content
- Tone: informational/warm — not an error
- Copy: *"Your account is under review. You can explore the app, but actions are locked until the admin approves your registration. We'll notify you once approved."*
- Colour: amber/gold background (consistent with the brand's gold token `#D4AF37`)
- No dismiss button — it disappears automatically when approved

### 3. `RejectionScreen`
**Path:** `src/components/auth/RejectionScreen.tsx`

- Shown when: `registrationStatus === 'rejected'`
- Full-screen card (same style as DriveGateScreen)
- Copy: *"Your registration was not approved. Please contact surveyosprime@gmail.com if you think this is a mistake."*
- Sign out button

### 4. `AuthGate` updates
**Path:** `src/components/auth/AuthGate.tsx`

- After auth resolves, fetch `users/{uid}` from Firestore and set `registrationStatus` in auth store
- Set up `onSnapshot` listener on `users/{uid}` — when status changes to `'approved'`, update auth store and the banner disappears live
- Render logic:
  - No Firestore doc → `<RegistrationForm />`
  - `status: 'pending'` → `<>{children}</>` (full app renders) + `<PendingApprovalBanner />`
  - `status: 'approved'` → `<>{children}</>` (normal)
  - `status: 'rejected'` → `<RejectionScreen />`

### 5. `auth-store.ts` updates
**Path:** `src/stores/auth-store.ts`

Add to `AuthState`:
```ts
registrationStatus: 'unregistered' | 'pending' | 'approved' | 'rejected' | null;
setRegistrationStatus: (status: AuthState['registrationStatus']) => void;
```

### 6. `signInWithGoogle()` updates
**Path:** `src/lib/firebase/auth.ts`

Return `isNewUser` alongside the user:
```ts
export async function signInWithGoogle(): Promise<{ user: User; isNewUser: boolean }> {
  const result = await signInWithPopup(auth, googleProvider);
  const isNewUser = result.additionalUserInfo?.isNewUser ?? false;
  return { user: result.user, isNewUser };
}
```

### 7. `AdminDashboard` updates
**Path:** `src/components/admin/AdminDashboard.tsx`

- New "Pending Registrations" section rendered at the top when pending users exist
- Each card shows: Name, Mobile, IRDAI Licence, City, State, sign-up date
- **Approve** button: sets `status = 'approved'`, `approvedAt = serverTimestamp()`
- **Reject** button: sets `status = 'rejected'`
- List updates in real time via `onSnapshot` on the `users` collection (filtered by `status == 'pending'`)

### 8. `SubscriptionGuard` updates
**Path:** `src/components/layout/SubscriptionGuard.tsx`

- Already gates features behind subscription status
- Extend: also block when `registrationStatus === 'pending'`
- This means all action buttons (New Claim, etc.) disable automatically with no additional work per component

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Firestore write fails on registration submit | Inline error message, submit button re-enabled |
| Firestore fetch fails on sign-in | Treat as `'unregistered'`, show RegistrationForm |
| `onSnapshot` disconnects | Banner stays visible; reconnects automatically when network returns |
| Admin approves already-rejected user | Firestore update succeeds; user's next load shows full access |

---

## Out of Scope

- Email notifications to user on approval/rejection (can be added later via Firebase Functions)
- Admin ability to add rejection reason/message (can be added later)
- Invite-only or coupon-code registration
- Annual plan or payment integration (separate feature)

---

## Files Changed

| File | Change |
|---|---|
| `src/components/auth/RegistrationForm.tsx` | **New** |
| `src/components/auth/PendingApprovalBanner.tsx` | **New** |
| `src/components/auth/RejectionScreen.tsx` | **New** |
| `src/components/auth/AuthGate.tsx` | Add Firestore fetch + onSnapshot |
| `src/stores/auth-store.ts` | Add `registrationStatus` field |
| `src/lib/firebase/auth.ts` | Return `isNewUser` |
| `src/components/admin/AdminDashboard.tsx` | Add pending registrations section |
| `src/components/layout/SubscriptionGuard.tsx` | Block on `pending` status |
