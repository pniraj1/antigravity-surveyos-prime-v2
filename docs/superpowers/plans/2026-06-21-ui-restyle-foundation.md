# UI Restyle — Foundation + Sidebar Pilot + Fee Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the enforced design-token system, build the first reusable token-driven components, migrate the sidebar as the pilot screen, and ship the dashboard fee paid/unpaid toggle — proving the system and locking the repeatable per-screen migration pattern.

**Architecture:** Presentation-only restyle. A named neutral ramp + semantic tokens live in `globals.css`; components consume tokens (never raw hex), following the existing `cva` + `cn` pattern (`src/components/ui/button.tsx`). The one functional change (fee toggle) is a pure, unit-tested helper in `src/lib` wired into the dashboard via the existing save+broadcast pattern.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript 5 (strict), Tailwind CSS 4, shadcn/`@base-ui/react`, `class-variance-authority`, Zustand, Vitest.

## Global Constraints

- Static export only (`output: 'export'`); no server runtime. Client-side code only.
- Two font weights: 400 regular, 500 medium. No `font-black`/700/900.
- Sentence case; uppercase only for short micro-labels; no text below 12px; meet WCAG AA contrast.
- One accent: gold `#D4AF37` for primary actions + active state only.
- Token-driven: no raw hex in components; all colour/space/radius from tokens.
- NEVER edit `src/components/pdf/*`, `src/components/print/*`, `src/lib/reports/*` (reports are isolated; keep them so).
- Do NOT change `AppTab` IDs or `useRouteSync`; `activeTab` stays non-persisted.
- Preserve `BroadcastChannel('surveyos_claims_sync')` + `'CLAIMS_UPDATED'`; preserve persistence keys (localStorage `surveyos-ui-storage`, IndexedDB v4, `evidence_*`).
- Keep survey-type tab filtering, `requiresClaim` gating, `SubscriptionGuard` logic, `'use client'` + `ssr:false`.
- Presentation only — no logic/calculation/data-shape changes EXCEPT the §7.2 fee toggle.
- Per-change verification: a Final + Spot report (PDF + print preview) is unchanged; reload restores tab+claim; Back/Forward works; cross-tab sync works; survey-type tab sets correct; subscription overlays still block; `npm run test` green; screenshot diff reviewed.

---

## File Structure

- `src/app/globals.css` — **modify**: add named neutral ramp + status tokens (additive; existing semantic tokens unchanged).
- `src/lib/claims/fee-status.ts` — **create**: pure `toggleFeePaid(claim)` helper.
- `src/lib/claims/__tests__/fee-status.test.ts` — **create**: unit tests for the helper.
- `src/components/ui/StatusBadge.tsx` — **create**: token-driven paid/unpaid + done/active badge.
- `src/components/ui/StageBadge.tsx` — **create**: token-driven survey-stage badge.
- `src/lib/claims/stage-variant.ts` — **create**: pure stage→variant mapping (so it is unit-testable).
- `src/lib/claims/__tests__/stage-variant.test.ts` — **create**: unit tests for the mapping.
- `src/components/layout/Dashboard.tsx` — **modify**: wire the fee badge to a toggle; use `StatusBadge`/`StageBadge`.
- `src/components/layout/sidebar.tsx` — **modify**: migrate inline hex → tokens, sentence case, `Button` primitive; logic untouched.

---

## Task 1: Token foundation (neutral ramp + status tokens)

**Files:**
- Modify: `src/app/globals.css` (inside `@theme inline { … }` and `:root { … }`)

**Interfaces:**
- Produces: CSS custom properties `--color-neutral-50/100/200/400/600/900`, `--color-status-success/warning/danger` and matching `*-tint` backgrounds, consumable as Tailwind classes (e.g. `text-[var(--color-neutral-600)]`) and by later components.

- [ ] **Step 1: Add the named tokens (additive — do not remove existing tokens)**

In `src/app/globals.css`, inside the existing `@theme inline { … }` block, add after the brand tokens:

