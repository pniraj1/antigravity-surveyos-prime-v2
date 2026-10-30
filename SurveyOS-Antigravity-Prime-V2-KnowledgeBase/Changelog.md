# Changelog

> Most recent entries at the top. Updated by whichever agent makes changes.

## 2026-10-30 (Antigravity) — Revert Over-engineered Estimate/Bill Extraction Prompts
- revert(ai): **Restored Battle-Tested Estimate & Final Bill Prompts** (`src/lib/ai/prompts.ts`, `src/lib/ai/__tests__/prompts-estimate.test.ts`).
  - Reverted experimental footer-first deduction rule, top-level `_audit` envelope, and extra per-row fields that had caused token limit blowouts and unparseable truncated JSON on dense bills (e.g. Pawar quotation pages 1–2).
  - Restored clean, direct row extraction into `spare_parts`, `labour_items`, and `painting_items` with standard fields (`sr_no`, `description`, `part_number`, `hsn_sac`, `taxable_amount`, `cgst_amount`, `sgst_amount`, `total_amount`, `gst_percent`, `category`).
  - All 227 test files (1,997 tests) passing; `next build` static export clean; deployed live to Firebase Hosting.

## 2026-10-30 (Antigravity) — Scan Fee Bill Notes & Unified Inspection Date/Time
- feat(store): **Store-Level Bi-Directional Sync for Shared Inspection Metadata** (`src/stores/slices/claimSlice.ts`, `src/stores/slices/vehicleSlice.ts`).
  - Added two-way state synchronization between `accident.dateOfSurvey` & `accident.timeOfSurvey`, `spotDetails.surveyDatetime`, and `valuationDetails.inspectionDate`.
  - Added two-way state synchronization between `accident.placeOfSurvey`, `spotDetails.placeOfSurvey`, and `valuationDetails.inspectionPlace`.
  - Added two-way state synchronization between `accident.dateOfAllotment` and `valuationDetails.allotmentDate`, and `accident.dateOfReport` and `valuationDetails.reportDate`.
  - Added two-way state synchronization between `spotDetails.enclosures` and `valuationDetails.enclosures`.
  - Added unit test suite in `src/stores/slices/__tests__/inspection-fields-unification.test.ts` (22 tests).
- feat(ui): **Valuation Tab Datetime Upgrade & Report Fallbacks** (`src/components/tabs/ValuationTab.tsx`, `src/components/claim/SurveyForm.tsx`, `src/lib/reports/valuation-report-builder.ts`, `src/lib/reports/spot-fee-bill-builder.ts`).
  - Upgraded Valuation Inspection Date input to `type="datetime-local"` labeled "Date & Time of Inspection".
  - Wired robust cross-fallbacks for inspection date, place, odometer, and enclosures in Valuation Report builder and Spot Fee Bill builder.
  - Added unit test suite in `src/lib/reports/__tests__/valuation-report-fallbacks.test.ts` (4 tests).
- feat(scan-import): **Handover Contract & Fee Bill Notes Import** (`SurveyOS Scan/docs/handover/prime-notes-import.md`, `src/lib/scan-import/notes.ts`).
  - Added specification for 16 `feeBill.*` fields and `Fee Bill Notes.txt` format.
  - Allow-listed 16 `feeBill.*` paths, added boolean/number parsing, and auto-backfilled survey datetime/place across Spot, Final, and Valuation claim state.
  - Added unit tests in `src/lib/scan-import/__tests__/notes.test.ts` (16 tests).
- feat(scan-android): **SurveyOS Scan: Valuation Datetime & Cross-Section Draft Sync** (`ValuationFields.kt`, `ValuationExport.kt`, `NotesViewModel.kt`, `ValuationNotes.kt`).
  - Upgraded Valuation inspection date control to `NoteControl.DATE_TIME` ("Date & Time of Inspection").
  - Implemented `SHARED_SYNC_MAP` cross-section draft sync in Room SQLite for date/time, place, odometer, and enclosures.
  - Added unit tests in `ValuationFieldsTest.kt` and `ValuationExportTest.kt`.
- feat(scan-android): **SurveyOS Scan: Fee Bill Fields, Sticky Rates, and Export** (`FeeBillFields.kt`, `FeeRatesStore.kt`, `FeeBillExport.kt`, `NotesExport.kt`, `ValuationExport.kt`, `Exporter.kt`, `SafExport.kt`, `Repository.kt`).
  - Defined 16 fee billing fields across 6 sections (`BILL`, `FEES`, `TRAVEL`, `PHOTOS`, `EXPENSES`, `TAX`) plus calculation helpers.
  - Implemented sticky rate preferences (`ratePerKm: "10"`, `photoRate: "15"`, `includeGST: "yes"`) via SharedPreferences.
  - Exported `Fee Bill Notes.txt` and `notes.feeBill` snapshot in `_surveyos-scan.json`.
  - Added unit tests in `FeeBillFieldsTest.kt`, `FeeBillExportTest.kt`, and `NotesExportTest.kt`.
- feat(scan-android): **SurveyOS Scan: Fee Bill Notes UI & Live Calculations** (`FeeBillNotes.kt`, `NoteFields.kt`, `NotesTab.kt`, `ClaimScreen.kt`).
  - Added 3-way chips (`Spot`, `Valuation`, `Fee Bill`) with horizontal scrolling.
  - Built `FeeBillNotes.kt` screen with live calculation cards (`TravelLiveCard`, `PhotosLiveCard`, `TaxLiveCard`), photo count suggestion chip, and guarded sticky rate persistence.
- tests: Full test suites passing in both projects: Prime Vitest (227 files, 1,998 tests) and Scan Gradle (`:app:testDebugUnitTest`, 337 tests); `npx tsc --noEmit` clean (0 errors); 100% coupling verified.

## 2026-10-30 (Antigravity) — Unify Goods Nature/Description, HPA/Financier, and Valuation Odometer
- feat(store): **Bi-Directional Store Sync for Goods, HPA, and Odometer** (`src/stores/slices/claimSlice.ts`, `src/stores/slices/vehicleSlice.ts`).
  - Added two-way state synchronization between `spotDetails.loadDesc` and `vehicle.natureOfGoods` / `vehicle.detailsOfGoodsCarried`.
  - Added two-way state synchronization between `policy.hpaWith` and `vehicle.hypothecation` / `vehicle.rcEndorsement`.
  - Added two-way state synchronization between `vehicle.odometer` and `valuationDetails.odometer`.
  - Added unit test suite in `src/stores/slices/__tests__/goods-hpa-odometer-sync.test.ts` (8 tests).
