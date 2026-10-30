# Unify Goods Nature/Description, HPA/Financier, and Valuation Odometer Design Specification

> **Date:** 2026-10-30  
> **Status:** Draft / Approved for Planning  
> **Scope:** Three Unified Workflows (Goods Nature & Description, HPA / Financier Interest, and Valuation / Vehicle Odometer)

---

## 1. Context & Business Rationale

Following the successful unification of GVW, ULW, and Accident Load, this specification unifies three remaining dual/split fields across the claim workflow:

1. **Goods Description vs. Nature of Goods (`AtAccidentForm.tsx`):**
   - In commercial claims, `AtAccidentForm.tsx` presented two separate text boxes: "Nature of Goods" (`vehicle.natureOfGoods`, shown only on final claims) and "Description of Goods" (`spotDetails.loadDesc`, shown on all commercial claims).
   - In addition, `vehicle.detailsOfGoodsCarried` existed in the model with no UI input.
   - Standard reports and Spot reports read `spotDetails.loadDesc`. UIIC reports read `detailsOfGoodsCarried || loadDesc` and `natureOfGoods`.
   - Surveyors perceive these as one single concept (the cargo being transported, e.g. "CEMENT BAGS", "STEEL COILS", "EMPTY").
2. **Financier / Hypothecation (HPA) Across Policy & Vehicle (`PolicyForm.tsx` & `VehicleForm.tsx`):**
   - `PolicyForm.tsx` asks for "Hypothecation (HPA)" (`policy.hpaWith`).
   - `VehicleForm.tsx` asks for "Hypothecation (H.P.A.)" (`vehicle.hypothecation`) AND "RC Endorsement (Financier)" (`vehicle.rcEndorsement`).
   - If AI extracts HPA from Policy, `policy.hpaWith` is set, but `vehicle.hypothecation` and `vehicle.rcEndorsement` remain blank.
   - UIIC report prints "RC endorsement on financier interest: [BLANK]" even though Policy had the financier.
   - Standard and Spot reports read `policy.hpaWith || vehicle.hypothecation`.
   - The financier is identical on the RC and the Policy schedule.
3. **Valuation Odometer vs. Vehicle Odometer (`ValuationTab.tsx` & `SurveyForm.tsx`):**
   - On the `Claim Details` tab, `SurveyForm.tsx` provides an "Odometer" input (`vehicle.odometer`).
   - On the `Valuation` tab, `ValuationTab.tsx` provides an "Odometer Reading (km)" input (`valuationDetails.odometer`).
   - The Valuation Report builder (`valuation-report-builder.ts`) strictly reads `vd.odometer`. If a surveyor entered the reading on Claim Details, the valuation report rendered as `—` (blank)!
   - Phone scan imports from SurveyOS Scan write to either `vehicle.odometer` (spot) or `valuationDetails.odometer` (valuation).

---

## 2. Requirements & Architecture

### A. Store-Level Bi-Directional Synchronization
1. **Goods Nature & Description:**
   - In `claimSlice.ts` (`updateSpotDetails`): updating `loadDesc` syncs `vehicle.natureOfGoods = loadDesc` and `vehicle.detailsOfGoodsCarried = loadDesc`.
   - In `vehicleSlice.ts` (`updateVehicle`): updating `natureOfGoods` or `detailsOfGoodsCarried` syncs `spotDetails.loadDesc`.
2. **Financier / Hypothecation:**
   - In `claimSlice.ts` (`updatePolicy`): updating `hpaWith` syncs `vehicle.hypothecation = hpaWith` and `vehicle.rcEndorsement = hpaWith`.
   - In `vehicleSlice.ts` (`updateVehicle`): updating `hypothecation` or `rcEndorsement` syncs `policy.hpaWith = hypothecation || rcEndorsement`.
3. **Valuation Odometer:**
   - In `claimSlice.ts` (`updateValuationDetails`): updating `odometer` syncs `vehicle.odometer = odometer`.
   - In `vehicleSlice.ts` (`updateVehicle`): updating `odometer` syncs `valuationDetails.odometer = odometer`.

