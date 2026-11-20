# Report Filing, Drive Backup and Phone Download — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every report and photo sheet lands once in the vehicle folder under its vehicle-first name, Drive keeps one current copy of each (the printed PDF included), and a phone import shows progress and never saves into the wrong claim.

**Architecture:** One write path for the vehicle folder: `saveDocuments` (sink → `writeDocuments`). It learns to keep a given name for Prime-made files (`keepName`), and its single-file replace also catches earlier Prime-made files of the type, so the printed PDF still replaces its HTML. `saveReportToClaimFolder` stops writing files itself. The Drive mirror gains replace-by-name (PATCH the same file id, as `backupClaimToDrive` does for `claim.json`). The phone import gains a progress callback and a claim check.

**Tech Stack:** Next.js 16 / React, TypeScript, Zustand, File System Access API, Google Drive v3 REST, Vitest. SurveyOS Scan (Kotlin) for the doc-type mirror.

**Spec:** this plan (findings below). Workflow study + scrutiny: 2026-11-20, after commit `e08ea1d4`. Owner decisions: vehicle-number-first names inside the vehicle folder (2026-11-20, confirming the 2026-11-18 plan `docs/plans/2026-11-18-documents-recon-naming-and-pdf-pagebreaks.md` §B).

## Findings (verified in code)

| # | Where | What the surveyor gets |
|---|---|---|
| F1 | `src/lib/reports/auto-file-report.ts:82-103` | Each report is written twice in the vehicle folder: `MH12AB1234_Final_Survey_Report_1.html` (direct write) and `Final Survey Report.html` (sink). Two toasts. Filing the printed PDF replaces only the plain copy; the vehicle-first HTML stays forever and is not in the claim's document list. |
| F2 | `src/components/pdf/PhotoSheetDownloadButton.tsx:62,74` | The photo sheet PDF is filed as `damagePhotos` → `Damage Photos/Damage Photos N.pdf` among real damage photos; each new sheet adds a numbered copy; split sheets file each part that way. |
| F3 | `src/lib/reports/valuation-report-builder.ts:185,187` | A valuation report is filed as `surveyReport`, so the folder copy is named "Final Survey Report". No overwrite (a valuation claim has no final report: `ReportTab.tsx:129-134`), only the wrong name/type. |
| F4 | `src/lib/drive/index.ts:408` | `uploadFileToDrive` always POSTs: every re-generation adds another same-name copy on Drive. |
| F5 | `src/lib/documents/print-followup.ts:77` | The printed PDF is filed in the folder but never sent to Drive. |
| F6 | `src/lib/scan-import/drive-source.ts:162-169` | All phone files download into memory first; only a spinner shows. If another claim is opened meanwhile, `importScanFiles` runs against that claim (only the vehicle question guards it) and the Drive move uses the old claim's folder. |
| F7 | `src/components/documents/FromPhoneButton.tsx:345` | On the older one-root-folder setup the surveyor is asked for a claim folder on every claim, though import and sink accept the root folder. |

Checked and fine: claim data backup (`claim.json` upsert, serialized), Drive queue on token expiry / offline, closing the tab mid-download (nothing written or moved), Scan hiding unknown Prime types (`DocGroups.kt:34` → `PRIME_MADE`).

## Global Constraints

