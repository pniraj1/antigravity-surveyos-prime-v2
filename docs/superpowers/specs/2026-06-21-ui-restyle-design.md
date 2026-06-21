# SurveyOS Prime — UI Restyle Design Spec

- **Date:** 2026-06-21
- **Author:** Claude (CTO advisory session)
- **Status:** Draft — awaiting user review
- **Scope:** Presentation-only restyle of the app (Phases 0–5). Navigation/IA restructure is a separate, later spec.
- **Related:** [UI_Refactor_Guardrails.md](../../../SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Architecture/UI_Refactor_Guardrails.md)

---

## 1. Summary

SurveyOS Prime is functional but feels "confusing and not streamlined." The root cause is not bad taste — it's that a clean design-token system exists in `globals.css` but is **bypassed** across the app by inline hardcoded hex and a "luxury showroom" visual language (900-weight type, uppercase micro-labels, many competing accent colours, gradients/glows/3-D) that fights a tool people use for hours a day.

This spec defines a **presentation-only restyle**: adopt and enforce one calm, token-driven design system — the restrained aesthetic the user liked in the inline mockups — migrated **screen-by-screen** with **zero changes** to business logic, routing, data, or report output. Each step ships independently and is reversible.

Restructuring navigation/information-architecture is explicitly **out of scope** here and deferred to its own spec (§12), because it carries adoption risk and needs a dedicated IA design pass.

## 2. Problem statement (grounded in code)

- **Tokens defined but ignored.** `globals.css` defines `--primary`, `--card`, `--border`, `--muted-foreground`, etc., but `Dashboard.tsx` and `sidebar.tsx` hardcode raw hex hundreds of times. The same colour is expressed two ways (`text-muted-foreground` vs `style={{color:'#8D99AE'}}`), and six near-identical greys are used interchangeably (`#F0F2F5` `#F8F9FA` `#FAFAFA` `#FAFBFC` `#E2E6EA` `#E8ECF0`).
- **No typographic hierarchy.** `font-black` (900) on headings, stat numbers, table headers, badges, buttons *and* 9–10px micro-labels, plus `UPPERCASE` + wide tracking. Everything shouts, so nothing leads. Text drops to `text-[8px]`.
- **Too many accent colours.** Gold, amber, green, red, slate, indigo fire simultaneously; stage badges use five colour schemes; each badge is a bg-tint + border + coloured-text trio.
- **Daily-tool dazzle.** Gradient hero with blurred "gold orbs" carrying marketing copy *inside the app*, `.btn-gold` shine, glowing shadows, and a `.transform-3d-dashboard` 3-D tilt.
- **Two UI vocabularies.** shadcn/ui primitives exist but the shell hand-rolls buttons, inputs, badges, and modals with inline styles.
- **Accessibility gaps.** Clickable `<div onClick>` rows (not keyboard-reachable), hover via JS style mutation (no focus states), colour-only status encoding, borderline-contrast greys.

## 3. Goals / Non-goals

**Goals**
- One enforced design system (colour, type, spacing, radius) used everywhere in the app shell + tabs/forms.
- A calmer, more legible, more scannable UI that reduces cognitive load for daily use.
- Standardise on a single component vocabulary (shadcn/ui + a few app components).
- Fix the accessibility basics (real interactive elements, focus states, contrast, touch targets).

**Non-goals (this spec)**
- **No** navigation/IA restructure (tab grouping, stepper, dashboard reorg) — separate spec.
- **No** changes to report renderers (`components/pdf`, `components/print`, `lib/reports`) or any business logic / calculations / data shapes — **except** the single dashboard fee toggle in §7.2, which reuses an existing save path.
- **No** dark mode now (the token system will make it possible later; the app currently forces light).
- **No** AI copilot/autopilot work (separate track).

## 4. Design principles (the north star)

1. **Flat surfaces** — solid fills, hairline borders, no gradients/glows/3-D in the app.
2. **Two font weights only** — 400 regular, 500 medium. No 900/`font-black`.
3. **Sentence case** — uppercase reserved for genuine micro-labels, used sparingly.
4. **One accent** — gold for primary actions and the active state only; everything else neutral.
5. **Token-driven** — no raw hex in components; all colour/space/radius from tokens.
6. **Restraint & whitespace** — let space, not colour, create structure.
7. **Legibility floor** — no text below 12px; meet WCAG AA contrast.

## 5. The design system (foundation)

These are proposed defaults to lock in Phase 1; exact values can be tuned during implementation. The brand (navy ink + platinum surface + gold accent) is retained — just disciplined.