- fix(claim): **Form Consolidation & Fallbacks across Claims and Valuation** (`src/components/claim/AtAccidentForm.tsx`, `src/components/claim/PolicyForm.tsx`, `src/components/claim/VehicleForm.tsx`, `src/components/claim/SurveyForm.tsx`, `src/components/tabs/ValuationTab.tsx`).
  - Replaced separate "Nature of Goods" and "Description of Goods" inputs in `AtAccidentForm.tsx` with a single unified input: "Nature / Description of Goods" (`c-goods`).
  - Wired cross-fallbacks for HPA / Financier across `PolicyForm.tsx` and `VehicleForm.tsx`.
  - Wired cross-fallbacks for Odometer across `SurveyForm.tsx` and `ValuationTab.tsx`.
  - Added unit tests in `src/components/claim/__tests__/AtAccidentForm.test.tsx` and `src/components/claim/__tests__/HpaAndOdometerFormSync.test.tsx` (16 tests).
- feat(ai): **AI Extraction Alignment for HPA, Goods, and Odometer** (`src/stores/slices/aiDataSlice.ts`).
  - `applyRC`: sets `vehicle.hypothecation`, `vehicle.rcEndorsement`, `policy.hpaWith`, and synchronizes odometer to both `vehicle` and `valuationDetails`.
  - `applyPolicy`: propagates `hpa_with` to `policy.hpaWith`, `vehicle.hypothecation`, and `vehicle.rcEndorsement`.
  - `applyLokChallan`: synchronizes `data.goods_description` across `spotDetails.loadDesc`, `vehicle.natureOfGoods`, and `vehicle.detailsOfGoodsCarried`.
  - Added unit tests in `src/stores/slices/__tests__/aiDataSlice.test.ts`.
- fix(reports): **Robust Cross-Fallbacks in Report Builders** (`src/components/print/SpotPrintReport.tsx`, `src/lib/reports/standard-report-builder.ts`, `src/lib/reports/uiic-final-builder.ts`, `src/components/print/UIICPrintReport.tsx`, `src/lib/reports/valuation-report-builder.ts`).
  - Spot Report & Standard Final Report fall back across `spotDetails.loadDesc`, `vehicle.natureOfGoods`, and `vehicle.detailsOfGoodsCarried`.
  - HPA / Financier falls back across `policy.hpaWith`, `vehicle.hypothecation`, and `vehicle.rcEndorsement` in Spot, Standard, UIIC Final, and UIIC Print.
  - Valuation Report builder falls back to `vehicle.odometer` when `valuationDetails.odometer` is blank.
  - Added unit tests in `src/lib/reports/__tests__/tp-and-load-challan.test.ts` (23 tests).
- tests: Full test suite passing (226 files, 1,987 tests); `npx tsc --noEmit` clean (0 errors); zero drift on SurveyOS Scan coupling.

## 2026-10-29 (Antigravity) — Unify GVW, ULW, and Accident Load
- feat(store): **Store-Level Bi-Directional Synchronization** (`src/stores/slices/vehicleSlice.ts`, `src/stores/slices/claimSlice.ts`).
  - Added two-way state synchronization between `vehicle.registeredLoadWeight`/`vehicle.grossWeight`/`vehicle.unladenWeight` and `spotDetails.gvw`/`spotDetails.ulw`/`spotDetails.loadCapacity`.
  - Automatically calculates Legal Load Capacity (`(gvw > ulw && ulw > 0) ? gvw - ulw : (gvw || 0)`) whenever either weight changes in either slice.
  - Synchronizes `spotDetails.actualLoad` (number) and `vehicle.goodsWeightAtAccident` / `vehicle.actualPayload` (string).
  - Added unit test suite in `src/stores/slices/__tests__/weights-and-load-unification.test.ts` (11 tests).
- fix(claim): **Deduplicate Accident Load in AtAccidentForm** (`src/components/claim/AtAccidentForm.tsx`).
  - Removed redundant "Goods Weight at Accident" input (`v-goods-weight`), leaving a single authoritative "Load at Accident (KG)" input (`c-actual-load`).
  - Synchronizes changes to both `spotDetails.actualLoad` and `vehicle.goodsWeightAtAccident`/`vehicle.actualPayload`.
  - Added unit tests in `src/components/claim/__tests__/AtAccidentForm.test.tsx` (4 tests).
- feat(claim): **Cross-Tab Weight Reflection** (`src/components/tabs/SpotTab.tsx`, `src/components/claim/VehicleForm.tsx`).
  - `SpotTab` Load Capacity card now displays fallback values from `vehicle.registeredLoadWeight` and `vehicle.unladenWeight` and automatically computes payload capacity.
  - Updates in `SpotTab` synchronize back to `vehicle` and vice versa.
  - Added unit tests in `src/components/tabs/__tests__/SpotTabWeights.test.tsx` (7 tests).
- fix(reports): **Robust Cross-Fallbacks Across All Report Builders** (`src/components/print/SpotPrintReport.tsx`, `src/lib/reports/standard-report-builder.ts`, `src/lib/reports/uiic-final-builder.ts`, `src/components/print/UIICPrintReport.tsx`).
  - Spot Report Section C and Section E now cross-fallback across `spotDetails` and `vehicle` for GVW, ULW, legal capacity, and actual load.
  - Standard Final Report Section 2 and Section 5 cross-fallback to `spotDetails.gvw` and `vehicle.goodsWeightAtAccident`.
  - UIIC Final and UIIC Print reports cross-fallback across `registeredLoadWeight`, `grossWeight`, and `spotDetails.gvw`.
  - Added test cases in `src/lib/reports/__tests__/tp-and-load-challan.test.ts` and `src/components/print/__tests__/spot-report-sections.test.tsx`.
- feat(ai): **AI Document Extraction Alignment** (`src/stores/slices/aiDataSlice.ts`).
  - `applyRC`, `applyFitness`, and `applyLokChallan` now uniformly populate both `vehicle.*` and `spotDetails.*` pairs.
  - Added unit tests in `src/stores/slices/__tests__/aiDataSlice.test.ts`.