```css
  /* Neutral ramp — single source of truth (collapses the 6 ad-hoc greys) */
  --color-neutral-50:  #F8F9FA;
  --color-neutral-100: #F0F2F5;
  --color-neutral-200: #E2E6EA;
  --color-neutral-400: #8D99AE;
  --color-neutral-600: #4A4E69;
  --color-neutral-900: #0D1B2A;

  /* Status — one text shade + one tint each (no bg+border+text trios) */
  --color-status-success:      #0F7A3D;
  --color-status-success-tint: #E6F4EC;
  --color-status-warning:      #9A6A00;
  --color-status-warning-tint: #FBF1DC;
  --color-status-danger:       #C0392B;
  --color-status-danger-tint:  #FBE9E7;
```

- [ ] **Step 2: Build to verify the tokens compile**

Run: `npm run build`
Expected: build completes (static export to `out/`) with no CSS errors.

- [ ] **Step 3: Verify no visual regression (tokens are additive, nothing consumes them yet)**

Run: `npm run dev`, open the dashboard, confirm it looks identical to before (no component uses the new tokens yet).
Expected: unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): add neutral ramp + status design tokens"
```

---

## Task 2: Fee-status helper (TDD)

**Files:**
- Create: `src/lib/claims/fee-status.ts`
- Test: `src/lib/claims/__tests__/fee-status.test.ts`

**Interfaces:**
- Produces: `toggleFeePaid(claim: Readonly<ClaimData>): ClaimData` — returns a new claim with `feeBill.feePaid` flipped and `updatedAt` refreshed. Immutable.
- Consumes: `ClaimData`, `createBlankClaim` from `@/types/claim`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/claims/__tests__/fee-status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toggleFeePaid } from '../fee-status';
import { createBlankClaim } from '@/types/claim';

describe('toggleFeePaid', () => {
  it('flips feeBill.feePaid from false to true', () => {
    const claim = createBlankClaim();
    expect(toggleFeePaid(claim).feeBill.feePaid).toBe(true);
  });

  it('flips feeBill.feePaid from true back to false', () => {
    const base = createBlankClaim();
    const paid = { ...base, feeBill: { ...base.feeBill, feePaid: true } };
    expect(toggleFeePaid(paid).feeBill.feePaid).toBe(false);
  });

  it('does not mutate the input claim', () => {
    const claim = createBlankClaim();
    const before = claim.feeBill.feePaid;
    toggleFeePaid(claim);
    expect(claim.feeBill.feePaid).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- fee-status`
Expected: FAIL — "Cannot find module '../fee-status'".

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/claims/fee-status.ts`:

```ts
import type { ClaimData } from '@/types/claim';

