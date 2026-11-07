# Admin Panel UI/UX Pro Max Overhaul Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the SurveyOS Admin Panel from a cramped, low-contrast prototype into an accessible (WCAG 2.1 AA), high-utility command console with consolidated data tables, clean modal extensions, streamlined approval workflows, and a strict "View-As (Read-Only Support Mode)".

**Architecture:**
1. **Design System & Typography:** Technical Flat Design archetype. Minimum font size of `12px` (`text-xs`) for metadata, `14px` (`text-sm`) for data, standardized 14-16px SVG icons, and theme-safe semantic Tailwind tokens (`bg-card`, `bg-background`, `border-border`, `text-foreground`).
2. **Table Density Consolidation:** Consolidate 9 cluttered columns into 6 high-utility columns (`Surveyor Identity`, `Licence & Firm`, `Status & Plan`, `Claims & Activity`, `Expiry`, `Actions`), eliminating redundant date columns and raw inline text inputs that hijack clicks.
3. **Structured Expanded Drawer:** 3-column Bento Card layout in the expanded surveyor drawer: Identity & Editable Details, Firm Team & Seats Stepper, and Payment History & Notes.
4. **Accessible Modals:** Replace the cramped inline day-picker with an accessible `ExtendSubscriptionModal` offering 1-click presets (`+30d`, `+90d`, `+180d`, `+365d`).
5. **View-As Read-Only Support Mode:** Enable admin to inspect any surveyor's workspace safely with disabled mutations and a persistent top exit banner.

**Tech Stack:** Next.js 16, TypeScript, React, Tailwind CSS, Lucide Icons, Zustand, Firebase Firestore.

---

### Task 1: Admin Navigation & Universal Command Header Redesign

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`
- Test: `src/components/admin/__tests__/admin-navigation-redesign.test.tsx`

**Step 1: Write the failing test**
Create `src/components/admin/__tests__/admin-navigation-redesign.test.tsx` verifying:
1. Top tab grouping renders primary operations tabs (`Surveyors`, `New Signups`, `Payments`) and system settings menu (`AI Models`, `Fee Schedule`, `Announcements`, `Dev Notes`).
2. Universal search bar is present and functional across tabs.
3. "Copy All Emails" triggers `toast.success` and copies to clipboard without invoking browser `window.alert`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/admin/__tests__/admin-navigation-redesign.test.tsx`

**Step 3: Implementation**
1. In `AdminDashboard.tsx`:
   - Replace `alert(...)` with `toast.success(...)`.
   - Reorganize top tabs:
     - Operations tabs: `All Surveyors`, `New Signups`, `Payments`.
     - System Tools dropdown/segmented button: `AI Models`, `Fee Schedule`, `Announcements`, `Dev Notes`.
   - Keep search bar visible across tabs or contextualize search placeholder per active tab.
   - Enforce typography floor: minimum `text-xs` (12px), crisp 16px icons.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/admin/__tests__/admin-navigation-redesign.test.tsx`

**Step 5: Commit on main**
```bash
git add src/components/admin/AdminDashboard.tsx src/components/admin/__tests__/admin-navigation-redesign.test.tsx
git commit -m "feat(admin): modernize admin navigation, universal search, and eliminate thread-blocking alert"
```

---

### Task 2: Surveyor Registry Table 6-Column Consolidation

**Files:**
- Modify: `src/components/admin/tabs/SurveyorsTab.tsx`
- Test: `src/components/admin/__tests__/surveyor-table-consolidation.test.tsx`

**Step 1: Write the failing test**
Create `src/components/admin/__tests__/surveyor-table-consolidation.test.tsx` verifying:
1. Table renders 6 consolidated columns (`Surveyor`, `Licence & Firm`, `Status & Plan`, `Claims & Onboarding`, `Expiry`, `Actions`).
2. Row click triggers expand/collapse cleanly without clicking on raw inline text inputs.
3. Expiry date and days remaining are rendered together in the Expiry column.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/admin/__tests__/surveyor-table-consolidation.test.tsx`

