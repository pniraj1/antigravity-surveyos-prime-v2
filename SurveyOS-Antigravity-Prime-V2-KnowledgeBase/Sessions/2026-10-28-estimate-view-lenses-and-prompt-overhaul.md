# Session Log: Estimate View Lenses, Prompt Overhaul & Lean Header

**Date:** 2026-10-28  
**Agent:** Antigravity  
**Branch:** `main` (committed on `main` directly)  

---

## 1. Goal
1. Overhaul the estimate/bill extraction prompts (`src/lib/ai/prompts.ts`) using a "Footer-First Deductive Reconciliation" algorithm so tax-inclusive and tax-exclusive quotations (e.g. Pawar, Dhanashree, Schwing Stetter) are correctly classified without blind `÷ 1.18` division errors.
2. Provide surveyor feedback in `AIReviewDialog` with a dedicated Audit Card (tax posture badge, detected columns, reconciliation notes, warnings).
3. Support multi-estimate continuation and batch workflows:
   - Auto-derive and persist `estimateId` on `AssessmentRow` in `buildEstimateRows()`.
   - Add Estimate View Switcher lens and Tally Banner above the assessment grid to filter by quotation without altering the underlying flat assessment rows or reports.
   - Add visual left-border color accents to rows when viewing all estimates to easily differentiate items from different quotations.
4. Lean UI Overhaul: Streamline the Assessment tab header into a lean ~36px toolbar, converting Policy Depreciation into an inline selector and Policy Check into a compact popover chip, recovering >200px of vertical table space.

---

## 2. Key Changes & Architecture

### A. Prompt & Reconciliation Overhaul (`src/lib/ai/prompts.ts`)
- Replaced rigid blind `÷ 1.18` division rule with a 3-step footer-reconciliation process:
  1. Footers first: compare `Subtotal + Taxes` to `Grand Total`. If they match, item amounts are taxable base; if item amounts sum to Grand Total directly, amounts are gross inclusive.
  2. Extracts complete assessment fields: `sr_no`, `description`, `part_number`, `hsn_sac`, `quantity`, `unit_price`, `taxable_amount`, `gst_percent`, `total_amount`, `category` (including `rubber` & `fiberglass`).
  3. Returns `_audit` envelope with `tax_posture`, `columns_detected`, `reconciliation_note`, and `warnings`.

### B. AI Review Dialog Feedback (`src/components/dialogs/AIReviewDialog.tsx` & `src/lib/ai/row-check.ts`)
- Added `AuditCard` displaying tax posture badge (`EXCLUSIVE`, `INCLUSIVE`, `UNKNOWN`), detected columns, reconciliation notes, and warnings.
- `stripPageTags()` removes `_audit` so it is never saved to claim storage or Firestore.

### C. Estimate Tracking (`src/types/assessment.ts` & `src/stores/slices/aiDataSlice.ts`)
- Added `estimateId?: string` to `AssessmentRow`.
- `buildEstimateRows()` derives `estimateId` from `workshop_name + estimate_number + estimate_date` and attaches it to parts, labour, and paint rows.

### D. Lean Assessment Tab Header (`src/components/tabs/AssessmentTab.tsx` & `PolicyCheckStrip.tsx`)
- Collapsed 3-story stacked controls (~280px height) into a compact, single-row 36px toolbar.
- Integrated `PolicyCheckStrip` as a compact pill chip (`Policy checked` / `Policy check: 2 of 4 [⚠️ 1]`) with a floating popover overlay (`PolicyCheckCard`), eliminating layout shifts and saving >200px vertical space.

### E. Estimate View Switcher & Tally Banner (`src/components/claim/EstimateViewSwitcher.tsx` & `EstimateTallyBanner.tsx`)
- Pure display-layer lens: computes unique `estimateId`s. When 2+ distinct estimates exist, renders segmented view pills `[ All (N) ] [ Vendor A (X) ] [ Vendor B (Y) ]`.
- Live tally banner displays taxable base, estimated GST, and gross total for the selected quotation to tally against printed physical documents.

### F. Multi-Estimate Visual Differentiation (`src/components/claim/AssessmentSectionTable.tsx`)
- Applied rotating left border color accents (`border-l-4 border-l-blue-500`, `border-l-purple-500`, etc.) when viewing all rows with multiple estimates, giving surveyors an instant visual clue of each row's origin.

---

## 3. Files Created & Modified
- Created: `src/components/claim/EstimateViewSwitcher.tsx`
- Created: `src/components/claim/EstimateTallyBanner.tsx`
- Created: `src/lib/ai/__tests__/prompts-estimate.test.ts`
- Created: `src/components/dialogs/__tests__/ai-review-audit.test.tsx`
- Created: `src/stores/slices/__tests__/estimate-tag.test.ts`
- Created: `src/components/claim/__tests__/EstimateViewSwitcher.test.tsx`
- Created: `src/components/claim/__tests__/estimate-row-accent.test.tsx`
- Modified: `src/lib/ai/prompts.ts`
- Modified: `src/lib/ai/row-check.ts`
- Modified: `src/components/dialogs/AIReviewDialog.tsx`
- Modified: `src/types/assessment.ts`
- Modified: `src/stores/slices/aiDataSlice.ts`
- Modified: `src/components/tabs/AssessmentTab.tsx`
- Modified: `src/components/policy/PolicyCheckStrip.tsx`
- Modified: `src/components/claim/AssessmentGrid.tsx`
- Modified: `src/components/claim/AssessmentSectionTable.tsx`

---

## 4. Verification & Results
- All unit tests pass:
  - `src/lib/ai/__tests__/prompts-estimate.test.ts` (4 passed)
  - `src/components/dialogs/__tests__/ai-review-audit.test.tsx` (3 passed)
  - `src/stores/slices/__tests__/estimate-tag.test.ts` (2 passed)
  - `src/components/claim/__tests__/EstimateViewSwitcher.test.tsx` (5 passed)
  - `src/components/claim/__tests__/estimate-row-accent.test.tsx` (2 passed)
  - Full suite: 215 test files passed (1,890 tests passed, 1 skipped). Zero regressions.
- Scan impact: None — display-layer view lenses and prompt changes do not affect Scan coupling or schemas.