- tests: Full test suite passing (223 files, 1,937 tests); `npx tsc --noEmit` clean (0 errors); zero drift on SurveyOS Scan coupling.

## 2026-10-29 (Antigravity) — Fix Browser Storage Exhaustion & Memory Cleaner
- fix(photos): **Default Photo Compression to JPEG 0.85** (`src/lib/photos/compress-image.ts`, `src/hooks/usePhotoUpload.ts`).
  - Switched default canvas export format from lossless `image/png` to high-quality `image/jpeg` with quality `0.85`.
  - Drops base64 payload size from ~1.6 MB down to ~40 KB per photo (~95% reduction), eliminating rapid IndexedDB quota exhaustion when importing 20–30 claim photos.
  - Added unit test in `src/lib/photos/__tests__/compress-image-jpeg.test.ts`.
- fix(drive): **Guard Drive Queue Against Unlinked Accumulation** (`src/lib/drive/index.ts`, `src/hooks/usePhotoUpload.ts`).
  - Prevents `uploadFileToDrive` and `usePhotoUpload` from dumping uncompressed raw camera blobs into IndexedDB `driveQueue` (which accumulated up to 500 MB) when Google Drive is disconnected or never linked.
  - Added unit test in `src/lib/drive/__tests__/unlinked-queue-guard.test.ts`.
- feat(storage): **Storage Usage Summary & Queue Pruning** (`src/lib/storage/indexeddb.ts`).
  - Added `StorageSummary` interface and exported `getStorageUsageSummary()`, `clearDriveQueue()`, and `clearRecoveredClaims()`.
  - Added unit tests in `src/lib/storage/__tests__/prune-storage.test.ts` verifying counts and byte aggregation.
- feat(profile): **Storage & Memory Cleaner Section & Modular Profile** (`src/components/profile/StorageCleanerSection.tsx`, `src/components/profile/SubscriptionSection.tsx`, `src/components/tabs/ProfileTab.tsx`).
  - Added live storage metrics card in Profile Settings displaying active claims, pending Drive queue size (MB), and recovery snapshots.
  - Added 1-click "Clean Up Storage" button with toast notification to immediately flush stuck queues and restore Chrome quota without deleting saved claims.
  - Factored out `SubscriptionSection.tsx` (217 lines), shrinking `ProfileTab.tsx` from 950 lines down to 729 lines (strict ≤ 800 line rule compliance).
  - Added unit tests in `src/components/profile/__tests__/StorageCleanerSection.test.tsx`.
- tests: All 220 test files (1,906 tests) passing; `tsc --noEmit` clean; zero impact on SurveyOS Scan coupling.

## 2026-10-28 (Antigravity) — Unify Survey Date & Time in Claim Details
- fix(claim): **Unified Survey Date & Time Input** (`src/components/claim/SurveyForm.tsx`).
  - Replaced separate "Date of Survey" and "Time of Survey" inputs (and the duplicate spot-only "Survey Datetime (Actual)") with a single unified `datetime-local` input labeled **"Date & Time of Survey"**.
  - Synchronizes changes to both `accident.dateOfSurvey` / `accident.timeOfSurvey` (used by Final reports) and `spotDetails.surveyDatetime` (used by Spot reports and Scan coupling).
  - Eliminates data entry discrepancies where one field was filled while the other remained empty or default.
- fix(print): **Spot Print Report Dual Fallback** (`src/components/print/SpotPrintReport.tsx`).
  - Line 172 (Header table) and Line 346 (Section C table) now both cross-fallback between `spotDetails.surveyDatetime` and `accident.dateOfSurvey` + `accident.timeOfSurvey`.
  - Guarantees both print locations show matching, non-blank values regardless of whether the claim was populated via Spot flow, Final flow, or mobile Scan.
- fix(lib): `claimSurveyDate` (`src/lib/claims/survey-date.ts`) falls back to `accident.dateOfSurvey` for spot claims if `spotDetails.surveyDatetime` is empty.
- tests: Added `src/components/claim/__tests__/SurveyForm.test.tsx` verifying single unified input on both Final and Spot claims, and updated `src/lib/claims/__tests__/survey-date.test.ts`. All 216 test files (1,894 tests) passing.
- Scan impact: None — Spot schema fields preserved with bidirectional syncing; Scan Android unit tests passing (`./gradlew :app:testDebugUnitTest`).

## 2026-10-28 (Antigravity) — Estimate View Lenses, Prompt Overhaul & Lean Header
- feat(ai): **Footer-First Deductive Reconciliation** prompt overhaul for estimates and final bills (`src/lib/ai/prompts.ts`).
  - Eliminates blind `÷ 1.18` division bugs on tax-exclusive quotations (e.g. Dhanashree, Schwing Stetter).
  - Footer reconciliation checks whether item amounts sum to Subtotal (exclusive base) or Grand Total (inclusive gross).
  - Captures full assessment fields: `part_number`, `hsn_sac`, `quantity`, `unit_price`, `taxable_amount`, `gst_percent`, `total_amount`, and `category` (including `rubber` & `fiberglass`).
  - Returns `_audit` envelope with `tax_posture`, `columns_detected`, `reconciliation_note`, and warnings.
- feat(dialogs): **AI Review Dialog Audit Card** (`AIReviewDialog.tsx`) displays tax posture badge, column detection overview, and reconciliation feedback notes to the surveyor. `_audit` is stripped by `stripPageTags` before persisting.
- feat(model): Added `estimateId` to `AssessmentRow` (`assessment.ts`), automatically computed in `buildEstimateRows` from `workshop_name + estimate_number + estimate_date`.
- refactor(ui): **Lean Assessment Tab Header** (`AssessmentTab.tsx`, `PolicyCheckStrip.tsx`):
  - Collapsed stacked header controls into a single lean 36px toolbar, recovering >200px vertical table space.
  - Converted Policy Depreciation into an inline select badge and Policy Check into a compact pill chip (`Policy checked` / `Policy check: 2 of 4 [⚠️ 1]`) with a floating popover overlay.
- feat(claim): **Estimate View Switcher & Tally Banner** (`EstimateViewSwitcher.tsx`, `EstimateTallyBanner.tsx`):
  - Added segmented view lens pills above the assessment grid (`[ All (N) ] [ Vendor A (X) ] [ Vendor B (Y) ]`) when 2+ distinct quotations are present.
  - Display-layer only: underlying flat `assessmentRows` array, serial numbers, calculations, and report generation remain completely untouched.
  - Tally Banner shows live taxable base, estimated GST, and gross sum for the active quotation to cross-check against paper documents.
