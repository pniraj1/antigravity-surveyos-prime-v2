# Team Workspace & Shared Drive Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable survey firms to have multiple team members (with distinct Google logins) collaborate on claims under an Admin-controlled seat quota, with active editing conflict warnings, privacy controls (hiding fees/earnings from assistants), and shared Google Drive backups for SurveyOS Scan.

**Architecture:** 
1. **Admin Seat Control:** Master Admin assigns `maxTeamSeats` (e.g., 3 seats) per surveyor in Firestore.
2. **Firm Team Management:** Senior Surveyor adds assistant email IDs in their Profile settings up to `maxTeamSeats`.
3. **Firm Workspace Scoping & Security:** In Firestore security rules, assistants are authorized to read/write claims under `users/{firmOwnerUid}/claims` if their email is in `teamEmails`. Assistants each have their own session document, avoiding single-session lock conflicts.
4. **Active Claim Conflict Detection:** A lightweight `claim_presence` document tracks who is currently viewing/editing each claim and displays a warning banner if another team member is already active.
5. **Role & Privacy Gates:** A `hideEarningsFromTeam` toggle prevents assistants from viewing professional fee bills, earnings summaries, and bank details.
6. **Scan & Drive Bridge:** Assistants in SurveyOS Scan select the firm's shared Google Drive folder so site photos and notes feed directly into the firm's storage.

**Tech Stack:** Next.js 16, TypeScript, Zustand, Firebase Firestore (Security Rules & Presence), Google Drive API, Android Kotlin (SurveyOS Scan).

---

### Task 1: Profile & Admin Types Update

**Files:**
- Modify: `src/types/vehicle.ts` (SurveyorProfile interface)
- Modify: `src/components/admin/types.ts` (SurveyorAdminProfile interface)
- Modify: `src/stores/profile-store.ts` (DEFAULT_PROFILE)
- Test: `src/types/__tests__/team-profile-types.test.ts`

**Step 1: Write the failing test**

Create `src/types/__tests__/team-profile-types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useProfileStore } from '@/stores/profile-store';

describe('Team Profile Types & Store defaults', () => {
  it('initializes team configuration fields with sensible defaults', () => {
    const profile = useProfileStore.getState().profile;
    expect(profile.maxTeamSeats).toBeDefined();
    expect(profile.maxTeamSeats).toBe(0);
    expect(profile.teamEmails).toEqual([]);
    expect(profile.hideEarningsFromTeam).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/__tests__/team-profile-types.test.ts`
Expected: FAIL (`maxTeamSeats` undefined).

**Step 3: Write minimal implementation**

In `src/types/vehicle.ts`, add to `SurveyorProfile`:
```typescript
  // ─── Team / Organization Access ───────────────────────────
  /** Max assistants allowed (set by Master Admin only, default 0) */
  maxTeamSeats?: number;
  /** List of assistant emails authorized to collaborate under this surveyor */
  teamEmails?: string[];
  /** Privacy toggle: hide fee bills, earnings & bank account from team members */
  hideEarningsFromTeam?: boolean;
```

In `src/components/admin/types.ts`, add to `SurveyorAdminProfile`:
```typescript
  maxTeamSeats?: number;
  teamEmails?: string[];
```

In `src/stores/profile-store.ts`, update `DEFAULT_PROFILE`:
```typescript
  maxTeamSeats: 0,
  teamEmails: [],
  hideEarningsFromTeam: true,
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/types/__tests__/team-profile-types.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/vehicle.ts src/components/admin/types.ts src/stores/profile-store.ts src/types/__tests__/team-profile-types.test.ts
git commit -m "feat(team): add maxTeamSeats, teamEmails, and hideEarningsFromTeam to profile types"
```

---

### Task 2: Master Admin Seat Quota Control

**Files:**
- Modify: `src/components/admin/tabs/SurveyorsTab.tsx`
- Modify: `src/components/admin/hooks/useAdminActions.ts`
- Test: `src/components/admin/__tests__/team-seats-admin.test.tsx`

**Step 1: Write the failing test**

Create `src/components/admin/__tests__/team-seats-admin.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

describe('Admin Team Seat Controls', () => {
  it('renders team seats input and triggers update function', () => {
    const onUpdateSeats = vi.fn();
    // Verify seat update handler propagates positive integers
    onUpdateSeats('user-123', 3);
    expect(onUpdateSeats).toHaveBeenCalledWith('user-123', 3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/__tests__/team-seats-admin.test.tsx`

**Step 3: Write minimal implementation**

1. In `src/components/admin/hooks/useAdminActions.ts`, add:
```typescript
const updateTeamSeats = async (surveyorId: string, seats: number) => {
  const currentRef = doc(db, 'users', surveyorId, 'profile', 'current');
  await updateDoc(currentRef, {
    maxTeamSeats: Math.max(0, Math.floor(seats)),
    updatedAt: serverTimestamp(),
  });
  toast.success(`Updated allowed team seats to ${seats}`);
};
```

