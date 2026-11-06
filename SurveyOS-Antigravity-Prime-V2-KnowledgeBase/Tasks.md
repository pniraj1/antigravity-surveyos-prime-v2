# Active Tasks

> Last updated: 2026-11-06 by Antigravity (Reconciliation Interactive Dual Evidence & No Auto-Close)
> Both agents (Claude and Antigravity) MUST read this before starting and update it before stopping.

---

## Done: Reconciliation Interactive Dual Evidence & No Auto-Close (2026-11-06, Antigravity)
- **Problem Solved:**
  1. Clicking any option in the Reconciliation Hub immediately committed the field and wiped it from the table because `getConflictFields` drops `isDecided` fields.
  2. If the user resolved the last/only conflict, an auto-close `useEffect` in `DocumentsTab.tsx` detected `conflicts.length === 0` and forcefully dismissed the dialog.
  3. The Evidence panel only rendered a single document slot, preventing surveyors from comparing both conflicting evidence documents (e.g. RC Book vs Insurance Policy) side-by-side or toggling between them.
- **Architecture Delivered:**
  - **`src/lib/ai/reconciliation.ts`:** Added `getAllConflictFields(claim)` to keep conflict rows visible in the dialog even after a decision is made.
  - **`src/components/tabs/DocumentsTab.tsx`:** Removed the auto-close `useEffect` on `conflicts.length === 0`; passed `allConflicts` to `ReconciliationDialog`.
  - **`src/components/tabs/reconciliation/ReconciliationDialog.tsx`:**
    - Live Document Switcher: Added top comparison bar in the right-hand panel showing the active field's conflicting sources (`[ 📄 RC Book ]`, `[ 📄 Policy ]`).
    - Clicking any option on either the table row or the evidence switcher flips the document iframe/image and verbatim context snippet live and updates the claim.
    - Decided rows transition smoothly into `✓ Resolved` state with green visual accents without disappearing.
    - Dialog stays open until the surveyor clicks the explicit **Finish Reconciliation** button.
- **Verification:**
  - Vitest: 281 test files passed, 2,513 unit tests passed (100% green).
  - TypeScript: 0 errors via `npx tsc --noEmit`.
  - Scan Coupling Impact: None.
  - Deployed to Firebase Hosting (`motorsurveyos-in` and `surveyos-v2-antigravity-in`) on project `surveyos-v2-antigravity-in`.
  - Verified live chunk `0n1i3q1dzc0gx.js` via curl on `https://motorsurveyos-in.web.app` and `https://surveyos.in`.
- **Commits on `main`:**
  - `ddc0fcca` feat(reconciliation): interactive dual evidence inspection without premature auto-close

---

## Done: Floating Preview Bill Check Parity & Clean Bill Check Header (2026-11-06, Antigravity)
- **Problem Solved:**
  1. The Bill Check tab header hardcoded "UIIC Bill Check Report", creating misleading branding for general insurer claims (National, New India, Oriental, private insurers).
  2. The Live Preview floater box (`FloatingReportPreview.tsx`) only supported UIIC Bill Check (`buildUIICBillCheckHTML`); Standard Bill Check (`buildStandardFinalSurveyHTML(..., 'bill-check')`) was completely missing.
  3. The Live Preview floater had a clunky 48px height minimize button that compromised ergonomics.
- **Architecture Delivered:**
  - **Clean Header (`src/components/tabs/bill-check/BillCheckHeader.tsx`):** Changed title from "UIIC Bill Check Report" to the universal "Bill Check Report".
  - **Live Preview Floater (`src/components/layout/FloatingReportPreview.tsx`):**
    - Expanded `ReportFormat` to include `std-bill` and `uiic-bill`.
    - Added Standard Bill Check HTML generation (`buildStandardFinalSurveyHTML(claim, profile, 'bill-check')`) and print gate (`gate('bill-check', ...)`).
    - Introduced 5-pill toolbar: `Std` | `UIIC` | `Std Bill` | `UIIC Bill` | `Fees`.
    - Smart auto-detection: when navigating to `bill-check` tab, auto-selects `uiic-bill` for United India claims and `std-bill` for all other insurers.
    - Removed redundant minimise button, keeping clean Close (`X`) button that docks back into the floating bubble pill.
- **Verification:**
  - Added unit test in `src/components/layout/__tests__/FloatingReportPreview.test.tsx` verifying generic title, format tabs (`Std Bill`, `UIIC Bill`), and absence of minimise button.
  - Full Vitest suite: 281 test files passed, 2,512 tests passed (100% green).
  - TypeScript compiler (`npx tsc --noEmit`): 0 errors.
  - Deployed to Firebase Hosting (`motorsurveyos-in` and `surveyos-v2-antigravity-in`) on project `surveyos-v2-antigravity-in`.
  - Verified live chunk `02eq3bw-3li1l.js` on `https://surveyos.in` and `https://motorsurveyos-in.web.app`.
- **Commits on `main`:**
  - `54143d7f` feat(ui): add standard bill check to live preview floater and clean bill check header

---

## Done: Standard and UIIC Bill Check Net Liability Calculation Reconciliation (2026-11-06, Antigravity)
- **Problem Solved:**
  1. In the UIIC Bill Check Report, the Page 2 summary box placed `Total Assessed (After Dep + GST)` at the top, but the deduction formula subtracted salvage and excess from `totalBilled` (derived from `bcSummary.grandTotalBilled`), completely ignoring the Total Assessed row above it.
  2. Page 1 summary table right column had an arithmetic impossibility ($gross - salvage - excess \ne netBilledLiability$).
  3. Page 2 displayed two conflicting Net Loss amounts and words (`asum.netAssessedLoss` in Table A vs `netBilledLiability` in Table B).
  4. In the Standard Bill Check Report (`buildStandardFinalSurveyHTML` in `bill-check` mode), the report previously projected rows via `projectForBillCheck(rows)`, mutating `r.assessed` to $\min(r.\text{assessed}, r.\text{billedTaxable})$. This improperly capped Columns 3 (`Assessed (after Dep.)`) and 4 (`Incl. GST`) as well as `grand` and `net` at workshop billed amounts, wiping out the surveyor's true assessment and deducting salvage/excess from billed figures.
  5. In `calculateBillCheckSummary` (`src/lib/calculations/assessment.ts`), `netLiability` was derived from `billedGrandTotal - salvage - totalExcess`, causing the UI "Final Liability" card on the Bill Check screen to deduct salvage and policy excess from billed amounts rather than assessed loss.
- **Architecture Delivered:**
  - **Standard Bill Check Report (`src/lib/reports/standard-report-builder.ts`):**
    - Assessment rows (`claim.assessmentRows || []`) remain the pure source of truth for assessed loss across both final survey and bill-check modes.
    - Column 2 (`Billed`) cleanly computes and displays the workshop billed taxable base totals (`col2PartsBase`, `col2Metal`, `col2Plastic`, `col2Glass`, `col2Fbr`, `col2LabBase`, `col2LabOnly`, `col2PaintOnly`).
    - Columns 3 (`Assessed (after Dep.)`) and 4 (`Incl. GST`) strictly reflect the surveyor's assessed figures (`pb`, `labBase`, `grand`).
    - Section 8 Net row: Labeled `NET LIABILITY` in bill check mode and calculated strictly as $\text{grandTotalAssessed} - \text{salvage} - \text{excess}$.
    - Section 9 item table: Disconnected `Assessed ₹` from the billed cap so it preserves the surveyor's actual assessed figure (`r.assessed`), and Column 4 prints `m9(isBillCheck ? (r.billedTaxable ?? r.estimated) : r.estimated)`.
  - **Bill Check Calculation Engine (`src/lib/calculations/assessment.ts`):**
    - Accumulated `assessedGrandTotal += assessedNet` for all allowed rows in `calculateBillCheckSummary`.
    - Updated `netLiability` to $\max(0, \text{assessedGrandTotal} - \text{salvage} - \text{totalExcess})$ and set `grandTotalAssessed: assessedGrandTotal`.
  - **UIIC Bill Check Report (`src/lib/reports/uiic-final-builder.ts`):**
    - Reconciled Net Liability to strictly derive from $\text{Total Assessed (After Dep + GST)} - \text{Salvage} - \text{Voluntary Excess} - \text{Compulsory Excess}$.
    - Removed misleading `Total Billed by Workshop` row from Page 2 summary box so the table balances cleanly from line 1 to net liability.
    - Reconciled Page 1 summary table, Page 2 words, and Service Hub use block to use `net`.
