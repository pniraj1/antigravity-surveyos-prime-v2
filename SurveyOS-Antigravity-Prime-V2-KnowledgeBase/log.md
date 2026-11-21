# SurveyOS Prime V2 — Operations Log

> Chronological log of major features, deployments, and architecture milestones.

## [2026-11-17] DEPLOY | UIIC Spot Survey Dates, Universal AI Model Pick and Deploy of main at f2a0452b
- Deployed hosting to production (`surveyos.in` / `motorsurveyos-in.web.app`).
- UIIC final report spot column reads `reinspection.spotAppointmentDate/spotSurveyDate/spotReportDate` (isolated from final survey dates).
- `callAIGateway` honours surveyor model choice everywhere with fallback session.
- Restored `[Final bill]` and `[Estimate]` buttons in `BillCheckHeader.tsx`.

## [2026-11-16] DEPLOY | Bill Check Column Order and Allowed-Only View
- Unified column order across Case 1 and Case 2: base | Assessed | uploaded | item no. | Status | GST | Disposal | Dep% | Net | Price+GST | Remarks.
- Allowed rows only view by default with toggle; counts and footer totals follow visible rows via `sectionFooterTotals`.

## [2026-11-16] FEAT | Cockpit Stage 3 and Stage 4 Rework
- Stage 3 displays assessment rows and remaining uploaded lines side-by-side before AI is asked.
- Stage 4 opens on unlinked assessed rows, then unlinked uploaded lines, isolating disallowed items with ₹0 liability.

## [2026-11-16] DEPLOY | Brand Orange Themed Upload Dialog & Modal Reconciliation Wizard
- Removed inline stepper replacing `BillCheckGrid`; created accessible modal dialogs (`BillCheckUploadDialog.tsx`, `ReconciliationWizardDialog.tsx`).
- Standardized 100% Brand Orange / Amber (`#F59E0B`) theme.

## [2026-11-16] FEAT | Surveyor-Controlled Progressive Tallying Cockpit
- 4-Stage progressive tally engine in `src/lib/tally/`: Stage 1 Part Numbers, Stage 2 Automotive Semantic Matching, Stage 3 Surveyor-Triggered AI Matching, Stage 4 Disallowed Segregation & Savings.

## [2026-11-14] AUDIT | Comprehensive Codebase Audit & Authoritative Architecture Map
- Line-by-line inspection of 116,108 lines of code across 807 source files.
- Published `Architecture/Codebase_Architecture_Map.md`.

## [2026-11-14] FEAT | BharatBenz DMS Invoices & Skip Blank Pages
- Deterministic parsing via `row-parser.ts` handles 13-page BharatBenz invoices with 0 row AI token calls.

## [2026-11-12] FIX | Phone Notes Backup & Drive Picker Normalizer
- Preserved fee bill notes, damage rows, and part rows from "Text only" zips and Drive backups in `normalizer.ts`.

## [2026-11-11] FIX | SurveyOS Scan Batch Photo Share Limit & Transaction Batching
- Expanded `MAX_SHARED_URIS` from 20 to 200 in `ShareInbox.kt`; atomic Room batching in `ClaimViewModel.kt`.
- Bumped Scan to `VERSION_CODE=7` (`1.5.1`) and built release AAB.

## [2026-11-10] FEAT | SurveyOS Scan Direct Share Photos & Document Field Naming
- Enabled direct sharing to Spot/Final/RI photo collections and explicit document field picker on "+ New document".

## [2026-10-30] DEPLOY | Zero-Login Sandbox & Anonymous BYOK Cloud Function Proxy
- Silent `signInAnonymously(auth)` in sandbox mode; Cloud Function proxy exemption for Ollama and NVIDIA NIM.