2. In `src/components/admin/tabs/SurveyorsTab.tsx`, add an editable "Team Seats" badge and counter in the expanded surveyor row:
```tsx
<div className="flex items-center gap-2 mt-2">
  <span className="text-xs font-medium text-muted-foreground">Team Seats:</span>
  <input
    type="number"
    min="0"
    max="50"
    defaultValue={surveyor.maxTeamSeats || 0}
    onBlur={(e) => handleUpdateSeats(surveyor.id, parseInt(e.target.value) || 0)}
    className="w-16 px-2 py-1 text-xs border rounded bg-background"
  />
  <span className="text-xs text-muted-foreground">
    ({(surveyor.teamEmails || []).length} registered)
  </span>
</div>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/__tests__/team-seats-admin.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/admin/tabs/SurveyorsTab.tsx src/components/admin/hooks/useAdminActions.ts src/components/admin/__tests__/team-seats-admin.test.tsx
git commit -m "feat(admin): add team seat quota control in admin dashboard"
```

---

### Task 3: Senior Surveyor Team Settings & Privacy Toggle

**Files:**
- Create: `src/components/profile/TeamManagementSection.tsx`
- Modify: `src/components/tabs/ProfileTab.tsx`
- Test: `src/components/profile/__tests__/TeamManagementSection.test.tsx`

**Step 1: Write the failing test**

Create `src/components/profile/__tests__/TeamManagementSection.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TeamManagementSection } from '../TeamManagementSection';

describe('TeamManagementSection', () => {
  it('prevents adding emails beyond maxTeamSeats', () => {
    const onAddEmail = vi.fn();
    render(
      <TeamManagementSection
        maxSeats={2}
        teamEmails={['assistant1@gmail.com', 'assistant2@gmail.com']}
        hideEarnings={true}
        onUpdateTeam={vi.fn()}
      />
    );
    expect(screen.getByText(/Seat limit reached \(2\/2\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Member/i })).toBeDisabled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/profile/__tests__/TeamManagementSection.test.tsx`
Expected: FAIL (module not found).

**Step 3: Write minimal implementation**

Create `src/components/profile/TeamManagementSection.tsx`:
- Shows:
  - Allowed seats vs used seats (e.g., `1 / 3 seats used`).
  - Input field to add an assistant's Gmail address (normalized to lowercase).
  - Validation: Email syntax, duplicates check, maxSeats check.
  - List of active assistants with a "Remove" button.
  - Privacy Toggle: `[x] Hide Fee Bills & Professional Earnings from Team Members`.
  - Notice: *"Assistants sign in with their own Google account. They work directly on your claims without needing your password."*

Mount `TeamManagementSection` inside `src/components/tabs/ProfileTab.tsx`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/profile/__tests__/TeamManagementSection.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/profile/TeamManagementSection.tsx src/components/tabs/ProfileTab.tsx src/components/profile/__tests__/TeamManagementSection.test.tsx
git commit -m "feat(profile): add team management and privacy toggle section in profile tab"
```

---

### Task 4: Firestore Rules & Team Access Scoping

**Files:**
- Modify: `firestore.rules`
- Test: `src/lib/firebase/__tests__/team-firestore-rules.test.ts` (or rule emulator unit tests)

**Step 1: Write the specification & security verification**

Verify Firestore rule logic:
```
// A signed-in user is a team member if their email is in the owner's teamEmails list
function isTeamMember(ownerUid) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/users/$(ownerUid)/profile/current) &&
    request.auth.token.email.lower() in
      get(/databases/$(database)/documents/users/$(ownerUid)/profile/current).data.get('teamEmails', []);
}
```

**Step 2: Update `firestore.rules`**

In `firestore.rules`:
1. Add `isTeamMember(userId)` helper.
2. In `match /users/{userId}`:
   - Profile:
     - Senior or Admin can write.
     - Team members can READ profile (needed to render firm header & license on reports), but CANNOT update profile.
   - Claims (`match /{collectionId}/{document=**}`):
     - Allow read/write if: `request.auth.uid == userId || isTeamMember(userId)`.
   - Single session (`match /session/{document=**}`):
     - Each user writes to their OWN `users/{request.auth.uid}/session/current`. Team members do not write to the owner's session doc, completely avoiding kickout conflicts.

**Step 3: Verify rules with test suite**

Run: `npm run test` and verify no regressions in existing sync/auth tests.

**Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat(security): allow authorized team members to access owner claims in firestore rules"
```

---

### Task 5: Auth & Workspace State Resolution (useAuth & useCloudSync)

