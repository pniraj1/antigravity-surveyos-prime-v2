# Estimate Prompt Overhaul, View Lenses & Lean Header — Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 
1. Fix the estimate/final-bill extraction prompt with footer-first tax deduction, full assessment fields, and surveyor audit feedback.
2. Add non-destructive estimate "View Lenses" (vendor filter pills + tally banner + row accent borders) to reconcile multi-vendor continuation estimates.
3. Make the upper section of the Assessment Tab lean and compact (recover ~220px of vertical space eaten by giant headers, multi-row button bars, and floating notice strips).

**Architecture:**
- **Store & Core Tables Unchanged:** `AssessmentRow[]` remains a single flat array grouped by sections (`parts`, `labour`, `paint`).
- **Lean Toolbar UI:** Consolidate the 3-story stacked top area (title + h-12 buttons + AI controls + policy strip) into a single sleek, 36px-height professional toolbar.
- **Estimate View Lenses:** Horizontal segmented tabs inside the grid header to filter rows and render an instant tally reconciliation banner.
- **Robust Prompt Overhaul:** Replace the blind `÷ 1.18` rule with footer reconciliation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand, Vitest.

---

## Decisions from Brainstorming & Ponytail Review

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Keep Gemini Vision as primary extraction engine** | Deterministic PDF coordinate parsing fails on multi-line descriptions, non-linear text streams, and garbled font encodings. |
| D2 | **Reject Chrome built-in AI / `window.ai`** | Most surveyor laptops lack VRAM/NPU for Gemini Nano. |
| D3 | **Fix the prompt, not the engine** | The 1.18-division rule and missing fields are the root cause of inaccurate extraction. |
| D4 | **Footer-first tax posture deduction** | Check `Subtotal + Tax = Grand Total` before deciding if line amounts are exclusive or inclusive. |
| D5 | **`_audit` feedback envelope** | AI reports its column mapping, tax posture decision, and warnings so the surveyor sees WHY, not just WHAT. |
| D6 | **Estimate view lenses are pure UI filters** | `AssessmentRow[]` stays flat. Filtering by vendor is a computed selector, not a data mutation. Reports, exports, and Scan are unaffected. |
| D7 | **Tally banner per estimate** | Each estimate's printed totals are compared against the live sum of its tagged rows with green ✓ / amber ⚠ indicator. |
| D8 | **Ponytail Lean UI Overhaul (Screenshot Review)** | The top area currently consumes ~320px of vertical height. Collapse title, buttons (`h-12` → `h-8/h-9`), policy strip, and AI controls into a single streamlined toolbar to double the visible rows. |

---

## Task 1: Rewrite `RAW_PROMPTS['estimate']` with Footer Deduction & Full Fields