### 5.1 Colour

- **Neutral ramp (collapses the six greys):**
  - `neutral-50 #F8F9FA` (page bg) · `neutral-100 #F0F2F5` (surface/hover) · `neutral-200 #E2E6EA` (border) · `neutral-400 #8D99AE` (icons/hints) · `neutral-600 #4A4E69` (body text) · `neutral-900 #0D1B2A` (headings/ink).
- **Accent:** `gold #D4AF37` — primary buttons + active nav/state **only**.
- **Semantics (one text shade + one tint bg each, not trios):** success `#0F7A3D`, warning `#9A6A00`, danger `#C0392B`.
- **Surfaces:** card `#FFFFFF`, border `neutral-200`. Map all to the existing `--*` tokens so components consume `bg-card`, `text-muted-foreground`, `border-border`, etc.

### 5.2 Typography

- Weights: **400 / 500 only.**
- Scale (sentence case): page title 22/500 · section 16/500 · body 14/400 · label 12/500 · caption 12/400.
- Uppercase only for short group labels, sparingly; never below 12px.

### 5.3 Radius / borders / spacing / shadows

- Radius: `sm 6px · md 8px · lg 12px` (cards = lg, controls = md, pills = full). Retire the 2xl/3xl/4xl sprawl from app surfaces.
- Borders: `1px solid var(--border)`; emphasis border one step darker.
- Shadows: at most one subtle elevation for raised cards; no glows.
- Spacing: 4px base rhythm (4/8/12/16/24/32).

### 5.4 Decoration policy

Gradients, gold-shine, mesh, and 3-D tilt are **landing-page only**. Remove them from app surfaces. (`.ai-filled` is currently unused; the AI-filled-field affordance, if reintroduced, uses a 3px gold left-border + faint tint via token.)

## 6. Component vocabulary

- **Standardise on shadcn/ui:** `Button`, `Input`, `Select`, `Textarea`, `Dialog`, `Card`, `Badge`, `Table`, `Label`, `Separator`.
- **Replace hand-rolled UI:** the inline-styled buttons/inputs and the hand-built archive/delete modals (`fixed inset-0`) → shadcn `Button` / `Dialog`.
- **Add canonical app components (token-driven):** `SectionHeader`, `StatCard`, `StatusBadge`, `StageBadge`, `FormField`, `EmptyState`. One source of truth each; screens stop reinventing them.

## 7. Phased rollout

| Phase | Goal | Scope / deliverable |
|---|---|---|
| **0 — Baseline** | Safety net + sizing | Capture before-state screenshots of every screen (reuse Puppeteer + `/screenshots`); grep-count inline `style={{`/hex to size the work. |
| **1 — Tokens** | Single source of truth | Finalise neutral ramp, accent, semantics, type scale, radius/spacing in `globals.css`. No visible change yet. |
| **2 — Primitives** | One vocabulary | Adopt shadcn primitives; build `SectionHeader`/`StatCard`/`StatusBadge`/`StageBadge`/`FormField`/`EmptyState`. |
| **3 — Migrate (bulk)** | Apply the system | Per screen, in order: **(1) shell/sidebar (incl. Drive status) → (2) dashboard → (3) all claim + output tabs: Documents, AI Review, Details, Assessment, Bill Check, *Valuation*, Reinspection, Photos, Fees, Insured Report → (4) Report Center *chrome* + Cloud Vault / Drive screens (NOT report renderers) → (5) Profile, Admin.** Replace inline hex with tokens, swap hand-rolled for primitives, calm type/colour, fix a11y. Screenshot-diff each. Every screen is in scope; only the report renderer files (§8) are off-limits. |
| **4 — De-dazzle** | Remove noise | Move gradients/glows/3-D to `/landing` only; normalise radius/spacing/shadow app-wide. |
| **5 — A11y & device** | Quality pass | WCAG AA contrast, keyboard nav + focus order, touch targets, responsive/mobile check. |

Each phase is independently shippable; user-visible value begins in Phase 3.

## 7.1 Cross-cutting surfaces (explicitly in scope)

These span screens and must be handled deliberately during the restyle:

- **Google Drive connection** — the sidebar Drive status indicator, the `DriveGateScreen`, and the Cloud Vault tab are all restyled to the token system. The OAuth connect/refresh **flow and logic stay untouched** (presentation only). A separate known auth/Drive bug (sign-in loop) is tracked in `Tasks.md` and is out of scope here.
- **Live report preview (`FloatingReportPreview`)** — global chrome shown on all tabs except Reports. Restyle its container + controls; keep its trigger logic and the **embedded report rendering untouched** (the preview reflects the off-limits renderers).
- **Report Center visualization** — the Report Center *chrome* (format pickers, action buttons, layout) is restyled; the embedded report preview/output remains the untouched renderer.

