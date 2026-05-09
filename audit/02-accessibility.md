# Pass 2 — Accessibility Audit (WCAG 2.1 AA)

**Audit date:** 2026-05-07
**Standard:** WCAG 2.1 AA
**Scope:** Landing → Login → Dashboard → Sidebar → NewClaimDialog → claim flow → tabs (sampled)

---

## Summary

| Severity | Count | Examples |
|---|---:|---|
| 🔴 **Critical** (blocks users) | **9** | Custom dialogs without focus trap, missing reduced-motion handling, contrast failures on body text, icon-only buttons without labels |
| 🟡 **Major** (significant barrier) | **14** | Sidebar nav missing `aria-current`, hover-only tooltips, error messages not announced, sub-44px touch targets, keyboard-trap on scroll-jacked landing tour |
| 🟢 **Minor** (polish) | **8** | No skip-to-content link, decorative SVGs without `aria-hidden`, missing landmark labels |

**Total findings:** **31**
**Headline:** This is a forms-heavy insurance app used in field conditions, but **8 ARIA attribute usages exist across the entire `src/components/**` tree** (excluding shadcn primitives) and **zero `prefers-reduced-motion` handling exists anywhere in the codebase**. The forms themselves use proper `htmlFor=` labels (73 instances across 7 form files — a bright spot), but everything around them — navigation, dialogs, status updates, decorative motion — is essentially unannotated.

---

## 1. Perceivable

### 1.1 Color Contrast (WCAG 1.4.3, 1.4.11)

The Executive Platinum palette has structural contrast problems against the platinum-white background.