### B. Form De-duplication & Reflection
1. **`AtAccidentForm.tsx`:**
   - Remove redundant separate "Nature of Goods" input.
   - Keep a single authoritative input labeled: **"Nature / Description of Goods"** (`c-goods`), bound with fallback: `sd.loadDesc || v?.natureOfGoods || v?.detailsOfGoodsCarried || ''`.
   - On change, updates both `spotDetails` and `vehicle`.
2. **`PolicyForm.tsx` & `VehicleForm.tsx`:**
   - In `PolicyForm.tsx`: `p?.hpaWith || v?.hypothecation || v?.rcEndorsement || ''`.
   - In `VehicleForm.tsx`: `v?.hypothecation || p?.hpaWith || ''` and `v?.rcEndorsement || v?.hypothecation || p?.hpaWith || ''`.
   - Updates keep all three fields in sync.
3. **`SurveyForm.tsx` & `ValuationTab.tsx`:**
   - In `SurveyForm.tsx`: `v?.odometer || currentClaim.valuationDetails?.odometer || ''`.
   - In `ValuationTab.tsx`: `vd.odometer || currentClaim.vehicle?.odometer || ''`.
   - Updates in either form update both paths.

### C. AI Document Extraction Alignment (`aiDataSlice.ts`)
1. **`applyLokChallan`:** Sets `spotDetails.loadDesc`, `vehicle.natureOfGoods`, and `vehicle.detailsOfGoodsCarried` from `data.goods_description`.
2. **`applyRC`:** Sets `vehicle.hypothecation`, `vehicle.rcEndorsement`, and `policy.hpaWith` from `data.hypothecation || data.hpa`.
3. **`applyPolicy`:** Sets `policy.hpaWith`, `vehicle.hypothecation`, and `vehicle.rcEndorsement` from `data.hpa_with`.
4. **Odometer extraction:** If extracted, updates both `vehicle.odometer` and `valuationDetails.odometer`.

### D. Report Builders Cross-Fallback Matrix
- **Spot Report (`SpotPrintReport.tsx`):**
  - Goods Carried: `{spotDetails.loadDesc || vehicle.natureOfGoods || vehicle.detailsOfGoodsCarried || '—'}`
  - HPA: `{policy.hpaWith || vehicle.hypothecation || vehicle.rcEndorsement || 'NIL'}`
- **Standard Final Report (`standard-report-builder.ts`):**
  - Description of Goods / Passengers: `${sd?.loadDesc || (vehicle as any)?.natureOfGoods || (vehicle as any)?.detailsOfGoodsCarried || '—'}`
  - HPA: `${policy.hpaWith || vehicle.hypothecation || vehicle.rcEndorsement || 'NIL'}`
- **UIIC Final Report (`uiic-final-builder.ts`):**
  - Details of goods carried: `${g((v as any).detailsOfGoodsCarried || sd.loadDesc || (v as any).natureOfGoods)}`
  - Nature of goods carried: `${g((v as any).natureOfGoods || sd.loadDesc || (v as any).detailsOfGoodsCarried)}`
  - FINANCIER INTEREST: `${g(p.hpaWith || v.hypothecation || v.rcEndorsement) || 'NIL'}`
  - RC endorsement on financier interest: `${g(v.rcEndorsement || v.hypothecation || p.hpaWith)}`
- **UIIC Print Report (`UIICPrintReport.tsx`):**
  - RC Endorsement: `{claim.vehicle.rcEndorsement || claim.vehicle.hypothecation || claim.policy.hpaWith || ''}`
- **Valuation Report (`valuation-report-builder.ts`):**
  - Kilometerage: `${g(vd.odometer || v.odometer)}`

---

## 3. SurveyOS Scan & External Coupling Verification
- Scan imports `spotDetails.loadDesc`, `vehicle.odometer`, and `valuationDetails.odometer` via `src/lib/scan-import/notes.ts`.
- Contract keys remain 100% unchanged.
- Because Prime now cross-syncs `vehicle.odometer` &harr; `valuationDetails.odometer` and `spotDetails.loadDesc` &harr; `vehicle.natureOfGoods`, phone captures for a claim will automatically populate both modules without drift.
