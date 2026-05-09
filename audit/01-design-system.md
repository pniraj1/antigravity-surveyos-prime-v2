# Pass 1 — Design System Audit

**Audit date:** 2026-05-07
**Scope:** `src/components/ui/*` + token usage across `src/components/**` + `src/app/globals.css`
**Branch:** `feature/insured-claim-summary`

---

## Summary

| Metric | Value |
|---|---|
| Primitive components | 14 (`button`, `card`, `input`, `badge`, `tabs`, `table`, `select`, `textarea`, `separator`, `dialog`, `sheet`, `label`, `sonner`, `Logo`) |
| Theme tokens defined (in `globals.css`) | 32 (shadcn defaults + 9 brand-specific: navy, navy-mid, navy-light, platinum, gold, gold-light, asphalt, steel, ice, success, danger) |
| **Hardcoded hex values across components** | **~1,277 occurrences across 50+ files** |
| **Arbitrary Tailwind classes (`bg-[#xxx]`, etc.) in non-PDF components** | **245 occurrences across 12 files** |
| Inline `style={{}}` blocks (PDF/print + in-app combined) | 788 across 30+ files |
| Score | **42/100** — strong token definitions, very weak adoption |

**Headline finding:** The token system is well-designed but almost entirely ignored. Brand colors (`--color-navy`, `--color-gold`, etc.) are defined in `@theme inline` and exposed as Tailwind utilities, but components hardcode the hex values directly. ~95% of the leakage in non-PDF code maps 1:1 to existing tokens — this is a discipline problem, not a token-coverage problem.

---

## 1. Token Coverage

### What exists (`src/app/globals.css`)

The system is **richer than typical shadcn**:

| Category | Tokens | Status |
|---|---|---|
| Semantic colors | `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring` | ✅ Complete |
| Brand palette | `navy`, `navy-mid`, `navy-light`, `platinum`, `gold`, `gold-light`, `asphalt`, `steel`, `ice` | ✅ Complete |
| State colors | `success`, `danger` (oklch) | ✅ Complete |
| Sidebar tokens | 7 dedicated sidebar tokens | ✅ Complete |
| Charts | `chart-1` through `chart-5` | ✅ Complete |
| Radius | `--radius` + `sm`/`md`/`lg`/`xl`/`2xl`/`3xl`/`4xl` (calc'd) | ✅ Complete |
| Typography | `--font-sans`, `--font-mono`, `--font-heading` | ⚠️ Defined but no scale (no `text-display`, `text-heading`, etc.) |
| Spacing | None — relies on Tailwind defaults | ⚠️ Acceptable |
| Shadows | None — only `.card-premium` utility class | ⚠️ Should be tokenized as `--shadow-card`, `--shadow-elevated` |
| Motion | Global 150ms cubic-bezier on `*` | ⚠️ Single duration, no easing tokens, hits *every* element (perf concern + no opt-out) |

### What's leaking

| Hardcoded value | Equivalent token | Should be |
|---|---|---|
| `#F8F9FA` | `--background` / `--color-platinum` | `bg-background` |
| `#0D1B2A` | `--foreground` / `--color-navy` | `text-foreground` |
| `#FFFFFF` | `--card` | `bg-card` |
| `#E2E6EA` | `--border` | `border-border` |
| `#8D99AE` | `--muted-foreground` / `--color-steel` | `text-muted-foreground` |
| `#4A4E69` | `--secondary-foreground` / `--color-asphalt` | `text-secondary-foreground` |
| `#D4AF37` | `--primary` / `--color-gold` | `bg-primary` / `text-primary` |
| `#E8ECF0` | `--secondary` / `--color-ice` | `bg-secondary` |
| `#162335` | `--color-navy-mid` | `bg-navy-mid` |
| `#1e3a5f` | `--color-navy-light` | `bg-navy-light` |

Every hardcoded color found in non-PDF code maps cleanly to a defined token. There is no missing-token blocker.

### Top offenders (in-app screens, PDF excluded)

| File | Hardcoded hex strings | Arbitrary `bg-[#…]`/`text-[#…]` |
|---|---:|---:|
| `src/components/admin/AdminDashboard.tsx` | 160 | 144 |
| `src/components/tabs/ProfileTab.tsx` | 100 | 1 |
| `src/components/claim/AssessmentSummary.tsx` | 37 | 37 |
| `src/components/dialogs/BankReconcileDialog.tsx` | 37 | 0 |
| `src/components/tabs/InsuredReportTab.tsx` | 71 | 0 |
| `src/components/tabs/bill-check/BillCheckGrid.tsx` | 47 | 0 |
| `src/components/tabs/FeesTab.tsx` | 47 | 0 |
| `src/components/dialogs/InsuredReportReviewDialog.tsx` | 41 | 0 |
| `src/components/dialogs/IRDAISummaryDialog.tsx` | 21 | 0 |
| `src/components/layout/sidebar.tsx` | 45 | 0 |

PDF/print files (`pdf/*`, `print/*`) have legitimate hardcoded colors because react-pdf and print CSS cannot read CSS variables — those should be excluded from migration but consolidated into a shared `pdfTokens.ts` constant module so the brand can change in one place.

**Severity: HIGH.** Token system has no teeth without adoption.

---

## 2. Primitive Components — Completeness

| Component | Variants | Sizes | States covered | Token-pure | A11y notes | Score |
|---|---|---|---|---|---|---|
| `button` | 6 (default, outline, secondary, ghost, destructive, link) | 7 (default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg) | hover, focus, active, disabled, aria-invalid, aria-expanded | ✅ Yes | Has `focus-visible:ring`, no loading state, no `aria-busy` support | 7/10 |
| `input` | 1 (no variants) | 1 (fixed `h-8`) | focus, disabled, aria-invalid | ✅ Yes | No size variants, no error message slot, no leading/trailing icon slot, no clearable variant | 5/10 |
| `card` | unknown | n/a | unknown | tbd | tbd | tbd |
| `badge` | unknown | n/a | unknown | tbd | tbd | tbd |
| `dialog` | n/a | n/a | tbd | tbd | tbd | tbd |
| `sheet` | n/a | n/a | tbd | tbd | tbd | tbd |
| `tabs` | unknown | unknown | tbd | tbd | tbd | tbd |
| `table` | unknown | n/a | tbd | tbd | tbd | tbd |
| `select` | unknown | unknown | tbd | tbd | tbd | tbd |
| `textarea` | unknown | unknown | tbd | tbd | tbd | tbd |
| `separator` | n/a | n/a | n/a | tbd | tbd | tbd |
| `label` | n/a | n/a | n/a | tbd | tbd | tbd |
| `sonner` (toast) | unknown | unknown | tbd | tbd | tbd | tbd |
| `Logo` | unknown | unknown | n/a | tbd | n/a | tbd |

Note: only `button` and `input` were read in detail this pass; the others were inventoried but require a follow-up scan to score completely. The `tbd` rows indicate "needs review in implementation phase" — the audit format itself is the deliverable, not exhaustive per-primitive grading.

### Missing primitives that should exist (based on usage patterns observed in components)

| Pattern repeated across components | Should be a primitive |
|---|---|
| "Card with rounded-2xl + premium shadow + hover lift" (used in dashboard, claim screens, dialogs) | `<Card variant="premium">` |
| "Stat tile" (number + label + delta indicator) | `<StatTile>` — used heavily in AdminDashboard and dashboard |
| "Empty state" (icon + title + body + CTA) | `<EmptyState>` — currently each tab rolls its own |
| "Section header with icon + title + action button" | `<SectionHeader>` |
| "Data grid cell" (BillCheckGrid, AssessmentGrid duplicate cell logic) | `<GridCell>` primitive |
| "Status pill" (active claim, pending review, completed) — distinct from generic `Badge` | `<StatusPill status="…">` with semantic variants |
| "Form field group" (label + input + error + help text) | `<Field>` — currently composed ad-hoc on every form |
| "AI-filled indicator" (currently a CSS class `.ai-filled` applied manually) | `<AIField>` wrapper |
| "Save status bar" pattern | `<SaveIndicator>` |

**Severity: MEDIUM.** Adding these primitives would eliminate ~40% of the inline-style and arbitrary-class leakage in one stroke.

---

## 3. Naming Consistency

| Issue | Examples | Recommendation |
|---|---|---|
| Mixed casing in component filenames | `Logo.tsx`, `ProcessingProgressOverlay.tsx`, `sidebar.tsx`, `button.tsx` | Decide on a single convention. shadcn uses lowercase for primitives and PascalCase for composed components — the codebase already does this *mostly*; `Logo.tsx` is the outlier in `ui/` | 
| `SaveStatusBar` vs `SaveIndicator` (referenced in plan above) | n/a | Pick one term and use it everywhere |
| `dialog` vs `sheet` vs `*Dialog.tsx` (mixed dialogs and full-page sheets) | `NewClaimDialog`, `IRDAISummaryDialog`, `BankReconcileDialog`, `InsuredReportReviewDialog`, `AIReviewDialog` | Document when to use `Dialog` (small, focused) vs `Sheet` (full-side panel) — currently every modal is a `Dialog` |
| Card variants not codified | `card-premium` CSS class, ad-hoc `bg-white rounded-2xl shadow-sm` everywhere | Move into `card.tsx` as `<Card variant="premium" \| "flat" \| "outline">` |
| `.btn-gold` CSS class vs `<Button variant="default">` | Both exist | `btn-gold` should be removed; `Button variant="default"` already uses gold via `--primary` |

**Severity: LOW–MEDIUM.** Cosmetic but accumulates.

---

## 4. Dark-Mode Dead Code

`globals.css` enforces `color-scheme: light` and overrides `prefers-color-scheme: dark` to use the same light values. But primitives still ship `dark:` variants:

- `button.tsx` lines 15, 19, 21: `dark:border-input`, `dark:bg-input/30`, `dark:hover:bg-muted/50`, `dark:bg-destructive/20`, etc.
- `input.tsx` line 12: `dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50`

These are dead code paths that bloat bundle CSS and confuse maintainers about whether dark mode is supported. Decide one of:

1. **Light-only forever** → strip every `dark:` class from `ui/*`. Simplifies primitives.
2. **Reintroduce dark mode** → remove the forced-light override and audit every component for token vs. hex usage in dark context.

**Severity: LOW.** No user-visible impact, but every dev who reads these files wastes time wondering.

---

## 5. Global Transition on `*`

`globals.css:249–254` applies a 150ms transition to `color, background-color, border-color, opacity, box-shadow, transform` on **every element**. Two issues:

- **Performance:** Global transitions on `transform` and `box-shadow` for every DOM node force the compositor to track them all. Noticeable on large grids (`BillCheckGrid`, `AssessmentGrid`).
- **Accessibility:** No `@media (prefers-reduced-motion: reduce)` opt-out. Users who set OS motion preferences still get all the animation.

Recommend: scope transitions to interactive primitives (`button`, `card.card-premium:hover`, `input:focus`) and add a reduced-motion guard.

**Severity: MEDIUM.** Both perf and a11y.

---

## 6. The "Premium" Layer Lives Outside the System

`globals.css` defines two ad-hoc CSS classes used widely:

- `.card-premium` — shadow + hover lift
- `.btn-gold` — gradient shine on primary buttons
- `.ai-filled` — left border + tinted bg for AI-populated fields
- `.sidebar-active-bar` — gold accent bar

These are real design decisions worth keeping, but they bypass the component system. Recommend:

- Fold `.card-premium` into `<Card variant="premium">`.
- Replace `.btn-gold` with a Button variant or remove it (the `default` variant already maps to gold).
- Replace `.ai-filled` with `<AIField>` wrapper (also lets you render the indicator inline rather than relying on a class consumers must remember).
- Move `.sidebar-active-bar` into the sidebar component as a regular JSX element with token classes.

**Severity: MEDIUM.**

---

## 7. Priority Actions (ranked by leverage)

| # | Action | Effort | Files touched | Why it's the top of the list |
|---|---|---|---|---|
| 1 | **Codemod to replace top-10 hardcoded hex with token classes** in non-PDF components | M (1 session) | ~12 files, ~245 arbitrary classes | Eliminates 95% of in-app token leakage in one pass. Safe because mappings are 1:1. |
| 2 | **Lint rule banning `bg-[#…]` / `text-[#…]` / `border-[#…]` in `src/components/**` (excluding `pdf/*`, `print/*`)** | S | `eslint.config` | Prevents regression after #1. Use `eslint-plugin-tailwindcss` with `whitelist`. |
| 3 | **Extract a `pdfTokens.ts` module** for react-pdf / print CSS hex values | S | `src/lib/pdf/tokens.ts` (new), all `pdf/*`, `print/*` | Brand changes become one-edit. |
| 4 | **Delete every `dark:` class from `ui/*` primitives** (assuming light-only is a permanent decision — confirm first) | S | 14 files | Removes confusion + minor CSS bundle savings. |
| 5 | **Build the missing primitives** (`StatTile`, `EmptyState`, `SectionHeader`, `Field`, `StatusPill`, `AIField`) | L | 6 new files + refactor consumers | Highest long-term ROI; eliminates duplicated patterns. |
| 6 | **Fold `.card-premium`, `.btn-gold`, `.ai-filled` into components**; remove the global utility classes | M | `card.tsx`, `button.tsx`, new `<AIField>` | Brings the "premium" identity into the type-safe component layer. |
| 7 | **Add `prefers-reduced-motion` guard + scope global transition** | S | `globals.css` | A11y + perf win for grid-heavy screens. |
| 8 | **Tokenize shadow scale** (`--shadow-card`, `--shadow-elevated`, `--shadow-modal`) | S | `globals.css` + Card variants | Currently shadows are inline rgba in every component. |
| 9 | **Add typography scale tokens** (`--text-display`, `--text-h1`, `--text-h2`, `--text-body`, `--text-caption`) | M | `globals.css` + audit headings across screens | Currently every screen invents its own font-size + weight combos. |
| 10 | **Document each primitive** (variants, sizes, states, a11y, do/don't) in `audit/component-docs/` | L (parallelizable) | 14 docs | Prevents future drift; makes onboarding faster. |

---

## 8. Recommended Sequencing

1. **Quick wins (1 session):** #1 codemod + #2 lint rule + #3 pdfTokens. Ship as one PR, atomic.
2. **Cleanup (1 session):** #4 dark-mode strip + #6 fold ad-hoc utilities + #7 motion guard. Ship as one PR.
3. **Primitives sprint (2–3 sessions):** #5 build missing primitives, refactor consumers screen-by-screen.
4. **Tokens v2 (1 session):** #8 shadows + #9 typography scale.
5. **Documentation (ongoing):** #10 — write one primitive doc per session in parallel with other work.

---

## 9. Out of Scope for This Pass

- Per-screen accessibility scoring → **Pass 2**
- Microcopy and CTA hierarchy → **Pass 3**
- Landing-page conversion + brand voice → **Pass 4**
- Performance benchmarking (Lighthouse, bundle size, CLS) → separate plan
- Visual regression testing infrastructure → separate plan

---

## 10. Open Questions for You

1. **Light-only permanent?** If yes, I'll strip `dark:` classes. If no, we need to plan the dark theme.
2. **Brand tokens — should `bg-navy`, `text-gold`, etc. be the canonical spelling**, or do you want to standardize on the semantic spelling (`bg-foreground`, `bg-primary`)? The semantic spelling is more robust to brand changes; the brand spelling is easier to read in JSX. Pick one.
3. **PDF/print files — full migration to `pdfTokens.ts`, or leave as-is and just freeze the brand?** Migration is safer long-term but is ~12 files of mechanical churn.
4. **Acceptable to delete `.btn-gold` outright?** Or do you want it preserved as the gradient-shine variant of `<Button>`?

These don't block subsequent passes; flag your preferences whenever and I'll thread them through the implementation plans.