| Token / hex | Used as | Vs. white (#FFFFFF) | Vs. platinum (#F8F9FA) | Required | Status |
|---|---|---:|---:|---:|---|
| `#8D99AE` (`steel` / `muted-foreground`) | Group labels, sub-text, status icons | **3.20:1** | **3.13:1** | 4.5:1 | 🔴 **FAIL** |
| `#4A4E69` (`asphalt` / `secondary-foreground`) | Body text | **7.64:1** | **7.46:1** | 4.5:1 | ✅ Pass |
| `#0D1B2A` (`navy` / `foreground`) | Headlines | **17.24:1** | **16.85:1** | 4.5:1 | ✅ Pass |
| `#D4AF37` (`gold` / `primary`) on white | Brand text accents, gold buttons | **2.18:1** | **2.13:1** | 4.5:1 (text) / 3:1 (UI) | 🔴 **FAIL for text**, ⚠️ borderline for UI |
| `#D4AF37` on `#0D1B2A` (sidebar gold-on-navy) | Sidebar primary accents, "Surveyor" label | **7.91:1** | n/a | 4.5:1 | ✅ Pass |
| `text-gray-400` (Tailwind `#9CA3AF`) on white | Footer, stat captions, helper text | **2.85:1** | n/a | 4.5:1 | 🔴 **FAIL** |
| `text-gray-500` (`#6B7280`) on white | Body copy on landing, "Sign in to access…" | **4.83:1** | n/a | 4.5:1 | ✅ Pass (barely) |
| `#E2E6EA` border on white | All borders | **1.13:1** | n/a | 3:1 (UI) | 🔴 **FAIL** for UI components requiring contrast |
| `text-amber-700` on `bg-amber-50` (landing pill) | "INTRODUCING SURVEYOS PRIME V2" | ~5.2:1 | n/a | 4.5:1 | ✅ Pass |
| Disabled sidebar item `#E2E6EA` on transparent | Disabled nav links | <2:1 | n/a | n/a (disabled exempt) | ⚠️ exempt but indistinguishable |

**Critical impact:** `#8D99AE` is used as the primary muted text color across the entire app (all sub-labels, status text, group headers in the sidebar, time stamps, helper text). A single token fix raises hundreds of spots above 4.5:1.

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| C1 | `--muted-foreground` (`#8D99AE`) fails 4.5:1 on white & platinum backgrounds | 1.4.3 | 🔴 Critical | Darken to `#6B7686` (passes 4.5:1) or `#5A6577` (7:1 AAA-grade). Single-line change in `globals.css`. |
| C2 | `text-gray-400` used widely on landing page for footer, stat captions, helper text | 1.4.3 | 🔴 Critical | Replace with `text-muted-foreground` once C1 is fixed; or `text-gray-600` immediately. |
| C3 | Border color `#E2E6EA` on white = 1.13:1, fails 3:1 for UI components | 1.4.11 | 🟡 Major | Darken `--border` to `#C9D0D7` (3:1) for borders that bound interactive components. Decorative dividers can stay light. |
| C4 | Gold `#D4AF37` used as text color on white-ish backgrounds (e.g., `--color-gold-light` accents, `text-primary` link in claim summary) | 1.4.3 | 🔴 Critical | Don't use gold as text color on light backgrounds. Reserve gold for filled buttons (gold bg + navy text — this passes), accents on dark navy, or icons ≥24px (decorative). |

### 1.2 Non-text Content (WCAG 1.1.1)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| P1 | Landing page hero icon containers and feature-grid icons have no `aria-hidden="true"` and no labels | 1.1.1 | 🟢 Minor | Add `aria-hidden="true"` to `<svg>` elements that are purely decorative; ensure adjacent text describes the content. lucide-react icons inherit `aria-hidden="true"` by default but explicit is better for the icon-only buttons. |
| P2 | Logo SVG (`Logo.tsx`) has no accessible name | 1.1.1 | 🟡 Major | Wrap with `<span aria-label="SurveyOS Prime">` or pass `aria-label` to the SVG. Currently announced as just "image" by screen readers. |
| P3 | Avatar `<img alt="">` in sidebar has empty alt — fine for decorative — but `src=""` when `photoURL` is missing causes a broken-image render | 1.1.1 + robustness | 🟢 Minor | Render the fallback `Shield` icon when `photoURL` is empty; don't render the `<img>` at all. |
| P4 | Animated SVGs in `WorkflowSimulation` (Cpu spin, scanning laser, ping dots) have no text alternative or live-region narration | 1.1.1, 4.1.3 | 🟡 Major | Wrap each tab in a region with an `aria-live="polite"` text caption that updates as steps progress. Or mark the entire simulation `aria-hidden="true"` and provide a static text summary nearby. |

### 1.3 Info & Relationships (WCAG 1.3.1)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| P5 | Sidebar group labels ("CLAIM WORKFLOW", "OUTPUT", "SETTINGS") are visual only — not announced as section boundaries | 1.3.1 | 🟡 Major | Wrap each group in `<div role="group" aria-labelledby="group-claim">` with the label as `<h2 id="group-claim">` (or `<div role="heading">`). |
| P6 | Active sidebar item indicated only by background + accent bar — no `aria-current="page"` | 1.3.1, 4.1.2 | 🟡 Major | Add `aria-current={isActive ? 'page' : undefined}` to the `<a>` tag (sidebar.tsx:332-348). |
| P7 | "AI-filled" fields use a CSS class (`.ai-filled`) with a left border — purely visual indicator | 1.3.1 | 🟡 Major | Add `aria-describedby` pointing to a visually-hidden span: "This field was filled by AI from extracted documents." |
| P8 | `<aside>` and `<nav>` in sidebar.tsx have no `aria-label` | 1.3.1 | 🟢 Minor | `<aside aria-label="Application sidebar">` + `<nav aria-label="Primary navigation">`. |
| P9 | Status messages in dashboard ("Cloud Linked", "Drive Unlinked", "Offline · Local") rely on color-coded icons | 1.3.3, 1.4.1 | 🟢 Minor | Already include text alongside icon — good. Just add `role="status"` to the connection status block so screen readers announce changes. |

### 1.4 Distinguishable — Motion (WCAG 2.3.3 — AAA but commonly tested at AA)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| P10 | **Zero `prefers-reduced-motion` handling anywhere in the codebase.** Landing page has infinite `animate-ping`, infinite `Cpu` rotation, scroll-driven simulation, infinite encryption laser, framer-motion `whileInView` on every section, hover-scale on every CTA. | 2.3.3, 2.2.2 | 🔴 **Critical** | Wrap motion in framer-motion's `useReducedMotion()` hook; gate Tailwind `animate-*` classes with `motion-safe:`; add a global `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` block in `globals.css` as a safety net. |
| P11 | Global transition on `*` (`globals.css:249–254`) cannot be opted out of | 2.3.3 | 🟡 Major | Same fix as P10. |
| P12 | Scroll-driven `StickySimulation` on landing changes content based on scroll position. Keyboard users using arrow keys see the tab change unexpectedly; reduced-motion users see jarring auto-advance. | 2.3.3, 3.2.1 | 🟡 Major | Add `useReducedMotion()`: if true, render all three simulation states stacked vertically instead of scroll-jacking. Or expose a "Pause animation" button. |

---

## 2. Operable

### 2.1 Keyboard Access (WCAG 2.1.1, 2.1.2)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| O1 | `NewClaimDialog` uses a raw `<div className="fixed inset-0 z-[100]…">` overlay — no focus trap, no Escape-to-close, no `role="dialog"`/`aria-modal`/`aria-labelledby`. Same pattern in `IRDAISummaryDialog`, `BankReconcileDialog`, `InsuredReportReviewDialog`, `AIReviewDialog`. | 2.1.1, 2.1.2, 4.1.2 | 🔴 **Critical** | Migrate all 5 dialogs to the `Dialog` primitive in `src/components/ui/dialog.tsx`. The primitive (built on shadcn/Radix) gives focus trap, escape, scroll-lock, and proper ARIA for free. |
| O2 | Auto-cycling tabs in `WorkflowSimulation` (3-second interval) — keyboard user landing on a tab cannot stop the cycle, and scroll position can override their choice | 2.2.2 | 🟡 Major | When a tab is focused, pause the auto-cycle. Provide a "Pause" button. |
| O3 | Sidebar tooltips in collapsed mode use `title` attribute. Title attribute tooltip support is poor for keyboard users (only shows on long hover) and inconsistent on screen readers. | 2.1.1, 4.1.2 | 🟡 Major | Replace `title` with a real tooltip component (Radix Tooltip) or with `aria-label` so SR users hear the label and visual users see a styled tooltip on focus. |
| O4 | Hover styles on sidebar items use `onMouseEnter`/`onMouseLeave` to mutate `style.background`. Keyboard users tabbing through the nav get **no hover feedback** at all. | 2.4.7 | 🔴 **Critical** | Replace with CSS `:hover, :focus-visible` selectors. Inline style mutation breaks keyboard parity. |
| O5 | "Tabs" on dashboard (the `tabs/*` components) — verify focus order matches DOM order; sample `BillCheckGrid` and `AssessmentGrid` may have focus traps because both grids re-render on every cell change | 2.4.3 | 🟡 Major | Audit grids individually. Ensure cells use `tabindex={-1}` for non-active and `tabindex={0}` for active, with arrow-key navigation between cells (a11y grid pattern). |

### 2.2 Visible Focus (WCAG 2.4.7)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| O6 | shadcn `button` and `input` primitives have `focus-visible:ring-3 focus-visible:ring-ring/50` — good. **But** every component using inline `style={{}}` instead of the primitives (sidebar, NewClaimDialog buttons, AdminDashboard buttons, dashboard CTAs) has **no focus indicator at all** — the inline styles override the default outline and don't add a replacement. | 2.4.7 | 🔴 **Critical** | This is the single highest-impact fix on the keyboard side. Either (a) migrate all custom buttons to `<Button>` from `ui/button.tsx`, or (b) add `focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none` to every custom button class. |
| O7 | `--ring` token is gold (`#D4AF37`). On light backgrounds, gold ring may not have 3:1 against the field — verify | 2.4.7, 1.4.11 | 🟡 Major | Test gold ring against `--background` and `--card`. If it fails, add a subtle dark outer ring shadow as well: `focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background`. |

### 2.3 Touch Target Size (WCAG 2.5.5 — AAA, but mandatory in field/mobile context)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| O8 | `Button` size variants: `xs` = h-6 (24px), `sm` = h-7 (28px), `default` = h-8 (32px), `lg` = h-9 (36px). **All fail 44×44**. | 2.5.5 | 🟡 Major (🔴 in field context) | This is a deliberate design choice for desktop density, but the app runs on mobile in the field. Either: (a) add a `mobile-touch:` class that bumps all buttons to h-11 (44px) on `<sm` breakpoints, or (b) on mobile views, default to `lg` size and reserve `xs`/`sm` for desktop. |
| O9 | Sidebar collapse toggle is `w-6 h-6` (24×24) — only desktop, but still under target | 2.5.5 | 🟢 Minor | Increase to 32×32. |
| O10 | "Archive" button in `ArchiveFirstScreen` is `px-3 py-1.5` text-xs — likely <44px on mobile | 2.5.5 | 🟡 Major | Use `<Button size="default">` or larger. |

### 2.4 Skip Link & Landmarks (WCAG 2.4.1)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| O11 | No skip-to-content link on any page | 2.4.1 | 🟢 Minor | Add `<a href="#main" className="sr-only focus:not-sr-only…">Skip to main content</a>` as the first focusable element in `app/layout.tsx`. The dashboard sidebar has 17 nav items — keyboard users have to tab through all of them to reach content. |
| O12 | `<main>` element exists on landing — good. Need to verify dashboard root has `<main>` and tab content has matching landmarks. | 2.4.1 | 🟢 Minor | Wrap `Dashboard.tsx` content in `<main id="main" tabIndex={-1}>` so the skip link target works. |

---

## 3. Understandable

### 3.1 Predictable on Focus (WCAG 3.2.1, 3.2.2)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| U1 | Sidebar items are `<a href="?tab=...">` with `e.preventDefault()` — middle-click and right-click work, but URL changes silently. This is fine. **However**, the `landing` item navigates to `/` via `window.location.href` instead of Next.js router — this causes a full page reload which is unexpected | 3.2.4 | 🟢 Minor | Use `useRouter().push('/')` instead of `window.location.href`. |

### 3.2 Error Identification (WCAG 3.3.1, 3.3.3)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| U2 | `LoginForm` error message uses a regular `<p>` — not announced to screen readers when it appears | 3.3.1, 4.1.3 | 🔴 **Critical** | Wrap in `<div role="alert" aria-live="assertive">`. Same fix needed for any form-level error throughout the app. |
| U3 | Form validation feedback (in claim forms) — verify each field's error has `aria-describedby` linking to an error span with `role="alert"` | 3.3.1, 3.3.3 | 🟡 Major | The `Input` primitive has `aria-invalid` styling but no error-message slot. Build a `<Field>` component that bundles label + input + error message + `aria-describedby` wiring. (Same recommendation as Pass 1's missing-primitives section.) |
| U4 | `toast()` from sonner — verify it sets `aria-live="polite"` correctly. Default sonner config does, but the codebase uses `toast.warning` and `toast.error` for mission-critical messages (e.g., "You have N unresolved AI data discrepancies"). Verify these don't auto-dismiss before SR can read. | 3.3.1, 4.1.3 | 🟡 Major | Set `duration: Infinity` for warning/error toasts that require user action; keep info toasts at 4–5 seconds. |