- Vehicle-folder and Drive names for Prime-made files: the vehicle-first names from `auto-file-report.ts` (`MH12AB1234_Final_Survey_Report_1.pdf`, `MH12AB1234-Photo-Sheet.pdf`). Surveyor uploads and phone files keep the label names (`RC Book.pdf`).
- `billCheckFileName` becomes `${reg}_Bill_Check_Report_${reportNo}.${ext}` so its name contains its label "Bill Check Report".
- Do not change `ALIASES` in `naming.ts` (Scan's `aliasesMatchPrimeSource` mirrors it).
- Never DELETE on Drive (Scan contract). Replace = PATCH media on the existing file id.
- A new doc type in `src/types/documents.ts` needs the same key and label in `../SurveyOS Scan/app/src/main/java/surveyos/scan/contract/PrimeContract.kt` and a note in `../SurveyOS Scan/docs/handover/`.
- No new dependencies. Commit on `main`. `npx vitest run` and `npx tsc --noEmit` green before each commit.

## Review Focus

1. Report printed as DRAFT, then printed again with report no. FIN-001 → one file left (`…_FIN-001`), the DRAFT file removed from disk and list (Task 2 test `a newer Prime-made file replaces the older one under another name`).
2. Folder opened on a second laptop (index rebuilt from disk) → `MH12AB1234_Final_Survey_Report_1.pdf` reads as Final Survey Report, `MH12AB1234-Photo-Sheet.pdf` as Photo Sheet (Task 2 test `vehicle-first Prime-made names are recognised`).
3. Report generated twice → one file on Drive, updated (Task 3 test `second mirror of the same name PATCHes`).
4. Report number containing `'` (e.g. `O'Neil/12`) → Drive search still works (Task 3 test `apostrophe in name is escaped in the query`).
5. Another claim opened mid-download → nothing saved, nothing moved, surveyor told (Task 4 test `claim switched during download writes nothing`).

---

### Task 1: Photo sheet and valuation report get their own types (Prime + Scan)

**Files:**
- Modify: `src/types/documents.ts` (DocType union, `DOC_TYPE_LABEL`)
- Modify: `src/lib/chase/ask-dialog.ts:25-27` (`PRIME_MADE`)
- Modify: `src/lib/reports/valuation-report-builder.ts:185,187`
- Modify: `../SurveyOS Scan/app/src/main/java/surveyos/scan/contract/PrimeContract.kt` (after `CASH_LOSS_CONSENT`)
- Create: `../SurveyOS Scan/docs/handover/prime-photo-sheet-valuation-types.md`
- Test: `src/lib/chase/__tests__/ask-dialog.test.ts` (or the existing chase test file)

**Interfaces:**
- Produces: DocType `'photoSheet'` label `'Photo Sheet'`; DocType `'valuationReport'` label `'Valuation Report'`. Single-file (not in `MULTI_FILE_TYPES`), not photo tags.
- Scan: `PHOTO_SHEET("photoSheet", "Photo Sheet")`, `VALUATION_REPORT("valuationReport", "Valuation Report")`.

- [ ] **Step 1: Write the failing test** `Prime-made types are never asked for`: `dialogDocs(claimWithoutScanChase).map((d) => d.key)` contains neither `'photoSheet'` nor `'valuationReport'`.
- [ ] **Step 2: Run** `npx vitest run src/lib/chase` — expect FAIL (types don't exist; tsc error in test is acceptable as the red).
- [ ] **Step 3: Implement**: add both types and labels; add both to `PRIME_MADE`; valuation builder uses `'valuationReport'` in `saveReportToClaimFolder` and `promptForPrintedPdf`.
- [ ] **Step 4: Scan side**: two enum entries; handover note in the style of `prime-cash-loss-doc-type.md` (Prime-made types, hidden in Scan via `PRIME_MADE` group, no alias/slot/manifest/folder change, Prime changes nothing further). Git Bash, `JAVA_HOME` = Android Studio jbr: `./gradlew :app:testDebugUnitTest` → BUILD SUCCESSFUL.
- [ ] **Step 5: Run** `npx vitest run` and `npx tsc --noEmit` — green.
- [ ] **Step 6: Commit** Prime `feat(documents): photo sheet and valuation report types`; Scan `feat(contract): mirror Prime photoSheet and valuationReport types`.

### Task 2: One vehicle-first file per Prime-made deliverable in the vehicle folder

**Files:**
- Modify: `src/lib/documents/folder.ts:22` (`FolderInput`), `:118-260` (`writeDocuments` naming)
- Modify: `src/lib/documents/index-ops.ts:60-67` (`replaceableEntries`)
- Modify: `src/lib/documents/naming.ts:104-109` (`docTypeFromRelPath`)
- Modify: `src/lib/reports/auto-file-report.ts` (drop direct writes, `keepName`, `billCheckFileName`, delete `saveGeneratedReportToClaimFolder`)
- Modify: `src/components/pdf/PhotoSheetDownloadButton.tsx:56-77` and the part button
- Modify: `src/lib/documents/print-followup.ts:33,77` and its callers (`standard-report-builder.ts:1014`, `uiic-final-builder.ts:552,1117`, `valuation-report-builder.ts:187`, `spot-fee-bill-builder.ts:231`, `reinspection-report-builder.ts:194`)
- Test: `src/lib/documents/__tests__/` (index-ops, naming tests), `src/lib/reports/__tests__/auto-file-report.test.ts`, `src/components/pdf/__tests__/PhotoSheetDownloadButton.test.tsx`, `src/lib/documents/__tests__/print-followup.test.ts`

**Interfaces:**
- Consumes (Task 1): `'photoSheet'`, `'valuationReport'`.
- Produces: `FolderInput.keepName?: boolean` — with one file of a single-file type, `writeDocuments` writes it at the folder top level under `name` exactly (sanitized for Windows); ignored for multi-file types.
- Produces: `replaceableEntries(existing, type, device)` also returns top-level entries of `type` with `source === 'generated'` (any name).
- Produces: `docTypeFromRelPath(relPath)` — when no label/alias matches a top-level file, lowercase the stem, turn `_`/`-` runs into spaces, and return the first of `surveyReport, billCheckReport, feeBill, reinspectionReport, valuationReport, photoSheet` whose label the stem contains; else `'other'`.
- Produces: `saveReportToClaimFolder(claim, fileName, blob, docType?)` — signature unchanged; calls `saveDocuments(docType, [{ blob, name: fileName, keepName: true }], 'generated', claim.id)` and the Drive mirror only.
- Produces: `promptForPrintedPdf(type: DocType, fileName: string): Promise<void>` — `fileName` is the vehicle-first `.pdf` name; the picked PDF is saved as `{ blob: file, name: fileName, keepName: true }`.
- Produces: `downloadPart(claim, regNum, part, whole: Blob)` — files `whole` as `${regNum}-Photo-Sheet.pdf`, type `'photoSheet'`; the browser still downloads `part.blob` as `…-Part<n>.pdf`.

- [ ] **Step 1: Write the failing tests**
  - `keepName writes under the given name`: writeDocuments with `[{ blob, name: 'MH12AB1234_Final_Survey_Report_1.html', keepName: true }]`, type `surveyReport` → written relPath `MH12AB1234_Final_Survey_Report_1.html`.
  - `a newer Prime-made file replaces the older one under another name`: `replaceableEntries([{ type: 'surveyReport', relPath: 'MH12AB1234_Final_Survey_Report_DRAFT.html', source: 'generated', devices: [dev] }], 'surveyReport', dev)` → that entry; the same entry with `source: 'upload'` → `[]`.
  - `vehicle-first Prime-made names are recognised`: `MH12AB1234_Final_Survey_Report_1.pdf` → `surveyReport`; `MH12AB1234_UIIC_Final_Survey_Report_1.pdf` → `surveyReport`; `MH12AB1234_Bill_Check_Report_1.pdf` → `billCheckReport`; `MH12AB1234-Photo-Sheet.pdf` → `photoSheet`; `MH12AB1234_Spot_Fee_Bill_1.html` → `feeBill`; `Holiday trip.pdf` → `other`; `RC Book 2.pdf` → `rc` (unchanged).
  - auto-file-report `writes the report only through the sink`: the claim folder handle's `getFileHandle` is never called; `saveDocuments` called once with `('surveyReport', [{ blob, name: 'MH12AB1234_Final_Survey_Report_1.html', keepName: true }], 'generated', claim.id)`. Update the bill-check name test to `MH12AB1234_Bill_Check_Report_1.html`.
  - PhotoSheetDownloadButton: existing expectation (lines 240-244) becomes `'photoSheet'`; new `any part click files the whole sheet once`: `downloadPart(claim, 'MH12AB1234', part2, whole)` → `saveReportToClaimFolder(claim, 'MH12AB1234-Photo-Sheet.pdf', whole, 'photoSheet')`.
  - print-followup: `picked PDF is filed under the vehicle-first name`: `promptForPrintedPdf('surveyReport', 'MH12AB1234_Final_Survey_Report_1.pdf')`, pick `chrome-print.pdf` → `saveDocuments('surveyReport', [{ blob: file, name: 'MH12AB1234_Final_Survey_Report_1.pdf', keepName: true }], 'generated')`.
- [ ] **Step 2: Run** `npx vitest run src/lib/documents src/lib/reports src/components/pdf` — expect FAIL.
- [ ] **Step 3: Implement** per Interfaces. Builders pass `fileName.replace(/\.html$/, '.pdf')`; `uiic-final-builder.ts:1117` passes `billCheckFileName(claim, 'pdf')`. Remove imports the deletions orphan.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit` — green. Scan `./gradlew :app:testDebugUnitTest` — still green (ALIASES and labels untouched).
- [ ] **Step 5: Commit** `fix(documents): one vehicle-first file per report and photo sheet`

### Task 3: Drive keeps one current copy, the printed PDF included

**Files:**
- Modify: `src/lib/drive/index.ts:408-449` (`uploadFileToDrive`)
- Modify: `src/lib/reports/auto-file-report.ts` (mirror call), `src/lib/documents/print-followup.ts` (mirror after filing)
- Test: `src/lib/drive/__tests__/upload-replace.test.ts` (create), `src/lib/documents/__tests__/print-followup.test.ts`

**Interfaces:**
- Consumes (Task 2): `promptForPrintedPdf(type, fileName)`.
- Produces: `uploadFileToDrive(claimId: string, fileName: string, blob: Blob, claimLabel?: string, opts?: { replace?: boolean }): Promise<void>`. With `replace`: query `name='<fileName with ' escaped as \'>' and '<folderId>' in parents and trashed=false`; if found, PATCH `upload/drive/v3/files/<id>?uploadType=multipart` with `{}` metadata; else POST as today. No-token and failure paths queue as today (a queued retry POSTs; accepted).

- [ ] **Step 1: Write the failing tests** (mock `driveRequest`, token present):
  - `second mirror of the same name PATCHes`: search returns `{ files: [{ id: 'X' }] }` → upload is `PATCH …/files/X?uploadType=multipart`; no POST, no DELETE.
  - `replace with no existing file POSTs`.
  - `apostrophe in name is escaped in the query`: `"MH12_Final_Survey_Report_O'N.pdf"` → query contains `O\'N`.
  - `replace without token queues`: no token, Drive linked → `addToDriveQueue` called, warning toast.
  - print-followup `filed PDF is mirrored to Drive`: Drive connected → `uploadFileToDrive(claimId, 'MH12AB1234_Final_Survey_Report_1.pdf', file, <label>, { replace: true })`.
- [ ] **Step 2: Run** `npx vitest run src/lib/drive src/lib/documents/__tests__/print-followup.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** per Interfaces; `saveReportToClaimFolder` passes `{ replace: true }`; print-followup mirrors only when `useUIStore.getState().isDriveConnected`, label = sanitized reg or claim id.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit` — green.
- [ ] **Step 5: Commit** `fix(drive): replace report copies on Drive and back up the printed PDF`

### Task 4: Phone download shows progress and stays with its claim

**Files:**
- Modify: `src/lib/scan-import/drive-source.ts:85-88,123-169`
- Modify: `src/components/documents/FromPhoneButton.tsx:223-259,345`
- Test: `src/lib/scan-import/__tests__/drive-source.test.ts`, `src/components/documents/__tests__/FromPhoneButton.test.tsx`

**Interfaces:**
- Produces: `DriveImportOptions.onProgress?: (done: number, total: number) => void` — `(0, total)` before the first download, then after each file; `total` = present files not already known.
- Produces: `importFromDrive` returns `{ result: { status: 'claim-changed', added: 0 }, moveFailed: 0, mismatched: [] }` when the open claim's id differs from the starting one, checked before each download and before `importScanFiles`.

- [ ] **Step 1: Write the failing tests**
  - `reports download progress`: 2 manifest files present → `onProgress` calls `[[0,2],[1,2],[2,2]]`.
  - `claim switched during download writes nothing`: `onProgress` switches `state.claim` to another id at `(1, 2)` → `claim-changed`, `state.imported` null, `state.moves` empty.
  - FromPhoneButton `older root folder needs no claim folder prompt`: `getClaimFolderHandle` → null, `getStoredRootHandle` → a handle → import runs, `onNeedsFolder` not called.
- [ ] **Step 2: Run** `npx vitest run src/lib/scan-import src/components/documents` — expect FAIL.
- [ ] **Step 3: Implement**: callback and claim check in `importFromDrive`; `runDriveImport` passes `onProgress: (d, t) => toast.loading(\`Bringing phone files: ${d} of ${t}\`, { id: 'phone-download' })` and dismisses it in `finally`; line 345 `(await getClaimFolderHandle(claim.id)) ?? (await getStoredRootHandle())`.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit` — green.
- [ ] **Step 5: Commit** `fix(scan-import): show phone download progress and stop on claim switch`

### Task 5: Record, build, deploy

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`, `Changelog.md`
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-11-20-report-filing-backup-phone-download.md`

- [ ] **Step 1:** Changelog + Tasks entries (F1–F7, changes, Scan impact: two enum lines + handover note).
- [ ] **Step 2:** `npx vitest run` all pass; `npx tsc --noEmit` 0 errors; Scan `./gradlew :app:testDebugUnitTest` BUILD SUCCESSFUL.
- [ ] **Step 3:** with the owner's go-ahead: `npm run build && npx firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in`.
- [ ] **Step 4: Commit** `docs(kb): record report filing, Drive backup and phone download fixes`

## Not in this plan

- Duplicate files already in vehicle folders (`Final Survey Report.html`, `Damage Photos/Damage Photos N.pdf` photo sheets): left alone; deleting surveyor files needs their say. The next report print replaces the plain report copy through the new replace rule only if it is a `generated` entry of that type on this device.
- Holding all phone files in memory before writing: fine for a normal claim; write type-by-type if a 100+ photo claim stalls a laptop.
- Scan showing what is still waiting to upload and a "Send now" button: separate Scan task.
- Checking each flow in the browser on a real claim: owner, after deploy.
