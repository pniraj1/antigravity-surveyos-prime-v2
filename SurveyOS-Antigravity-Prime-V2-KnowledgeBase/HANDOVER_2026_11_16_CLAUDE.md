# Complete Master Handover to Claude Code — 2026-11-16

> **Date:** 2026-11-16  
> **From:** Google Antigravity  
> **To:** Claude Code  
> **Coverage:** Bill Check Progressive Tallying Cockpit, UI/UX Pro Max Overhaul, Orange Theme System, Modal Dialog Architecture, Surgical In-Header Cleanup, and Production Deployment to `https://surveyos.in`.  
> **Current Repo State:** Branch `main` is clean. 355 Vitest test files (**3,200 tests, 100% green**), `npx tsc --noEmit` clean (**0 errors**), Next.js 16 production build succeeded, deployed to Firebase hosting and live verified via curl.  

---

## 1. Executive Summary: What Was Done & Why

Following owner feedback on 2026-11-16, the Bill Check workflow and UI/UX have been overhauled and deployed:
1. **The Core Grievance:**
   - Previously, matching was either naive token overlap or an all-or-nothing exact-only matcher.
   - The UI attempted to place an inline 4-stage stepper on the page body, replacing the primary spreadsheet grid (`BillCheckGrid`) and using foreign blue/purple gradients alien to SurveyOS.
   - The header had duplicate `[Final bill]` and `[Estimate]` toggle buttons before file selection.
2. **The New Architecture:**
   - **Spreadsheet Grid Kept Pristine:** `BillCheckGrid` remains permanently mounted as the primary workspace. Surveyors never lose sight of their assessment grid.
   - **Dialog 1: Disambiguation & Dropzone (`BillCheckUploadDialog.tsx`):**
     - Clicking the orange **`[Upload Document]`** button opens an accessible modal dialog asking whether the document is a **Final Workshop Bill / Tax Invoice (Recommended)** or a **Repair Estimate / Quotation**.
     - Features drag-and-drop file upload (PDF/images) with full keyboard accessibility (`Enter`/`Space` selection, `Escape` dismissal).
   - **Dialog 2: 4-Stage Reconciliation Modal Wizard (`ReconciliationWizardDialog.tsx`):**
     - Once AI extracts line items, or whenever the surveyor clicks the orange header pill **`[Reconciliation Cockpit (N)]`**, a full-screen modal wizard opens.
     - **Stage 1 (Part Numbers):** Side-by-side exact and normalized part number matching with price delta calculation (`priceDelta = billed - assessed`).
     - **Stage 2 (Name & Cost):** Semantic matching using automotive dictionary (`ORVM` -> mirror, `W/S` -> windshield, `Bonnet` -> hood), directional locks (LH never matches RH), and ±40% price divergence guards.
     - **Stage 3 (Ask AI):** Surveyor-triggered AI matching for ambiguous items only. Plain English reasoning with quoted explanations and Accept/Reject buttons.
     - **Stage 4 (Disallowed Items & Final Tally Matrix):** Segregates workshop-claimed items disallowed at survey with enforced ₹0 liability and audit remark; highlights insurer savings in emerald; flows unmatched workshop lines to the extra items tray.
     - **Apply Button:** Brand Orange **`[Apply to Assessment Grid & Finish]`** syncs data to `currentClaim.assessmentRows`, closes modal, and returns to spreadsheet grid.
3. **100% Brand Orange Theme Compliance:**
   - Brand Orange / Amber (`#F59E0B`, `bg-primary`, `hover:bg-amber-600`), warm amber accents (`#FEF3C7`, `border-amber-300`, `text-amber-900`), and clean white cards on platinum (`#F8F9FA`). All foreign blues/purples purged.
4. **Surgical In-Header Button Removal:**
   - Removed redundant `[Final bill]` and `[Estimate]` toggle buttons from `BillCheckHeader.tsx`. Single prominent `[Upload Document]` button remains.

---

## 2. Production Deployment Status