### 3.3 Labels & Instructions (WCAG 3.3.2)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| U5 | Claim forms (`AccidentForm`, `VehicleForm`, `PolicyForm`, `DriverForm`) — **73 `htmlFor=` instances across 7 files**. ✅ Forms are properly labeled. | 3.3.2 | ✅ Pass | No action. This is a bright spot. |
| U6 | Search inputs in `AdminDashboard` and elsewhere — verify `<input placeholder="Search…">` has an associated `<label>` (placeholder is not a label) | 3.3.2 | 🟡 Major | Add `aria-label="Search claims"` to bare search inputs. |
| U7 | Sidebar quick-action icon buttons ("New Claim" with collapsed icon, "Open Claim" folder icon) — only `title` attribute. | 3.3.2, 4.1.2 | 🔴 **Critical** | Add `aria-label` to every icon-only button. The current `title` is not a substitute. |
| U8 | Mobile menu button has no `aria-label` and no `aria-expanded` | 3.3.2, 4.1.2 | 🟡 Major | `<button aria-label="Open navigation menu" aria-expanded={open} aria-controls="sidebar">`. |

---

## 4. Robust

### 4.1 Name, Role, Value (WCAG 4.1.2, 4.1.3)

| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| R1 | **Only 8 ARIA attribute usages exist across the entire `src/components/**` tree** (excluding the bundled shadcn primitives in `ui/*`). Sidebar nav, dialogs, tabs, dashboard cards, status indicators, save status bar — none expose programmatic state. | 4.1.2 | 🔴 **Critical** | Systemic fix: each issue listed in this audit names a specific ARIA attribute to add. Tackling them in priority order will lift this number from ~8 to ~80. |
| R2 | Loading buttons (Login, NewClaim Save, every async action) show `<Loader2 className="animate-spin" />` but do not set `aria-busy="true"` on the parent button or read out a status | 4.1.2, 4.1.3 | 🟡 Major | When loading, set `aria-busy="true"` and replace the button text with visually hidden text: `<span className="sr-only">Signing in…</span>`. |
| R3 | `<Tabs>` primitive — verify it implements the WAI-ARIA tabs pattern (role="tablist", role="tab", aria-selected, arrow-key nav) | 4.1.2 | 🟡 Major | shadcn's tabs primitive does this correctly out of the box; just confirm the wrapper isn't replacing the `role`. |
| R4 | `<Sheet>` primitive — verify focus trap + role=dialog | 4.1.2 | 🟢 Minor | shadcn correct by default; confirm. |

