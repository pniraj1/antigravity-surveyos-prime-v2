# Session Log: 2026-10-30 — Scan Fee Bill Notes & Unified Inspection Date/Time

**Agent:** Antigravity  
**Goal:** Add a dedicated "Survey Fees Bill" notes tab to SurveyOS Scan for capturing fee billing details on mobile, and unify shared inspection metadata (Date & Time of Survey/Inspection, Place, Odometer, Enclosures, Allotment Date, Report Date) across Spot, Final, Valuation, and Fee Bill notes and reports in both Prime and Scan.

---

### 1. Scope & Surveyor Rulings
- **Unified Inspection Event:** The physical inspection date/time, place, odometer, and enclosures represent the exact same real-world event whether recorded in Spot, Final, or Valuation. In Prime, editing in any tab synchronizes across `accident`, `spotDetails`, and `valuationDetails`. In Scan, editing in Spot, Valuation, or Fee Bill synchronizes Room SQLite drafts across sections via `SHARED_SYNC_MAP`.
- **Dedicated Fee Bill Tab in Scan:** Surveyors need to capture fee bill particulars on-site (Bill No/Date, Professional Fees, Conveyance / KM & Rate, Photo Count & Rate, Miscellaneous / Outstation expenses, and GST posture).
- **Sticky Rates UX:** Default rates (`ratePerKm: "10"`, `photoRate: "15"`, `includeGST: "yes"`) persist in Android SharedPreferences, auto-populate new fee bills, and update sticky preferences only when a surveyor actively types/modifies rates (preventing passive overwrites of past claims).
- **Coupling & Zero Drift:** Prime import engine (`src/lib/scan-import/notes.ts`) parses both `Fee Bill Notes.txt` and `_surveyos-scan.json` notes snapshots into `feeBill.*`, auto-backfilling survey datetime/place across claim tabs.

---

### 2. Implementation Summary

#### SurveyOS Prime V2 (Web Repo)
1. **Store-Level Bi-directional Sync (`claimSlice.ts`, `vehicleSlice.ts`):**
   - Synchronized `accident.dateOfSurvey` & `accident.timeOfSurvey` with `spotDetails.surveyDatetime` and `valuationDetails.inspectionDate`.
   - Synchronized `accident.placeOfSurvey` with `spotDetails.placeOfSurvey` and `valuationDetails.inspectionPlace`.
   - Synchronized `accident.dateOfAllotment` with `valuationDetails.allotmentDate`.
   - Synchronized `accident.dateOfReport` with `valuationDetails.reportDate`.
   - Synchronized `spotDetails.enclosures` with `valuationDetails.enclosures`.
   - Synchronized `vehicle.odometer` with `valuationDetails.odometer`.
   - Commits: `83753194`, `5a9dd9f0`.
2. **Report Builders & Valuation Tab UI (`valuation-report-builder.ts`, `spot-fee-bill-builder.ts`, `ValuationTab.tsx`, `SurveyForm.tsx`):**
   - Upgraded Valuation Inspection Date to `type="datetime-local"` labeled "Date & Time of Inspection".
   - Added robust fallbacks for inspection date/time, place, odometer, and enclosures across Valuation Report builder and Spot Fee Bill builder.
   - Commits: `d9a44f29`, `d7f6c5a6`, `068f6a67`, `af743391`.
3. **Handover Contract & Scan Import Engine (`docs/handover/prime-notes-import.md`, `src/lib/scan-import/notes.ts`):**
   - Documented 16 `feeBill.*` fields and `Fee Bill Notes.txt` contract in handover spec.
   - Allow-listed 16 `feeBill.*` paths, added boolean/number parsers, and auto-backfilled survey datetime/place across Spot, Final, and Valuation claim state.
   - Added 16 unit tests in `src/lib/scan-import/__tests__/notes.test.ts`.
   - Commits: `7931736b`, `a3b454bf`.

#### SurveyOS Scan (Android App Repo)
1. **Valuation Datetime & Shared Inspection Draft Sync:**
   - Upgraded `ValuationFields.kt` `inspectionDate` to `NoteControl.DATE_TIME` ("Date & Time of Inspection").
   - Added `SHARED_SYNC_MAP` in `NotesViewModel.kt` synchronizing `date_time`, `place`, `odometer`, and `enclosures` across Spot, Valuation, and Fee Bill drafts in Room SQLite.
   - Commits: Scan `13e72204`, `9aeff5b`.
2. **Fee Bill Fields, Sticky Rates, and Exporters:**
   - Created `FeeBillFields.kt` defining 16 fee billing fields across 6 sections (`BILL`, `FEES`, `TRAVEL`, `PHOTOS`, `EXPENSES`, `TAX`) plus calculation helpers.
   - Created `FeeRatesStore.kt` using SharedPreferences for sticky defaults (`ratePerKm: "10"`, `photoRate: "15"`, `includeGST: "yes"`).
   - Created `FeeBillExport.kt` generating `Fee Bill Notes.txt`.
   - Updated `NotesExport.kt`, `ValuationExport.kt`, `Exporter.kt`, `SafExport.kt`, and `Repository.kt` to export `notes.feeBill` in `_surveyos-scan.json` and generate `Fee Bill Notes.txt`.
   - Added `FeeBillFieldsTest.kt`, `FeeBillExportTest.kt`, and updated `NotesExportTest.kt`.
   - Commit: Scan `ff3227ce`.
3. **Fee Bill Notes Screen UI & Live Calculations:**
   - Added `NoteKind` enum (`SPOT`, `VALUATION`, `FEE_BILL`) and 3-way chips with horizontal scrolling in `NoteFields.kt` and `ClaimScreen.kt`.
   - Built `FeeBillNotes.kt` with live calculation cards (`TravelLiveCard`, `PhotosLiveCard`, `TaxLiveCard`), photo count suggestion chip, and guarded sticky rate persistence.
   - Commits: Scan `e9660f5`, `b55b0b9`.

---

### 3. Verification & Coupling
- **SurveyOS Prime (Web):**
  - Vitest: 227 test files, 1,998 unit tests passing (100% green).
  - TypeScript: `npx tsc --noEmit` exited clean with 0 errors.
- **SurveyOS Scan (Android):**
  - Gradle UnitTest: `:app:testDebugUnitTest` passed (337 tests, 0 failures).
  - Git working tree: 100% clean on `main`.
