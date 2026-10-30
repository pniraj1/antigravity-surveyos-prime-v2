# SurveyOS Unified Inspection Fields & Scan Fee Bill Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify shared inspection placeholders across Spot, Final, Valuation, and Fee Bill in SurveyOS Prime into a bi-directionally synchronized single source of truth, and introduce a dedicated "Fee Bill" tab in SurveyOS Scan notes with shared inspection metadata and sticky rate defaults.

**Architecture:** 
In SurveyOS Prime, implement store-level bi-directional synchronization in Zustand (`claimSlice.ts` and `vehicleSlice.ts`) for common real-world inspection fields: Survey Date & Time (`accident.dateOfSurvey`/`timeOfSurvey` <-> `spotDetails.surveyDatetime` <-> `valuationDetails.inspectionDate`), Place of Survey (`accident.placeOfSurvey` <-> `valuationDetails.inspectionPlace`), Odometer (`vehicle.odometer` <-> `valuationDetails.odometer`), Enclosures (`spotDetails.enclosures` <-> `valuationDetails.enclosures`), and Allotment/Report dates. In SurveyOS Scan, make these core inspection fields shared across Note tabs, upgrade Valuation inspection date to a full datetime picker, and add a dedicated "Fee Bill" tab (`FeeBillFields.kt`, `FeeRatesStore.kt`, `FeeBillExport.kt`, `FeeBillNotes.kt`) under a 3-way chip selector (`Spot | Valuation | Fee Bill`). Update the manifest export (`notes.feeBill`) and Prime's import engine (`src/lib/scan-import/notes.ts`) in lockstep with the handover contract.

**Tech Stack:** 
- SurveyOS Prime: TypeScript, Next.js 16, Zustand, Vitest.
- SurveyOS Scan: Android Jetpack Compose, Material 3, Room, Kotlin Coroutines, JUnit4 drift tests.

---

### Shared vs Fragmented Field Mapping Reference

| Real-World Inspection Concept | Spot Survey Path | Final Survey Path | Valuation Path | Fee Bill Path | Canonical Sync Rule |
|---|---|---|---|---|---|
| **Survey / Inspection Date & Time** | `spotDetails.surveyDatetime` (`YYYY-MM-DDTHH:mm`) | `accident.dateOfSurvey` (`YYYY-MM-DD`) + `accident.timeOfSurvey` (`HH:mm`) | `valuationDetails.inspectionDate` (ISO datetime string) | Uses Final / Spot | Setting any one syncs all three |
| **Place of Survey / Inspection** | `accident.placeOfSurvey` (fallback `spotDetails.repairWorkshop`) | `accident.placeOfSurvey` (fallback `accident.workshopName`) | `valuationDetails.inspectionPlace` | `accident.placeOfSurvey` | Setting any one syncs `accident.placeOfSurvey` and `valuationDetails.inspectionPlace` |
| **Odometer (KM)** | `vehicle.odometer` | `vehicle.odometer` | `valuationDetails.odometer` | N/A | Syncs `vehicle.odometer` <-> `valuationDetails.odometer` |
| **Date of Allotment / Appointment** | `spotDetails.allotmentDate` | `accident.appointmentDate` | N/A | N/A | Syncs `spotDetails.allotmentDate` <-> `accident.appointmentDate` |
| **Date of Report** | `spotDetails.reportDate` | `claim.reportDate` | `claim.reportDate` | `feeBill.billDate` | Syncs `spotDetails.reportDate` <-> `claim.reportDate` |
| **Enclosures** | `spotDetails.enclosures` | N/A | `valuationDetails.enclosures` | N/A | Syncs `spotDetails.enclosures` <-> `valuationDetails.enclosures` |

---

### Task 1: Store-Level Unification in Prime (`claimSlice.ts`, `vehicleSlice.ts`)

**Files:**
- Create: `src/stores/slices/__tests__/inspection-fields-unification.test.ts`
- Modify: `src/stores/slices/claimSlice.ts`
- Modify: `src/stores/slices/vehicleSlice.ts`

