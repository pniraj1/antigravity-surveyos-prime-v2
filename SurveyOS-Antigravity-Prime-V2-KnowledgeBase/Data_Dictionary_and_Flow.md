# Data Dictionary & Reporting Process Flow

This document outlines the strict pipeline of how a claim transitions from a UI form down to a highly constrained output template, detailing every major placeholder and module transition inside SurveyOS-Prime-V2.

## The Macro Flow

The application follows a strictly unidirectional data lineage:
**React UI Components** ➡️ **Zustand State (`useClaimStore`)** ➡️ **TypeScript Model (`ClaimData`)** ➡️ **Reporting Engines (Excel / React-PDF)**

1.  **Input Phase**: User interacts with components like `VehicleDetailsForm.tsx` or `AssessmentGrid.tsx`.
2.  **State Phase**: These components fire updates to the Zustand store (e.g., `updateVehicleField('chassisNumber', '...')`).
3.  **Model Phase**: The state directly represents our `src/types/claim.ts` definition (Detailed below).
4.  **Generation Phase**: On hitting Export, the entire `ClaimData` object is passed directly into a Report Builder class, which maps the JSON properties to literal physical document coordinates.

---

## The Master Data Schema (`src/types/claim.ts`)

Everything originates from the single source of truth: the `ClaimData` model. Here is the explicit field-to-field mapping of what gets captured.

### 1. `Report Metadata`
*   **`reportNo`**: The sequential allocation (e.g., `FIN/2026/004`).
*   **`reportDate`**: Current timestamp of generation.
*   **`surveyType`**: Flag holding `spot` or `final`.
*   **`isActive` & `isCompleted`**: Boolean flags used by the Dashboard to filter views.

### 2. `VehicleDetails`
In the UI, this is the "Vehicle" tab.
*   `registrationNumber` (Mapped to Vehicle Reg No.)
*   `make` & `model` (Mapped to Vehicle Make/Class)
*   `chassisNumber` & `engineNumber`
*   `dateOfRegistration` & `yearOfManufacture`
*   `odometer` & `colour` & `fuel` & `seatingCapacity`

### 3. `PolicyDetails`
*   `policyNumber`
*   `insurerName` & `insurerBranch` (Triggers whether standard PDF or specific UIIC logic runs)
*   `insuredName` & `insuredAddress` & `insuredMobile`
*   `periodFrom` & `periodTo`
*   `idv` (Insured Declared Value - Critical for total loss calculation)
*   `excess` & `hpa`

### 4. `DriverDetails`
*   `name` & `licenceNumber`
*   `dateOfIssue` & `validUpto`
*   `typeOfLicence` (NT/TR/LMV... etc)

### 5. `AccidentDetails`
*   `dateAndTime` & `placeOfAccident` & `natureOfAccident`
*   `policeAction` & `thirdPartyDamage` & `injuryDetails`

### 6. `AssessmentRow` (The Core Math Engine)
Used in the `Assessment` tab, this governs financial calculation.
*   `sno` (Row Number)
*   `partName`
*   `type` (`Metal`, `Plastic`, `Glass`, `Rubber`)
*   `job` (`Replace`, `Repair`)
*   `estimatedAmount` (Workshop estimate)
*   `depreciationPct` (Calculated automatically based on `VehicleDetails.dateOfRegistration`)
*   `assessedAmount` (Mathematical: Est - Dep)

### 7. `ReinspectionDetails` & `BillCheckDetails`
Secondary stages that only activate late in the final survey process.
*   Reinspection fields: `date`, `place`, `findings`.
*   Bill Fields: `billedLabour`, `billedParts`, `billedTaxes`, vs `assessedLabour`, `assessedParts`, `assessedTaxes`.

---

## Output Engines: Field-to-Template Mapping

Once `ClaimData` is assembled, it gets injected into outputs. We have two very different logic flows for placeholders.

### Process Flow A: The UIIC Excel Bridge (`uiic-excel-builder.ts`)
*File Location: `src/lib/reports/uiic-excel-builder.ts`*
Because legacy UIIC requires strict Microsoft Excel formats, this module uses `exceljs` to manually map fields to Exact Cell Coordinates.

**Example Placemarkers in Code:**
*   `A4:H4` ➡️ `MOTOR SURVEY REPORT (FINAL)` (Header injection)
*   `CRow` (Dynamic) ➡️ `this.claim.policy?.policyNumber`
*   `GRow` (Dynamic) ➡️ `this.claim.vehicle?.make`
*The math is not done in Excel formulas. We pass the computed results directly into the static cells.*

### Process Flow B: Standard React-PDF Engine (`UIICReportDocument.tsx`)
*File Location: `src/components/pdf/UIICReportDocument.tsx`*
Instead of A1:B2 coordinates, this uses CSS-like Flexbox and React PropTypes to structure the data for a printer perfectly.

**Example Placemarkers in Code:**
```tsx
<LabelValue label="Insured Name" value={claim.policy?.insuredName} />
<LabelValue label="Chassis Number" value={claim.vehicle?.chassisNumber} />
```
The React PDF library reads the entire DOM structure, iterates over all `AssessmentRow` arrays using a standard `.map(row => <Cell>{row.partName}</Cell>)` and renders the final PDF blob dynamically inside the browser, zero server processing required.
