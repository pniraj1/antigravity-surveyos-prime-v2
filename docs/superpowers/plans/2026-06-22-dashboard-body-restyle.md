# Dashboard Body Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `DashboardContent` (the dashboard home screen body) from inline hex + raw colour classes + JS hover to the design-token system, consuming the `StageBadge`/`StatusBadge` primitives built in the foundation phase, and calming the hero banner — without changing any data, routing, or claim-action logic.

**Architecture:** Presentation-only restyle of one file (`src/components/layout/Dashboard.tsx`). Replace raw hex (`#0D1B2A`, `#8D99AE`, `#E2E6EA`, `#F0F2F5`, `#D4AF37`, etc.) and ad-hoc Tailwind colour classes (`bg-amber-500`, `text-green-600`, …) with the neutral ramp + status tokens. Replace JS `onMouseEnter`/`onMouseLeave` with CSS hover. Two font weights only. The rainbow per-stage badge and the status badge are replaced by the existing `<StageBadge>` / `<StatusBadge>` components.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript 5 (strict), Tailwind CSS 4, `class-variance-authority`, Zustand.

## Global Constraints

- **Presentation only.** NO changes to logic, data shape, calculations, routing, or handlers. The ONLY edits are className/style/markup-for-styling and swapping in the badge components.
- **DO NOT touch the claim-row `onClick` body** (`Dashboard.tsx:354–369`): the `useUIStore.getState().setCurrentClaimId(claim.id)` call MUST stay synchronous and BEFORE the `await getClaim(...)`. Restyle only the row's `className`/`style`/hover, never the handler.
- **DO NOT change** the fee-toggle button handler (already token-driven), the mark-complete handler, the archive/restore handler, the delete handler, or any `BroadcastChannel('surveyos_claims_sync')` + `'CLAIMS_UPDATED'` call.
- **DO NOT change** the `grid-cols-[...]` column templates (they define the table layout) except to keep header and rows identical to each other.
- Two font weights only: 400 (default) and 500 (`font-medium`). Remove every `font-black`/`font-extrabold`/`font-bold`/`font-semibold` → `font-medium` or default.
- One accent: gold (`bg-primary`/`text-primary`) only for the primary "New claim" CTA and any single active accent. Everything else neutral/status tokens.
- No raw hex (`#XXXXXX`) and no `rgba(...)` literals left in the file after this plan. Use `var(--color-neutral-*)`, `var(--color-status-*)`, or the matching Tailwind token utilities (`bg-card`, `border-border`, `text-muted-foreground`, `text-foreground`, `bg-background`).
- Sentence case for labels ("New claim", "Open saved", "Recent claims", "Fees overview", "No claims yet"). Short uppercase micro-labels (column headers, stat labels) may stay uppercase.
- Keep `'use client'`. Do NOT touch `Dashboard()` (the outer shell), `TabPlaceholder`'s routing `if` chain, `useRouteSync`, or the dynamic imports.
- NEVER edit `src/components/pdf/*`, `src/components/print/*`, `src/lib/reports/*`.
- Commit directly to main (no new branches).
- Per-task verification: `npm run build` succeeds; dashboard renders; claim row click still opens the claim on the Details tab; fee toggle, mark-complete, archive, delete all still work; search/sort still work; archived/active switch still works.

---

## File Structure

- `src/components/layout/Dashboard.tsx` — **modify only**. No new files. The `StageBadge`/`StatusBadge` components already exist at `src/components/ui/StageBadge.tsx` / `StatusBadge.tsx`.

**Component interfaces already available (from foundation phase):**
- `import { StageBadge } from '@/components/ui/StageBadge';` → `<StageBadge stage={claim.stage} />` (renders the stage label in a calm neutral pill; unknown stages render muted).
- `import { StatusBadge } from '@/components/ui/StatusBadge';` → `<StatusBadge tone="success" | "warning" | "danger">{label}</StatusBadge>` (filled tint pill).

---

## Task 1: Recent Claims table — tokens, CSS hover, badge components

**Files:**
- Modify: `src/components/layout/Dashboard.tsx` — the "Recent Claims Table" block (`~236–518`): section header + Active/Archived toggle, search/sort controls + total pill, the table card, the header row, the empty state, and each claim row's styling.

**Interfaces:**
- Consumes: `StageBadge`, `StatusBadge` (add the two imports at the top of the file).

- [ ] **Step 1: Add the badge imports**

At the top of `Dashboard.tsx`, after the existing component imports, add:

```ts
import { StageBadge } from '@/components/ui/StageBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
```

- [ ] **Step 2: Replace the stage cell with `<StageBadge>`**

Replace the entire stage `<div>` (the `<span>` with the 5-branch `claim.stage === 'spot' ? … : …` inline `style`, `~385–402`) with:

```tsx
<div>
  <StageBadge stage={claim.stage} />
</div>
```

- [ ] **Step 3: Replace the status cell with `<StatusBadge>`**

Replace the status `<div>` (`~411–415`, the `<span>` using `var(--color-status-*)` border/colour) with:

```tsx
<div>
  <StatusBadge tone={!claim.isActive ? 'danger' : claim.isCompleted ? 'success' : 'warning'}>
    {!claim.isActive ? 'Archived' : claim.isCompleted ? 'Done' : 'Active'}
  </StatusBadge>
</div>
```

- [ ] **Step 4: Replace JS hover on the claim row with CSS hover**

On the claim row `<div>` (`~352–374`): KEEP the `key`, the `onClick` handler (unchanged), and the `grid` layout classes. REMOVE the `onMouseEnter`/`onMouseLeave` props and the inline `style={{ borderBottom: '1px solid #F0F2F5' }}`. Result:

```tsx
<div
  key={claim.id}
  onClick={async () => {
    // Set ID synchronously so Effect 2 in useRouteSync sees
    // the correct currentClaimId before the async gap below.
    useUIStore.getState().setCurrentClaimId(claim.id);
    try {
      const fullClaim = await getClaim(claim.id);
      if (fullClaim) {
        useClaimStore.getState().loadClaim(fullClaim);
        useUIStore.getState().setActiveTab('details');
      } else {
        useUIStore.getState().setCurrentClaimId(null);
      }
    } catch {
      useUIStore.getState().setCurrentClaimId(null);
    }
  }}
  className="px-6 py-4 grid grid-cols-[1.5fr_1fr_2fr_100px_100px_120px_60px] gap-4 items-center cursor-pointer border-b border-[var(--color-neutral-100)] transition-colors hover:bg-[var(--color-neutral-50)]"
>
```

(The `onClick` body is reproduced verbatim — do not alter it.)

- [ ] **Step 5: Migrate the remaining inline hex in this block to tokens**