**Step 3: Implementation**
1. In `SurveyorsTab.tsx`:
   - Reduce columns to 6:
     - Column 1: `Surveyor & Identity` (Avatar initials, Name, Email, Mobile).
     - Column 2: `Licence & Firm` (IRDAI Licence, Platform ID badge, City/State).
     - Column 3: `Status & Plan` (Status badge, Solo vs Firm Seats badge).
     - Column 4: `Claims & Onboarding` (Claims count badge with activity dot, onboarding badge).
     - Column 5: `Expiry` (Formatted date `DD Mon YYYY` + countdown badge `(XXd left)`).
     - Column 6: `Actions` (`[Manage]`, `[Extend]`, `[View 👁️]`).
   - Remove raw `<input>` elements for name and platform ID from table cells; move editing to the expanded drawer.
   - Standardize icon sizes (14-16px) and replace `text-[9px]/text-[10px]` with `text-xs`/`text-sm`.
   - Add `scope="col"` on `<th>` and `aria-expanded` on table row buttons.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/admin/__tests__/surveyor-table-consolidation.test.tsx`

**Step 5: Commit on main**
```bash
git add src/components/admin/tabs/SurveyorsTab.tsx src/components/admin/__tests__/surveyor-table-consolidation.test.tsx
git commit -m "feat(admin): consolidate surveyor table to 6 high-utility accessible columns"
```

---

### Task 3: Expanded Surveyor Drawer Bento Grid Layout

**Files:**
- Modify: `src/components/admin/tabs/SurveyorsTab.tsx`
- Test: `src/components/admin/__tests__/surveyor-drawer-bento.test.tsx`

**Step 1: Write the failing test**
Create test verifying the expanded drawer renders:
1. Contact & Identity section with editable Name and Platform ID form inputs.
2. Firm Team & Seats section with seat adjustment stepper and assistant roster.
3. Subscription & Payments ledger with recent payments and admin notes.
4. Danger Zone with account deletion and session reset.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/admin/__tests__/surveyor-drawer-bento.test.tsx`

**Step 3: Implementation**
1. In `SurveyorsTab.tsx` expanded row (`expandedId === surveyor.id`):
   - Replace flat list with a 3-column responsive Bento Grid:
     - **Card 1 (Identity & Licence):** Name, Email, Phone, IRDAI Licence, Platform ID with an explicit edit mode and `[Save Changes]` button.
     - **Card 2 (Firm Team & Seats):** Allowed Seats stepper control, registered assistant emails list, and privacy status.
     - **Card 3 (Subscription & Payments):** Current status, expiry date, recent payments with admin notes, and lifetime revenue summary.
     - **Card 4 / Footer (Danger Zone):** Account deletion, session lock reset, and status toggles.
   - Minimum font size `text-xs`, high-contrast labels, and clear form borders.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/admin/__tests__/surveyor-drawer-bento.test.tsx`

**Step 5: Commit on main**
```bash
git add src/components/admin/tabs/SurveyorsTab.tsx src/components/admin/__tests__/surveyor-drawer-bento.test.tsx
git commit -m "feat(admin): redesign expanded surveyor drawer into accessible 3-column bento grid"
```

---

### Task 4: Accessible Subscription Extension Modal

**Files:**
- Create: `src/components/admin/modals/ExtendSubscriptionModal.tsx`
- Modify: `src/components/admin/tabs/SurveyorsTab.tsx`
- Test: `src/components/admin/__tests__/ExtendSubscriptionModal.test.tsx`

**Step 1: Write the failing test**
Create test verifying that `ExtendSubscriptionModal`:
1. Renders preset buttons (`+30d`, `+90d`, `+180d`, `+365d`) and custom number input.
2. Selecting a preset updates the days value.
3. Submitting calls `onConfirm(uid, days)` with proper positive integer.
4. Includes visible focus states and escape/cancel handling.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/admin/__tests__/ExtendSubscriptionModal.test.tsx`

**Step 3: Implementation**
1. Create `src/components/admin/modals/ExtendSubscriptionModal.tsx`:
   - Clean dialog overlay with backdrop blur.
   - Quick preset pills: `+30 Days (1 Month)`, `+90 Days (Quarter)`, `+180 Days (Half Year)`, `+365 Days (1 Year)`.
   - Custom days input with `<label>` and autofocus.
   - Displays calculated new expiry date preview based on selected days.
   - Action buttons: `Cancel` and `Confirm & Extend`.