- **Verification:**
  - Added regression unit tests in `src/lib/reports/__tests__/standard-bill-check.test.ts` and `src/lib/reports/__tests__/bill-check-report.test.ts`.
  - Full Vitest suite: 280 test files passed, 2,509 tests passed (100% green).
  - TypeScript compiler (`npx tsc --noEmit`): 0 errors.
  - Sibling Android App (`SurveyOS Scan`): 0 impact on shared contracts or sync.
  - Deployed to Firebase Hosting (`motorsurveyos-in` and `surveyos-v2-antigravity-in`) on project `surveyos-v2-antigravity-in`.
  - Verified live chunk `0es4-_7.7_kel.js` on `https://surveyos.in` and `https://motorsurveyos-in.web.app`.
- **Commits on `main`:**
  - `4744d70a` fix(reports): reconcile UIIC bill check net liability calculation from assessed loss
  - `511ab333` fix(reports): reconcile standard bill check net liability calculation from assessed loss

---

## Done: Claim Folder Deduplication, Silent Auto-Replace & 3-Touchpoint Allocation (2026-11-06, Antigravity)
- **Problem Solved:**
  1. Clutter from unwanted `(old)`, `(old 2)` file accumulation when re-uploading clearer versions of single-file documents (RC, DL, Policy, reports).
  2. Redundant re-writes of identical files already existing in the claim folder.
  3. Visual confusion from legacy `No claim folder · Connect` in `DocumentsTab` alongside the header's `Set Folder`.
  4. Missing early proactive prompt during claim creation.
- **Architecture Delivered:**
  - **Silent Auto-Replace (`src/lib/documents/folder.ts`):** Single-file document slots (`rc`, `dl`, `policy`, `permit`, `fitness`, `surveyReport`, `reinspectionReport`, etc.) silently overwrite/replace in-place with clean canonical names (`RC Book.pdf`), eliminating `(old)` file generation.
  - **In-Folder Deduplication (`folder.ts`):** Checks existing file size/name before disk writes to skip redundant writes when identical files are present. Old extension files (e.g. replaced `.html` report with `.pdf`) are cleanly removed after new file promotion.
  - **Clean Documents Tab (Option A) (`src/components/tabs/DocumentsTab.tsx`):** Removed duplicate legacy `FolderLine` (`No claim folder · Connect`) from below the reconciliation hub. Cleaned top actions row to host `AskForDocumentsButton` and `BringPhoneScans`.
  - **Touchpoint 1 (Proactive Creation) (`src/components/dialogs/NewClaimDialog.tsx`):** Added optional folder picker row in `NewClaimDialog` allowing surveyors to designate their claim folder right during claim creation.
  - **Touchpoint 3 (Just-in-Time Gate) (`src/components/layout/ClaimFolderPromptDialog.tsx`):** Built accessible `/ui-ux-pro-max` dialog prompting for folder allocation when triggering folder-dependent actions (`Bring phone scans`, `Use phone files`, `Print PDF`) on unallocated claims.
- **Verification:**
  - Full Vitest suite: 280 test files passed, 2,507 tests passed (100% green).
  - TypeScript compiler (`npx tsc --noEmit`): 0 errors.
  - Sibling Android App (`SurveyOS Scan`): Unit tests passed (`:app:testDebugUnitTest`) with 0 drift.
- **Commits on `main`:**
  - `b15909c7` fix(documents): silent auto-replace for single-file slots without (old) clutter
  - `7b9a0b41` feat(ui): proactive folder allocation in NewClaimDialog and clean DocumentsTab

---

## Done: Oriental Insurance (OIC / OICL) Assessment Excel & Portal Mapping (2026-11-05, Antigravity)
- **Problem Solved:**
  1. Surveyors required generating an Oriental Insurance Company (OICL) assessment upload Excel workbook conforming to the exact 2-sheet specification (`Invoice` and `Items`) in `9400ExcelOICL.xlsx` and official sample report format.
  2. Solved OIC's missing native painting engine limitation: standard painting requires 25% material depreciation (50% on plastic/material = 12.5% effective statutory deduction), but OIC portal only allows assessing either 0% Labour or 50% Plastic/Rubber.
  3. Handled user-agreed architectural boundary: SurveyOS Final Survey Reports remain 100% pure and IRDAI-compliant without workarounds, while the OIC export and portal filler isolate statutory translation into an adapter layer (splits painting into 75% Labour at 0% dep and 25% Plastic at 50% dep, yielding identical 12.5% net assessment to the exact paisa).
  4. Mapped OIC Surveyor Portal (`https://orientalinsurance.org.in/surveyor-assessment-form`) Step 2 "Basic Details" (25+ fields) in the SurveyOS Portal Fill Chrome extension.
  5. Enhanced Chrome extension engine to support React Synthetic Event tracking (`_valueTracker`), selector-based ID querying (`#<id>`), and HTML5 pushState URL path routing (`location.pathname`).
- **Architecture Delivered:**
  - **OIC Excel Generator (`src/lib/reports/oic-assessment-excel.ts`):** Produces 2-sheet workbook (`Invoice` with metadata, `Items` with parts/labour/painting assessment). Employs exact OIC formula `=ROUND((E{row}-(E{row}*F{row}/100))*(G{row}/100),2)` in Column K. Adds Data Validations for all dropdowns and automatically files into claim folder via `saveOrDownloadReport`.
  - **OIC Export Dialog (`src/components/dialogs/OICExportDialog.tsx`):** Dialog with bill-check verification gate, statutory painting translation summary chip, and customizable invoice metadata.
  - **AssessmentGrid Integration (`src/components/claim/AssessmentGrid.tsx`):** Indigo-themed `OIC Excel` export action button in toolbar alongside UIIC and NIA.
  - **Extension Portal Overlay & Compilation (`scripts/portal-map/oic-assessment.overlay.json`):** 25+ DOM fields mapped to SurveyOS canonical packet paths. Compiled to `extension/maps/oic-assessment.json` and `public/portal-maps/oic-assessment.json`.
  - **Chrome Extension Support (`manifest.json`, `background.js`, `packet-validate.js`, `panel.js`, `filler.js`):** Registered `https://orientalinsurance.org.in/*`, validated `oic: ['assessment']` flow, and added selector + React event dispatch support.
- **Verification:**
  - Full Vitest suite: 278 test files passed, 2,491 tests passed (100% green).
  - Extension test suite: 10 test files passed, 124 tests passed (100% green).
  - TypeScript compiler (`npx tsc --noEmit`): 0 errors.
  - Sibling Android App (`SurveyOS Scan`): Unit tests passed (`:app:testDebugUnitTest`) with 0 drift.
  - **Live Deployment Verified:** Deployed to Firebase Hosting (`motorsurveyos-in`). Verified live chunk `0e3uv-_6it7cw.js` on `https://surveyos.in` and `https://motorsurveyos-in.web.app` containing `OIC Excel`.
- **Commits on `main`:**
  - `a978f83b` feat(reports): OIC assessment Excel workbook generator and statutory painting translation
  - `8cc072c4` feat(ui): OIC assessment Excel export dialog with statutory painting translation
  - `80ff2fc1` feat(claim): integrate OIC assessment Excel export button into AssessmentGrid toolbar
  - `64a6101f` feat(portal): OIC portal assessment mapping and extension support
  - `a903f39a` test(documents): update kit-types test for oicAssessmentExcel DocType
- [x] Task 1: OIC Assessment Excel Generator with statutory painting adapter (`src/lib/reports/oic-assessment-excel.ts`).
- [x] Task 2: OIC Export Dialog with bill check validation gate (`src/components/dialogs/OICExportDialog.tsx`).
- [x] Task 3: AssessmentGrid Toolbar Integration (`AssessmentGrid.tsx`, `documents.ts`, `extension-bridge.ts`).
- [x] Task 4: OIC Portal Mapping & Extension Engine Updates (`oic-assessment.overlay.json`, `filler.js`, `panel.js`).
- [x] Task 5: Scan Contract Parity, Drift Verification, and KnowledgeBase Documentation.

---

## Done: Unified Claim Folder, Local Storage & Auto-Filing Architecture (2026-11-05, Antigravity)
- **Problem Solved:** 
  1. Rigid single-root folder guessing (`${reg} - ${insurer}`) caused new claims without vehicle registration to fall back to `"claim"`, cross-connecting multiple claims into the same folder and adopting each other's files.
  2. Direct uploads on `DetailsTab` ("Scan RC", "Scan DL", "Scan Policy") were only fed to AI extraction in memory and never saved to disk, evidence viewer, or Google Drive (files were lost on reload).
  3. No automatic output filing: generated reports (Final, Re-inspection, Spot, Valuation, Bill Check, Photo Sheet) downloaded to generic Windows folders rather than saving to the claim's designated folder.
  4. Missing "Use Phone Files" button on `DetailsTab` for phone-scanned RC and DL.
  5. Asynchronous Chromium permission drops on reload threw `SecurityError: Must be handling a user gesture`.
  6. Photos used `${Date.now()}` in filenames, causing duplicate accumulation on Google Drive.
