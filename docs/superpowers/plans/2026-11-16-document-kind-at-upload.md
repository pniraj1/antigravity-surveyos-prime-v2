# Say What the Document Is at Upload — Plan 3a

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bill or an estimate is read only where the surveyor has said what it is (Assessment or Bill Check). The Documents tab's "Final Garage Bill" card goes, and the bill is still filed for the insurer kit, chase messages and Scan.

**Architecture:**
- A pure helper decides the document type to file an upload under.
- The Assessment tab asks one question on a claim's first upload.
- Bill Check files its uploads. The Documents tab drops one card.

No new AI calls and no new doc types.

**Tech Stack:** TypeScript, React (Next.js 16), Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-bill-check-reference-finder-design.md`, section **D13** (with D0 and D12). Builds on Plan 2 (`docs/superpowers/plans/2026-11-15-bill-check-mode-and-labour.md`, on `main`, not deployed).

## Global Constraints
- Commit to `main`. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage files by path only.
- **Unchanged:** the key `'final-bill'`, `FIELD_KEY_TO_DOC_TYPE`, `DocType`, `DOC_TYPE_LABEL`, Scan import (`src/lib/scan-import/*`), and the new-claim drop routing (`NewClaimDialog.tsx`, `Dashboard.tsx` docTypes lists).
- **Filing rule:**
  - Bill Check upload → `'invoice'` when its choice is Final bill, `'estimate'` when Estimate;
  - Assessment upload → `'invoice'` when `billCheck.baseDocument === 'final-bill'`, else `'estimate'`.
- **A phone file is never filed or uploaded to Drive a second time.** Keep today's `phone` / `isOnDrive` checks.
- **Exact copy for the Assessment question:**
  - title `What is this document?`;
  - buttons `Estimate` (default) and `Final bill`;
  - explanation `Choose Final bill when the insurer asks you to assess from the bill (UIIC). Bill Check will then read the estimate for Est. No.`
- Prime ↔ Scan: only a Documents-tab card disappears, and `DocumentChecklist.tsx` / `documents.ts` don't change. Task 1 runs Scan's drift tests to prove it.
- Run tests from the repo root: `npx vitest run <path>`.

## Review Focus
1. **A UIIC claim whose first Assessment upload is the bill.** Bill Check opens already on "Estimate", and its column reads "Est. No." (Task 3 test on the helper, plus the existing `isFromBill`).
5. **Answering Estimate** records it, so a failed first read or deleted rows never ask again (Task 3).
2. **A second Assessment upload** (more pages or supplementary) on a claim already made from the bill is filed as invoice and never asks again (Task 3 test).
3. **The insurer upload kit** for UIIC still finds an `invoice` document after a Bill Check upload of the final bill (Task 2 test via the filing helper).
4. **A phone file picked in Bill Check** is not filed twice (Task 2, keeps the `phone` guard).

---

### Task 1: Remove the Documents tab's Final Garage Bill card

**Files:**
- Modify: `src/components/tabs/DocumentsTab.tsx:59`. Delete the `{ id: 'final-bill', … }` card entry, and remove any imports that only it used (e.g. the `Receipt` icon, if now unused).
- Test: the existing Documents tab tests in `src/components/tabs/__tests__/`. If one asserts the card exists, update it to assert the card is gone.

- [ ] **Step 1:** Write or adjust a test asserting the Documents tab's card list has no `'final-bill'` card. Run it and expect FAIL.
- [ ] **Step 2:** Delete the entry. Run the same test and expect PASS. Then run `npx tsc --noEmit -p .`.
- [ ] **Step 3: Scan check.** In Git Bash, from `../SurveyOS Scan`, with `JAVA_HOME` set to the Android Studio jbr: run `./gradlew :app:testDebugUnitTest`. Expected: BUILD SUCCESSFUL. If Java or gradle is unavailable, record that in the report and do not fail the task.
- [ ] **Step 4:** Commit with `feat(documents): remove the Final Garage Bill card; bills are read in Assessment or Bill Check`.

---

### Task 2: Bill Check files its upload

**Files:**
- Create: `src/lib/documents/upload-doc-type.ts`
- Modify: `src/components/tabs/BillCheckTab.tsx` (`handleFileUpload` / `processBillFile`)
- Test: `src/lib/documents/__tests__/upload-doc-type.test.ts`

**Interfaces:**
- Produces:
  ```ts
  /** Where a Bill Check upload is filed: the bill as 'invoice', the estimate as 'estimate'. */
  export function billCheckUploadDocType(upload: 'final-bill' | 'estimate'): 'invoice' | 'estimate';
  /** Where an Assessment upload is filed: 'invoice' in a claim made from the bill, else 'estimate'. */
  export function assessmentUploadDocType(claim: { billCheck?: { baseDocument?: string } } | null): 'invoice' | 'estimate';
  /** True on a claim's first Assessment upload: no rows and no baseDocument chosen yet. */
  export function asksDocumentKind(claim: { assessmentRows?: unknown[]; billCheck?: { baseDocument?: string } } | null): boolean;
  ```

**Behaviour in BillCheckTab:**
- A non-phone upload calls `saveDocuments(billCheckUploadDocType(upload), [{ blob: file, name: file.name }], 'upload')`.
- It also uploads to Drive when `profile.autoUploadDrive !== false` and the user confirms. Follow AssessmentTab's pattern exactly (`confirmSaveToCloud`, `uploadFileToDrive`). The Drive name is `${docType}.${ext}`.
- Phone files (`onPhoneFile`) are never saved again.

- [ ] **Step 1: Write the failing tests** for the three functions:
  - `billCheckUploadDocType('final-bill') === 'invoice'`, and `('estimate') === 'estimate'`;
  - `assessmentUploadDocType` gives `'invoice'` for `baseDocument: 'final-bill'` and `'estimate'` for none;
  - `asksDocumentKind` is true for `{ assessmentRows: [] }`, false once rows exist, false once `baseDocument` is `'final-bill'`, and false once it is `'estimate'`.
- [ ] **Step 2:** Run them and expect FAIL. Implement. Run again and expect PASS.
- [ ] **Step 3:** Wire BillCheckTab. Then run `npx tsc --noEmit -p .` and `npx vitest run src/components/tabs src/lib/documents`.
- [ ] **Step 4:** Commit with `feat(bill-check): file the uploaded bill or estimate in the claim's documents`.