Within the Recent Claims block only, replace every raw hex / `rgba()` with tokens, keeping layout identical:
- Section heading "Recent/Archived Claims" `style={{ color: '#8D99AE' }}` → `className="… text-[var(--color-neutral-400)]"` (drop the inline style); change `font-black` → `font-medium`; use sentence case "Recent claims" / "Archived claims".
- Active/Archived toggle wrapper `style={{ background: '#F0F2F5', … }}` → `bg-[var(--color-neutral-100)]`; selected tab `bg-white text-[#0D1B2A]` → `bg-card text-[var(--color-neutral-900)]`; unselected `text-[#8D99AE] hover:text-[#0D1B2A]` → `text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-900)]`; `font-bold` → `font-medium`. The archived-count pill already uses status tokens — keep it, but change its hardcoded `#E2E6EA`/`#0D1B2A` branch to `var(--color-neutral-200)`/`var(--color-neutral-900)`.
- Search input `style={{ background:'#FFFFFF', border:'1px solid #E2E6EA', color:'#0D1B2A' }}` → `className` `bg-card border border-border text-[var(--color-neutral-900)]` (remove inline style; keep the focus ring classes). Search icon `text-gray-400` → `text-[var(--color-neutral-400)]`.
- Sort button inline style → `bg-card border border-border text-[var(--color-neutral-600)]`; `font-bold` → `font-medium`.
- "X total" pill `style={{ background:'#0D1B2A', color:'#D4AF37' }}` → `bg-[var(--color-neutral-900)] text-primary`; `font-bold` → `font-medium`.
- Table card `style={{ background:'#FFFFFF', border:'1px solid #E2E6EA', boxShadow:'0 1px 3px rgba(13,27,42,0.04)' }}` → `className` `bg-card border border-border shadow-sm` (remove inline style).
- Empty state: icon wrapper `style={{ background:'#F0F2F5' }}` → `bg-[var(--color-neutral-100)]`; `FileCheck` `style={{ color:'#8D99AE' }}` → `text-[var(--color-neutral-400)]`; "No claims yet" `style={{ color:'#0D1B2A' }}` → `text-[var(--color-neutral-900)]` and `font-bold`→`font-medium`; helper text `#8D99AE` → `text-[var(--color-neutral-400)]`; the empty-state "New Claim" button `style={{ background:'#0D1B2A', color:'#D4AF37' }}` → `bg-[var(--color-neutral-900)] text-primary`, label sentence case "New claim", `font-bold`→`font-medium`.
- Header row `style={{ borderBottom:'1px solid #E2E6EA', color:'#8D99AE', background:'#FAFAFA' }}` → `className` `border-b border-border text-[var(--color-neutral-400)] bg-[var(--color-neutral-50)]` (remove inline style); `font-black` stays as the small uppercase micro-label exception is NOT allowed — change to `font-medium`.
- Report-No cell `style={{ color:'#0D1B2A' }}` → `text-[var(--color-neutral-900)]`, `font-bold`→`font-medium`. Drive icon `style={{ color:'#16a34a', flexShrink:0 }}` → `className="text-[var(--color-status-success)] shrink-0"`.
- Vehicle cell `style={{ color:'#0D1B2A' }}` → `text-[var(--color-neutral-900)]`, `font-bold`→`font-medium`.
- Date cell `style={{ color:'#8D99AE' }}` → `text-[var(--color-neutral-400)]`.
- Leave the fee-toggle button, mark-complete, archive, restore, and delete buttons' **handlers** untouched; you MAY normalise their hardcoded greys (`text-gray-400`, `hover:bg-gray-100`, `bg-green-100 text-green-600`) to `text-[var(--color-neutral-400)]`, `hover:bg-[var(--color-neutral-100)]`, and `text-[var(--color-status-success)]` for the completed state, and the delete hover red to `hover:text-[var(--color-status-danger)]`.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: success, 18 pages generated.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Dashboard.tsx
git commit -m "refactor(ui): migrate dashboard recent-claims table to tokens + badge components"
```

---

## Task 2: Hero banner + stats row + fees overview

**Files:**
- Modify: `src/components/layout/Dashboard.tsx` — the hero banner (`~104–145`), stats row (`~150–174`), and fees overview (`~176–233`).

- [ ] **Step 1: Calm the hero banner (flatten, two weights, sentence case, single accent)**

Replace the hero `<div className="relative overflow-hidden …bg-gradient-to-br from-slate-900…">` block (`~105–145`) so that:
- The banner background is a flat token surface: `className="px-8 py-10 lg:px-14 lg:py-14 bg-[var(--color-neutral-900)] text-white"` (remove `relative overflow-hidden` and the gradient).
- DELETE the two decorative gold-orb `<div>`s (`~106–108`).
- Badge pill: keep the text "AI-powered · cloud-native · IRDAI compliant" (sentence case), `font-bold`→`font-medium`, colours `bg-amber-500/15 text-amber-500 border-amber-500/30` → `bg-primary/15 text-primary border border-primary/30`.
- `<h1>`: remove `font-black` → `font-medium`; remove the duplicate `tracking-*`; keep the "Prime" pill but flatten its `bg-gradient-to-br from-amber-500 to-amber-300` → `bg-primary` (text stays `text-[var(--color-neutral-900)]`).
- Sub-paragraph: `text-slate-200/70` → keep as `text-white/70`; `font-medium` stays.
- Primary CTA "New Claim": label → "New claim"; flatten `bg-gradient-to-br from-amber-500 to-amber-300 … shadow-[…]` → `bg-primary text-[var(--color-neutral-900)] hover:bg-primary/90`; `font-bold`→`font-medium`; keep rounded + padding.
- Secondary CTA "Open Saved": label → "Open saved"; `bg-white/10 text-slate-50 border-white/15 hover:bg-white/20` → `bg-white/10 text-white border border-white/15 hover:bg-white/20`; `font-bold`→`font-medium`.

- [ ] **Step 2: Migrate the stats row colour classes to tokens**

In the stats array (`~152–156`) and card (`~157–173`): the `bgClass`/`textClass` per stat use `bg-amber-500`/`bg-green-500`/`bg-slate-900` etc. Replace the accent top-bar so all four stat cards use a single restrained accent: set every `bgClass` to `bg-primary` and drop the per-stat `textClass` colour (use `text-[var(--color-neutral-400)]` for the icon). Card wrapper already uses `bg-card border border-border` — keep. `font-black` on the value → `font-medium`. Stat label stays uppercase micro-label but `font-bold`→`font-medium`.

- [ ] **Step 3: Migrate the fees overview to status tokens**

- Section heading "Fees Overview" → sentence case "Fees overview"; `font-black`→`font-medium`; `text-muted-foreground` stays.
- "Export Annual Summary" button → sentence case "Export annual summary"; `bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20` → `bg-[var(--color-status-success-tint)] text-[var(--color-status-success)] border border-[var(--color-status-success)]/30 hover:opacity-90`; `font-bold`→`font-medium`.
- "Reconcile Bank Statement" button → sentence case "Reconcile bank statement"; `bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20` → `bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)] border border-[var(--color-status-warning)]/30 hover:opacity-90`; `font-bold`→`font-medium`.
- Fee cards array (`~198–216`): map `bgClass`/`textClass` to status tokens — Total Billed → neutral (`bg-[var(--color-neutral-600)]` bar, value `text-[var(--color-neutral-900)]`); Fees Received → `bg-[var(--color-status-success)]` bar, value `text-[var(--color-status-success)]`; Outstanding → `bg-[var(--color-status-danger)]` bar, value `text-[var(--color-status-danger)]`. Because these are passed as className strings in the data array, replace the string values accordingly. `font-black` on values → `font-medium`. Card label `font-bold`→`font-medium`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Dashboard.tsx
git commit -m "refactor(ui): calm dashboard hero + migrate stats/fees cards to tokens"
```