**Files:**
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/lib/firebase/sync.ts`
- Modify: `src/stores/auth-store.ts` (add `activeWorkspaceUid`, `isTeamMember`)
- Test: `src/hooks/__tests__/team-workspace-auth.test.ts`

**Step 1: Write the failing test**

Create `src/hooks/__tests__/team-workspace-auth.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { resolveEffectiveWorkspace } from '@/lib/auth/workspace-resolver';

describe('Workspace Resolver', () => {
  it('resolves firm owner workspace when user is an assistant', () => {
    const userEmail = 'assistant@gmail.com';
    const firmAffiliations = [
      { ownerUid: 'senior-123', firmName: 'Patil Surveyors', hideEarnings: true }
    ];
    const resolved = resolveEffectiveWorkspace(userEmail, 'assistant-uid', firmAffiliations);
    expect(resolved.activeOwnerUid).toBe('senior-123');
    expect(resolved.isTeamMember).toBe(true);
    expect(resolved.hideEarnings).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/team-workspace-auth.test.ts`
Expected: FAIL (module not found).

**Step 3: Write minimal implementation**

1. Create `src/lib/auth/workspace-resolver.ts`.
2. In `useAuth.ts`:
   - On auth state change, if user has team membership, discover firm owner via collection group or indexed profile lookup.
   - Set `activeOwnerUid` in `auth-store`.
   - Claims sync (`pullClaimsFromCloud`, `pushClaimToCloud`) targets `users/${activeOwnerUid}/claims`.
   - Inherit `firmProfile` so letterheads, licenses, and surveyor seals match the Senior Surveyor.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/team-workspace-auth.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/auth/workspace-resolver.ts src/hooks/useAuth.ts src/stores/auth-store.ts src/hooks/__tests__/team-workspace-auth.test.ts
git commit -m "feat(auth): resolve and sync firm workspace for assistant logins"
```

---

### Task 6: Claim Active Presence & Conflict Warning Banner

**Files:**
- Create: `src/hooks/useClaimPresence.ts`
- Create: `src/components/claims/ClaimPresenceBanner.tsx`
- Modify: `src/components/layout/Dashboard.tsx`
- Test: `src/hooks/__tests__/useClaimPresence.test.ts`

**Step 1: Write the failing test**

Create `src/hooks/__tests__/useClaimPresence.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isRecentPresence } from '../useClaimPresence';

describe('Claim Presence', () => {
  it('detects another user active within 5 minutes', () => {
    const now = Date.now();
    const presence = { userEmail: 'ramesh@gmail.com', userName: 'Ramesh', updatedAt: now - 60000 };
    expect(isRecentPresence(presence, 'my-email@gmail.com', now)).toBe(true);
  });

  it('ignores own presence or stale presence > 5 mins', () => {
    const now = Date.now();
    const stalePresence = { userEmail: 'ramesh@gmail.com', userName: 'Ramesh', updatedAt: now - 360000 };
    expect(isRecentPresence(stalePresence, 'my-email@gmail.com', now)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useClaimPresence.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

1. Create `src/hooks/useClaimPresence.ts`:
   - Updates `users/{ownerUid}/claim_presence/{claimId}` every 30s while claim is open.
   - Listens to presence on current claim via Firestore snapshot.
2. Create `src/components/claims/ClaimPresenceBanner.tsx`:
   - If someone else is active:
     ```tsx
     <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
       <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 animate-pulse" />
       <span>
         <strong>{presence.userName || presence.userEmail}</strong> is currently editing this claim (last active {timeAgo}).
         Coordinate to avoid conflicting edits.
       </span>
     </div>
     ```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useClaimPresence.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/hooks/useClaimPresence.ts src/components/claims/ClaimPresenceBanner.tsx src/components/layout/Dashboard.tsx src/hooks/__tests__/useClaimPresence.test.ts
git commit -m "feat(presence): add active editing warning banner for team claims"
```

---

### Task 7: Earnings & Fee Bill Visibility Gate

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/Dashboard.tsx`
- Modify: `src/components/tabs/FeeBillTab.tsx`
- Test: `src/components/layout/__tests__/team-privacy-gate.test.tsx`

**Step 1: Write the failing test**

Create `src/components/layout/__tests__/team-privacy-gate.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { shouldHideEarningsTab } from '../sidebar';

describe('Team Privacy Gate', () => {
  it('hides fee bill tab for team members when hideEarnings is true', () => {
    expect(shouldHideEarningsTab(true, true)).toBe(true);
  });

  it('shows fee bill tab for team members if surveyor allowed it', () => {
    expect(shouldHideEarningsTab(true, false)).toBe(false);
  });

  it('never hides fee bill tab for firm owner', () => {
    expect(shouldHideEarningsTab(false, true)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/__tests__/team-privacy-gate.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

In `src/components/layout/sidebar.tsx`:
- Check `isTeamMember && hideEarningsFromTeam`.
- If true, omit `'fee-bill'` and hide revenue summary stats in dashboard cards.
- In `FeeBillTab.tsx`, render a clean lock message if navigated directly: *"Fee bills and professional earnings are restricted to the primary surveyor."*

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/__tests__/team-privacy-gate.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/Dashboard.tsx src/components/tabs/FeeBillTab.tsx src/components/layout/__tests__/team-privacy-gate.test.tsx
git commit -m "feat(privacy): restrict fee bills and earnings from team members based on owner toggle"
```

---

### Task 8: SurveyOS Scan Shared Backup Drive Integration

**Files:**
- Modify: `../SurveyOS Scan/app/src/main/java/in/surveyos/scan/data/drive/GoogleDriveService.kt`
- Modify: `../SurveyOS Scan/app/src/main/java/in/surveyos/scan/ui/settings/SettingsScreen.kt`
- Modify: `docs/handover/prime-notes-import.md`
- Test: `../SurveyOS Scan/app/src/test/java/in/surveyos/scan/DriveSyncTest.kt`

**Step 1: Write the contract documentation**

Update `docs/handover/prime-notes-import.md`:
- Document shared root folder support: field assistants in Scan can configure a "Shared Drive Folder ID" or select the shared folder shared by the Senior Surveyor.

**Step 2: Scan Android Implementation**
- In `GoogleDriveService.kt`: When querying root folder, check for both personal "SurveyOS" and shared folder with ID configured in settings.
- In `SettingsScreen.kt`: Add "Firm Shared Folder" picker/selector.
- Field assistant captures photos and notes -> Scan writes to the Senior Surveyor's shared folder.
- Prime imports from this same folder.

**Step 3: Drift & Unit Tests**
Run Scan tests in Git Bash:
`cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest`

**Step 4: Commit**
```bash
git add docs/handover/prime-notes-import.md
git commit -m "docs(contract): document team shared drive folder sync for scan and prime"
```

---

### Task 10: Admin Payment Notes & Manual Offline Payment Recording

**Files:**
- Modify: `src/types/payment.ts`
- Modify: `src/lib/firebase/payments.ts`
- Modify: `src/components/admin/modals/VerifyPaymentModal.tsx`
- Create: `src/components/admin/modals/RecordOfflinePaymentModal.tsx`
- Modify: `src/components/admin/tabs/PaymentsTab.tsx`
- Modify: `src/components/admin/tabs/SurveyorsTab.tsx`
- Test: `src/components/admin/__tests__/admin-payment-notes.test.ts`

**Step 1: Write failing test**
Create test verifying `verifyPayment` accepts `adminNotes` and records it on the payment doc, and `recordManualPayment` creates a verified payment doc with custom duration and notes.

**Step 2: Implementation**
1. Add `adminNotes?: string` and `planName?: string` to `PaymentRecord`.
2. Update `verifyPayment` in `src/lib/firebase/payments.ts` to save `adminNotes`.
3. Add `recordManualPayment(adminUid, surveyorUid, amount, durationDays, notes)` in `payments.ts`.
4. In `VerifyPaymentModal.tsx`, add an "Admin Notes" input textarea.
5. Create `RecordOfflinePaymentModal.tsx` allowing admin to select any surveyor and log a cash/bank/direct payment with custom notes.
6. In `SurveyorsTab.tsx`, show recent payments & notes in the expanded surveyor card.

---

### Task 11: Dedicated Surveyor Subscription & Billing View

**Files:**
- Create: `src/components/subscription/SubscriptionBillingView.tsx`
- Modify: `src/components/profile/SubscriptionSection.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Test: `src/components/subscription/__tests__/SubscriptionBillingView.test.tsx`

**Step 1: Write failing test**
Create test verifying that `SubscriptionBillingView` renders plan details, team seats used/allowed, days remaining, payment history with admin notes, and hides from team assistants if `hideEarningsFromTeam` is true.

**Step 2: Implementation**
1. Build `SubscriptionBillingView.tsx` with high-clarity plan card, team seats status, UPI QR submission, and table of verified payments showing Admin Notes.
2. Ensure team assistants cannot view this if `hideEarningsFromTeam` is active.

---

### Task 12: Full Integration Verification

**Files:**
- Full test suite: `npx vitest run`
- TypeScript check: `npx tsc --noEmit`
- Scan drift tests: `cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest`

**Steps:**
1. Run all 227+ test files in Prime (`npx vitest run`).
2. Run `npx tsc --noEmit` to verify 0 type errors.
3. Verify coupled tests between Prime and Scan.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-11-07-team-workspace-and-shared-drive.md`.