**Step 1: Write the failing tests**
Create `src/stores/slices/__tests__/inspection-fields-unification.test.ts` asserting:
1. `updateAccident({ dateOfSurvey: '2026-10-30', timeOfSurvey: '11:30' })` syncs:
   - `spotDetails.surveyDatetime = '2026-10-30T11:30'`
   - `valuationDetails.inspectionDate = '2026-10-30T11:30'` (or `'2026-10-30'`)
2. `updateSpotDetails({ surveyDatetime: '2026-10-30T14:45' })` syncs:
   - `accident.dateOfSurvey = '2026-10-30'`
   - `accident.timeOfSurvey = '14:45'`
   - `valuationDetails.inspectionDate = '2026-10-30T14:45'`
3. `updateValuationDetails({ inspectionDate: '2026-10-30T09:15' })` syncs:
   - `accident.dateOfSurvey = '2026-10-30'`
   - `accident.timeOfSurvey = '09:15'`
   - `spotDetails.surveyDatetime = '2026-10-30T09:15'`
4. `updateAccident({ placeOfSurvey: 'Sai Motors, Dhule' })` syncs:
   - `valuationDetails.inspectionPlace = 'Sai Motors, Dhule'`
5. `updateValuationDetails({ inspectionPlace: 'Apex Garage, Nashik' })` syncs:
   - `accident.placeOfSurvey = 'Apex Garage, Nashik'`
6. `updateVehicle({ odometer: '45210' })` syncs:
   - `valuationDetails.odometer = '45210'`
7. `updateValuationDetails({ odometer: '48300' })` syncs:
   - `vehicle.odometer = '48300'`
8. `updateSpotDetails({ enclosures: 'RC, DL, 12 photos' })` syncs:
   - `valuationDetails.enclosures = 'RC, DL, 12 photos'`
9. `updateSpotDetails({ reportDate: '2026-10-30' })` syncs `claim.reportDate = '2026-10-30'`.
10. `updateSpotDetails({ allotmentDate: '2026-10-28' })` syncs `accident.appointmentDate = '2026-10-28'`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/stores/slices/__tests__/inspection-fields-unification.test.ts`
Expected: FAIL.

**Step 3: Implement minimal store synchronization**
- In `claimSlice.ts`:
  - In `updateAccident`: when `dateOfSurvey` or `timeOfSurvey` updates, compute combined datetime and set `spotDetails.surveyDatetime` and `valuationDetails.inspectionDate`. When `placeOfSurvey` updates, sync `valuationDetails.inspectionPlace`. When `appointmentDate` updates, sync `spotDetails.allotmentDate`.
  - In `updateSpotDetails`: when `surveyDatetime` updates, split into date/time and sync `accident.dateOfSurvey`, `accident.timeOfSurvey`, and `valuationDetails.inspectionDate`. When `enclosures` updates, sync `valuationDetails.enclosures`. When `reportDate` updates, sync `claim.reportDate`. When `allotmentDate` updates, sync `accident.appointmentDate`.
  - In `updateValuationDetails`: when `inspectionDate` updates, parse datetime and sync `accident.dateOfSurvey`, `accident.timeOfSurvey`, and `spotDetails.surveyDatetime`. When `inspectionPlace` updates, sync `accident.placeOfSurvey`. When `odometer` updates, sync `vehicle.odometer`. When `enclosures` updates, sync `spotDetails.enclosures`.
- In `vehicleSlice.ts`:
  - In `updateVehicle`: when `odometer` updates, sync `valuationDetails.odometer`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/stores/slices/__tests__/inspection-fields-unification.test.ts`
Expected: PASS.

**Step 5: Commit in Prime**
```bash
git add src/stores/slices/claimSlice.ts src/stores/slices/vehicleSlice.ts src/stores/slices/__tests__/inspection-fields-unification.test.ts
git commit -m "feat(store): bi-directional synchronization for shared inspection fields"
```

---

### Task 2: Report Builders & Form Fallbacks in Prime

**Files:**
- Modify: `src/lib/reports/valuation-report-builder.ts`
- Modify: `src/lib/reports/spot-fee-bill-builder.ts`
- Modify: `src/components/tabs/ValuationTab.tsx`
- Modify: `src/components/claim/SurveyForm.tsx`
- Test: `src/lib/reports/__tests__/valuation-report.test.ts` (or relevant report test)