- **Architecture Delivered:**
  - **Per-Claim Folder Store (`claim-folder-store.ts`):** Isolated directory handle store in IndexedDB (`surveyos-local-sync`, store `claim-handles`). Allows surveyors complete freedom to allocate any local folder on their PC per claim.
  - **ClaimHeader Folder Button (`ClaimFolderButton.tsx`):** 1-click synchronous user gesture for folder selection, name display, and permission re-granting that survives Chromium reloads without errors.
  - **Universal Ingestion Pipeline (`ingest.ts`):** 4-step pipeline (Disk Write -> Evidence Viewer Register -> AI Extraction -> Google Drive Cloud Mirror) unifying DetailsTab direct uploads and phone file imports.
  - **DetailsTab Integration:** Added "Use phone files" pickers for RC (`['rc', 'rcBack']`), DL (`['dl', 'dlBack']`), and Policy (`['policy']`). Persisted direct uploads immediately via `ingestDocument`.
  - **Auto-Filing Report Engine (`auto-file-report.ts`):** Report builders (`standard-report-builder.ts`, `reinspection-report-builder.ts`, `uiic-final-builder.ts`, `spot-fee-bill-builder.ts`, `valuation-report-builder.ts`, and `PhotoSheetDownloadButton.tsx`) auto-save output files (`Final_Survey_Report_<ReportNo>.html`, `Reinspection_Report_<ReportNo>.html`, `Spot_Fee_Bill_<ReportNo>.html`, `Valuation_Report_<ReportNo>.html`, etc.) directly into the claim's folder.
  - **Photo Upload Deduplication & Drive Hygiene (`usePhotoUpload.ts`, `index.ts`, `upload-with-check.ts`):** Switched to deterministic indexed filenames (`final_photo_01_<name>.jpg`), integrated `uploadWithDuplicateCheck`, and added guards in `saveDriveIndex` preventing index wiping on network flakes.
- **Verification:**
  - Full Vitest suite: 276 test files passed, 2,475 tests passed (100% green).
  - TypeScript compiler (`npx tsc --noEmit`): 0 errors.
  - Sibling Android App (`SurveyOS Scan`): Gradle unit tests passed (`:app:testDebugUnitTest`) with 0 drift.
- **Commits on `main`:**
  - `7ed523b9` docs(spec): unified claim folder, storage and auto-filing architecture specification and plan
  - `03cca639` feat(storage): per-claim directory handle isolation store
  - `8759fa26` feat(ui): add per-claim folder selector and permission status in ClaimHeader
  - `1cc8436b` feat(documents): unified document ingestion pipeline and per-claim folder integration
  - `8c37d8d8` fix(details-tab): persist direct field uploads and add phone files picker
  - `85d5a5d1` feat(reports): auto-write generated reports directly into claim folder
  - `4073e6ce` fix(photos): deterministic drive photo names and duplicate check integration
- [x] Task 1: Per-Claim Directory Handle Storage (`claim-folder-store.ts`).
- [x] Task 2: Claim Header Folder Allocation Button & Permission Chip.
- [x] Task 3: Universal Document Ingestion Pipeline (`ingest.ts`).
- [x] Task 4: Fix Details Tab Direct Uploads & Add Phone Scans Support.
- [x] Task 5: Automatic Output Filing for Final, Re-inspection, and Spot Reports.
- [x] Task 6: Photo Upload De-duplication & Drive Hygiene.
- [x] Task 7: Full System Verification, Vitest, TypeScript & Scan Drift Tests.

---

## Done: Custom Domain (surveyos.in) Sign-in & OAuth Debugging (2026-11-04, Antigravity)
- [x] Diagnosed sign-in failure on new custom domain `https://surveyos.in` (`auth/unauthorized-domain` + OAuth origin mismatch).
- [x] Identified missing Firebase Auth Authorized Domains and Google Cloud Console OAuth 2.0 Web Client origins.
- [x] Guided owner through adding `surveyos.in` to Firebase Auth and Google Cloud Console.
- [x] Verified live: owner confirmed Google Sign-In and trial onboarding are fully functional on `surveyos.in`.
- [x] Session log created: `Sessions/2026-11-04-custom-domain-auth-debugging.md`.

---

## Done: Re-inspection Surveyor Conclusion & Remarks Editable Defaults (2026-11-04, Antigravity)
- [x] Defined `DEFAULT_REINSPECTION_REMARKS` constant in `src/types/assessment.ts`: "We have re-inspected the captioned vehicle and have found that the repairs / replacement made there were strictly followed as per our final survey report. The salvage of the replaced parts was also verified by me."
- [x] Seeded default in `createBlankClaim()` in `src/types/claim.ts` so new claims start with the standard remark populated.
- [x] Auto-seeded empty observations in `ReinspectionTab.tsx` when opening claims that had empty observations, so surveyors see actual text rather than a ghost placeholder.
- [x] Changed textarea text styling to `text-foreground` and added "Reset to default" button to quickly restore standard phrasing if modified.
- [x] Updated `buildReinspectionHTML` in `reinspection-report-builder.ts` to fallback to `DEFAULT_REINSPECTION_REMARKS` when observations is empty, preventing blank reports.
- [x] Added unit tests in `src/lib/reports/__tests__/reinspection-report.test.ts` for default vs overridden observations. All 2358 tests pass.
- [ ] Owner: verify in Re-inspection tab on a claim and test print/export.

---

## In Progress: User onboarding (2026-11-04, Handed over to Google Antigravity)
- **Handover complete:** Antigravity read all handover documents, protocol, specs, and existing onboarding code (`lib/onboarding/`, `components/onboarding/`).
- Spec and plan: `Specs/2026-11-04-user-onboarding-design.md`, `Sessions/2026-11-04-antigravity-onboarding-takeover.md`.
- [x] Phase 0: disabled tabs explained, AI key labels (provider names stay hidden), empty state, survey type lines, blank-profile banner in Report Center. "Open saved" and the sidebar folder button now work. Deployed.
- [x] Phase 1: welcome, 3-step profile setup, Getting Started checklist. Deployed.
- [ ] Owner: live check feedback on Phases 0 & 1 with a fresh trial account (any feedback comes before new work).
- [ ] Owner: review proposed tab wording for Phase 2A and approve Phase 2 plan (digital garage PDF advice integrated).
- [x] Design review & brainstorming: audited Executive Platinum style with `/ui-ux-pro-max` (slim banner, touch targets, contrast) and completed `/multi-agent-brainstorming` review.
- [ ] Owner: confirm whether the admin-key fallback is on in live `ai_config/routing`; if so the AI key row could say optional.
- [x] Phase 2A: First-visit tips on each tab (`tab-help.ts`, `TabTip.tsx`) with digital PDF guidance and survey-aware next tab.
- [x] Phase 2B: Always-available Help button (`HelpDialog.tsx`, sidebar footer, claim header, mobile drawer).
- [x] Phase 2C: Desktop Dashboard tour using `driver.js` (`dashboard-tour.ts`, 4 stops, reduced-motion safe).
- [x] User Requested: Renamed "Power Print" buttons and labels across the app to "Print PDF" (`SpotActions.tsx`, `SurveyActions.tsx`, `BillCheckTab.tsx`, `FeesTab.tsx`, `ReinspectionTab.tsx`).
- [x] Phase 3: Report section guide in Report Center (`report-guide.ts`, `ReportSectionGuide.tsx`) with insurer check explanations and direct jump-to-fix navigation.
- [x] Phase 4: Admin progress column in `SurveyorsTab.tsx` showing onboarding milestone badges (0/5, 3/5, Ready 5/5) and full onboarding checklist in expanded row (`admin-progress.ts`, `useAdminData.ts`).

---

## In Progress: Past prices for a part (2026-11-03, Claude Code)
- [x] Clock icon + popup on assessment rows (`components/claim/PartHistoryButton.tsx`, `lib/claims/part-history.ts` + tests).
- [x] Deployed 2026-11-03 (motorsurveyos-in).
- [ ] Owner: check in the app on a claim whose model has past claims.