/** Returns a new claim with feeBill.feePaid toggled. Never mutates the input. */
export function toggleFeePaid(claim: Readonly<ClaimData>): ClaimData {
  return {
    ...claim,
    feeBill: { ...claim.feeBill, feePaid: !claim.feeBill.feePaid },
    updatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- fee-status`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/claims/fee-status.ts src/lib/claims/__tests__/fee-status.test.ts
git commit -m "feat(claims): add immutable toggleFeePaid helper with tests"
```

---

## Task 3: Wire the fee toggle into the dashboard

**Files:**
- Modify: `src/components/layout/Dashboard.tsx` (the Fee column cell in the recent-claims row, ~line 415–419)

**Interfaces:**
- Consumes: `toggleFeePaid` (Task 2); existing `getClaim`, `saveClaim` from `@/lib/storage/indexeddb`; `BroadcastChannel('surveyos_claims_sync')`.

- [ ] **Step 1: Import the helper**

At the top of `src/components/layout/Dashboard.tsx`, add to the imports:

```ts
import { toggleFeePaid } from '@/lib/claims/fee-status';
```

- [ ] **Step 2: Replace the read-only Fee badge with a toggle button**

Find the Fee cell (the `<div>` containing the `Paid/Unpaid` `<span>`, ~line 415–419) and replace it with a button that mirrors the existing "mark complete" handler:

```tsx
<div>
  <button
    onClick={async (e) => {
      e.stopPropagation();
      const fullClaim = await getClaim(claim.id);
      if (!fullClaim) return;
      await saveClaim(toggleFeePaid(fullClaim));
      const channel = new BroadcastChannel('surveyos_claims_sync');
      channel.postMessage('CLAIMS_UPDATED');
      channel.close();
    }}
    title={claim.feePaid ? 'Mark fee unpaid' : 'Mark fee paid'}
    className="text-xs rounded-md border px-2 py-0.5 transition-colors"
    style={
      claim.feePaid
        ? { borderColor: 'var(--color-status-success)', color: 'var(--color-status-success)' }
        : { borderColor: 'var(--color-status-danger)', color: 'var(--color-status-danger)' }
    }
  >
    {claim.feePaid ? 'Paid' : 'Unpaid'}
  </button>
</div>
```

- [ ] **Step 3: Verify the existing test suite still passes**

Run: `npm run test`
Expected: PASS (no logic regressions).

- [ ] **Step 4: Manually verify the toggle**

Run: `npm run dev`. On the dashboard, click a claim's Fee badge (do NOT open the claim).
Expected: badge flips Paid⇄Unpaid; reopen the claim's Fees tab and confirm `feeBill.feePaid` matches; open the app in a second tab and confirm the list updates there (BroadcastChannel).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Dashboard.tsx
git commit -m "feat(dashboard): toggle fee paid/unpaid inline without opening the claim"
```

---

## Task 4: Stage + status badge components (with unit-tested variant mapping)

**Files:**
- Create: `src/lib/claims/stage-variant.ts`
- Test: `src/lib/claims/__tests__/stage-variant.test.ts`
- Create: `src/components/ui/StageBadge.tsx`
- Create: `src/components/ui/StatusBadge.tsx`

**Interfaces:**
- Produces: `stageVariant(stage: string): 'spot' | 'final' | 'reinspection' | 'valuation' | 'default'`; `<StageBadge stage={string} />`; `<StatusBadge tone="success" | "danger" | "warning">{label}</StatusBadge>`.

- [ ] **Step 1: Write the failing test for the variant mapping**

Create `src/lib/claims/__tests__/stage-variant.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stageVariant } from '../stage-variant';

describe('stageVariant', () => {
  it('maps known stages to their key', () => {
    expect(stageVariant('spot')).toBe('spot');
    expect(stageVariant('final')).toBe('final');
    expect(stageVariant('reinspection')).toBe('reinspection');
    expect(stageVariant('valuation')).toBe('valuation');
  });

  it('falls back to default for unknown stages', () => {
    expect(stageVariant('something-else')).toBe('default');
    expect(stageVariant('')).toBe('default');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- stage-variant`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mapping**

Create `src/lib/claims/stage-variant.ts`:

```ts
export type StageVariant = 'spot' | 'final' | 'reinspection' | 'valuation' | 'default';

const KNOWN: ReadonlySet<string> = new Set(['spot', 'final', 'reinspection', 'valuation']);

export function stageVariant(stage: string): StageVariant {
  return KNOWN.has(stage) ? (stage as StageVariant) : 'default';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- stage-variant`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the badge components (token-driven, no raw hex)**

Create `src/components/ui/StatusBadge.tsx`:

```tsx
import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'danger';
const TONE: Record<Tone, { color: string; bg: string }> = {
  success: { color: 'var(--color-status-success)', bg: 'var(--color-status-success-tint)' },
  warning: { color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-tint)' },
  danger:  { color: 'var(--color-status-danger)',  bg: 'var(--color-status-danger-tint)' },
};

export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', className)}
      style={{ color: TONE[tone].color, background: TONE[tone].bg }}
    >
      {children}
    </span>
  );
}
```

Create `src/components/ui/StageBadge.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { stageVariant } from '@/lib/claims/stage-variant';

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const variant = stageVariant(stage);
  const muted = variant === 'default';
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', className)}
      style={{
        color: muted ? 'var(--color-neutral-600)' : 'var(--color-neutral-900)',
        background: 'var(--color-neutral-100)',
      }}
    >
      {stage}
    </span>
  );
}
```

- [ ] **Step 6: Build to verify components compile**

Run: `npm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/lib/claims/stage-variant.ts src/lib/claims/__tests__/stage-variant.test.ts src/components/ui/StageBadge.tsx src/components/ui/StatusBadge.tsx
git commit -m "feat(ui): add token-driven StageBadge + StatusBadge with tested variant mapping"
```

---

## Task 5: Sidebar pilot migration

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: existing `Button` from `@/components/ui/button`; tokens from Task 1. No change to `NAV_ITEMS`, `AppTab`, `handleTabChange`, survey-type filtering, `requiresClaim`, or the auth/Drive-status logic.

- [ ] **Step 1: Capture the before screenshot**

Run: `npm run dev`, open the app with a claim loaded, screenshot the sidebar (expanded + collapsed) to `.tmp-screenshots/sidebar-before-*.png`.

- [ ] **Step 2: Replace the nav button styling (inline hex → tokens, two weights, sentence case)**

In `src/components/layout/sidebar.tsx`, replace the nav `<button>` `style`/`onMouseEnter`/`onMouseLeave` block (the per-item button, ~lines 290–331) with token classes and CSS hover (remove the JS mouse handlers):

```tsx
<button
  key={item.id}
  onClick={() => !disabled && handleTabChange(item.id)}
  disabled={disabled}
  title={sidebarCollapsed ? item.label : undefined}
  className={cn(
    'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm relative transition-colors',
    sidebarCollapsed ? 'justify-center' : '',
    isActive
      ? 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-900)] font-medium'
      : disabled
        ? 'text-[var(--color-neutral-200)] cursor-not-allowed'
        : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-neutral-900)]'
  )}