**Step 1: Write failing tests for report fallbacks**
Add tests asserting:
1. `buildValuationHTML`: if `valuationDetails.inspectionDate` is empty, falls back to `accident.dateOfSurvey` or `spotDetails.surveyDatetime`.
2. `buildValuationHTML`: if `valuationDetails.odometer` is empty, falls back to `vehicle.odometer`.
3. `buildValuationHTML`: if `valuationDetails.inspectionPlace` is empty, falls back to `accident.placeOfSurvey`.
4. `buildSpotFeeBillHTML`: uses unified survey date and place correctly.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/reports/__tests__/`
Expected: FAIL.

**Step 3: Implement fallbacks & UI alignment**
1. In `valuation-report-builder.ts`:
   - Fall back `inspectionDate` to `claim.accident?.dateOfSurvey || claim.spotDetails?.surveyDatetime || claim.reportDate`.
   - Fall back `odometer` to `claim.vehicle?.odometer || ''`.
   - Fall back `inspectionPlace` to `claim.accident?.placeOfSurvey || claim.accident?.workshopName || ''`.
   - Fall back `enclosures` to `claim.spotDetails?.enclosures || ''`.
2. In `ValuationTab.tsx`:
   - Change `inspectionDate` input from `type="date"` to `type="datetime-local"`.
   - When entered, updates unified inspection datetime.
3. In `SurveyForm.tsx`:
   - Allow Survey Date & Time and Place to be visible and editable for valuation claims as well (or keep unified).

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/reports/__tests__/`
Expected: PASS.

**Step 5: Commit in Prime**
```bash
git add src/lib/reports/valuation-report-builder.ts src/lib/reports/spot-fee-bill-builder.ts src/components/tabs/ValuationTab.tsx src/components/claim/SurveyForm.tsx
git commit -m "fix(reports): add cross-field fallbacks and datetime support for valuation"
```

---

### Task 3: Handover Contract & Prime Scan-Import Engine

**Files:**
- Modify: `../SurveyOS Scan/docs/handover/prime-notes-import.md`
- Modify: `src/lib/scan-import/notes.ts`
- Test: `src/lib/scan-import/__tests__/notes.test.ts`

**Step 1: Write failing tests in `notes.test.ts`**
1. Test `NOTES_ALLOW_LIST` allows all `feeBill.*` paths:
   - `feeBill.billDate`, `feeBill.advanceReceipt`, `feeBill.cashReceived`, `feeBill.feePaid`, `feeBill.professionalFee`, `feeBill.riFee`, `feeBill.distanceKm`, `feeBill.ratePerKm`, `feeBill.travelNote`, `feeBill.tollCharges`, `feeBill.tollNote`, `feeBill.photosCount`, `feeBill.photoRate`, `feeBill.postalCharges`, `feeBill.haltageCharges`, `feeBill.includeGST`.
2. Test that importing phone notes with `spotDetails.surveyDatetime` or `accident.dateOfSurvey` updates the unified inspection fields in Prime.
3. Test that importing `valuationDetails.inspectionDate` with datetime populates both date and time.
4. Verify drift test `allowListMatchesHandover` passes with the new `## Fee Bill fields` section.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/scan-import/__tests__/notes.test.ts`
Expected: FAIL.

**Step 3: Update handover contract and scan-import implementation**
1. In `../SurveyOS Scan/docs/handover/prime-notes-import.md`:
   - Add `## Fee Bill fields` table.
   - Document `notes.feeBill` in the manifest contract.
   - Document `Fee Bill Notes.txt`.
   - Document the shared inspection field contract (Survey Date/Time, Place, Odometer, Enclosures).
