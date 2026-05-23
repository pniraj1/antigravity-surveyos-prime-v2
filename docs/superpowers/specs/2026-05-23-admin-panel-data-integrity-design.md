# Admin Panel Data Integrity & Controls — Design Spec

**Date:** 2026-05-23
**Status:** Approved

## Problem

Six issues found during staging validation of the restructured admin panel:

1. **No "Set to Read-Only" button** — admin can only Activate or Suspend, never manually set readonly
2. **Trial period hardcoded at 60 days** — should be 30-day default, configurable per approval
3. **Trial date not linked to Expiry Date column** — `trialEndDate` and `subscriptionExpiry` are separate fields that can diverge
4. **IRDAI licence not visible in Approval Queue** — form writes to `profile/current`, but queue reads from `newSignups`
5. **Contact number not visible in Approval Queue** — same root cause as #4
6. **Payment tab disconnected** — admin cannot manually extend subscriptions; verification is the only path

All six trace back to: the admin panel doesn't read from `profile/current` consistently, and lacks key admin controls.

## Design

### Part A: Enriched Approval Queue

**Goal:** Show real user data (IRDAI, phone, name) from `profile/current` in the Approval Queue, not stale `newSignups` data.

**Approach:** Client-side enrichment using data already fetched.

In `useAdminData.ts`, after both `fetchAllProfiles` and `fetchSignups` complete, enrich each signup:

```
For each newSignup UID:
  -> Find matching surveyor in the profiles array (by UID)
  -> Merge authoritative fields: irdaiLicence, mobile, name, accessRequestSubmitted
  -> If no profile match, keep newSignups data as fallback
```

The `NewSignup` type gains enriched fields:

| Field | Source | Fallback |
|---|---|---|
| `profileName` | `profile/current.name` | `newSignups.displayName` |
| `profileIrdai` | `profile/current.irdaiLicence` | `''` |
| `profileMobile` | `profile/current.mobile` | `''` |
| `accessRequestSubmitted` | `profile/current.accessRequestSubmitted` | `false` |

**Approval Queue UI changes:**

- IRDAI column renders `signup.profileIrdai` (from profile)
- Phone column renders `signup.profileMobile` (from profile)
- Name renders `signup.profileName`, falling back to `signup.displayName`
- If `accessRequestSubmitted === false`, show "Awaiting form submission" badge instead of IRDAI/phone
- Approve button remains always enabled (no IRDAI guard)

**No Firestore changes.** No new queries. Just cross-referencing two arrays already in memory.

### Part B: Unified Expiry Model

**Goal:** One expiry field, one source of truth.

`subscriptionExpiry` is THE expiry field for all statuses (trial, active, readonly).

On approval:
- `subscriptionExpiry` = `now + trialDays`
- `trialEndDate` = same value (metadata only — records original trial end)
- `trialStartDate` = now

The SurveyorsTab "Days Left" and "Expiry Date" columns both read `subscriptionExpiry`. No more branching between `trialEndDate` and `subscriptionExpiry`.

**`isExpiringSoon()` and `isExpired()` in SurveyorsTab** simplify from:
```ts
const expiry = surveyor.subscriptionStatus === 'trial'
  ? surveyor.trialEndDate
  : surveyor.subscriptionExpiry;
```
To:
```ts
const expiry = surveyor.subscriptionExpiry;
```

### Part C: Configurable Trial Duration

**Goal:** Admin sets trial length per user at approval time. Default 30 days.

**Constant change:** `TRIAL_DURATION_DAYS` changes from `60` to `30`.

**Approval Queue UI:** Add a number input next to the Approve button:
```
Trial: [30] days  [Approve]  [Dismiss]
```

Each signup row gets its own trial days input (local state), defaulting to 30. Admin can override per user.

**`handleApprove` signature change:**
```ts
// Before
handleApprove(signup: NewSignup): Promise<void>

// After
handleApprove(signup: NewSignup, trialDays: number): Promise<void>
```

Inside `handleApprove`, replace `calculateTrialEndDate(trialStart)` with inline calculation using the passed `trialDays`:
```ts
const trialEnd = addDaysToDate(trialStart, trialDays);
```

### Part D: Admin Status Controls

**Goal:** Admin can set any status: active, suspended, readonly.

**`handleUpdateStatus` type change:**
```ts
// Before
handleUpdateStatus(uid: string, status: 'active' | 'suspended' | 'expired'): void

// After
handleUpdateStatus(uid: string, status: 'active' | 'suspended' | 'readonly'): void
```

**SurveyorsTab action buttons per current status:**

| Current Status | Available Actions |
|---|---|
| `trial` | Suspend, Read-Only |
| `active` | Suspend, Read-Only |
| `readonly` | Activate, Suspend |
| `suspended` | Activate, Read-Only |