- feat(claim): **Multi-Estimate Row Accent Borders** (`AssessmentSectionTable.tsx`):
  - Rows are highlighted with distinct left-border color accents (`border-l-4 border-l-blue-500`, etc.) in "All" view to visually distinguish items from different estimates at a glance.
- tests: Added test suites for prompt audit structure, review dialog cards, estimate tagging, view switcher, and row accent borders. All 215 test files (1,890 tests) passing; zero regressions.
- Scan impact: None — display-only views and prompt changes do not touch Scan coupling.

## 2026-10-27 (Antigravity) — Bill Check Reference Serial Numbers
- feat(bill-check): **Reference Serial Number column (`refSrNo`)** added across Bill Check grid and generated reports (both Standard and UIIC formats).
  - Cross-references Estimate item serial numbers against Final Bill item numbers (or vice versa in bill-first UIIC flow).
  - Rendered as the **last column** in red italic font (`#d32f2f`, `italic`, `font-weight: 600`).
  - Column title defaults to `Bill No.` (or `Est. No.` if `baseDocument === 'final-bill'`), and is directly editable in-place on the Bill Check grid header or stored in `claim.billCheck.refColumnTitle`.
  - Grid cell is directly editable in-place; shows amber indicator dot for ambiguous matches.
  - Added **"Review Ref Numbers (N)"** toggle button in the grid toolbar to filter down to uncertain/missing rows in high-volume claims (up to 400 lines) with zero fatigue.
- feat(ai): `applyFinalBill` extracts invoice line serial numbers (`sr_no`, `item_no`, `serial_no`) and writes `refSrNo` and `refStatus` (`clean` | `ambiguous`) into matched assessment rows.
- feat(reports):
  - Standard Bill Check Report: Added reference column on the far right of section 9 (`width: 4.5%`); column width deducted purely from Particulars so all monetary amounts retain uninterrupted currency formatting; subtotal rows use merged trailing span to avoid whitespace waste. Regular final survey report layout preserved.
  - UIIC Bill Check Report: Added reference column as the 13th column; all headers, item rows, tax lines, and subtotals aligned to 13 columns. UIIC regular final survey report preserved at 12 columns.