---

## 5. Color Contrast Detail (computed)

| Pair | Ratio | Required (AA) | Pass? |
|---|---:|---:|---|
| `#0D1B2A` on `#FFFFFF` | 17.24:1 | 4.5:1 | ✅ |
| `#0D1B2A` on `#F8F9FA` | 16.85:1 | 4.5:1 | ✅ |
| `#4A4E69` on `#FFFFFF` | 7.64:1 | 4.5:1 | ✅ |
| `#4A4E69` on `#F8F9FA` | 7.46:1 | 4.5:1 | ✅ |
| `#8D99AE` on `#FFFFFF` | **3.20:1** | 4.5:1 | 🔴 |
| `#8D99AE` on `#F8F9FA` | **3.13:1** | 4.5:1 | 🔴 |
| `#D4AF37` on `#FFFFFF` | **2.18:1** | 4.5:1 | 🔴 (text) |
| `#D4AF37` on `#0D1B2A` | 7.91:1 | 4.5:1 | ✅ |
| `#0D1B2A` on `#D4AF37` (gold button text) | 7.91:1 | 4.5:1 | ✅ |
| `#E2E6EA` border on `#FFFFFF` | **1.13:1** | 3:1 (UI) | 🔴 |
| `#FFFFFF` on `#0D1B2A` (sidebar) | 17.24:1 | 4.5:1 | ✅ |
| `#E8ECF0` on `#0D1B2A` (sidebar foreground) | 14.23:1 | 4.5:1 | ✅ |
| `text-gray-400` (`#9CA3AF`) on `#FFFFFF` | **2.85:1** | 4.5:1 | 🔴 |
| `text-gray-500` (`#6B7280`) on `#FFFFFF` | 4.83:1 | 4.5:1 | ✅ (barely) |