## 7.2 Bundled UX quick win — set Fees paid/unpaid from the dashboard

- **Problem (user-reported):** fee paid/unpaid can only be changed inside a claim (Fees tab); the dashboard shows it read-only, forcing the surveyor to open the claim just to mark a fee paid.
- **Change:** make the dashboard Fee badge an inline toggle (paid ⇄ unpaid), settable without opening the claim.
- **Why it's safe:** it reuses the *exact pattern the dashboard already uses* for "mark complete/incomplete" — `getClaim()` → `saveClaim({ ...claim, feePaid: !feePaid })` → post `'CLAIMS_UPDATED'` on `BroadcastChannel('surveyos_claims_sync')`. No new data shape, no calculation change, same persistence path.
- **Scope note:** this is the **one sanctioned functional change** in this otherwise presentation-only spec (see §3). Extending the same inline pattern to other dashboard actions is deferred (YAGNI).

## 8. Guardrails (do not disrupt)

Per the audit, the restyle touches the **app shell + tabs/forms only**. Hard rules:

- **Never edit** `src/components/pdf/*`, `src/components/print/*`, `src/lib/reports/*` (reports are isolated; this keeps them so).
- **Do not change** `AppTab` IDs (URL contract via `useRouteSync`), and do not touch `useRouteSync` (race-guarded; `activeTab` stays non-persisted).
- **Preserve** `BroadcastChannel('surveyos_claims_sync')` + `'CLAIMS_UPDATED'`, and all persistence keys (localStorage `surveyos-ui-storage`, IndexedDB v4, `evidence_*`).
- **Keep** survey-type tab filtering + `requiresClaim` gating, `SubscriptionGuard` logic, `'use client'` + `ssr:false` on tabs, and static-export constraints.
- Presentation only — **no logic, calculation, or data-shape changes.**

## 9. Risk & mitigation

- **Low risk by construction** — presentation-only, incremental, reversible. The dangerous surfaces (reports, routing) are isolated from CSS.
- **Mitigations:** small per-screen PRs; visual screenshot diff vs Phase-0 baseline; run the §10 checklist before each merge; keep the existing vitest suite green.

## 10. Verification & testing

Before merging any UI change:
- [ ] Generate a Final + Spot report (PDF + print preview) — unchanged.
- [ ] Open a claim → reload → same tab + claim restored; Back/Forward works.
- [ ] Create / archive / delete a claim → dashboard updates in another open tab.
- [ ] Spot vs Final vs Valuation show the correct tab set.
- [ ] Subscription readonly / suspended overlays still block editing.
- [ ] `npm run test` (vitest) green; screenshot diff reviewed.

## 11. Cost & resources

- **Effort:** ~10–15 dev-days total; user-visible value from Phase 3 onward (each screen improves as it ships).
- **Infra cost:** $0 — no new services.
- **Libraries:** none new (shadcn/ui, Tailwind, framer-motion already installed). Optional: nothing required.

## 12. Out of scope / future (separate specs)

- **Navigation/IA restructure** — workflow stepper, two-level nav, collapsing the 17 nav items into ~5–7 jobs, dashboard reorg, progressive disclosure in forms, mobile nav pattern. Needs its own IA design pass (map each survey-type journey, prototype nav, plan tab-ID migration/aliases). Considerations captured in this session and the guardrails note.
- **Dark mode** — enabled by the token system; defer.
- **AI copilot / autopilot + 3-lane model layer** — separate track (earlier sessions).

## 13. Decisions (resolved at review, 2026-06-21)

- **Accent:** keep gold, used sparingly (primary actions + active state only).
- **Dark mode:** deferred (the token system enables it later).
- **Migration order:** as written in §7.
- **Scope:** restyle-only now; navigation/IA restructure is a separate spec.

Rationale / original framing:

1. **Accent:** keep gold (used sparingly, for primary actions + active state only) — or shift to a cooler/neutral accent? *Recommendation: keep gold, disciplined.*
2. **Dark mode:** confirm it stays out of scope for now. *Recommendation: yes, defer.*
3. **Migration order:** is shell → dashboard → claim tabs → report chrome → profile/admin the right priority, or should a specific high-traffic tab go first?
4. **Scope confirmation:** restyle-only now, restructure as a separate spec next — confirm.