- tests: Added `src/lib/reports/__tests__/bill-check-ref-sr-no.test.ts` (10 tests); updated existing column count tests; 36 report test files (348 tests) passing; `tsc --noEmit` clean.
- Scan impact: None — no shared schema or coupling points touched.
- feat(assessment): **Fix estimate reading** toolbar button + dialog replaces the floating "Fix Extraction" pill. One AI re-read with the surveyor's note; the review lists only rows **missing on the sheet** (ticked) and **changed** rows (old → new, unticked, "Accept all changes"). Never deletes; a surveyor-edited assessed figure is kept and the row gets an on-screen "Re-read" badge. Original/Supplementary toggle. Removes the old path that could wipe edited estimate rows after Apply.
- feat(upload): **More pages of the same estimate** (continuation: rows join the original estimate, numbering carries on) and **More pages of the same bill** (keeps bill no./date, takes a printed total, doesn't re-match billed rows).
- feat(policy): **Policy check** — Nil Dep, IMT 23, consumables, excess. AI policy read only *suggests* ("AI read: Yes"); notice strip on Assessment and Report Center; final + bill-check Print/Word blocked until all four answered. Nil Dep answer ↔ depreciation dropdown kept in sync.
- feat(print): **Before printing — UIIC** step on every UIIC final / bill-check Print or Word: RI appointment, repair auth, est./actual completion dates, repairs as per assessment (same fields as the Reinspection tab).
- fix(word): Word export keeps UIIC page breaks (verified in Word: each page starts at the surveyor name).
- feat: Dashboard **Survey Date** + **Last Edited** columns; Recovered list shows vehicle no.; **Add row** also below each section (Assessment and Bill Check).
- refactor: **Site tab retired** (Scan replaces it); phone opens a claim on Claim Details; `?tab=site` falls back to Details; `getAt/setAt` moved to `src/lib/scan-import/path.ts`.
- Scan impact: none beyond the path move; Scan unit tests pass.
- fix: the re-read no longer offers repeat copies of a row it changed (multi-page text PDFs return each row once per page) — 88f1ccd1.
- tests: 209 files / 1865 passing, tsc clean. Commits 469aaa51..88f1ccd1 on main. Not pushed, not deployed, not tried in a signed-in browser. Spec/plan: `docs/superpowers/{specs,plans}/2026-10-27-surveyor-feedback-round-1*`.

## 2026-10-25 (Claude) — Use phone files (Assessment, Bill Check, Photos)
- feat(assessment, bill-check): **Use phone files** beside Upload Estimate (`estimate`, `supplementaryEstimate`) and the invoice upload (`invoice`). A pick runs the same handler as the file chooser, so the estimate mode dialog and the read and review run unchanged.
- feat(photos): **Use phone files** beside Gallery / Browse opens **Phone photos**: phone photos grouped by type (Final Photos, Spot, Front/Rear/Left/Right, Chassis, Odometer) with lazy thumbnails (3 read at a time, object URLs revoked on close), per-photo ticks and **Select all** per group. **Add to photo sheet** runs the same compress-and-add path as Gallery / Browse. Nothing lands without that click.
  - Tags carry over (a chassis photo arrives tagged `chassis`; Final Photos arrive as plain Damage).
  - `PhotoItem.sourceDocId` (new, optional) records the source document; already-added photos show "Added" and are disabled, so adding twice adds nothing. Photos stored without an id are matched by name.
  - Phone photos are not saved into the claim folder a second time; the Drive save prompt is unchanged.
- Buttons are hidden when the claim has no matching phone files. No change to Scan. No AI call, no running cost.
- tests: `npm test` green, tsc clean. Commits 3946c2d0 and the Photos commit. Not pushed, not deployed, not tried in a signed-in browser.

## 2026-10-25 (Claude) — Bring phone scans (SurveyOS Scan → Prime)
- feat(documents): **Bring phone scans** button: From Google Drive (Google Picker, existing `drive.file` token) or From this computer.
  - A vehicle mismatch asks Import anyway / Cancel.
  - The import needs a connected claim folder.
  - Files are de-duped by content and saved as source `'scan'`.
  - No AI calls.
- feat(documents): **Phone notes** review with three parts:
  - Will fill, ticked by default.
  - Phone notes differ, with Keep Prime (default) / Use phone.
  - Rows to add.
  - Nothing is written until Apply. A re-import never asks again (`claim.scanImport.decided`), and `isInsurable` is never auto-filled.
- feat(documents): cards show "From phone — click to read". New Phone files list with "Checked N of M" portal ticks.
- refactor(documents): removed the Pages grid, Portal list, "Documents · N" and "Files on Drive". The claim folder is now one line.
- Scan repo: Sync to Drive removed. Every import arrives as a zip. The handover doc is clarified.
- Owner step: enable the Google Picker API in `surveyos-v2-antigravity-in`.
- tests: `npm test` green, tsc clean.
  - Prime commits 7611cc83..6ad6a0d7, plus the import entry commit.
  - Scan commits b8b1248..0da6f79, plus the handover commit.
  - Not pushed, not deployed, not tried in a signed-in browser. Session log `Sessions/2026-10-25-bring-phone-scans.md`.

## 2026-10-25 (Claude) — Claim Details regrouped by document, dates on the right
- feat(claim): sections follow the source papers: Assignment, Policy & Insured, RC, Driving Licence, Permit & Fitness, Accident, At the Time of Accident, Survey & Workshop, Documents Obtained, Spot Findings; shared `DocSection` puts every date field in one right-hand column
- feat(claim): Scan RC / DL / Policy buttons in their section headers (replace the three big tiles); sticky processing banner
- feat(claim): vehicle type switch (Private / Comm. Goods / Comm. Passenger) in the report-number strip; only shows or hides type-specific fields, stored values stay
- style(claim): "used in spot report" dots removed, red empty-borders only on core fields, neutral section titles, Spot section restyled to match; Word Report button removed from this tab (Report tab has it)
- fix(spot): "Log Book / Tax Paid" saved into `spotDetails.fitnessType` and printed as Fitness Type; now `spotDetails.taxPaid` (old value still shown); UIIC prints `vehicle.fitnessType` only
- fix(claim): overload prompt showed for any load on final claims (capacity 0); capacity falls back to RC GVW − ULW, unknown = no prompt
- fix(claim): screen-width column spans inside container grids broke rows with the Evidence panel open; all spans container-based
- Storage paths unchanged; fitness/route/goods hidden for private vehicles, passenger/load hidden for valuation (not printed there)
- tests: 1744 passing, tsc clean. Commit ea2a9ed6 on `main`. Deployed to motorsurveyos-in 2026-10-25 10:18 (hosting; new strings verified in the live chunk). Not tried in the signed-in app. Session log `Sessions/2026-10-25-claim-details-layout.md`.

## 2026-10-22 (Claude) — Surveyor feedback: date/time, evidence viewer, select-all, rephrase, page jump
- fix(ai): accident time parsed from "4.30 pm", "16.30 hrs", "1630 hrs", "02:30 PM" (AM/PM kept); an unreadable date keeps the existing value instead of writing a blank "T00:00"; Reconciliation writes a valid datetime-local and no longer shows a false date-vs-datetime conflict
- fix(review): AI Review tab uses the shared inline Evidence Viewer (its old copy read a sessionStorage key nothing writes, so it never showed a document)
- feat(documents): Select all / Unselect all on the shared PDF page grid (AI reading and Photos annexure pickers)
- feat(claim): "Rephrase with AI" beside Cause and Nature of Accident (now a 3-line textarea); translates and rewrites in a senior surveyor's house style, never adds facts, Undo restores; ~1k tokens per press
- feat(evidence): extraction tags each value with its PDF page/file; AI Review, Details and Reconciliation open the document at that page ("page N" in the header)
- tests: 1734 passing, tsc clean. Commits 7bc9132e, 565919af, 877ab9f8 on `main`. Deployed to motorsurveyos-in 2026-10-22 15:54 (hosting, owner-run; live chunks verified). Not tried in the signed-in app.

## 2026-10-21 (Claude) — Claim document kit, Phases 1–2
- feat(documents): KYC and portal document types with page labels; per-device file fingerprints, so a changed file resets its labels
- feat(documents): free page recognisers from the text layer and file names (no AI); identity checks that a document belongs to this claim (registration, chassis, policy, names; KYC compares names only)
- feat(documents): portal recipes for New India non-tieup, New India KIA tie-up (provisional) and United India; Ready / Check / Missing checklist with a copy-ready missing-documents message
- feat(documents): upload files built with pdf-lib (split and merge); upload files written into `Portal Upload/<portal>/` only for confirmed boxes; Review upload set, where a source or claim-field change marks a box stale until rebuilt
- fix(documents): final-review fix wave: labels tied to the exact file (Scan and labelling fingerprint every file; Build refuses a changed one); HTML stand-ins never built; boxes build independently with per-box errors; `Portal Upload/<portal>/` cleared of files the review doesn't cover; boxes go stale on any source, not-needed or identity-field change; identity checks that haven't run count as "Still checking"; continuation pages (policy terms, card backs) no longer a mismatch; encrypted PDFs refused; Windows-safe file names
- feat(documents): folder location choice (this computer, or Google Drive for desktop with a guide); three Documents-tab panels: Portal checklist, Pages, Review
- chore(deps): `pdf-lib@^1.17.1`, the only new dependency
- tests: 1721 passing, tsc clean. Commits 7181ae3c..f510fbae, fix wave 287d7113..5f1bb70a, on `main`. Not deployed; not tried in a browser. Owner to confirm recipe defaults in spec §8(b)–(d). Next: Phases 3–5 (Google Drive online picker, opt-in AI "Guess the rest", extension upload). Spec `docs/superpowers/specs/2026-10-20-claim-document-kit-design.md`, plan `docs/superpowers/plans/2026-10-20-claim-document-kit.md`.

## 2026-10-17 (Claude) — Portal fill v0.4.0: page check and redesigned card
- feat(extension): **Check page**, a read-only button that reports per field whether Fill would work (structure, value and wrong-claim modes); writes nothing; text and money values never shown
- feat(extension): redesigned card: docked right and centred, collapsible 40 px tab, Esc and keyboard support, screen-reader roles, draggable header, problems listed first, click a line to jump to the field, summary, next-step hint, legend, Copy report
- chore(extension): map labels and next-step hints in the overlays (NIA map v3, UIIC v2); README: Check page, updated fixture walk-throughs, read-only live-check steps
- tests: 1507 passing, tsc clean. Not deployed (hosting needs the owner's go-ahead); card not yet tried in a browser.

## 2026-10-16 (Claude) — Portal fill extension Phase 2: UIIC (v0.3.0)
- feat(extension): UIIC claim-survey map (28 fields: survey date/time/place, mobile, report no, IRDAI parts buckets, GST slabs, labour, invoice no, salvage, excesses, fee bill), generated from the capture (renamed `uiic-claimsurvey-survey.json`)
- feat(extension): `uiicText` (portal's `[a-zA-Z0-9. ]` pattern, 500 cap), `hour`/`minute` split; any map field can read another packet field via `from`
- feat(uiic): `buildUiicPacket` (bill-check basis, R12) + Send to extension in the UIIC summary dialog, behind the bill-check tick
- fix(extension): unmatched select option reported rejected, not filled; new maps load on worker start; panel text portal-neutral; panel re-boots after removal; results survive a map refresh; remote maps shape-checked; fill-core wrapped in an IIFE; flow-list drift test; build fails on field/file key clash
- tests: 1456 passing, tsc clean. Commits 2019832f..fcfff741. Deployed to motorsurveyos-in.web.app (hosting) 2026-10-16; hosted maps verified live. No browser run of the extension.

## 2026-10-16 (Claude) — Portal fill extension Phase 1 (multi-portal core, v0.2.0)
- docs: roadmap `docs/superpowers/plans/2026-10-16-portal-extension-roadmap.md` — Phase 0 (live checks + capture sweep) through Phase 6 (store listing)
- feat(extension): `pickMap(maps, host, hash)` — exact route match, so `#/WorklistSurvey` never catches `#/WorklistSurveyNew`; map headers gain `host` and `modelRoot`
- feat(extension): background keeps `maps` (one per flow, `MAP_IDS`), migrates v0.1.0's `map` key, loads maps when the worker starts with none
- feat(extension): panel re-picks its map on every route change; `packetGate` refuses a packet built for another portal/flow; validator reads `KNOWN_FLOWS`
- feat(extension): scope found from the claim-number / field elements when a map names no controller (UIIC)
- chore(extension): `build-ext.py` builds and zips every `*.overlay.json`; fixture scope generated from model paths; NIA map version 2
- tests: 1424 passing. Commits e62a61fa..2019832f. Not deployed; no browser walk-through run (needs an unpacked extension in Chrome).

## 2026-09-18 → 09-23 (Claude) — back-filled
- feat(nia): NIA Assessment Excel generator with nil-dep painting and bill-check gate (09-18)
- feat(extension): Portal Fill extension v0.1.0 for NIA non-tieup; `src/lib/portal/packet.ts` + Send to extension in the NIA dialog (09-21)
- feat(documents): Claim Documents typed index + disk folder; folders named by vehicle + insurer short form; Scan folder; one-time Tidy up (09-21 → 09-23)

## 2026-10-04 (Claude) — Phone layout bug-fix pass
- fix(layout): sidebar now slides off-screen below 1024 px (it was always visible and covered the left 258 px)
- fix(evidence): Details/Review evidence panel closed by default on phones, opens as a full-screen overlay; shared `useEvidencePanel` + `EvidencePanelSlot` replace two copies
- fix(layout): `h-screen`/`100vh` → `dvh`; report preview fits phone width and no longer clips left; hover-only row/photo actions visible on touch; hamburger hidden on phones with a claim open; notifications dropdown fits the phone drawer
- chore: Playwright MCP added to the project (extension mode, Pixel 7) for phone-layout verification
- tests: 1408 passing. Commits 472dbc5b, c1fcd3ed..47c9f8f6. Deployed to motorsurveyos-in.web.app (hosting) 2026-10-04. Visual check via Playwright pending (needs Bridge extension + session restart).

## 2026-10-03 (Claude) — Phone site capture (P1–P3)
- feat(photos): Camera button (opens the phone's own camera app) on Photos and on each document card; shared `usePhotoUpload` hook; "save to Drive?" asked once per claim; photos remember their Drive filename (`PhotoItem.driveName`)
- feat(sync): "N waiting to upload" chip for the Drive queue; banner offers photos uploaded from another device (per-device ignore list; deleted photos never re-offered); Restore from Drive no longer duplicates
- feat(pwa): installable (manifest, icons, iPhone icon), hand-written service worker caches the app shell + chunks, opens without signal, 4 s weak-signal fallback, skips `/__/` auth handler
- feat(site): new `AppTab 'site'` — phones land on it: capture buttons, still-missing / confirm checklist per survey type, dictated site notes → allow-listed fields via one AI text call with review (never assessment, amounts or identity; never overwrites), navigate + tap-to-call; phone bottom bar; `isNavItemVisible` is the single tab-visibility rule
- feat(share): Share button for Photo Sheet and Document Annexure PDFs
- tests: 1408 passing. Spec `docs/superpowers/specs/2026-10-02-phone-site-capture-design.md`, plan `docs/superpowers/plans/2026-10-02-phone-site-capture.md`, session log `Sessions/2026-10-03-phone-site-capture.md`. Commits 5db7c5b2..b949bb11. Deployed to motorsurveyos-in.web.app (hosting) 2026-10-03. Phone checks not run — no credentials or device in session.

## 2026-09-17 (Claude) — AI upload PDF page selection
- feat(ai): multi-page PDFs dropped into any AI upload (estimate, final bill, RC/DL/policy, Documents tab, Sync picker) get a page picker — the surveyor unticks pages before the document is sent; unticked pages are never rasterized, so they cost zero tokens
- feat(ai): `ai-pages.ts` — `setAIPages`/`getAIPages` WeakMap carrier tags the selection onto the `File` object itself, four calls deep into the rasterize chain, with no signature change; Re-scan, Smart Fix and the bank-statement extractor inherit it for free. Pure `resolveAIPages` clamps out-of-range picks
- feat(documents): `needsReview` gate now opens the review sheet for a single multi-page PDF too (previously multi-file only); `PdfPageGrid` extracted from the photos annexure picker into a shared component; `DocumentReviewSheet` shows a per-PDF grid, page-aware counts/warnings, survives crop edits, zero-ticked PDF excluded from Send, unreadable PDF falls back to sending whole
- chore(ai): `AssessmentTab`, `BillCheckTab`, `DetailsTab` now route their uploads through the review sheet when the gate says so
- tests: 1239 passing. Spec `docs/superpowers/specs/2026-09-17-ai-pdf-page-selection-design.md`, session log `Sessions/2026-09-17-ai-pdf-page-selection.md`. Not deployed. Manual E2E (spec §5) not run — no credentials in session.

## 2026-09-17 (Claude) — Admin ranked lists (Phase 2-C)
- fix(ai): non-Google models (Groq/NVIDIA/Ollama non-gemma) now rank in an `other` tier after gemma for every job — L11 showed Groq qwen #1 for licences and NVIDIA above gemma4 for estimates; a 429/5xx/timeout in the vision probe keeps the previous verdict (3.6-flash had been recorded text-only). Deployed.
- feat(admin): AI Models tab is veto-based — every probe-ok model is in the surveyor chain unless excluded; guard rails auto-exclude slow / preview / transcribe / robotics / tts / image / embedding / audio / live / omni ids with a visible reason and an Include button
- feat(admin): three ranked lists (Estimates & bills / Licence · RC · policy / Letters & text) computed by the loop's own ranker; per-row editable calls/day (overrides the quota table; 0 = off); Exclude refused on the last eligible model; discovery line per provider
- feat(ai): config schema 2 (`excluded`, `excludedReason`, `keep`, `limits`, `notes`) with pure migration from the tick list; `poolFromProbes` shared by request path and admin; surveyors load `ai_config/model_probes`; legacy `models` field kept as a mirror of the chain for stale tabs (delete in 2-D)
- chore(admin): removed per-model checkbox, ★ default, size buckets, accuracy test, benchmark card, `probe-reconcile.ts`
- tests: 1222 passing. Spec `docs/superpowers/specs/2026-09-17-admin-ranked-lists-design.md`, plan `docs/superpowers/plans/2026-09-17-admin-ranked-lists.md`, session log `Sessions/2026-09-17-admin-ranked-lists.md`. Deployed to motorsurveyos-in.web.app (hosting only) 2026-09-17; admin Save + Probe pending.

## 2026-09-16 (Claude) — Quota-aware ranking (Phase 2-A)
- feat(ai): free-tier budgets drive the model order — Google gives every Flash model 20 calls/day per key, Flash-Lite 500, Pro 0 (`quota.ts`); a per-key spend ledger resets at Pacific midnight (`health.ts`)
- feat(ai): heavy (estimate/bill) runs on the strongest tier whose key can still finish the whole document (budget re-checked per chunk, never a half-read); light (RC/DL/policy) never spends Flash while Flash-Lite or gemma is available
- feat(ai): non-Gemini 429 (Ollama usage window) rests that key:model one hour; day-limit toast also fires when the ledger has spent every key; once-a-day "Flash quota used up" nudge
- chore(ai): surveyor's saved Gemini model pick no longer steers ranking (picker inert until 2-D); status badge shows "Gemini · auto"
- tests: 1184 passing. Spec `docs/superpowers/specs/2026-09-16-quota-aware-ranking-design.md`, plan `docs/superpowers/plans/2026-09-16-quota-aware-ranking.md`, session log `Sessions/2026-09-16-quota-aware-ranking.md`. Deployed to motorsurveyos-in.web.app (hosting only).

## 2026-09-16 (Claude) — Smart Fix
- feat(ai): missed-row detection replaces the subtotal math check — rows carry their page; serial (`sr_no`) gaps and duplicates are found after the merge; the gross is checked against row sums only (text mode: only when its digits are printed); section subtotals are never checked (they cried wolf on a perfect 80-row DTC read)
- feat(ai): a gap is filled with ONE single-page vision call for its page, merged by serial; a whole-document second opinion runs only when the gross is off and no serial gap explains it, and is accepted only when it reconciles. Clean read = zero extra calls.
- feat(ui): Smart Fix moves out of the toast into the review dialog — one amber "Check before applying" card above the fields with the button inside; closing the dialog or re-scanning cancels a running fix; Apply is locked while it runs
- fix(ai): unnumbered bills (model numbers each page 1..n itself) keep every row — duplicates are dropped only when ≤ 10 % of serials
- fix(ai): retry any Gemini 400 once without thinking and remember it per model; retired Gemini ids dropped from the chain; page-level subtotal noise no longer triggers a second read (50c2e994, fd732a06, 2b20fde9)
- chore(ai): dev-only `?ai-drop=<sr_no>` simulates a missed row for live check L9
- tests: 1150 passing (processor flow now driven end-to-end in node via a FileReader stub). Spec `docs/superpowers/specs/2026-09-16-smart-fix-missed-rows-design.md`, plan `docs/superpowers/plans/2026-09-16-smart-fix-missed-rows.md`, session log `Sessions/2026-09-16-smart-fix-missed-rows.md`. deployed to motorsurveyos-in.web.app (hosting only) after a surveyor hit the 3.5-flash-lite 400 on auth/fitness docs.

## 2026-09-16 (Claude)
- feat(ai): job-aware fallback loop — every AI call declares heavy/light/text; the ranker orders every reachable model; on 503/429 the app hops to the next Gemini model before rotating keys or leaving Gemini; no in-place 503 retry; per-call timeouts (heavy 120 s)
- feat(ai): Gemini 429s classified by `quotaId` — per-model/minute hops, per-model/day marks the model dead till Pacific midnight, per-project/day marks the key, day+minute together = zero quota (Pro on a free key)
- feat(ai): Ollama Cloud (Gemma 4 31B, free vision) as a proxied fallback; `nvidiaProxy` generalised to `aiProxy` with a host allowlist; Ollama key row in Profile
- feat(ai): Gemini extraction runs with thinking off (2.5 Flash was truncating at MAX_TOKENS); 400-on-thinking retries once without it
- feat(ai): a document whose extracted rows don't add up is re-run once on the next model; whichever passes the math wins
- feat(probe): Ollama catalogue and ping; 402 recorded as a durable `paid` status
- fix(sync): `nvidiaApiKeys` was reaching Firestore — now stripped and purged (`deleteField`) for one release
- chore(ai): dev-only `?ai-fault=` injection for live fallback tests
- deploy: live at motorsurveyos-in.web.app (project surveyos-v2-antigravity-in); 1105 tests passing. Live checks L0–L8 pending. Session log: `Sessions/2026-09-16-ai-fallback-phase-1.md`

## 2026-09-15 (Claude)
- feat(ri): Reinspection tab now holds every field the RI report prints (RI ref, place, RI/auth/est dates, plus two-way Report No / insurer / offices / accident & survey dates). RI report drops Date of Report, Survey Ref No, Survey Date. Photo sheet Report No editable with "Use RI Ref".

## 2026-08-21 (Claude)
- feat(salvage): `salvageBasis(rows, lens)` in `src/lib/calculations/salvage.ts` — allowed metal parts only, assessed before depreciation, each row's own GST, replacing a basis struck on the unfiltered estimate
- feat(salvage): the Assessment tab's suggested band reads the new basis instead of `estimateMetalBase`
- feat(bill-check): `feeBill.billSalvage` (optional, no default) plus `resolveBillSalvage` — a typed figure wins, otherwise the final report's salvage is rescaled by how far the metal basis moved, both directions, never written back to `salvageValue`
- refactor(claim): `SalvageInput` extracted from `AssessmentSummary.tsx` into `src/components/claim/SalvageInput.tsx`, used by both the Assessment and Bill Check tabs
- feat(bill-check): salvage box added to `BillCheckSummaryPanel`, beside Final Liability, with a note when a figure has been carried over and rescaled
- feat(bill-check): both bill-check report builders print the resolved salvage figure; the standard builder branches on `mode` since it serves the Final Survey Report from the same read, pinned by a regression test
- deploy: live at motorsurveyos-in.web.app (project surveyos-v2-antigravity-in); 863 tests passing

## 2026-08-20 (Claude)
- fix(calc): stop filtering the per-material estimate split — `estimatePartsBase` summed every row while Metal/Plastic/Glass/Fibre summed allowed rows only, so every summary table printing both disagreed with itself
- fix(report): Standard builder reads the engine's estimate figures instead of its own filtered duplicate; §8 column relabelled `Estimated (before GST)`
- feat(report): §9 subtotals the Estimate and Assessed columns — the label used to span six columns and swallow them
- feat(bill-check): §8's Billed total ties to the invoice, deducting rejected-but-billed items on one aggregate line
- feat(bill-check): the billed amount caps the assessment per item (`billCheckAssessed`), bill-check only — the Final Survey Report is never touched
- refactor(bill-check): `billVerified` in, `partial` status out — it changed no arithmetic and compared against the estimate rather than the assessment
- feat(bill-check): `bill-check-flags.ts` — one divergence rule in both directions, diagnosed by the estimate; plus invoice reconciliation, a rejected-item-billed advisory and a low-confidence-match advisory that the screen already detected and never showed
- feat(bill-check): per-row flag mark with an in-place explanation, a two-tier attention banner with bulk actions, and a print gate on blocking flags
- deploy: live at motorsurveyos-in.web.app (project surveyos-v2-antigravity-in); 836 tests passing

## 2026-05-25 (Claude)
- feat: duplicate upload detection for Google Drive (DuplicateUploadDialog + upload-with-check.ts)
- feat: per-claim Drive file listing with IDB cache (useClaimDriveFiles hook, DB_VERSION=4)
- feat: city/state fields in access-request form + profile store
- feat: admin SurveyorsTab expandable detail rows (9 fields: email, mobile, IRDAI, city, state, qualifications, referral, join date)
- feat: admin ApprovalQueueTab Location column
- feat(bramha): gate archive button behind isCompleted in Dashboard.tsx and NewClaimDialog.tsx
- feat(bramha): new Cloud Function `onClaimArchived` — archive-triggered Gemini embedding pipeline
- feat(bramha): `bramha_memories` supports RAG + fraud detection + civic hotspot analysis
- chore(bramha): deleted old `processCompletedClaim` Cloud Function
- chore(bramha): added functions config to SurveyOS-Prime/firebase.json
- deploy: all changes live at motorsurveyos.web.app; functions at us-central1
- chore: pushed 18 commits to GitHub (pniraj1/antigravity-surveyos-prime-v2)

## 2026-05-21 (Claude)
- chore: project reorganization — purged 473+ auto-generated vault files
- chore: restructured vault into Architecture/, Features/, Rules/, Operations/, Specs/, Reference/
- docs: created AGENT_PROTOCOL.md — universal rules for all AI agents
- docs: created Rules/ (File_Placement, Naming_Conventions, Documentation_Protocol, Handoff_Protocol)
- docs: created 10 Feature docs from source code audit
- docs: created HTML project map at docs/project-map.html
- chore: deleted unused IDE configs (.cursorrules, .windsurfrules, .opencode.json)
- chore: deleted stale .claude/worktrees/, Cinematic landing page/, claude_handover.md
- chore: updated .gitignore (added open-design/, ruvector.db, .venv/, functions/node_modules/)
- chore: rewrote CLAUDE.md and GEMINI.md as thin pointers to vault

## 2026-05-17 (Claude)
- fix: move Hide/Show Summary button next to Show Evidence button
- feat: add toggle button to hide/show financial summary panel in AssessmentTab
- feat: implement subscription lifecycle system with trial, payments, and referrals
- fix: add missing bg prop to CHAPTERS and style passthrough to GlassCard
- fix: prompt clarification — CGST+SGST must be summed for gst_percent (9+9=18)

## 2026-05-16 (Claude)
- feat: wire Ctrl+V paste, Escape, and cell highlight ring into AssessmentGrid
- feat: add cell selection state and mouse handler to AssessmentGrid
- feat: add grid-paste utility with parseClipboardValue and buildPasteUpdates
- fix: separate 'approved' from 'safe' category — approved in full vs no damage
- fix: recolor shared DocumentEvidenceViewer to light mode
- chore: exclude open-design from tsconfig to fix build

## 2026-05-15 (Claude)
- feat: wire Pass 2.5 enrichTaggedRows into runAssessmentAnalysis
- refactor: split buildPreClassifiedExplanations into autoClassified + taggedRows
- feat: add buildTaggedRowEnrichmentPrompt for Pass 2.5 enrichment