---

## Task 3: Confirmation dialogs + TabPlaceholder

**Files:**
- Modify: `src/components/layout/Dashboard.tsx` — archive dialog (`~524–571`), delete dialog (`~573–625`), and `TabPlaceholder` empty/coming-soon state (`~647–658`).

- [ ] **Step 1: Migrate the archive confirmation dialog**

Keep ALL handler logic (the archive `onClick` async body, `BroadcastChannel`, `sessionStorage.removeItem`, `toast`). Restyle only:
- Icon wrapper `bg-amber-50` + `AlertTriangle text-amber-600` → `bg-[var(--color-status-warning-tint)]` + `text-[var(--color-status-warning)]`.
- Title `text-[#0D1B2A]` → `text-[var(--color-neutral-900)]`, `font-bold`→`font-medium`; subtitle `text-[#8D99AE]` → `text-[var(--color-neutral-400)]`.
- Body `text-[#4A4E69]` → `text-[var(--color-neutral-600)]`.
- Cancel button `text-[#4A4E69] hover:bg-[#F0F2F5]` → `text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]`, `font-bold`→`font-medium`.
- Confirm "Archive Claim" button → sentence case "Archive claim"; `bg-amber-500 text-white hover:bg-amber-600` → `bg-[var(--color-status-warning)] text-white hover:opacity-90`; `font-bold`→`font-medium`.

- [ ] **Step 2: Migrate the delete confirmation dialog**

Keep ALL handler logic (the `deleteClaim`, confirm-text gate, `BroadcastChannel`, `toast`). Restyle only:
- Icon wrapper `bg-red-50` + `Trash2 text-red-600` → `bg-[var(--color-status-danger-tint)]` + `text-[var(--color-status-danger)]`.
- Title/subtitle as in Step 1 (`text-[var(--color-neutral-900)]` / `text-[var(--color-neutral-400)]`), `font-bold`→`font-medium`.
- Body `text-[#4A4E69]` → `text-[var(--color-neutral-600)]`.
- Label `text-[#8D99AE]` → `text-[var(--color-neutral-400)]`, `font-bold`→`font-medium`.
- Input `border-[#E2E6EA]` → `border-border`; keep the red focus ring (`focus:ring-red-200 focus:border-red-400`) OR map to `focus:ring-[var(--color-status-danger)]/30 focus:border-[var(--color-status-danger)]`.
- Cancel button as in Step 1.
- Confirm "Delete Forever" button → sentence case "Delete forever"; `bg-red-600 text-white hover:bg-red-700` → `bg-[var(--color-status-danger)] text-white hover:opacity-90`; keep the `disabled:opacity-40` logic; `font-bold`→`font-medium`.

- [ ] **Step 3: Migrate `TabPlaceholder` coming-soon state**

Icon wrapper `bg-[#F0F2F5]` → `bg-[var(--color-neutral-100)]`; `Zap text-[#8D99AE]` → `text-[var(--color-neutral-400)]`; tab title `style={{ color:'#0D1B2A' }}` → `text-[var(--color-neutral-900)]`, `font-bold`→`font-medium`; "Coming soon" `style={{ color:'#8D99AE' }}` → `text-[var(--color-neutral-400)]`.

- [ ] **Step 4: Final no-hex check + build**

Run: `npm run build`
Then confirm no raw hex remains in the file: `grep -nE "#[0-9A-Fa-f]{6}|rgba\(" src/components/layout/Dashboard.tsx` should return nothing.
Expected: build success; grep empty.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Dashboard.tsx
git commit -m "refactor(ui): migrate dashboard confirmation dialogs + tab placeholder to tokens"
```

---

## Self-Review

- **Spec coverage:** Recent claims table (the densest hex source) + badge consumption → Task 1. Hero de-dazzle + stats + fees → Task 2. Dialogs + placeholder → Task 3. Together they remove every raw hex/`rgba` and every `font-black/bold/semibold` from `DashboardContent`, `TabPlaceholder`, and the two dialogs.
- **Logic untouched:** every task explicitly preserves the claim-row sync-before-await ordering, all `BroadcastChannel` calls, and the archive/delete/fee/complete handlers. No data-shape or calculation edits.
- **Type consistency:** `StatusBadge tone` values (`'success' | 'warning' | 'danger'`) and `StageBadge stage` (string) match the components from the foundation phase.
- **Placeholder scan:** no TBD/TODO; every step names exact lines, exact before/after token mappings, and exact commands.