- **Live URL:** [`https://surveyos.in`](https://surveyos.in) (primary custom domain) / [`https://motorsurveyos-in.web.app`](https://motorsurveyos-in.web.app) (Firebase default)
- **Firebase Project:** `surveyos-v2-antigravity-in`
- **Hosting Site:** `motorsurveyos-in`
- **Verification Performed:**
  - `npm run build` compiled all 25 static pages cleanly with Turbopack.
  - `npx firebase-tools deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in` executed successfully (311 files deployed).
  - Chunk inspection via `curl.exe`: Deployed chunk `_next/static/chunks/02plwitdsi-70.js` returns HTTP 200 containing `Upload Document (Final Bill or Estimate)` and `Reconciliation Cockpit`.

---

## 3. Key Source Files & Where Logic Lives

| File | Purpose |
|---|---|
| `src/components/dialogs/BillCheckUploadDialog.tsx` | Modal dialog for document type selection (Final Bill vs Estimate) + drag & drop file upload. |
| `src/components/dialogs/ReconciliationWizardDialog.tsx` | Full-screen modal wizard housing the 4-stage reconciliation flow with sticky navigation. |
| `src/components/tabs/bill-check/BillCheckHeader.tsx` | Streamlined toolbar with Brand Orange `[Upload Document]` button and `[Reconciliation Cockpit (N)]` pill. |
| `src/components/tabs/bill-check/BillCheckStepper.tsx` | Brand Orange 4-stage stepper navigation with active/complete/pending badges. |
| `src/components/tabs/bill-check/StageReviewTable.tsx` | Side-by-side matching table for Stage 1 (Part Numbers) and Stage 2 (Name & Cost). |
| `src/components/tabs/bill-check/StageAITrigger.tsx` | Stage 3 surveyor-triggered AI matcher hero card. |
| `src/components/tabs/bill-check/StageAuditView.tsx` | Stage 4 matrix isolating disallowed parts (₹0 liability), insurer savings, and extra items. |
| `src/lib/tally/stage1-part-number.ts` | Exact and normalized part number matching algorithm. |
| `src/lib/tally/stage2-name-cost.ts` | Semantic automotive matching with directional guardrails and ±40% price cap. |
| `src/lib/tally/stage3-ai-matcher.ts` | AI prompt generator and response parser for leftover ambiguous items. |
| `src/lib/tally/stage4-tally-matrix.ts` | Disallowed item segregation, savings calculation, and extra items tray promoter. |
| `src/stores/slices/tallySlice.ts` | Zustand slice for `activeTallyStage` (`'grid' | 1 | 2 | 3 | 4`), `isReconcileWizardOpen`, and stage actions. |

---

## 4. Test Suite & Quality Status

- **Unit Tests:**
  - `src/components/dialogs/__tests__/BillCheckUploadDialog.test.tsx`: 10 tests passing.
  - `src/components/dialogs/__tests__/ReconciliationWizardDialog.test.tsx`: 6 tests passing.
  - `src/components/tabs/bill-check/__tests__/`: 27 tests passing across stepper, review tables, AI trigger, and audit view.
  - `src/components/tabs/__tests__/BillCheckHeader.test.tsx`: 4 tests passing.
  - Full test suite: **355 test files, 3,200 tests passing, 0 failures**.
- **TypeScript:** `npx tsc --noEmit` clean (**0 errors**).
- **Scan Drift / Prime ↔ Scan Coupling:** None. Changes are confined to web UI and bill check reconciliation logic.

---

## 5. What Claude Should Know Going Forward

1. **Theme Identity:**
   - Always adhere strictly to **Brand Orange (`#F59E0B`, `amber-500`)** and warm amber accents (`amber-50`, `amber-100`, `amber-300`).
   - Never use purple gradients or blue action buttons in the main app layout.
2. **Spreadsheet Grid Invariance:**
   - `BillCheckGrid` must remain the permanent primary view on the Bill Check tab.
   - Any multi-step wizard, ingestion, or verification flows should live in modal dialogs (`ReconciliationWizardDialog`, `BillCheckUploadDialog`), not replace the grid inline.
3. **Deployments:**
   - Always build first (`npm run build`).
   - Always deploy using `--only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in`.
   - Always verify via curl against `https://surveyos.in` and `https://motorsurveyos-in.web.app`.