>
  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[55%] w-[3px] rounded-r-full bg-primary" />}
  <span className={isActive ? 'text-primary' : ''}>{item.icon}</span>
  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
</button>
```

Add `import { cn } from '@/lib/utils';` at the top if not present.

- [ ] **Step 3: Replace the "New Claim" quick action with the Button primitive**

Replace the inline-styled New Claim `<button>` (~lines 188–201) with:

```tsx
<Button
  onClick={() => setNewClaimDialogOpen(true)}
  title="New claim"
  className="flex-1 justify-center gap-2"
>
  <Plus size={14} />
  {!sidebarCollapsed && 'New claim'}
</Button>
```

Add `import { Button } from '@/components/ui/button';` at the top.

- [ ] **Step 4: Migrate remaining inline hex in this file to tokens**

Replace the remaining hardcoded hex (`#0D1B2A`, `#8D99AE`, `#E2E6EA`, `#F0F2F5`, `#D4AF37`, etc.) in the brand header, active-claim badge, group labels, and footer (auth + status) with the neutral/`primary` tokens. Keep gold (`bg-primary`/`text-primary`) only on the active accent bar, the New Claim button, and the Drive-connected indicator. Use sentence case for all labels (e.g. "Sign in with Google", "Drive unlinked"); drop `font-black`/`uppercase` except the small group labels.

- [ ] **Step 5: Verify build + tests + nav behaviour**

Run: `npm run build && npm run test`
Expected: build succeeds; all tests pass.
Then `npm run dev` and confirm against the Global Constraints checklist: nav switches tabs; Spot vs Final vs Valuation show the correct items; `requiresClaim` items disabled with no claim; collapse/expand works; Drive status + sign-in/out still render; active item shows the gold bar.

- [ ] **Step 6: Capture the after screenshot and diff**

Screenshot the sidebar again to `.tmp-screenshots/sidebar-after-*.png`; confirm it is calmer (neutral text, single gold accent, sentence case) and nothing is missing vs. before.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "refactor(ui): migrate sidebar to design tokens (pilot screen)"
```

---

## Out of scope for this plan (follow-up, one short plan each)

The remaining screens follow the Task 5 pattern (inline hex → tokens, primitives, sentence case, calm colour, a11y fix, screenshot diff) and each gets its own short plan generated when its file is read: dashboard body, the claim/output tabs (Documents, AI Review, Details, Assessment, Bill Check, Valuation, Reinspection, Photos, Fees, Insured Report), Report Center chrome + Drive/Cloud Vault screens, Profile, Admin. Then Phase 4 (de-dazzle) and Phase 5 (a11y/device pass) from the spec.

---

## Self-Review

- **Spec coverage:** Phase 1 (tokens) → Task 1. Phase 2 (primitives) → Tasks 4 (StageBadge/StatusBadge; remaining primitives created as needed during later screen migrations). §7.2 fee toggle → Tasks 2–3. Phase 3 pilot → Task 5. Phase 0 baseline folded into Task 5 Step 1 (screenshot harness) for the pilot; full-app baseline runs before the follow-up plans. Phases 4–5 explicitly deferred (Out of scope). No spec requirement for this plan's scope is unaddressed.
- **Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output.
- **Type consistency:** `toggleFeePaid(claim): ClaimData` used identically in Task 2 (def) and Task 3 (call); `stageVariant` return union matches `StageBadge` usage; `StatusBadge` `tone` prop matches its `TONE` map keys.
