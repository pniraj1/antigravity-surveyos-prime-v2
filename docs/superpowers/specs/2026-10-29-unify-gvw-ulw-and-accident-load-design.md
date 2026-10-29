# Unify GVW, ULW, and Accident Load Design Specification

> **Date:** 2026-10-29  
> **Status:** Draft / Approved for Planning  
> **Scope:** Option A (GVW & ULW Unification + Load at Accident / Goods Weight Consolidation)

---

## 1. Context & Motivation

In Motor SurveyOS Prime V2, motor insurance surveyors enter vehicle and accident details that produce official survey reports (Spot Report, Standard Final Report, UIIC Final Report).

Currently, two key weight and load parameters are duplicated across distinct forms and distinct state slices:
1. **GVW (Gross Vehicle Weight) and ULW (Unladen Weight):**
   - Appears in **Vehicle Details** (`VehicleForm.tsx`) as `vehicle.registeredLoadWeight` (string) and `vehicle.unladenWeight` (number).
   - Appears in **Spot Findings &rarr; Load Capacity** (`SpotTab.tsx`) as `spotDetails.gvw` (number) and `spotDetails.ulw` (number).
   - In `SpotPrintReport.tsx`, Section C (Vehicle Particulars) prints `vehicle.registeredLoadWeight`, while Section E (Load Details) prints `spotDetails.gvw`, `spotDetails.ulw`, and computes `loadCapacity`.
   - **Bug:** `vehicleSlice.ts` only synchronizes `registeredLoadWeight` &rarr; `spotDetails.gvw` one-way, and **never synchronizes ULW**. When a surveyor enters ULW in Vehicle Details, Section E of the printed Spot Report prints `—` (dash) for ULW, leaving Legal Load Capacity blank. Furthermore, if a surveyor enters weights in `SpotTab.tsx`, nothing syncs back to `vehicle`.
2. **Load at Accident vs. Goods Weight at Accident:**
   - Both fields are rendered in the exact same card in `AtAccidentForm.tsx` ("At the Time of Accident"):
     - Field 1: `<Label>Load at Accident (KG)</Label>` bound to `spotDetails.actualLoad` (number; includes overload alert check).
     - Field 2: `<Label>Goods Weight at Accident</Label>` bound to `vehicle.goodsWeightAtAccident` (string).
   - In the data model, `vehicle.actualPayload` also exists as an orphaned duplicate.
   - Spot reports and standard final reports read `spotDetails.actualLoad`, whereas UIIC read `vehicle.goodsWeightAtAccident || spotDetails.actualLoad`. SurveyOS Scan imports into `spotDetails.actualLoad`. Having two separate inputs for the exact same figure confuses surveyors and results in partial data entry.

---

## 2. Goals & Non-Goals

### Goals
- **Consolidate UI inputs:** Remove the duplicate "Goods Weight at Accident" input in `AtAccidentForm.tsx`, keeping a single authoritative "Load at Accident (KG)" input.
- **Bi-directional synchronization:** Any edit to GVW, ULW, or Load at Accident in any form (`VehicleForm`, `SpotTab`, `AtAccidentForm`) immediately updates both `vehicle.*` and `spotDetails.*` in the Zustand store.
- **Automatic calculation:** Legal Load Capacity (`gvw - ulw`) is automatically computed whenever GVW or ULW changes.
- **Report cross-fallback:** All report builders (`SpotPrintReport.tsx`, `standard-report-builder.ts`, `uiic-final-builder.ts`, `UIICPrintReport.tsx`) gracefully cross-fallback between `vehicle.*` and `spotDetails.*` so existing claims and legacy records render without missing values.
- **AI extraction alignment:** Ensure RC, Fitness, and Load Challan extractions in `aiDataSlice.ts` populate all paired fields synchronously.
- **Scan compatibility:** Zero drift or breaking changes for SurveyOS Scan (`spotDetails.actualLoad` remains the primary contract key).

### Non-Goals
- Altering other fields (Workshop Name, Nature/Description of Goods, Hypothecation, Valuation Odometer) — these will be handled in subsequent planned iterations.
- Database schema migration or breaking changes to `ClaimData` structure (both field locations are preserved in state for 100% backward compatibility).

---

## 3. Architecture & Data Flow