## In Progress: SurveyOS Scan Marketing Video & Google Play Store Launch
- [x] Spec & Design: In-viewer gallery photo stamp mode chips (`[Full]` / `[No Date]` / `[No Stamp]`) with zero empty lines when GPS is missing, lossless restamp from original, and batch application for gallery photos (`Specs/2026-11-05-scan-gallery-stamp-mode-design.md`).
- [x] Implementation Plan: `Specs/2026-11-05-scan-gallery-stamp-mode-implementation-plan.md` created using `writing-plans` superpower.
- [x] Scan Implementation: Added `COMPACT_PHOTO` (~100 KB) & `BALANCED_PHOTO` (~250 KB) to `ImageSizing.kt`, `photoQualityForSize` dynamic quality inferencing, stamp mode detection & transitions in `PageStamp.kt`, `PageFileEdits.restamp` universal redraw, `Dao.setPageStamp`, `Repository` stamp mode & compression batch operations, `ClaimViewModel` reactive bindings, and `PhotoViewer.kt` with live size in KB, 1-tap Compress dialog, and Stamp filter chips with batch apply confirmation dialog.
- [x] Unit Tests: Expanded `StampTextTest.kt` covering mode detection, transitions, zero lines on missing GPS, and quality ranges.
- [x] Documented full Google Play Store Launch Blueprint in `docs/marketing/2026-11-02-surveyos-scan-marketing-video-plan.md` (Accounts, AdMob release guards, upload keystore, `ad_free` IAP, privacy policy URL hosting, 14-day Closed Testing track).
- [x] Documented comprehensive SurveyOS Scan status and updates (WhatsApp/Email document chasing in EN/HI/MR, rejection reasons, "Waiting for" filter chip, Drive sync, on-site fee bill notes, geo-stamped photos).
- [x] Established 5-Act problem-first marketing video narrative sequence (Chaos without app -> Problem defined -> Prominent SurveyOS brand reveal -> Step-by-step transformation -> Resolution & CTA).
- [ ] Next step: Write individual scene prompts (visual direction, camera angles, voiceover, on-screen text) for AI video generators / production crews.
- [x] Owner step: Generated upload keystore, set AdMob IDs, hosted privacy policy, and uploaded signed AAB v1.3 (versionCode 4) to Play Console.

---

## In Progress: Drive cleanup (Plan 4 Task 4, built 2026-11-01 on main, NOT deployed or pushed)
- [x] `lib/drive/cleanup.ts` (`groupForCleanup`, `cleanupTargets`, `trashFolder`) + Profile tab `DriveCleanupSection`; `ClaimData.driveTrashedAt`.
- [ ] Owner: try in a signed-in browser with a completed claim (not tried against real Drive yet).

---

## In Progress: Import phone scans from Drive (Plan 4 Task 2, built 2026-11-01 on main, NOT deployed or pushed)
- [x] `drive-source.ts` + `importScanFiles` core: import Scan's Drive folder, move files into Prime's claim folder, `driveFileId` on documents.
- [ ] Owner: try with a phone on Drive backup › Full (not tried in a browser yet).

---

## In Progress: Scan Drive status sync (Plan 3 Task 5, built 2026-11-01 on main, NOT deployed or pushed)
- [x] `src/lib/drive/scan-status.ts`: port of Scan's `StatusFile` codec and merge (same tests). `scan-status-sync.ts`: find `SurveyOS/Phone Scans/<folder>` by `appProperties.claimId`, read/merge/write `_surveyos-status.json`.
- [x] Claim open (`AuthSyncWrapper`) refreshes `scanChase` from the file; a document upload (`sink.ts`, source `upload`) marks the base DocType slot received by Prime.
- [ ] Owner: try in a signed-in browser with a phone that has Drive backup on (not tried yet).
- [ ] Plan 4: Prime writes `status: "completed"` when the claim is completed.
- [ ] Deferred: asks logged in Prime's Ask dialog are not written to the file (contract: Prime writes the slot only).

---