---

### Task 3: Assessment asks once: Estimate or Final bill

**Files:**
- Create: `src/components/dialogs/DocumentKindDialog.tsx`
- Modify: `src/components/tabs/AssessmentTab.tsx` (`processEstimateFile` and `startEstimate`, around lines 54–100)
- Test: `src/components/dialogs/__tests__/DocumentKindDialog.test.tsx` (static markup)

**Behaviour:**
- **The question.** In `processEstimateFile`, before `confirmEstimateMode`: when `asksDocumentKind(currentClaim)`, show `DocumentKindDialog`, using the copy from Global Constraints.
  - Cancel → stop, with no extraction.
  - Final bill → `updateBillCheck({ baseDocument: 'final-bill' })`.
  - Estimate → `updateBillCheck({ baseDocument: 'estimate' })`, so the question is never repeated (e.g. after a failed first read, or after the rows are deleted). `isFromBill` is false for `'estimate'`.
- **Filing.** In `startEstimate`, file with `assessmentUploadDocType(useClaimStore.getState().currentClaim)` instead of the fixed `'estimate'`. Use the same doc type for the Drive name (`${docType}.${ext}`).
- **Unchanged.** Extraction stays `triggerExtraction('estimate', …)`: the Assessment reads every upload the same way.
- **Phone files.** `ESTIMATE_TYPES` (AssessmentTab.tsx:35) gains `'invoice'`, so a bill photographed with Scan can be picked in Assessment for a claim made from the bill. Today it can only be picked in Bill Check.
- **Dialog props:** `{ onChoose: (k: 'estimate' | 'final-bill') => void; onCancel: () => void }`. Follow an existing dialog's look (e.g. `EstimateModeDialog.tsx`).

- [ ] **Step 1: Write the failing test:** the dialog markup shows the title, both buttons and the explanation line verbatim. Run it and expect FAIL.
- [ ] **Step 2:** Implement the dialog and the wiring. Run and expect PASS. Then run `npx tsc --noEmit -p .` and `npx vitest run src/components src/hooks src/lib`.
- [ ] **Step 3:** Commit with `feat(assessment): ask once whether the first upload is the estimate or the final bill`.

---

### Task 4: Ship

- [ ] **Step 1: Full suite.** Run `npx vitest run`, with output to a file, and read the tail. Expected: all pass.
- [ ] **Step 2: Build.** Run `npm run build`. Expected: completes.
- [ ] **Step 3: Deploy, only when the owner says so.** This plan, Plan 2 and Plan 2's Task 7 ship together.
- [ ] **Step 4: Record.** Add a Changelog entry in the vault, update the `bill-match-score` memory, and commit. Push only when the owner says so.