```
                      [ User Input ]
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
 [ VehicleForm.tsx ]  [ SpotTab.tsx ]  [ AtAccidentForm.tsx ]
   GVW / ULW            GVW / ULW        Load at Accident
        │                   │                   │
        ▼                   ▼                   ▼
 [ vehicleSlice ] ◄─────────┴─────────► [ claimSlice ]
   updateVehicle()                       updateSpotDetails()
        │                                       │
        └───────────────────┬───────────────────┘
                            │ (Bi-directional Sync)
                            ▼
              ┌───────────────────────────┐
              │     Zustand ClaimData     │
              │ ───────────────────────── │
              │ vehicle.registeredLoadWt  │ ◄──► spotDetails.gvw
              │ vehicle.grossWeight       │
              │ vehicle.unladenWeight     │ ◄──► spotDetails.ulw
              │                           │      spotDetails.loadCapacity
              │ vehicle.goodsWeight...    │ ◄──► spotDetails.actualLoad
              │ vehicle.actualPayload     │
              └─────────────┬─────────────┘
                            │
                            ▼
                    [ Report Builders ]
   SpotPrintReport / standard-report-builder / uiic-final-builder
         (Cross-fallback: reads spotDetails || vehicle)
```

### State Synchronization Rules
1. **GVW Sync:**
   - When `registeredLoadWeight` or `grossWeight` is updated:
     - `parsed = parseFloat(String(val).replace(/[^0-9.]/g, ''))`
     - If `parsed > 0`, set `spotDetails.gvw = parsed`, `vehicle.grossWeight = parsed`, `vehicle.registeredLoadWeight = String(parsed)`.
     - Recalculate `spotDetails.loadCapacity = (gvw > ulw && ulw > 0) ? gvw - ulw : 0`.
   - When `spotDetails.gvw` is updated:
     - Set `vehicle.registeredLoadWeight = gvw ? String(gvw) : ''`, `vehicle.grossWeight = gvw`.
     - Recalculate `spotDetails.loadCapacity = (gvw > ulw && ulw > 0) ? gvw - ulw : 0`.

2. **ULW Sync:**
   - When `vehicle.unladenWeight` is updated:
     - Set `spotDetails.ulw = unladenWeight`.
     - Recalculate `spotDetails.loadCapacity = (gvw > ulw && ulw > 0) ? gvw - ulw : 0`.
   - When `spotDetails.ulw` is updated:
     - Set `vehicle.unladenWeight = ulw`.
     - Recalculate `spotDetails.loadCapacity = (gvw > ulw && ulw > 0) ? gvw - ulw : 0`.

3. **Load at Accident Sync:**
   - When `spotDetails.actualLoad` is updated:
     - Set `vehicle.goodsWeightAtAccident = actualLoad ? String(actualLoad) : ''`.
     - Set `vehicle.actualPayload = actualLoad ? String(actualLoad) : ''`.
   - When `vehicle.goodsWeightAtAccident` is updated:
     - Set `spotDetails.actualLoad = parseFloat(goodsWeightAtAccident) || null`.

---

## 4. Report Fallback Matrix

| Report | Field | Priority 1 | Priority 2 | Priority 3 |
|---|---|---|---|---|
| **Spot Report (Sec C)** | GVW | `vehicle.registeredLoadWeight` | `spotDetails.gvw + ' kg'` | `—` |
| **Spot Report (Sec E)** | GVW (kg) | `spotDetails.gvw` | `vehicle.grossWeight` | `parseFloat(vehicle.registeredLoadWeight)` |
| **Spot Report (Sec E)** | ULW / Tare (kg) | `spotDetails.ulw` | `vehicle.unladenWeight` | `—` |
| **Spot Report (Sec E)** | Legal Load Capacity | `spotDetails.loadCapacity` | `gvw - ulw` | `—` |
| **Spot Report (Sec E)** | Actual Load Carried | `spotDetails.actualLoad` | `parseFloat(vehicle.goodsWeightAtAccident)` | `—` |
| **Standard Final (Sec 2)** | GVW | `vehicle.registeredLoadWeight` | `spotDetails.gvw + ' kg'` | `—` |
| **Standard Final (Sec 5)** | Load at Accident | `spotDetails.actualLoad` | `vehicle.goodsWeightAtAccident` | `—` |
| **UIIC Final** | Registered Laden Wt | `vehicle.registeredLoadWeight` | `vehicle.grossWeight` | `spotDetails.gvw` |
| **UIIC Final** | Registered Unladen Wt | `vehicle.unladenWeight` | `spotDetails.ulw` | `—` |
| **UIIC Final** | Weight of Goods Carried | `vehicle.goodsWeightAtAccident` | `spotDetails.actualLoad` | `—` |
| **UIIC Print** | Gross Weight | `vehicle.grossWeight` | `vehicle.registeredLoadWeight` | `spotDetails.gvw` |

---

## 5. SurveyOS Scan & External Coupling Verification
- Scan imports `spotDetails.actualLoad` via `src/lib/scan-import/notes.ts`.
- `spotDetails.actualLoad` is fully preserved as the primary key.
- Drift tests in `SurveyOS Scan` test contract types and labels; zero changes to contract types.
- Scan unit tests pass with zero drift.