2. Replace inline `ExtendControl` in `SurveyorsTab.tsx` with this accessible modal.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/admin/__tests__/ExtendSubscriptionModal.test.tsx`

**Step 5: Commit on main**
```bash
git add src/components/admin/modals/ExtendSubscriptionModal.tsx src/components/admin/tabs/SurveyorsTab.tsx src/components/admin/__tests__/ExtendSubscriptionModal.test.tsx
git commit -m "feat(admin): replace cramped inline extend widget with accessible preset modal"
```

---

### Task 5: Approval Queue & Signups Workflow Polish

**Files:**
- Modify: `src/components/admin/tabs/ApprovalQueueTab.tsx`
- Test: `src/components/admin/__tests__/approval-queue-polish.test.tsx`

**Step 1: Write the failing test**
Create test verifying that `ApprovalQueueTab`:
1. Renders clean typography (no `text-[9px]`/`text-[10px]`).
2. Has accessible labels for trial day inputs.
3. Supports 1-click approval per row.
4. Renders empty state cleanly when queue is cleared.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/admin/__tests__/approval-queue-polish.test.tsx`

**Step 3: Implementation**
1. In `ApprovalQueueTab.tsx`:
   - Eliminate all `text-[9px]` and `text-[10px]`; upgrade metadata to `text-xs` (12px) and primary text to `text-sm` (14px).
   - Standardize icon sizes to 14px.
   - Replace raw input with styled trial picker and clear `[Approve (30d)]` button.
   - Add accessible labels and `aria-label` tags.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/admin/__tests__/approval-queue-polish.test.tsx`

**Step 5: Commit on main**
```bash
git add src/components/admin/tabs/ApprovalQueueTab.tsx src/components/admin/__tests__/approval-queue-polish.test.tsx
git commit -m "feat(admin): polish approval queue typography, accessible trial picker, and clean action buttons"
```

---

### Task 6: View-As Read-Only Support Mode

**Files:**
- Modify: `src/stores/auth-store.ts` (add `viewAsSurveyor: { uid: string; name: string; licence: string } | null`)
- Create: `src/components/admin/ViewAsSupportBanner.tsx`
- Modify: `src/components/layout/Dashboard.tsx` (mount ViewAsSupportBanner and enforce read-only)
- Modify: `src/components/admin/tabs/SurveyorsTab.tsx` (add `[ 👁️ View Workspace ]` button)
- Test: `src/components/admin/__tests__/view-as-support-mode.test.ts`

**Step 1: Write the failing test**
Create test verifying:
1. Setting `viewAsSurveyor` in `useAuthStore` updates active workspace to target surveyor UID.
2. `ViewAsSupportBanner` renders target surveyor details with an `[Exit Support Mode]` button.
3. Exiting support mode restores admin workspace and clears `viewAsSurveyor`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/admin/__tests__/view-as-support-mode.test.ts`

**Step 3: Implementation**
1. In `src/stores/auth-store.ts`:
   - Add `viewAsSurveyor: { uid: string; name: string; licence: string } | null`.
   - Add `setViewAsSurveyor(surveyor: ... | null)` action.
2. Create `src/components/admin/ViewAsSupportBanner.tsx`:
   - High-contrast amber/indigo top bar:
     `"👁️ SUPPORT MODE: Viewing workspace of {name} ({licence}) — STRICT READ-ONLY ACCESS [ Exit to Admin Panel ]"`
3. In `src/components/layout/Dashboard.tsx`:
   - Mount `<ViewAsSupportBanner />` at top when `viewAsSurveyor` is active.
   - If `viewAsSurveyor` is active, disable mutations (saving, deletions, AI calls).
4. In `SurveyorsTab.tsx`:
   - Add `[ 👁️ View Workspace ]` button in table actions and drawer header.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/admin/__tests__/view-as-support-mode.test.ts`

**Step 5: Commit on main**
```bash
git add src/stores/auth-store.ts src/components/admin/ViewAsSupportBanner.tsx src/components/layout/Dashboard.tsx src/components/admin/tabs/SurveyorsTab.tsx src/components/admin/__tests__/view-as-support-mode.test.ts
git commit -m "feat(admin): add view-as read-only support mode to inspect surveyor workspaces"
```

---

### Task 7: Full Integration Verification

**Files:**
- Run Vitest suite: `npx vitest run`
- TypeScript check: `npx tsc --noEmit`
- Scan drift tests: `cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest`
- Update `Tasks.md`, `Changelog.md`, and write new session log.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-11-07-admin-panel-ui-ux-pro-max-overhaul.md`. Ready to execute task-by-task via subagents.
