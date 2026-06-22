# Details Tab Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `DetailsTab` (the claim Details screen chrome) and its inline `InlineEvidencePanel`/`EvidenceIconBtn` subcomponents from raw hex + gradients + heavy font weights to the design-token system, calming the gradient "report number" card — without touching the drag-to-resize, panel persistence, AI extraction, or report-number allocation logic.

**Architecture:** Presentation-only restyle of one file (`src/components/tabs/DetailsTab.tsx`). Replace raw hex (`#0D1B2A`, `#D4AF37`, `#E2E6EA`, `#8D99AE`, `#FAFBFC`, `#F0F2F5`, `#F8F9FA`, `#1e3a5f`), `linear-gradient(...)`, and `rgba(212,175,55,…)`/`rgba(148,163,184,…)` literals with neutral-ramp + status + primary tokens. Drop heavy weights to 400/500. The shared form components (`@/components/claim/*`) are NOT in scope.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript 5 (strict), Tailwind CSS 4, `class-variance-authority`.

## Global Constraints

- **Presentation only.** NO changes to logic, state, persistence, or handlers.
- **DO NOT touch the drag-to-resize logic:** `onMouseDownHandle`, `isDragging`/`dragStartX`/`dragStartWidth`/`containerRef` refs, `panelWidth`/`setPanelWidth`, the `window` mousemove/mouseup listeners, or the deferred `useEffect` persistence. The evidence panel wrapper's `style={{ width: panelWidth, … }}` MUST keep `width: panelWidth` inline (runtime value) — only migrate *colour* there, never the dynamic width/layout.
- **DO NOT change** the localStorage keys (`surveyos-details-evidence-panel-open`, `…-width`), the panel open/close toggle, `useEvidenceStore`, the AI extraction flow (`handleFileChange`, `triggerExtraction`, `confirmApply`, `cancelReview`, `reviewData`, `isProcessing`, `progress`), the report-number allocation (`getNextSpotNumber`/`getNextFinalNumber`, `updateClaim`, `updateSpotDetails`, the `confirm(...)` call, `toast`), or `generateWordReport`.
- **DO NOT change** the form conditionals (`surveyType !== 'valuation'`, `surveyType === 'spot'`) or which child forms render.
- Two font weights only: 400 default, 500 (`font-medium`). Replace every `font-black`/`font-bold`/`font-semibold` with `font-medium` or default.
- One accent: gold (`text-primary`/`bg-primary`) only for the report-number card's icon/badge accent, the AI scan slots, and the processing banner. No accent sprawl.
- No raw hex / `rgba()` / `linear-gradient()` with literal colours left in the file after this plan.
- Keep `'use client'`. Do NOT touch the shared form imports or `@/components/claim/*`, `@/lib/reports/*`.
- NEVER edit `src/components/pdf/*`, `src/components/print/*`, `src/lib/reports/*`.
- Commit directly to main (no new branches).
- Per-task verification: `npm run build` succeeds; the Details tab renders; the evidence panel opens/closes and drag-resizes; report-number auto-allocate works; AI document scan still triggers; Word report button works.

---

## File Structure

- `src/components/tabs/DetailsTab.tsx` — **modify only**. No new files. Tokens already exist in `globals.css` (`--color-neutral-*`, `--color-status-*`, `--primary`).

---

## Task 1: Evidence panel subcomponents → tokens

**Files:**
- Modify: `src/components/tabs/DetailsTab.tsx` — `InlineEvidencePanel` (`~38–126`) and `EvidenceIconBtn` (`~128–138`).

- [ ] **Step 1: Migrate `InlineEvidencePanel` colours and weights**

Keep all logic (`useEvidenceStore`, `effectiveDocType` resolution, `blobEntry`, `isPdf`, the iframe/img/empty branches) byte-identical. Restyle only:
- Outer wrapper `border-[#E2E6EA] bg-[#FAFBFC]` → `border-border bg-[var(--color-neutral-50)]`.
- Header bar `bg-[#0D1B2A]` → `bg-[var(--color-neutral-900)]`; `FileSearch` `text-[#D4AF37]` → `text-primary`; "Evidence Viewer" `text-xs font-semibold text-white` → `text-xs font-medium text-white`; doc-label `text-[#D4AF37]` → `text-primary`.
- "Open in new tab" link `text-[#D4AF37] underline hover:text-amber-300` → `text-primary underline hover:opacity-80`.
- Context snippet box `bg-amber-50 border-amber-200` → `bg-[var(--color-status-warning-tint)] border border-[var(--color-status-warning)]/30`; "EXTRACTED FROM DOCUMENT" label `font-bold text-[#D4AF37]` → `font-medium text-[var(--color-status-warning)]`, sentence case "Extracted from document"; snippet `text-[#0D1B2A]` → `text-[var(--color-neutral-900)]` (keep `font-mono`).
- Empty-state text `text-[#8D99AE]` → `text-[var(--color-neutral-400)]`.
- Footer `border-[#E2E6EA]` → `border-border`; `ChevronRight` `text-[#8D99AE]` → `text-[var(--color-neutral-400)]`; helper span `text-[#8D99AE]` → `text-[var(--color-neutral-400)]`.