---

## 6. Keyboard Navigation Sample (Sidebar)

| Element | Tab Order | Enter/Space | Escape | Arrow Keys |
|---|---|---|---|---|
| Sidebar collapse toggle | 1 | Toggles | n/a | n/a |
| New Claim button | 2 | Opens dialog | n/a | n/a |
| Open Claim button | 3 | Opens list | n/a | n/a |
| Active claim badge | (skipped, no tabindex) | n/a | n/a | n/a |
| Each nav item (`<a>`) | 4..N | Switches tab | n/a | **Should** support up/down arrows like a real menu — currently doesn't |
| Sign Out button | N+1 | Signs out | n/a | n/a |

**Issues:** No `aria-current` on active item; arrow-key nav not implemented; collapsed-mode tooltips don't appear on focus.

---

## 7. Priority Fixes (top 12, ordered by impact × ease)

| # | Action | Severity | Effort | Why |
|---|---|---|---|---|
| 1 | **Darken `--muted-foreground` from `#8D99AE` to `#5A6577`** in `globals.css` | 🔴 | XS (1-line) | Single change fixes contrast in hundreds of spots. The most cost-efficient a11y fix in the codebase. |
| 2 | **Add global `prefers-reduced-motion` reset in `globals.css`** + replace `framer-motion` `<motion.*>` with `useReducedMotion()`-aware versions on the landing page | 🔴 | M | Eliminates a WCAG 2.3.3 failure that affects every animated screen. |
| 3 | **Migrate 5 custom dialogs to the `Dialog` primitive** (`NewClaimDialog`, `IRDAISummaryDialog`, `BankReconcileDialog`, `InsuredReportReviewDialog`, `AIReviewDialog`) | 🔴 | L | Gives focus trap, escape, role=dialog, aria-modal, scroll-lock — all the things they're missing right now. |
| 4 | **Add `focus-visible` ring to every inline-style button** (or migrate to `<Button>` from primitives) | 🔴 | M | Keyboard users currently get no focus indicator on most CTAs. Pairs nicely with Pass 1 task #1 (codemod hex → tokens). |
| 5 | **Replace `title="…"` with `aria-label` on every icon-only button** (sidebar, dashboard, dialogs) | 🔴 | S | Screen readers don't reliably read `title`. |
| 6 | **Wrap form errors in `role="alert" aria-live="assertive"`** — start with `LoginForm` and propagate to claim forms | 🔴 | S | Errors currently invisible to SR users. |
| 7 | **Add `aria-current="page"` to active sidebar item** | 🟡 | XS | One-line fix, big SR-UX win. |
| 8 | **Build the `<Field>` primitive** that bundles label + input + error + `aria-describedby` wiring (also from Pass 1 §2 missing primitives) | 🟡 | M | Fixes inconsistent error labeling on every form for free. |
| 9 | **Group sidebar sections with `<div role="group" aria-labelledby="…">`** + promote group labels to `<h2>` | 🟡 | S | Makes the 17-item nav navigable by SR landmark. |
| 10 | **Add skip-to-content link** in `app/layout.tsx` | 🟢 | XS | One link, big keyboard-UX win on a 17-item nav. |
| 11 | **Set `aria-busy` + visually-hidden status text on loading buttons** (LoginForm + every async CTA) | 🟡 | S | Currently SR users get "spinning" silence. |
| 12 | **Pause `WorkflowSimulation` auto-cycle on focus + provide manual pause button** | 🟡 | M | Honors WCAG 2.2.2 timing, makes scroll-jacked tour usable for keyboard/reduced-motion users. |