**Files:**
- Modify: [`src/lib/ai/prompts.ts`](file:///c:/Users/Manasi/OneDrive/Desktop/Antigravity%20Surveyor%20V6%20fixed/SurveyOS-Prime-V2/src/lib/ai/prompts.ts) lines 126–184 & 186–224
- Test: `src/lib/ai/__tests__/prompts-estimate.test.ts` (create)

**Step 1: Write unit tests for prompt rules**
- Verify prompt includes `"RECONCILE THE SUMMARY FIRST"`.
- Verify prompt removes blind `total_amount / (1 + gst_percent/100)`.
- Verify prompt contains `part_number`, `hsn_sac`, `quantity`, `unit_price`, `category` (including `rubber` and `fiberglass`).
- Verify prompt requests `_audit` envelope.

**Step 2: Run test to verify failure**
Run: `npm test src/lib/ai/__tests__/prompts-estimate.test.ts`

**Step 3: Update `RAW_PROMPTS['estimate']` and `RAW_PROMPTS['final-bill']` in `src/lib/ai/prompts.ts`**
Replace rule 4 with the footer deduction logic and include the full schema.

**Step 4: Run test to verify pass**
Run: `npm test src/lib/ai/__tests__/prompts-estimate.test.ts`

**Step 5: Commit**
`git commit -m "feat(ai): rewrite estimate/bill prompts with footer deduction and full assessment fields"`

---

## Task 2: Surface `_audit` in the AI Review Dialog & Strip Before Persisting

**Files:**
- Modify: [`src/components/dialogs/AIReviewDialog.tsx`](file:///c:/Users/Manasi/OneDrive/Desktop/Antigravity%20Surveyor%20V6%20fixed/SurveyOS-Prime-V2/src/components/dialogs/AIReviewDialog.tsx)
- Modify: [`src/lib/ai/row-check.ts`](file:///c:/Users/Manasi/OneDrive/Desktop/Antigravity%20Surveyor%20V6%20fixed/SurveyOS-Prime-V2/src/lib/ai/row-check.ts) (`stripPageTags`)
- Test: `src/components/dialogs/__tests__/ai-review-audit.test.tsx` (create)

**Step 1: Write test for `_audit` display and stripping**
- `AIReviewDialog` shows green/amber badge with detected columns and tax posture.
- `stripPageTags` strips `_audit` so it is never saved into claim store.

**Step 2: Run test to verify failure**
Run: `npm test src/components/dialogs/__tests__/ai-review-audit.test.tsx`

**Step 3: Implement `AuditCard` in `AIReviewDialog` and strip `_audit` in `stripPageTags`**

**Step 4: Run test to verify pass**
Run: `npm test src/components/dialogs/__tests__/ai-review-audit.test.tsx`

**Step 5: Commit**
`git commit -m "feat(ui): display AI audit feedback in review dialog and strip before persistence"`

---

## Task 3: Add `estimateId` Tag to `AssessmentRow`

**Files:**
- Modify: [`src/types/assessment.ts`](file:///c:/Users/Manasi/OneDrive/Desktop/Antigravity%20Surveyor%20V6%20fixed/SurveyOS-Prime-V2/src/types/assessment.ts) line ~123
- Modify: [`src/stores/slices/aiDataSlice.ts`](file:///c:/Users/Manasi/OneDrive/Desktop/Antigravity%20Surveyor%20V6%20fixed/SurveyOS-Prime-V2/src/stores/slices/aiDataSlice.ts) (`buildEstimateRows`, line 742)
- Test: `src/stores/slices/__tests__/estimate-tag.test.ts` (create)

**Step 1: Write test for `estimateId` preservation on rows**
Verify `buildEstimateRows()` sets `estimateId` from incoming data or leaves `undefined` for manual rows.

**Step 2: Run test to verify failure**
Run: `npm test src/stores/slices/__tests__/estimate-tag.test.ts`

**Step 3: Implement `estimateId?: string` in `AssessmentRow` and map in `buildEstimateRows`**

**Step 4: Run test to verify pass**
Run: `npm test src/stores/slices/__tests__/estimate-tag.test.ts && npm test`

**Step 5: Commit**
`git commit -m "feat(assessment): add optional estimateId tag to AssessmentRow for view grouping"`

---

## Task 4: Lean Header & Compact Toolbar Overhaul (Recovering ~220px Vertical Height)

**Files:**
- Modify: [`src/components/tabs/AssessmentTab.tsx`](file:///c:/Users/Manasi/OneDrive/Desktop/Antigravity%20Surveyor%20V6%20fixed/SurveyOS-Prime-V2/src/components/tabs/AssessmentTab.tsx) lines 98–198
- Modify: [`src/components/policy/PolicyCheckStrip.tsx`](file:///c:/Users/Manasi/OneDrive/Desktop/Antigravity%20Surveyor%20V6%20fixed/SurveyOS-Prime-V2/src/components/policy/PolicyCheckStrip.tsx)
- Test: `src/components/tabs/__tests__/AssessmentTabHeader.test.tsx` (create)

**The Ponytail Reductions (Before vs After):**
1. **Outer padding:** Change `p-6 lg:p-8` to `p-3 lg:p-4`.
2. **Title & Subtitle:** Remove the redundant 2-line paragraph ("Build the assessment grid..."). Keep crisp `Assessment` title inline with controls.
3. **Button Heights:** Shrink bloated `h-12` (48px) buttons to compact, ergonomic `h-8` (32px) button bar.
4. **Depreciation Dropdown:** Remove bulky card wrapper (`p-3 bg-card rounded-xl border`); make it a sleek inline badge selector `Policy: [Nil Depreciation ▾]`.
5. **AI Controls:** Consolidate the separate floating card into a single compact pill inline on the toolbar.
6. **Policy Check Strip:** Instead of a full-width stacked block with bullet points eating 50px, collapse into an inline chip directly in the header with a popover for warnings.

**Step 1: Write visual layout test**
Verify all controls (Upload, Fix, Evidence, Summary, Save, Depreciation, AI controls) render in the streamlined single-toolbar container.

**Step 2: Run test to verify failure**
Run: `npm test src/components/tabs/__tests__/AssessmentTabHeader.test.tsx`

**Step 3: Implement lean toolbar in `AssessmentTab.tsx` and compact mode for `PolicyCheckStrip.tsx`**

**Step 4: Run test to verify pass**
Run: `npm test src/components/tabs/__tests__/AssessmentTabHeader.test.tsx`

**Step 5: Commit**
`git commit -m "refactor(ui): streamline Assessment tab header into lean 36px toolbar, recovering vertical space"`

---

## Task 5: Estimate View Switcher & Tally Banner

**Files:**
- Create: `src/components/claim/EstimateViewSwitcher.tsx`
- Create: `src/components/claim/EstimateTallyBanner.tsx`
- Modify: [`src/components/claim/AssessmentGrid.tsx`](file:///c:/Users/Manasi/OneDrive/Desktop/Antigravity%20Surveyor%20V6%20fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentGrid.tsx)
- Test: `src/components/claim/__tests__/EstimateViewSwitcher.test.tsx` (create)

**Step 1: Write component test for view switching and tally calculation**
- Renders pills for "All Estimates", plus one pill per detected estimate batch.
- When 2+ estimates exist, selecting a pill filters displayed rows.
- Renders `EstimateTallyBanner` with green checkmark when grid sum matches printed total, or amber discrepancy badge when mismatched.

**Step 2: Run test to verify failure**
Run: `npm test src/components/claim/__tests__/EstimateViewSwitcher.test.tsx`

**Step 3: Implement `EstimateViewSwitcher` and `EstimateTallyBanner`**
Embed directly in `AssessmentGrid` card header to avoid adding vertical page bloat.

**Step 4: Run test to verify pass**
Run: `npm test src/components/claim/__tests__/EstimateViewSwitcher.test.tsx`

**Step 5: Commit**
`git commit -m "feat(ui): add estimate view switcher and tally banner to assessment grid header"`

---

## Task 6: Visual Row Accent Borders for Multi-Estimate Differentiation

**Files:**
- Modify: `src/components/claim/AssessmentSectionTable.tsx`
- Test: `src/components/claim/__tests__/estimate-row-accent.test.tsx` (create)

**Step 1: Write test for row left-border accenting**
Verify rows receive distinct left-border color classes (`border-l-blue-400`, `border-l-purple-400`, `border-l-amber-400`) based on their `estimateId` only when multiple estimates are present in "All" view.

**Step 2: Run test to verify failure**
Run: `npm test src/components/claim/__tests__/estimate-row-accent.test.tsx`

**Step 3: Implement row accent styling in `AssessmentSectionTable.tsx`**

**Step 4: Run test to verify pass**
Run: `npm test src/components/claim/__tests__/estimate-row-accent.test.tsx`

**Step 5: Commit**
`git commit -m "feat(ui): add visual left-border color accents for multi-estimate row differentiation"`

---

## Task 7: Full Regression Suite Verification

**Files:** None modified. Run only.

**Steps:**
1. Run full test suite:
   ```
   npm test
   ```
2. Verify zero regressions in:
   - Assessment calculations (`src/lib/calculations/__tests__/`)
   - Bill-check reports (`src/lib/reports/__tests__/`)
   - Row-check & Smart Fix (`src/lib/ai/__tests__/`)
   - Store actions and state transitions (`src/stores/slices/__tests__/`)

**Commit:** `test: verify zero regression after prompt overhaul, lean header, and view lenses`
