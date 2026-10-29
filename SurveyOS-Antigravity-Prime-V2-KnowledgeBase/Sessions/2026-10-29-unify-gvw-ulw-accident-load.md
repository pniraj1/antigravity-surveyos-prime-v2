# Session Log: 2026-10-29 — Unify GVW, ULW, and Accident Load

**Agent:** Antigravity  
**Goal:** Root-cause investigate and resolve duplicate weight and load fields across Spot and Final claim details, forms, AI extraction, and report builders.

---

### 1. Root Cause Findings & Decisions
- **GVW and ULW Duplication:**
  - `VehicleForm.tsx` had `vehicle.registeredLoadWeight` (string) and `vehicle.unladenWeight` (number).
  - `SpotTab.tsx` had `spotDetails.gvw` (number) and `spotDetails.ulw` (number).
  - `vehicleSlice.ts` only synced `registeredLoadWeight` -> `spotDetails.gvw` one-way, never synced `unladenWeight`, and `SpotTab.tsx` never synced back to `vehicle`.
  - `SpotPrintReport.tsx` Section C printed `vehicle.registeredLoadWeight`, while Section E printed `spotDetails.gvw` and `spotDetails.ulw`. If a surveyor typed ULW in Vehicle Details, Spot Section E printed `—` for ULW and left Payload Capacity blank.
- **Accident Load Duplication:**
  - `AtAccidentForm.tsx` rendered two duplicate inputs right above each other: "Load at Accident (KG)" (`spotDetails.actualLoad`) and "Goods Weight at Accident" (`vehicle.goodsWeightAtAccident`).
  - Standard and Spot reports read `spotDetails.actualLoad`, UIIC read `vehicle.goodsWeightAtAccident || spotDetails.actualLoad`, and SurveyOS Scan synced `spotDetails.actualLoad`.

---

### 2. Implementation Summary
1. **Store Bi-directional Sync (`vehicleSlice.ts`, `claimSlice.ts`):**
   - Synchronized `vehicle.registeredLoadWeight` / `grossWeight` with `spotDetails.gvw`.
   - Synchronized `vehicle.unladenWeight` with `spotDetails.ulw`.
   - Automated Legal Load Capacity calculation (`(gvw > ulw && ulw > 0) ? gvw - ulw : (gvw || 0)`) in both slices.
   - Synchronized `spotDetails.actualLoad` (number) with `vehicle.goodsWeightAtAccident` / `vehicle.actualPayload` (string).
   - Commit `236ec70c`.
2. **Form Cleanup (`AtAccidentForm.tsx`):**
   - Removed redundant "Goods Weight at Accident" input.
   - Kept single authoritative "Load at Accident (KG)" input with fallback display and two-way store synchronization.
   - Commit `49c20d93`.
3. **Cross-Tab Reflection (`SpotTab.tsx`, `VehicleForm.tsx`):**
   - `SpotTab` inputs and payload calculation fallback to `vehicle.registeredLoadWeight` and `vehicle.unladenWeight`.
   - Changes in `SpotTab` update both `spotDetails` and `vehicle`.
   - Commit `d3cdea4d`.
4. **Report Builder Fallbacks (`SpotPrintReport.tsx`, `standard-report-builder.ts`, `uiic-final-builder.ts`, `UIICPrintReport.tsx`):**
   - Added robust cross-fallbacks across all builders so reports render complete data regardless of where values were entered.
   - Commit `a4d690a9`.
5. **AI Document Extraction Alignment (`aiDataSlice.ts`):**
   - Synchronized `applyRC`, `applyFitness`, and `applyLokChallan` to uniformly populate both `vehicle.*` and `spotDetails.*`.
   - Commit `753a1dce`.

---

### 3. Verification & Coupling
- **TypeScript:** `npx tsc --noEmit` exited with 0 errors.
- **Vitest:** 223 test files (1,937 tests) all passing.
- **SurveyOS Scan Coupling:** Zero drift; `spotDetails.actualLoad` remains the primary contract key in `src/lib/scan-import/notes.ts`.
