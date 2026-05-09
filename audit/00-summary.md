# Audit Summary — Top 10 Cross-Pass Priorities

**Audit date:** 2026-05-07
**Source passes:** [01-design-system.md](01-design-system.md) · [02-accessibility.md](02-accessibility.md) · [03-copy-and-critique.md](03-copy-and-critique.md) · [04-landing-conversion.md](04-landing-conversion.md)

---

## Headline Numbers

| Pass | Findings | Critical | Highlights |
|---|---:|---:|---|
| 1 — Design system | ~10 priorities + dozens of leakage instances | — | 1,277 hardcoded hex strings, 245 arbitrary `bg-[#…]` classes, 6 missing primitives, score **42/100** |
| 2 — Accessibility (WCAG 2.1 AA) | 31 | 9 | `--muted-foreground` fails contrast; only 8 ARIA usages exist app-wide; zero reduced-motion handling |
| 3 — UX copy + critique | 46 | — | 11 same-concept-multiple-name terminology drifts; save-toast labyrinth (6 strings for one mental action) |
| 4 — Landing conversion + brand | 41 | 7 | 6 different CTA labels for one action; trust signals buried; footer below legal minimum |
| **Total** | **~120** | **16+ critical** | |

---

## Top 10 Highest-Leverage Fixes (impact × ease)

The order below is what I'd ship first if I were running this. Each entry links to the detailed finding and includes effort estimate.

### 1. Fix the legal footer 🔴
**Pass 4 §7 (FT1–FT4)** · **Effort: M** · **Compliance gate**

Current footer is one line: `© 2026 SurveyOS Prime. Engineered for Surveyors.` For an Indian SaaS taking paid plans, this is below legal minimum. Add: Privacy Policy, Terms of Service, Refund Policy, Contact email, registered business address.

**Why first:** Cannot run any further marketing spend or paid acquisition without this. Pure compliance.

---

### 2. Verify and rewrite unsubstantiated claims 🔴
**Pass 4 §6 (L1–L4)** · **Effort: XS** · **Compliance + trust**

Three landing-page claims need attention:
- **"Flawless OCR"** → use your already-qualified "99.9% accuracy on clear scans" everywhere.
- **"Join thousands of surveyors"** → drop until you can substantiate, or replace with a real number.
- **"We literally cannot see your files"** → verify against your Firestore-backed architecture. If Firestore stores any claim metadata, the absolute claim is false. Recommend: **"We don't store your photos or documents."**

**Why first:** Zero engineering effort, removes consumer-protection risk, and forces a useful internal conversation about your actual data architecture.

---