## In Progress: Scan chase import and Ask for documents (built 2026-11-01 on main, NOT deployed or pushed)
- [x] `planChase`: fill blank insured/workshop fields from Scan's manifest `chase`, store `scanChase` + `scanClaimId`, refuse a zip from another phone claim. Commits `155e618c`, `a46ee91b`.
- [x] Ask message templates (EN/HI/MR) shared with Scan, pinned by Scan's `AskTemplatesTest`. Commit `7fbd16aa`.
- [x] Ask for documents dialog on the Documents tab (WhatsApp or email), slot-key normalisation. Commits `8dc3b150`, `77bd5faa`.
- [ ] Owner: review and approve a push and deploy.
- [ ] Plan 2 says the claim shows slot states and the ask log. Only the Ask dialog reads them so far; confirm before calling it done.
- [x] Rejected slots listed with reason in Ask. Missing slots Prime has since received a document for are dropped; claim-id conflict now asks to relink (2026-11-01).
- [ ] Deferred: insured email field in Prime (Ask uses Scan's email only).
- [ ] Deferred: show slot states and the ask log on the claim outside the Ask dialog.
- [ ] Deferred: mobile number normalisation (Prime's number is stored as typed).

---

## In Progress: Parser-first extraction (built 2026-11-01 on main; deployed to SANDBOX 2026-11-01, not prod, not pushed)
- [ ] Owner: on surveyos-v2-antigravity-in.web.app, upload a few digital estimates and confirm the "Read from the PDF text" note (sandbox deployed 2026-11-01).
- [x] Maruti estimate + final bill and Tata DTC / INTRA / Consolidated layouts (2026-11-01): all 23 sample PDFs read with 0 calls, all match printed totals.
- [ ] Owner: send digital PDFs from other makes (Honda, Mahindra, Toyota, Renault, MG, Skoda/VW, Hyundai estimates) to extend coverage.
- [ ] Phase 2: image-PDF hardening (spec §8): page-coverage retry, per-page totals message.
- [ ] Deferred review minors: see `.superpowers` ledger summary in the session log.

## In Progress: Extraction bench (built 2026-10-31 on main, NOT deployed or pushed)
- [x] Page-order fix, PDF text lines, per-page text/image, `/bench` (sandbox only), limits grouping (empty table), `?sandbox=true` production guard. See `Sessions/2026-10-31-extraction-bench.md`.
- [ ] Owner: approve the sandbox deploy (functions `aiProxy` + hosting `surveyos-v2-antigravity-in`).
- [ ] Owner: on the sandbox `/bench`, add the Pawar PDF, confirm its profile, lock its gold key, enter keys and run.
- [ ] Spec checklist §6.6 A–F before any `page-limits.ts` table goes to production.

## Done: Auto-Split Multi-Page Row Ordering Bug (fixed 2026-10-31, commit fb851ec5: gap-fill appended rows; now page order)
- [x] **Fix Inverted Row Order on Multi-Page Auto-Split:**
  - **Observed Behavior:** In sandbox testing with Ollama (`gemma4:31b`), extracting the first 2 pages of Pawar Brothers' merged estimate PDF triggered the in-flight auto-split fallback (`"Re-reading page 1 of 2 individually..."`, `"Re-reading page 2 of 2 individually..."`). However, Page 2's line items appeared *first* in the assessment sheet, followed by Page 1's items.
  - **Inspection Targets:**
    1. `src/lib/ai/processor.ts` lines 585–601: Check `mergeResponse` and `singleResp` error handling; if page 1 threw during individual pass, `rowCheck` start-gap detector called `fillGaps` which appended page 1 rows after page 2.
    2. `src/stores/slices/aiDataSlice.ts` (`buildEstimateRows`): Sort built rows by printed `srNo` (ascending) when present so items 1..N always precede items N+1..M regardless of network resolution order.
    3. `src/lib/ai/ai-pages.ts` & `src/lib/photos/pdf-to-images.ts`: Verify `apiImages` array order matches `resolveAIPages`.
  - **Verification:** Test with Pawar Brothers estimate pages 1 & 2 on Ollama `gemma4:31b` in sandbox (`https://surveyos-v2-antigravity-in.web.app`).

---

## Multi-Estimate Mode, Auto-Split Fallback & Zero-Login Sandbox (Built 2026-10-30 on main)
- [x] Anonymous Firebase Auth for Sandbox (`src/lib/sandbox.ts`): calls `signInAnonymously(auth)` in the background so backend Cloud Functions (`aiProxy`, `nvidiaProxy`) receive a valid Firebase Auth token without requiring Google OAuth or any login popups.
- [x] Cloud Function BYOK Proxy Exemption (`functions/index.js`): permits anonymous callers in `aiProxy` / `nvidiaProxy` without demanding a paid subscription record in Firestore since the caller supplies their own provider key (BYOK), enabling Ollama (`gemma4:31b`) and NVIDIA NIM in the sandbox. Deployed live to `asia-south1`.
- [x] Zero-Login Sandbox Bypass (`src/lib/sandbox.ts`): auto-detects sandbox environments (hostname containing `sandbox` or `surveyos-v2-antigravity-in`, or query `?sandbox=true`), seeds a virtual authenticated surveyor session (`sandbox-surveyor`), connects virtual Google Drive, activates compliant subscription profile, and drops surveyors directly into the live **Assessment Tab** (`SANDBOX-TEST-01`, `MH-12-AB-1234`) with zero login prompts or Google OAuth popups.
- [x] Eliminated Google OAuth Origin Mismatch (`Error 400: origin_mismatch`): guarded `silentlyRestoreDriveToken()`, `linkGoogleDrive()`, and `uploadFileToDrive()` in `src/lib/drive/index.ts`, guarded `useCloudSync()` and `useSessionHeartbeat()`, and bypassed `signInWithGoogle()` and `signOutUser()` in `src/lib/firebase/auth.ts` during sandbox sessions so Google Identity Services (GIS) never communicates with Google OAuth endpoints from unauthorized preview origins.
- [x] Protected Live Production: Whitelisted bypass strictly for sandbox domains/params; live production users on `https://motorsurveyos-in.web.app` remain 100% guarded by Google Sign-In and cloud Firestore sync.
- [x] Added "Another Estimate (Estimate 2, 3...)" mode (`'another'`) to `EstimateModeDialog.tsx` and `aiDataSlice.ts` (`applyEstimate`). Keeps original printed serials (1..N) without renumbering, keeps all existing assessment rows, and assigns distinct `estimateId` (e.g. `Quote 2`) with automatic view switching via `EstimateViewSwitcher`.
- [x] Implemented Start-of-Document Gap Detection in `src/lib/ai/row-check.ts` (`gapsIn`): flags serials `1..present[0].sr-1` when extracted rows start at `sr > 1`, ensuring early-page drops are immediately detected and targeted for re-read by Smart Fix.
- [x] Implemented In-Flight Auto-Split in `src/lib/ai/processor.ts`: multi-page chunks (2 pages) that fail JSON parsing (e.g. dense 70+ item pages overflowing token caps) automatically split into 1-page-at-a-time calls on the fly, eliminating silent drops.
- [x] Zero prompt changes: `src/lib/ai/prompts.ts` strictly untouched in battle-tested state.
- [x] Sandbox Deployed to Both Channels: `https://motorsurveyos-in--sandbox-izvlcn5z.web.app` and `https://surveyos-v2-antigravity-in.web.app`.
- [x] Full test suite passing (227 files, 1,999 tests); `npx tsc --noEmit` clean (0 errors); Next.js production build verified.

---

## Scan Fee Bill Notes & Unified Inspection Date/Time (Built 2026-10-30 on main)
- [x] Implemented store-level bi-directional sync in Prime (`src/stores/slices/claimSlice.ts`, `src/stores/slices/vehicleSlice.ts`) for Survey/Inspection Date & Time (`dateOfSurvey`/`timeOfSurvey` ↔ `surveyDatetime` ↔ `inspectionDate`), Place (`placeOfSurvey` ↔ `inspectionPlace`), Odometer (`odometer`), Enclosures (`enclosures`), Allotment Date (`dateOfAllotment` ↔ `allotmentDate`), and Report Date (`dateOfReport` ↔ `reportDate`) (commits `83753194`, `5a9dd9f0`).
- [x] Upgraded Valuation Tab in Prime to `type="datetime-local"` labeled "Date & Time of Inspection"; added robust cross-fallbacks across Valuation Report builder (`valuation-report-builder.ts`) and Spot Fee Bill builder (`spot-fee-bill-builder.ts`) (commits `d9a44f29`, `d7f6c5a6`, `068f6a67`, `af743391`).
- [x] Updated Handover Contract (`SurveyOS Scan/docs/handover/prime-notes-import.md`) and Prime Scan Import Engine (`src/lib/scan-import/notes.ts`) with allow-list for 16 `feeBill.*` paths, boolean/number parsing, and survey datetime/place backfills into Spot, Final, and Valuation claim state (commits `7931736b`, `a3b454bf`, Scan `0c4bf85`).
- [x] Upgraded Scan Valuation inspection date to `NoteControl.DATE_TIME`; implemented `SHARED_SYNC_MAP` cross-section draft sync in Room SQLite (`NotesViewModel.kt`) for date/time, place, odometer, and enclosures (commits Scan `13e72204`, `9aeff5b`).
- [x] Defined 16 Fee Bill fields across 6 sections (`BILL`, `FEES`, `TRAVEL`, `PHOTOS`, `EXPENSES`, `TAX`) in Scan (`FeeBillFields.kt`); implemented sticky rate preferences (`ratePerKm: "10"`, `photoRate: "15"`, `includeGST: "yes"`) via SharedPreferences (`FeeRatesStore.kt`); exported `Fee Bill Notes.txt` and `notes.feeBill` snapshot in `_surveyos-scan.json` (commit Scan `ff3227ce`).
- [x] Added 3-way chips (`Spot`, `Valuation`, `Fee Bill`) with horizontal scroll in Scan; built `FeeBillNotes.kt` screen with live calculation cards (`TravelLiveCard`, `PhotosLiveCard`, `TaxLiveCard`), photo count suggestion chip, and guarded sticky rate persistence (commits Scan `e9660f5`, `b55b0b9`).
- [x] All unit tests passing in both repositories: Prime Vitest (227 files, 1,998 tests) and Scan Gradle (`:app:testDebugUnitTest`, 337 tests); `npx tsc --noEmit` clean (0 errors); 100% contract coupling verified.

---

## Unify Goods Description, HPA/Financier, and Valuation Odometer (Built 2026-10-30 on main)
- [x] Implemented store-level bi-directional sync in `src/stores/slices/claimSlice.ts` and `src/stores/slices/vehicleSlice.ts` between `spotDetails.loadDesc` and `vehicle.natureOfGoods`/`vehicle.detailsOfGoodsCarried`, between `policy.hpaWith` and `vehicle.hypothecation`/`vehicle.rcEndorsement`, and between `vehicle.odometer` and `valuationDetails.odometer` (commit `9ffa4788`).
- [x] Consolidated "Nature of Goods" and "Description of Goods" in `src/components/claim/AtAccidentForm.tsx` into a single authoritative "Nature / Description of Goods" input; wired fallback displays and dual-store updates across `PolicyForm.tsx`, `VehicleForm.tsx`, `SurveyForm.tsx`, and `ValuationTab.tsx` (commit `960ff541`).
- [x] Synchronized AI document extraction in `src/stores/slices/aiDataSlice.ts` across `applyRC`, `applyPolicy`, and `applyLokChallan` so HPA, goods description, and odometer update all paired fields uniformly without impacting extraction accuracy (commit `2d4267e3`).
- [x] Added robust cross-fallbacks across report builders (`SpotPrintReport.tsx`, `standard-report-builder.ts`, `uiic-final-builder.ts`, `UIICPrintReport.tsx`, `valuation-report-builder.ts`) ensuring no blank fields appear regardless of where data was entered (commit `04b07835`).
- [x] Full test suite passing (226 test files, 1,987 tests); `npx tsc --noEmit` clean with 0 errors; zero drift on SurveyOS Scan coupling.

---

## Unify GVW, ULW, and Accident Load (Built 2026-10-29 on main)
- [x] Implemented store-level bi-directional sync in `src/stores/slices/vehicleSlice.ts` and `src/stores/slices/claimSlice.ts` between `vehicle.registeredLoadWeight`/`vehicle.grossWeight`/`vehicle.unladenWeight` and `spotDetails.gvw`/`spotDetails.ulw`/`spotDetails.loadCapacity`, plus automatic computation of `spotDetails.loadCapacity` (`gvw - ulw`) (commit `236ec70c`).
- [x] Deduplicated "Goods Weight at Accident" in `src/components/claim/AtAccidentForm.tsx`, leaving single authoritative "Load at Accident (KG)" input with two-way sync to both `spotDetails.actualLoad` and `vehicle.goodsWeightAtAccident` / `vehicle.actualPayload` (commit `49c20d93`).
- [x] Added cross-tab fallback display and synchronized updates between `src/components/tabs/SpotTab.tsx` and `src/components/claim/VehicleForm.tsx` (commit `d3cdea4d`).
- [x] Added robust cross-fallbacks across all report builders (`SpotPrintReport.tsx`, `standard-report-builder.ts`, `uiic-final-builder.ts`, `UIICPrintReport.tsx`) so reports never render blank/missing weights regardless of where data was originally entered (commit `a4d690a9`).
- [x] Synchronized AI document extraction in `src/stores/slices/aiDataSlice.ts` across `applyRC`, `applyFitness`, and `applyLokChallan` (commit `753a1dce`).
- [x] Full test suite passing (223 test files, 1,937 tests); `npx tsc --noEmit` clean with 0 errors; zero drift on SurveyOS Scan coupling.

---

## Fix Browser Storage Exhaustion & Memory Cleaner (Built 2026-10-29 on main)
- [x] Switched default photo canvas compression in `src/lib/photos/compress-image.ts` and `src/hooks/usePhotoUpload.ts` from lossless PNG (1.6 MB) to high-quality JPEG 0.85 (~40 KB), reducing photo payload by ~95% in `claim.photos` (commit `7bbf6703`).
- [x] Guarded `uploadFileToDrive` and `usePhotoUpload` in `src/lib/drive/index.ts` to prevent hoarding raw uncompressed camera files in `driveQueue` when Google Drive is unlinked (commit `2ca322fe`).
- [x] Added `getStorageUsageSummary()`, `clearDriveQueue()`, and `clearRecoveredClaims()` to `src/lib/storage/indexeddb.ts` with unit tests in `src/lib/storage/__tests__/prune-storage.test.ts` (commit `75366034`).
- [x] Built `StorageCleanerSection.tsx` with live storage metric cards and 1-click memory cleanup; factored `SubscriptionSection.tsx` out of `ProfileTab.tsx` to reduce file size from 950 to 729 lines (≤ 800 line rule compliance) (commit `a28bdccb`).
- [x] Full test suite (220 files, 1,906 tests) passing; `tsc --noEmit` clean with 0 errors; zero impact on SurveyOS Scan coupling.

---

## Unify Survey Date & Time in Claim Details (Built 2026-10-28 on main)
- [x] Resolved duplicate survey date and time inputs across Spot and Final claims in `src/components/claim/SurveyForm.tsx`.
- [x] Consolidated into a single `datetime-local` input labeled "Date & Time of Survey" across both claim types; removed separate "Time of Survey" and spot-specific "Survey Datetime (Actual)".
- [x] Implemented synchronized updates to both `accident.dateOfSurvey` / `accident.timeOfSurvey` and `spotDetails.surveyDatetime` to maintain 100% backward compatibility.
- [x] Updated `src/components/print/SpotPrintReport.tsx` (headers and section C) to cross-fallback between `spotDetails.surveyDatetime` and `accident.dateOfSurvey` / `accident.timeOfSurvey`, preventing discrepancies or blank spots in printed reports.
- [x] Updated `src/lib/claims/survey-date.ts` with fallback support for spot claims.
- [x] Added unit tests in `src/components/claim/__tests__/SurveyForm.test.tsx` and updated `src/lib/claims/__tests__/survey-date.test.ts`. All 216 test files (1,894 tests) passing; `tsc --noEmit` clean; SurveyOS Scan Android unit tests passing with zero drift.

---

## Estimate View Lenses, Prompt Overhaul & Lean Header (Built 2026-10-28 on main)
- [x] Rewrote `RAW_PROMPTS['estimate']` and `RAW_PROMPTS['final-bill']` in `src/lib/ai/prompts.ts` with Footer-First Deductive Reconciliation, full assessment fields (`part_number`, `hsn_sac`, `quantity`, `unit_price`, `taxable_amount`, `gst_percent`, `total_amount`, `category`), and `_audit` envelope.
- [x] Added `AuditCard` to `AIReviewDialog.tsx` showing tax posture badge, columns detected, reconciliation notes, and warnings. `stripPageTags()` removes `_audit` prior to persistence.
- [x] Added `estimateId` to `AssessmentRow` and auto-derived in `buildEstimateRows()` (`aiDataSlice.ts`).
- [x] Streamlined Assessment tab header into a lean ~36px toolbar, recovering >200px vertical table space; converted `PolicyCheckStrip` into an inline badge chip with popover card.
- [x] Added `EstimateViewSwitcher` lens and `EstimateTallyBanner` above `AssessmentGrid` for multi-quotation filtering and live totals tally without mutating the underlying flat row array.
- [x] Added visual left-border color accents to `AssessmentSectionTable` rows when 2+ estimates exist.
- [x] All 215 test files (1,890 tests) passing; zero regressions. Commits on `main`.

---

## Surveyor feedback round 1 — built 2026-10-27 (on main, not pushed/deployed)

- [x] Closed the last "Fix estimate reading" gap: repeat copies of a row the re-read *changed* are no longer offered as "missing" (88f1ccd1).
- [ ] Owner in-app check on one real claim: all 9 items (see session log 2026-10-27-surveyor-feedback-round-1).
- [ ] Owner: open a UIIC final + bill-check Word download in Word and confirm page breaks.
- [x] Deployed hosting to motorsurveyos-in 2026-10-27 (verified live). Not pushed to GitHub.
- [x] Nav cleanup: hidden Insured Report behind admin gate; removed Learning and Feature Overview tabs (a3ae84a6). Deployed to motorsurveyos-in.

---

## Bill Check Reference Serial Numbers
- [x] Brainstorming & specification approved: `Specs/2026-10-27-bill-check-reference-serial-design.md` (2026-10-27).
- [x] Implementation plan creation & execution following Ponytail design principles.
- [x] Model & Grid: `refSrNo` + `refStatus` on `AssessmentRow`; `baseDocument` + `refColumnTitle` on `BillCheckDetails`.
- [x] Grid UI: Added editable Reference column (`width: 80px`, red italic font) with click-to-rename header and amber dot for ambiguous rows.
- [x] 400-Line Ergonomics: Added "Review Ref Numbers (N)" toggle filter in `BillCheckGrid` to filter down to uncertain/unmatched items without review fatigue.
- [x] Standard Report: Appended Reference column on far right of section 9 (`width: 4.5%`, deducted from particulars; currency widths preserved); subtotal rows use merged trailing span to avoid whitespace waste; header customizable (`refColumnTitle` or defaults to `Bill No.` / `Est. No.`).
- [x] UIIC Report: Appended Reference column as 13th column in `buildUIICBillCheckHTML`; red italic font; all sections and subtotals aligned to 13 columns; UIIC regular final report unaffected (12 columns preserved).
- [x] Automated matching: `applyFinalBill` extracts `srNo` from invoice lines and tags matched estimate rows with `refSrNo` and `refStatus` (`clean` vs `ambiguous`).
- [x] Unit Tests: Created `src/lib/reports/__tests__/bill-check-ref-sr-no.test.ts` (10 tests passing); updated existing column span tests; 36 report test files (348 tests) passing; `tsc --noEmit` clean.

---

## Bramha — Next Steps (Phase 2)

- [ ] **Admin Simulator UI** — hidden admin page to run test RAG queries against `bramha_memories` and tune prompts
- [ ] **Fraud detection UI** — query `bramha_memories` by policyNumber/vehicleRegistration to flag repeat claimants
- [ ] **Hotspot map** — aggregate `placeOfAccident` field from `bramha_memories` and display on map
- [ ] **Node.js runtime check** — `functions/package.json` already declares `"node": "22"`; confirm in the Firebase console that the deployed functions run on Node 22 before 2026-10-30 (Node 20 decommissioned that day).
- [ ] **firebase-functions upgrade** — current version outdated; upgrade has breaking changes, do carefully

## Reported Bugs

- [ ] **Sign-in loop** — Google Auth completes but returns to landing page; no Drive connection request shown. Needs investigation in auth flow + Drive token handling.

## In Progress

- [ ] **Use phone files — browser checks** (2026-10-25). A **Use phone files** button picks imported phone (`'scan'`) files on Assessment → Upload Estimate, Bill Check → invoice, and the Photos tab (**Phone photos** dialog: grouped, Select all, nothing reaches the sheet without **Add to photo sheet**; already-added photos are disabled). On `main`, **NOT pushed, NOT deployed, not tried in a signed-in browser.**
  - **Owner:** run the "Use phone files" checks U1–U12 in `Sessions/2026-10-25-bring-phone-scans.md`.

- [ ] **Bring phone scans — enable Picker API + browser checks** (2026-10-25). Prime imports SurveyOS Scan zips (from Drive or this computer) with a vehicle check, a phone notes review and Phone files ticks. The Documents tab is cleaned up, and Scan no longer syncs to Drive. All on `main` in both repos, **NOT pushed, NOT deployed, not tried in a signed-in browser.**
  - **Owner/controller one-time step:** enable the **Google Picker API** in `surveyos-v2-antigravity-in`. If the Firebase web key is API-restricted, add the Picker API to it, or set `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`. Until then, "From Google Drive" falls back to the local chooser.
  - **Owner:** run checks 1–18 in `Sessions/2026-10-25-bring-phone-scans.md`.
  - **Controller:** run the Scan phone checks.
  - A future CSP must allow `apis.google.com`, `docs.google.com` and `www.googleapis.com`.

- [ ] **Claim Details layout — live check** (2026-10-25) — regrouped by document with dates on the right, vehicle type switch, tax/overload/span fixes; commit ea2a9ed6, deployed to motorsurveyos-in 2026-10-25 10:18. **Owner: open one spot, one final and one valuation claim; flip the vehicle switch once; scan an RC and confirm fields fill.** Session log `Sessions/2026-10-25-claim-details-layout.md`.

- [ ] **Surveyor feedback batch — live check** (2026-10-22) — date/time parsing, AI Review evidence viewer, select/unselect all, Rephrase with AI, page jump: all deployed to motorsurveyos-in 2026-10-22 15:54. **Owner: on one real claim, re-read the claim form → check accident date/time, press Rephrase on the cause, click a field in AI Review/Reconciliation and confirm it opens the right page.** Add more of Vikram's paragraphs to `EXAMPLES` in `src/lib/ai/rephrase-cause.ts` when available (3 so far). Session log `Sessions/2026-10-22-surveyor-feedback-batch.md`.

- [ ] **Portal fill extension — multi-portal** (2026-10-16) — **2026-10-17: Stage A done on `main` (v0.4.0: Check page + redesigned card), NOT deployed, card not yet tried in a browser. Next: Stage B on the live NIA portal (owner logs in; Claude in Chrome, read-only). Owner: run the fixture walk-throughs (`extension/README.md`, load `dist/unpacked-dev`) and approve a hosting deploy (map versions moved: NIA 3, UIIC 2).** Earlier: — roadmap `docs/superpowers/plans/2026-10-16-portal-extension-roadmap.md`. Phases 1–2 done on `main` (fcfff741): multi-portal core + **UIIC claim-survey fill**, extension v0.3.0. Hosting deployed to motorsurveyos-in 2026-10-16 (hosted maps NIA v2, UIIC v1 verified live). Extension not tried in a browser. Owner: fixture walk-throughs (NIA + UIIC) on the v0.3.0 zip; Phase 0 in India (NIA + UIIC Stage 0 on closed claims, capture sweep); decide uiicText space-vs-delete. Next code: Phase 3 (NIA tie-ups, needs a spec) or Phase 4 (National Insurance) after captures. Session logs `Sessions/2026-10-16-portal-extension-phase-1.md`, `…-phase-2.md`.

- [ ] **Claim document kit — Phases 1–2** (2026-10-21) — built on `main` (commits 7181ae3c..f510fbae): document types and page labels, per-device fingerprints, free page recognisers, identity checks, portal recipes (NIA non-tieup, NIA KIA tie-up provisional, UIIC), Ready/Check/Missing checklist, upload files in `Portal Upload/`, Review, folder choice, three Documents-tab panels. **NOT deployed, not tried in a browser. Owner: confirm recipe defaults in spec §8(b)–(d). Next: Phases 3–5 (Google Drive online picker, opt-in AI "Guess the rest", extension upload).** Spec `docs/superpowers/specs/2026-10-20-claim-document-kit-design.md`, plan `docs/superpowers/plans/2026-10-20-claim-document-kit.md`.

- [ ] **Phone site capture — phone checks + deploy** (2026-10-03) — P1–P3 deployed to motorsurveyos-in 2026-10-03 (hosting, 93f625b0). Owner: run the phone checklist in `Sessions/2026-10-03-phone-site-capture.md`. Then P4 plan (phone restyle of form tabs + deferred items listed there).
- [ ] **Phase 2-C admin steps + L11** (2026-09-17) — deployed (hosting, 96098c6f). Owner: Admin → Save, then Probe all, review Excluded (L11).
- [ ] **Live check L10** (2026-09-16) — Phase 2-A deployed (hosting, e7c1a997). L10 in `Sessions/2026-09-16-quota-aware-ranking.md`.
- [ ] **Live check L9** (2026-09-16) — Smart Fix deployed (hosting, 56b44714). Run L9 (`npm run dev`, open with `?ai-drop=38`, upload DTC Proforma Invoice-1.PDF as estimate — expect one extra single-page call and a clean dialog).
- [ ] **AI fallback — Phase 1 live checks** (2026-09-16) — code deployed; L0–L8 from `docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md` Task 14 still to run in the live app with the owner's AQ. + Ollama keys (`?ai-fault=503|429-minute|429-day|429-zero` for induced failures).
- [ ] **AI fallback — Phase 2-B/D** — 2-B discovery + models.dev deprecation filter + persistent NEW detection (no accuracy benchmark — owner rejected); 2-D Profile provider rows with Test buttons, remove surveyor model pickers + legacy `models`/`defaultModel`/`resolveEnabledModel`/`AIControls` picker; consider a fourth `other` tier for non-Gemini non-gemma models. Carried minors in the 2026-09-16 session logs.

- [ ] **IndexedDB memory optimization** — 40 MB photo storage bloat
  - **Plan:** Client-side compression + schema splitting + soft archiving (50 claim limit)
  - **Status:** Planning complete, no code changes yet
  - **Next step:** Implement compression in `src/stores/claim-store.ts`
  - **Key files:** `claim-store.ts`, `src/lib/storage/indexeddb.ts`, `src/types/claim.ts`, `PhotosTab.tsx`

---

## Pending — High Priority

- [ ] Rotate Firebase API key (leaked in git history — see [[Security_Audit]])
  1. Firebase Console → Project Settings → Regenerate Web API Key
  2. Update `.env.local` and `.env.production`
  3. `npm run build && firebase deploy --only hosting`
- [ ] Move Google Drive OAuth token from localStorage to secure storage
- [ ] Add CSP headers to `firebase.json`
- [ ] Sanitize claim text before injecting into AI prompts (H-3)

## Pending — Medium Priority

- [ ] Firebase App Check integration
- [ ] GDPR data deletion endpoint
- [ ] Unit test coverage to 80% (currently 3 test files)
- [ ] Client-side rate limiting for AI extraction (free-tier: 10 RPM gemini-2.5-flash)
- [ ] Session timeout for authentication (currently no expiry)
- [ ] Role-based access beyond active/pending/dismissed
- [ ] Fix profile path — sync.ts writes `profile/main`, AdminDashboard reads `profile/current` (M-4)
- [ ] Firestore field-level validation + doc size limits (M-3)

## Pending — Low Priority / Open Questions

- [ ] Insured Report dialog reads policy images from a dead sessionStorage key (`evidence_<claimId>_policy`, nothing writes it) — falls back to an upload, so it works; switch to the evidence store's blob files.

- [ ] AI PDF page selection — auto-suggest junk pages from the local text layer (heuristic pre-ticking). Follow-up from `docs/superpowers/specs/2026-09-17-ai-pdf-page-selection-design.md` Non-Goals.
- [ ] AI PDF page selection — text-instead-of-image optimisation for digital PDFs (skip rasterizing pages with a clean text layer). Separate investigation, same spec's Non-Goals.
- [ ] AI upload PDF page selection — deployed to motorsurveyos-in 2026-09-17 (d13d28fc). Manual E2E (spec §5) still pending on live site.
- [ ] Should report numbers sync to Firestore for multi-device access?
- [ ] Should Standard and UIIC report formats get parity enforcement?
- [ ] Update ANTIGRAVITY_BIBLE.md (AI model reference is outdated)

---

## Blocked

- (none)

---

## Recently Completed

- [x] Portal fill extension Phase 1 — multi-portal core, v0.2.0 (2026-10-16) — maps chosen by host + exact route, one map per flow in storage (v0.1.0 `map` key migrated), wrong-portal packets refused, controller-less scope lookup, build/test over every overlay. 1424 tests.
- [x] Portal fill extension v0.1.0 (2026-09-21) — NIA non-tieup filler, `extension/`; spec `docs/superpowers/specs/2026-09-20-portal-fill-extension-design.md`. Stage 0 on live portal pending.
- [x] Claim Documents (2026-09-21) + vehicle/insurer folder names, folder scan, one-time tidy-up (2026-09-22/23).
- [x] NIA Assessment Excel generator (2026-09-18) — spec `docs/superpowers/specs/2026-09-18-nia-assessment-excel-design.md`.
- [x] UIIC portal summary panel (2026-08-31) — spec `docs/superpowers/specs/2026-08-31-uiic-portal-summary-design.md`.

- [x] AI upload PDF page selection (2026-09-17) — multi-page PDFs into any AI upload (estimate, final bill, RC/DL/policy, Documents, Sync) get a page picker; unticked pages are never rasterized (zero tokens). `ai-pages.ts` WeakMap carrier, shared `PdfPageGrid`, `needsReview` gate extended. 1239 tests. deployed to motorsurveyos-in 2026-09-17. Manual E2E (spec §5) not run — no credentials in session. Session log: `Sessions/2026-09-17-ai-pdf-page-selection.md`.
- [x] AI fallback — Phase 2-C admin ranked lists + veto (2026-09-17) — schema 2, guard rails, shared `poolFromProbes`, editable limits, tab split. 1222 tests. Session log: `Sessions/2026-09-17-admin-ranked-lists.md`.
- [x] AI fallback — Phase 2-A quota-aware ranking (2026-09-16) — tier + per-key daily budget ordering, Pacific-day ledger, Ollama 1 h rest, Flash reserved for estimates. 1184 tests. Session log: `Sessions/2026-09-16-quota-aware-ranking.md`.
- [x] Smart Fix — missed-row detection (2026-09-16) — serial-gap + printed-gross check, page-targeted gap fill, gross-only second opinion, review-dialog card. Spec/plan `2026-09-16-smart-fix-missed-rows*`. 1150 tests. Session log: `Sessions/2026-09-16-smart-fix-missed-rows.md`.
- [x] AI fallback — Phase 1 (2026-09-16) — Google's AQ. keys broke extraction (fixed 2026-09-15, 7b1ff921); the follow-up redesign makes model choice automatic: every call declares a job (heavy/light/text), a pure ranker orders every reachable model, the loop hops models before keys and never retries a 503 in place (measured: a 503 takes up to 194 s to return). Gemini 429s are classified by `quotaId`; Ollama Cloud's free Gemma 4 is a proxied fallback (measured Δ0.01 % on a 5-page estimate); thinking is off for extraction (2.5 Flash was truncating); a document whose rows don't add up is re-run once on the next model. NVIDIA keys had been leaking to Firestore — stripped and purged. Spec: `docs/superpowers/specs/2026-09-15-ai-fallback-and-job-routing-design.md`; plan: `docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md`. 1105 tests. Session log: `Sessions/2026-09-16-ai-fallback-phase-1.md`.
- [x] Reinspection fields — sync all RI/print data to Reinspection tab (2026-09-15) — Reinspection tab now captures every field the RI report prints: RI ref, place of survey, RI/authority/estimate dates. Two-way sync with Report No, insurer, offices, accident and survey dates. Photo sheet Report No is session-local (never persisted). RI report drops Date of Report, Survey Ref No, Survey Date. Place of survey fallback: `ri.placeOfSurvey || accident.placeOfSurvey`. Dead fields `ri.surveyRef` and `ri.surveyDate` remain on type for old data but nothing reads them. Session log: `Sessions/2026-09-15-reinspection-fields.md`.
- [x] Salvage — basis and a Bill Check figure of its own (2026-08-21) — the suggested salvage range was struck on the garage's estimate for metal parts, pre-GST, over every metal row including ones the surveyor rejected; new `salvageBasis(rows, lens)` in `src/lib/calculations/salvage.ts` strikes it on allowed metal parts only, at their assessed amount, with each row's own GST. The Bill Check shared the final report's `salvageValue` with no box to change it, so a part the workshop never replaced kept earning salvage the insurer never receives; new optional `feeBill.billSalvage` is bill-check-only — a typed figure wins outright, otherwise `resolveBillSalvage` rescales the final report's salvage by how far the metal basis moved (both directions, never written back to `salvageValue`). One `SalvageInput` component now serves both tabs; the Bill Check tab renders it beside Final Liability. Both bill-check report builders print the resolved figure — the standard builder branches on `mode`, since it serves the Final Survey Report from the same salvage read, and a regression test pins that the filed report never prints a bill-check figure. Every figure is a suggestion; nothing overrides a number the surveyor has typed. Spec: `Specs/2026-08-21-salvage-basis-and-bill-check-salvage-design.md`; plan: `docs/superpowers/plans/2026-08-21-salvage-basis-and-bill-check-salvage.md`. 863 tests passing. Screen behaviour (the box, the carried-over note, the live band) not verifiable without a real login — needs exercising on a live claim.
- [x] Bill Check — the cap, the flags and the estimate figures (2026-08-20) — three parts, ten tasks, deployed. **Estimates:** `calculateAssessmentSummary` summed `estimatePartsBase` over every row but split it by material over allowed rows only, so every summary table printing both showed a heading its own breakdown did not add up to; the `allowed` guard is gone from the split and the Standard builder's private duplicate of that maths is deleted in favour of the engine's. §8 column now reads `Estimated (before GST)`; §9 gained Estimate and Assessed subtotals (its label used to span six columns and swallow them); §8's Billed total ties to the invoice, deducting rejected-but-billed items on one aggregate line. **Cap:** `billCheckAssessed` returns `min(assessed, billedTaxable)` — the bill caps the claim per item, bill-check only, never touching the Final Survey Report. **Flags:** new `bill-check-flags.ts` derives one rule in both directions (billed under over-claims against the insurer, billed over leaves the insured paying), diagnosed by the estimate as the third number; a mark per row opens an in-place explanation, a two-tier banner carries bulk actions, and blocking flags gate printing. `partial` status retired (it changed no arithmetic and compared against the wrong number); `billVerified` added. Spec: `Specs/2026-08-18-bill-check-cap-and-flags-design.md`; plan: `docs/superpowers/plans/2026-08-18-bill-check-cap-and-flags.md`. 836 tests passing. Screen behaviour not verifiable without a real login — needs exercising on a live claim.
- [x] UIIC report — Depreciation Amount column (2026-08-18) — rupee value beside `Part Depreciation` %, in both the UIIC final report and the UIIC bill check item table. Shipped alongside the labour/paint column split ("Part with GST" / "Labour with GST" / Paint) and per-line tax and depreciation throughout.
- [x] Standard Bill Check report + grid alignment (2026-08-18) — new `mode: 'bill-check'` on the Standard Final Survey builder (row projection, no new calculations); Standard | UIIC toggle on the Bill Check tab; `billAllowed` field + AllowanceScopeDialog so a bill-check allowance can't silently rewrite an issued Final Survey Report; PendingRowsDialog blocks printing on unchecked items; MissingRemarkDialog warns (non-blocking) on undocumented rows; Bill Check grid gained Dep%/Net/Price+GST and corrected column labels via a shared `grid-columns.ts`. Spec: `Specs/2026-08-18-standard-bill-check-design.md`; plan: `docs/superpowers/plans/2026-08-18-standard-bill-check.md`. 742 tests passing.
- [x] Fixed UIIC "Repairs As Per Assessment" defaulting to YES with no reinspection on record (2026-08-18)
- [x] Project reorganization and vault restructure (2026-05-21)
- [x] Excel-style grid paste for AssessmentGrid (2026-05-16)
- [x] Pass 2.5 AI enrichment for insured reports (2026-05-15)
- [x] Subscription lifecycle system (2026-05-17)
- [x] Hide/Show financial summary toggle (2026-05-17)
- [x] Dashboard navigation race condition fix (2026-05-12)
- [x] DL expiry reporting fix (2026-05-12)
- [x] GVW/RLW & seating capacity regression fix (2026-05-12)
- [x] Valuation / break-in inspection report (2026-04-26)

---

## Key Decisions (Carry Forward)

1. All 3 spot report formats must stay identical — SpotPrintReport.tsx is source of truth
2. 4 report renderers exist (UIIC, Standard, Word, PDF) — only spot reports have parity enforcement
3. Admin access = `isAdmin` flag OR master UID — prevents lockout if Firestore resets
4. Report numbers are local (localStorage only, not synced, reset yearly)
5. Cloud sync distinction: "Auto Push Files" = photos/docs only; profile backup always syncs
6. Photo Sheet Generation feature MUST be kept (not deleted)