Renders as two small contextual buttons, replacing the current binary Activate/Suspend toggle.

### Part E: Admin Subscription Extension

**Goal:** Admin can extend any surveyor's subscription directly, without requiring a user-submitted payment.

**New action in SurveyorsTab:** "Extend" button on each row. Clicking it shows an inline popover:
```
Extend by: [30] days  [Apply]
```

**New handler — `handleExtendSubscription`:**
```ts
handleExtendSubscription(uid: string, days: number): Promise<void>
```

Logic:
- If `subscriptionExpiry` exists and is in the future: add `days` to current expiry
- If `subscriptionExpiry` is past or empty: add `days` from today
- If current status is `readonly` or `trial`, set `subscriptionStatus` to `'active'`; otherwise keep current status
- Write `subscriptionExpiry`, `subscriptionStatus`, `updatedAt` to `profile/current`

Reuses existing `addDaysToDate()` from `status.ts`.

### Part F: Payment Tab Connection

The payment verification flow already works correctly:
1. User submits via `PaymentSubmissionForm` -> `users/{uid}/payments` with `status: 'pending'`
2. Admin verifies in Payments tab -> `verifyPayment()` updates both payment doc AND `profile/current`
3. The verify modal's `onConfirm` already calls `fetchPayments()` and `fetchAllProfiles()`

The only fix: ensure the `await` calls complete before closing the modal (currently `setVerifyModal(null)` fires before the awaits). Move modal close to after refresh completes.

## Files to Modify

| File | Action | Changes |
|---|---|---|
| `src/lib/subscription/status.ts` | Modify | `TRIAL_DURATION_DAYS` 60 -> 30 |
| `src/components/admin/types.ts` | Modify | Add enriched fields to `NewSignup`, update status union |
| `src/components/admin/hooks/useAdminData.ts` | Modify | Enrich signups with profile data after fetch |
| `src/components/admin/hooks/useAdminActions.ts` | Modify | `handleApprove` accepts `trialDays`, add `handleExtendSubscription`, update `handleUpdateStatus` to accept `'readonly'` |
| `src/components/admin/tabs/ApprovalQueueTab.tsx` | Modify | Show enriched data, add trial days input, "Awaiting form" badge |
| `src/components/admin/tabs/SurveyorsTab.tsx` | Modify | Unify expiry to `subscriptionExpiry`, add Read-Only + Extend buttons, context-dependent actions |
| `src/components/admin/AdminDashboard.tsx` | Modify | Pass `trialDays` through to `handleApprove`, fix verify modal await order |

## Files NOT Changed

- `src/hooks/useAuth.ts` — auto-transition logic already correct
- `src/lib/firebase/payments.ts` — `verifyPayment()` works correctly
- `src/components/subscription/PaymentSubmissionForm.tsx` — user-facing flow unchanged
- `src/app/access-request/page.tsx` — form writes to `profile/current`, unchanged
- `firestore.rules` — no new collections or permissions needed

## Data Flow (After)

```
User submits access request form:
  -> PRIMARY: profile/current { name, irdaiLicence, mobile, accessRequestSubmitted: true }
  -> SECONDARY: newSignups/{uid} { displayName, email, status, updatedAt } (pointer only)

Approval Queue displays:
  newSignups UIDs -> enriched with profile/current data
  -> Admin sees real name, IRDAI, phone from profile
  -> Admin sets trial days (default 30) -> clicks Approve
  -> Writes subscriptionExpiry = trialEndDate = now + trialDays

Surveyors Tab displays:
  subscriptionExpiry as single source for "Days Left" and "Expiry Date"
  -> Admin can: Activate | Suspend | Read-Only (context-dependent)
  -> Admin can: Extend by N days (inline)

Payments Tab:
  -> User submits UPI proof -> Admin verifies -> verifyPayment() extends subscriptionExpiry
  -> Refresh updates Surveyors tab automatically

Manual extension (Surveyors Tab):
  -> Admin clicks Extend -> enters days -> updates subscriptionExpiry directly
  -> No payment record created (admin override, not a financial transaction)
```

## Verification

After implementation:
1. `npm run build` — zero errors
2. Deploy to staging
3. Smoke test:
   - New user signs up -> submits form -> Approval Queue shows IRDAI + phone from profile
   - Admin sets trial to 15 days -> approves -> Surveyors tab shows 15 days left, correct expiry date
   - Admin clicks Read-Only on a trial user -> status changes
   - Admin clicks Extend 30 days on a readonly user -> becomes active with 30 days
   - User submits payment -> Admin verifies -> Surveyors tab reflects new expiry
   - Expiry date column and Days Left column always agree