---

## 8. Recommended Sequencing

1. **Quick wins (1 session):** #1 (token darken), #5 (aria-label), #7 (aria-current), #10 (skip link), #11 (aria-busy). Five small fixes, ~20 file touches, big SR-UX uplift.
2. **Motion safety (1 session):** #2 — most-visible improvement for users with vestibular sensitivity; landing page goes from "exhausting" to "calm" for affected users.
3. **Focus indicators (1 session):** #4 — pair with Pass 1's codemod (replace inline-style buttons with `<Button>`) so focus rings come for free.
4. **Dialog migration (1–2 sessions):** #3 — five dialogs, mechanical but each needs verification. Big robustness win.
5. **Form errors + Field primitive (1 session):** #6 + #8 — adds the missing primitive once, retrofits forms incrementally.
6. **Polish (ongoing):** #9, #12, and the long tail in §1–4 above.

---

## 9. Out of Scope (this pass)

- Manual screen-reader testing (NVDA / VoiceOver / JAWS) — requires a human session
- Manual keyboard-only walkthrough of every claim flow — sampled here, not exhaustive
- Mobile a11y testing on iOS / Android with TalkBack / VoiceOver
- WCAG 2.2 additions (focus appearance §2.4.11, dragging §2.5.7, target size minimum §2.5.8)
- Cognitive load / plain-language audit for insureds (overlaps with Pass 3 — copy)
- Lighthouse / axe-core automated scan (would catch ~30% of these issues; recommend adding to CI as follow-up plan)

---

## 10. Open Questions for You

1. **Field-use vs desktop-density tradeoff**: Touch targets default to 24–36px to fit dense forms. Are surveyors using this on mobile in the field, or always desktop? If mobile, we need a per-breakpoint size strategy (#8 above).
2. **Insured-facing screens vs surveyor-facing**: Cognitive accessibility is much higher stakes for insureds (claimants under stress reading a claim summary) than for surveyors (trained operators). Should `InsuredReport` get a stricter a11y bar — plain language, larger type, fewer color cues — than the rest?
3. **Marketing motion vs core app motion**: The landing-page motion is part of the brand pitch. Are you OK reducing it to a single hero animation + static screenshots when reduced-motion is set, or do you want the simulation to remain as a key marketing asset (with a manual "Play" button)?
4. **Toast severity gating**: Should `toast.error` and `toast.warning` be `duration: Infinity` (require dismiss) or kept short? Affects U4 above.

These don't block Pass 3.