2. In `src/lib/scan-import/notes.ts`:
   - Add `feeBill.*` to `NOTES_ALLOW_LIST`.
   - Update `applyNotes` to leverage store sync for unified fields.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/scan-import/__tests__/notes.test.ts`
Expected: PASS.

**Step 5: Commit in Prime**
```bash
git add src/lib/scan-import/notes.ts src/lib/scan-import/__tests__/notes.test.ts "../SurveyOS Scan/docs/handover/prime-notes-import.md"
git commit -m "feat(scan-import): add fee bill allow-list and unified inspection notes import"
```

---

### Task 4: SurveyOS Scan — Shared Inspection Notes & Valuation Datetime

**Files:**
- Modify: `../SurveyOS Scan/app/src/main/java/surveyos/scan/notes/ValuationFields.kt`
- Modify: `../SurveyOS Scan/app/src/main/java/surveyos/scan/ui/claim/NotesViewModel.kt`
- Modify: `../SurveyOS Scan/app/src/main/java/surveyos/scan/notes/ValuationExport.kt`
- Test: `../SurveyOS Scan/app/src/test/java/surveyos/scan/notes/ValuationFieldsTest.kt`
- Test: `../SurveyOS Scan/app/src/test/java/surveyos/scan/notes/ValuationExportTest.kt`

**Step 1: Write failing tests in Scan**
1. In `ValuationFieldsTest.kt`: assert `valuationDetails.inspectionDate` is `NoteControl.DATE_TIME` with label "Date & Time of Inspection".
2. In `ValuationExportTest.kt`: assert export displays formatted date and time.
3. Test that shared inspection keys (datetime, place, odometer, enclosures) share values across note views.

**Step 2: Run test to verify it fails**
In Git Bash:
`cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest --tests surveyos.scan.notes.Valuation*`
Expected: FAIL.

**Step 3: Implement shared field resolution & valuation datetime**
1. In `ValuationFields.kt`:
   - Update `inspectionDate` to `NoteControl.DATE_TIME`, label "Date & Time of Inspection".
2. In `NotesViewModel.kt`:
   - Bridge common field getters so if a shared field (e.g., Odometer, Place, Survey Date/Time, Enclosures) is filled in one note tab, the other note tab automatically accesses it as fallback/initial value.
3. In `ValuationExport.kt`:
   - Format datetime with `displayDateTime`.

**Step 4: Run test to verify it passes**
Run: `./gradlew :app:testDebugUnitTest --tests surveyos.scan.notes.Valuation*`
Expected: PASS.

**Step 5: Commit in Scan**
```bash
git add app/src/main/java/surveyos/scan/notes/ValuationFields.kt app/src/main/java/surveyos/scan/ui/claim/NotesViewModel.kt app/src/main/java/surveyos/scan/notes/ValuationExport.kt app/src/test/java/surveyos/scan/notes/ValuationFieldsTest.kt app/src/test/java/surveyos/scan/notes/ValuationExportTest.kt
git commit -m "feat(notes): upgrade valuation to date-time and link shared inspection fields"
```

---

### Task 5: SurveyOS Scan — Fee Bill Fields, Sticky Rates, and Export

**Files:**
- Create: `../SurveyOS Scan/app/src/main/java/surveyos/scan/notes/FeeBillFields.kt`
- Create: `../SurveyOS Scan/app/src/main/java/surveyos/scan/notes/FeeRatesStore.kt`
- Create: `../SurveyOS Scan/app/src/main/java/surveyos/scan/notes/FeeBillExport.kt`
- Modify: `../SurveyOS Scan/app/src/main/java/surveyos/scan/notes/NotesExport.kt`
- Modify: `../SurveyOS Scan/app/src/main/java/surveyos/scan/notes/NoteSuggestions.kt`
- Test: `../SurveyOS Scan/app/src/test/java/surveyos/scan/notes/FeeBillFieldsTest.kt`
- Test: `../SurveyOS Scan/app/src/test/java/surveyos/scan/notes/FeeBillExportTest.kt`

**Step 1: Write failing tests in Scan**
1. `FeeBillFieldsTest.kt`: assert all `FEE_BILL_FIELDS` labels match Prime's `FeesTab.tsx` and `spot-fee-bill-builder.ts`.
2. Test math helpers: `travellingCharges`, `travelTotal`, `photoCharges`, `subTotal`, `gstAmount`, `grossTotal`.
3. `FeeBillExportTest.kt`: assert `Fee Bill Notes.txt` formatting.
4. `NotesExportTest.kt`: assert `notes.feeBill` is included in manifest JSON.

**Step 2: Run test to verify it fails**
Run: `./gradlew :app:testDebugUnitTest --tests surveyos.scan.notes.FeeBill*`
Expected: FAIL.

**Step 3: Implement FeeBillFields, sticky rates, and export**
1. Create `FeeBillFields.kt` with sections (`BILL`, `FEES`, `TRAVEL`, `PHOTOS`, `EXPENSES`, `TAX`), fields, and calculation helpers.
2. Create `FeeRatesStore.kt` using `SharedPreferences` for sticky defaults.
3. In `NoteSuggestions.kt`: add photo count suggestion from claim photos.
4. Create `FeeBillExport.kt` and update `NotesExport.kt` to serialize `notes.feeBill` and write `Fee Bill Notes.txt`.

**Step 4: Run test to verify it passes**
Run: `./gradlew :app:testDebugUnitTest --tests surveyos.scan.notes.FeeBill* --tests surveyos.scan.notes.NotesExportTest`
Expected: PASS.

**Step 5: Commit in Scan**
```bash
git add app/src/main/java/surveyos/scan/notes/FeeBillFields.kt app/src/main/java/surveyos/scan/notes/FeeRatesStore.kt app/src/main/java/surveyos/scan/notes/FeeBillExport.kt app/src/main/java/surveyos/scan/notes/NotesExport.kt app/src/test/java/surveyos/scan/notes/FeeBillFieldsTest.kt app/src/test/java/surveyos/scan/notes/FeeBillExportTest.kt
git commit -m "feat(notes): implement fee bill fields, sticky rates, and export"
```

---

### Task 6: SurveyOS Scan — Notes UI with 3-Way Chips & Live Calculations

**Files:**
- Create: `../SurveyOS Scan/app/src/main/java/surveyos/scan/ui/claim/FeeBillNotes.kt`
- Modify: `../SurveyOS Scan/app/src/main/java/surveyos/scan/ui/claim/NotesTab.kt`
- Modify: `../SurveyOS Scan/app/src/main/java/surveyos/scan/ui/claim/ClaimScreen.kt`

**Step 1: Implement FeeBillNotes UI and update chip navigation**
1. In `NotesTab.kt`:
   - Replace boolean with `NoteKind` enum: `SPOT`, `VALUATION`, `FEE_BILL`.
   - Render 3 chips: `Spot | Valuation | Fee Bill`.
   - When `FEE_BILL` selected, render `FeeBillNotes`.
2. In `FeeBillNotes.kt`:
   - Show Inspection Header (Survey Date & Time, Place of Survey - pre-filled from shared inspection state).
   - Render sections in `NoteSectionCard`s: Bill Details, Fee Components, Travel & Tolls, Photography, Incidental Expenses, and Summary.
   - Display live calculated totals (Travelling Charges, Photos Total, Subtotal, GST @ 18%, Gross Total).
   - On rate changes, update sticky values in `FeeRatesStore`.

**Step 2: Run all Scan unit and drift tests**
Run: `cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest`
Expected: PASS (all tests green).

**Step 3: Commit in Scan**
```bash
git add app/src/main/java/surveyos/scan/ui/claim/FeeBillNotes.kt app/src/main/java/surveyos/scan/ui/claim/NotesTab.kt app/src/main/java/surveyos/scan/ui/claim/ClaimScreen.kt
git commit -m "feat(ui): add fee bill notes screen with live calculations and shared inspection header"
```

---

### Task 7: Full End-to-End Test Suite & KnowledgeBase Logging

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-10-30-unified-inspection-and-scan-fee-bill.md`

**Step 1: Run comprehensive tests in both repos**
1. In Prime:
   `npx vitest run`
   `npx tsc --noEmit`
2. In Scan:
   `./gradlew :app:testDebugUnitTest`

**Step 2: Verify zero regressions**
Confirm all 1865+ Prime tests and all Scan drift/unit tests pass with 0 errors.

**Step 3: Update documentation and log session**
Document the unified fields architecture, fee bill feature, and coupling points as required by `AGENT_PROTOCOL.md`.
Commit on `main`.