### 3. Codemod hardcoded colors → tokens + ban arbitrary hex classes 🟡
**Pass 1 §7 (#1, #2)** · **Effort: M (1 session)** · **Foundation for everything else**

245 arbitrary `bg-[#xxx]` Tailwind classes across 12 in-app components. Every value maps 1:1 to an existing token. Run a codemod, then add an ESLint rule banning `bg-[#…]` / `text-[#…]` / `border-[#…]` in `src/components/**` (excluding `pdf/*` and `print/*`).

**Why now:** Pairs with #4, #5, #6 below — they all benefit from a token-clean component layer.

---

### 4. Darken `--muted-foreground` 🔴
**Pass 2 §1 (C1)** · **Effort: XS (1 line)** · **Highest a11y ROI in the codebase**

Change `--muted-foreground` from `#8D99AE` (3.20:1 contrast on white — fails WCAG AA) to `#5A6577` (7:1, AAA-grade). Single line in `globals.css`. Lifts hundreds of pieces of body text out of failing contrast in one change.

---

### 5. Migrate 5 custom dialogs to the `Dialog` primitive 🔴
**Pass 2 §2 (O1)** · **Effort: L** · **Massive a11y + UX dividend**

`NewClaimDialog`, `IRDAISummaryDialog`, `BankReconcileDialog`, `InsuredReportReviewDialog`, `AIReviewDialog` all use a raw `<div>` overlay. No focus trap, no Escape-to-close, no `role="dialog"`, no `aria-modal`. The shadcn `Dialog` primitive in `src/components/ui/dialog.tsx` gives all of this for free.

**Why now:** 5 mechanical migrations, each verifiable independently. Pairs nicely with Pass 3's copy fixes for these same dialogs.

---

### 6. Add `prefers-reduced-motion` global reset + motion-safe wrapping 🔴
**Pass 2 §1 (P10)** · **Effort: M** · **WCAG 2.3.3 + brand polish**

Zero reduced-motion handling exists anywhere. The landing page has infinite `animate-ping`, infinite `Cpu` rotation, scroll-jacked simulation, infinite encryption laser, and global `*` transition. Two-step fix:
1. Global CSS reset: `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:0.01ms!important; transition-duration:0.01ms!important; } }`
2. Wrap framer-motion in `useReducedMotion()` on landing for a calmer fallback.

---

### 7. Unify CTAs to 2 labels across landing 🔴
**Pass 4 §1** · **Effort: S** · **Highest landing conversion lift**

Replace 6 CTA labels with 2:
- Signed-out → **"Start free trial"** (primary), **"Watch demo"** / **"Sign in"** (secondary)
- Signed-in → **"Open SurveyOS"**

Pure copy change, ~10 spots.

---

### 8. Write the terminology glossary + start the voice migration 🟡
**Pass 3 §1 + §6** · **Effort: S (glossary) + rolling (migration)** · **Foundation**

Create `docs/copy/glossary.md` from Pass 3 §1 and Pass 4 §11. The 11 same-concept-multiple-name drifts (Cloud Vault / Drive / Cloud Linked / Drive Unlinked / Not Linked) are all symptoms of a missing glossary. Once the glossary exists, voice migration is a string-replace exercise.

**Why now:** Cheap to write, prevents future drift, makes every subsequent copy task ~3× faster.

---

### 9. Collapse the save-toast matrix from 6 strings to 3 🟡
**Pass 3 §5** · **Effort: S** · **Most-frequent UX paper-cut**

The user does one action ("save"). They get 6 different sentences mentioning two systems they can't tell apart. Replace with:
- Save OK → **"Saved."**
- Save OK + photos uploaded → **"Saved. N photo(s) uploaded."**
- Save failed → **"Couldn't save. Your changes are safe locally."**

Long-tail edge cases (queued, expired, not-linked) live in the persistent status bar, not the toast.

**Why now:** Touches `ClaimHeader.tsx` + `SaveStatusBar.tsx` only; verifiable in 5 minutes.

---

### 10. Build the missing primitives — `Field`, `EmptyState`, `StatTile`, `SectionHeader`, `StatusPill`, `AIField` 🟡
**Pass 1 §2 + Pass 2 §3 (U3) + Pass 3 §3** · **Effort: L** · **Compounds across audit**

Six primitives are inlined on every screen and account for ~40% of the leakage in Pass 1, the form-error a11y gap in Pass 2, and the missing-empty-states problem in Pass 3. Building them once retrofits everywhere.

**Why now:** Highest *long-term* ROI on the list. Schedule after #1–#9 land so the new primitives are token-clean and a11y-correct from day one.

---

## Sequencing Plan (5 sprints)

| Sprint | Theme | Items | Outcome |
|---|---|---|---|
| **Sprint 1** | Compliance + critical claims | #1, #2 | Legal floor met; ad spend safe to ramp. |
| **Sprint 2** | Token + contrast foundation | #3, #4 | Component layer is token-clean; body text passes WCAG AA. |
| **Sprint 3** | A11y critical path | #5, #6 | Dialogs accessible; reduced-motion respected. |
| **Sprint 4** | Voice + landing conversion | #7, #8, #9 | Single voice across product; landing CTAs unified; toasts simplified. |
| **Sprint 5** | Primitives sprint | #10 | New primitives in place; consumers refactored screen-by-screen. |

Each sprint is roughly one focused session. Items #1–#9 should land within 2 weeks if prioritized; #10 is structural and benefits from being last.

---

## What's NOT in the top 10 (but worth doing eventually)

| Item | Pass | Why it didn't make top 10 |
|---|---|---|
| Add skip-to-content link | Pass 2 (O11) | XS effort, real benefit, but lower visibility than the contrast fix |
| Sidebar `aria-current` + landmark labels | Pass 2 (P5–P8) | Bundled into the broader a11y work — do alongside #5/#6 |
| Hide disabled nav items until claim exists | Pass 3 §7.1 | High UX value, but waits on the empty-state primitive (#10) |
| FAQ section on landing | Pass 4 §4 (I4) | Content-heavy task; do once core funnel is clean |
| Lighthouse + SEO meta audit | Pass 4 §8 | Belongs in a separate dedicated SEO plan (`marketing:seo-audit`) |
| Tokenize shadow + typography scale | Pass 1 §7 (#8, #9) | Lower-frequency leakage; pair with #10 primitives sprint |
| Strip dead `dark:` classes from primitives | Pass 1 §4 | Confusion only — bundle with primitive cleanup |
| User-research with surveyors | Plan §10 (out of scope) | High value, separate plan |

---

## Open Questions (consolidated across passes)

These don't block any sprint but will sharpen implementations:

1. **Light-only theme — permanent?** (Pass 1 §10 q1) → Determines whether to strip `dark:` classes.
2. **Brand-token spelling: `bg-navy` or `bg-foreground`?** (Pass 1 §10 q2) → Determines codemod target.
3. **PDF token migration scope?** (Pass 1 §10 q3) → Touch 12 files now, or freeze brand and migrate later?
4. **Field-use vs. desktop-density tradeoff for touch targets?** (Pass 2 §10 q1) → Determines breakpoint strategy.
5. **Insured Report audience — surveyor or insured?** (Pass 2 §10 q2 + Pass 3 §12 q1) → Determines voice/cognitive-load bar.
6. **Marketing-motion vs. core-app-motion gating?** (Pass 2 §10 q3) → How aggressively to dial back animations on `prefers-reduced-motion`.
7. **Toast severity gating — auto-dismiss or persistent?** (Pass 2 §10 q4) → Determines toast lifecycle.
8. **Autosave vs. manual save?** (Pass 3 §12 q2) → Determines whether to elevate or hide manual Save.
9. **Drop "Cloud Vault" from user copy?** (Pass 3 §12 q3) → Determines toast and status-bar copy.
10. **Voice direction — Stripe-adjacent / Mailchimp-warm / Aesop-luxe / Notion-playful?** (Pass 3 §12 q4) → Determines glossary tone.
11. **Version pill, "V2 · Executive", "Surveyor" tags — real or placeholder?** (Pass 3 §12 q5) → Determines what to keep in sidebar.
12. **Firestore = third-party storage?** (Pass 4 §14 q1) → Determines whether "we cannot see your files" is true as written.
13. **Real surveyor count + testimonial permission?** (Pass 4 §14 q2) → Determines trust-signal strategy.
14. **IRDAI / regulatory positioning?** (Pass 4 §14 q3) → Determines hero positioning + footer.
15. **Pro card vs Free Trial card — same action or different flow?** (Pass 4 §14 q4) → Determines pricing CTA semantics.
16. **Free trial auto-convert behavior?** (Pass 4 §14 q5) → Disclosure copy + FAQ content.
17. **Custom domain for support email?** (Pass 4 §14 q6) → Brand polish.

---

## How to Use This Audit

- **Each individual pass** is a self-contained findings document — share with team-leads by audit area.
- **This summary** is the executive view — share with stakeholders deciding what to ship next quarter.
- **Each priority item** above maps to a specific implementation plan that should be written *separately* (with TDD + verification workflow) when you're ready to execute. The audit is the deliverable; the plans + code are next.
- **Open questions** should be answered before kicking off the relevant sprint. Where I had a recommendation, I gave one — but these are calls only you can make.

I'd recommend starting Sprint 1 (legal + claim cleanup) immediately and answering questions 12–14 in parallel since they share an internal data-architecture conversation.