- [ ] **Step 2: Migrate `EvidenceIconBtn`**

`text-[#8D99AE] bg-[#F0F2F5] hover:bg-[#E2E6EA] hover:text-[#0D1B2A]` → `text-[var(--color-neutral-400)] bg-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-neutral-900)]`. Keep `onClick`, `title`, `children` untouched.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success, 18 pages.

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/DetailsTab.tsx
git commit -m "refactor(ui): migrate details evidence panel to design tokens"
```

---

## Task 2: DetailsTab chrome — report card, header, slots, drag handle

**Files:**
- Modify: `src/components/tabs/DetailsTab.tsx` — `DetailsTab` body (`~221–417`).

- [ ] **Step 1: Calm the report-number card (flatten gradient, two weights)**

The card `<div>` (`~232–284`): keep the `<input>` `onChange`, the auto-allocate `<button>` `onClick` (with its `confirm(...)`, `getNextSpotNumber`/`getNextFinalNumber`, `updateClaim`, `updateSpotDetails`, `toast`) byte-identical. Restyle only:
- Card wrapper `style={{ background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)', border: '1px solid rgba(212,175,55,0.2)' }}` → remove the inline `style`; use `className="… bg-[var(--color-neutral-900)] border border-primary/20"`.
- Icon wrapper `style={{ background: 'rgba(212,175,55,0.15)' }}` → `className` `bg-primary/15`; `Hash` `style={{ color: '#D4AF37' }}` → `className="text-primary"`.
- Label `style={{ color: 'rgba(212,175,55,0.7)' }}` + `font-bold` → `className="… font-medium text-primary/70"`; keep "{surveyLabel} Report No." text.
- Input `font-black` → `font-medium`; `style={{ color: '#F8F9FA', caretColor: '#D4AF37' }}` → `className` `text-[var(--color-neutral-50)] caret-primary` (keep `bg-transparent`, placeholder classes).
- Auto-allocate button `style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37' }}` → `className` `bg-primary/20 text-primary`; keep `hover:scale-110`.
- Assigned/Pending badge `font-bold` → `font-medium`; `style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}` → `className` `bg-primary/15 text-primary border border-primary/30`.

- [ ] **Step 2: Header, AI slots, processing banner — weights + sentence case**

- Header `<h2>` "Claim Details" `font-bold` → `font-medium`; keep the description paragraph. (Buttons already use the `Button` primitive — leave their logic; labels "Evidence" / "Word Report" → keep, or sentence-case "Word report".)
- AI extraction slots (`~316–337`): these already use `border-primary/20 bg-primary/5 text-primary` tokens — keep colours. Change `font-bold` on "Scan {label}" → `font-medium`. Leave `handleFileChange` and the file input untouched.
- Processing banner (`~339–344`): already `bg-primary text-primary-foreground`. Change `font-bold … uppercase` → `font-medium` (keep uppercase if desired as micro-label, but drop bold). Leave `progress` text logic.

- [ ] **Step 3: Drag handle — JS hover → CSS, colour tokens**

The drag handle (`~358–386`): KEEP `onMouseDown={onMouseDownHandle}` and the outer handle `style` (layout: width 6, cursor col-resize, flex — these are fine as layout inline styles). For the inner visual indicator `<div>`: remove the `onMouseEnter`/`onMouseLeave` JS background mutation; replace the `rgba(148,163,184,0.25)` resting background with a token via className and use CSS hover. Convert the indicator to:

```tsx
<div className="w-[3px] h-10 rounded-full bg-[var(--color-neutral-400)]/30 hover:bg-[var(--color-neutral-400)]/60 transition-colors" />
```

(Keep the parent handle `<div>`'s `onMouseDown`, `title`, and layout `style` as-is — only the inner indicator changes.)

- [ ] **Step 4: Evidence panel wrapper colour (keep dynamic width)**

The right panel wrapper `<div style={{ width: panelWidth, … }}>` (`~390–399`): leave the `style` object intact (it carries the runtime `panelWidth` and layout) — there are no colour literals here, so no change is required. Do NOT convert `width: panelWidth` to a class.

- [ ] **Step 5: Final no-hex check + build**

Run: `npm run build`
Then: `grep -nE "#[0-9A-Fa-f]{6}|rgba\(|linear-gradient\(" src/components/tabs/DetailsTab.tsx` — should return nothing.
Expected: build success; grep empty.

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/DetailsTab.tsx
git commit -m "refactor(ui): calm details report-number card + migrate chrome to tokens"
```

---

## Self-Review

- **Spec coverage:** evidence panel subcomponents → Task 1; report card + header + slots + drag handle → Task 2. Together they remove every raw hex/`rgba`/`linear-gradient` literal and every `font-black/bold/semibold` from `DetailsTab.tsx`.
- **Logic untouched:** every task explicitly preserves drag-to-resize, panel persistence, AI extraction, report-number allocation, and form conditionals. The dynamic `width: panelWidth` inline style is explicitly kept.
- **Placeholder scan:** no TBD/TODO; every step gives exact before/after token mappings and exact commands.
