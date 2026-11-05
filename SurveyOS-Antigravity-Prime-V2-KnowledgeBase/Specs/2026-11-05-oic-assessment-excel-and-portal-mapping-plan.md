# OIC Assessment Excel & Portal Mapping Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Oriental Insurance (OIC) Assessment Excel generator (`9400ExcelOICL.xlsx` format) and Chrome extension portal mapping for auto-filling `/surveyor-assessment-form`.

**Architecture:** Pure Adapter Layer. The core SurveyOS assessment grid and statutory IRDAI survey reports remain 100% untouched. The adapter (`oic-assessment-excel.ts`, `OICExportDialog.tsx`, and `oic-assessment.overlay.json`) translates clean claim data into OIC's 2-sheet Excel upload and DOM input fields.

**Tech Stack:** TypeScript, Next.js 16, React 19, ExcelJS, Lucide React, Vitest, Chrome Extension Manifest V3.

---

### Task 1: OIC Excel Generator Business Logic & Pure Workbook Builder

**Files:**
- Create: `src/lib/reports/oic-assessment-excel.ts`
- Test: `src/lib/reports/__tests__/oic-assessment-excel.test.ts`

**Step 1: Write the failing unit tests**
Define tests covering:
1. Column headers for `Invoice` and `Items` sheets matching `9400ExcelOICL.xlsx`.
2. Part type mapping: plastic -> Plastic, metal -> Metallic Parts, glass -> Glass, rubber -> Non-Metalic Parts, labour -> Labour Charge.
3. Painting calculation:
   - Nil Depreciation: Single row under `Labour Charge` (`TOTAL PAINTING CHARGES`) at 0% depreciation.
   - Standard: Two rows: 75% under `Labour Charge` at 0% dep, and 25% under `Plastic` at 50% dep.
4. Formula generation for Column K: `=ROUND((E{row}-(E{row}*F{row}/100))*(G{row}/100),2)`.
5. Invoice sheet totals matching items sum.
6. ExcelJS Data Validations on dropdown columns.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/reports/__tests__/oic-assessment-excel.test.ts`
Expected: FAIL with module not found or functions missing.

**Step 3: Implement minimal code in `src/lib/reports/oic-assessment-excel.ts`**
- Export types: `OicInvoiceRow`, `OicItemRow`, `OicItemDescription`, `OicSideDescription`, `OicGstType`.
- Export functions: `oicAssessmentRows`, `buildOicWorkbook`, `exportOicAssessmentExcel`.
- Add data validations matching `9400ExcelOICL.xlsx`.
- Hook into `saveDocuments` for auto-filing into claim folder.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/reports/__tests__/oic-assessment-excel.test.ts`
Expected: PASS (all tests green).

**Step 5: Commit**
```bash
git add src/lib/reports/oic-assessment-excel.ts src/lib/reports/__tests__/oic-assessment-excel.test.ts
git commit -m "feat(oic): add oic assessment excel generator with statutory painting split"
```

---

### Task 2: Build OIC Export Dialog Component

**Files:**
- Create: `src/components/dialogs/OICExportDialog.tsx`
- Test: `src/components/dialogs/__tests__/OICExportDialog.test.tsx` (or vitest check)

**Step 1: Write failing component tests / checks**
Verify:
1. Dialog renders title "Oriental Insurance — Assessment Upload".
2. Bill check gate checkbox defaults to unchecked and disables download until verified.
3. Displays invoice number, date, and GST type inputs.
4. Displays painting translation chip indicating how paint was handled (Nil-dep vs Standard split).
5. Calls `exportOicAssessmentExcel` on download click.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/dialogs/__tests__/OICExportDialog.test.tsx`
Expected: FAIL.

**Step 3: Implement `OICExportDialog.tsx`**
- Create modal dialog with clean Executive Platinum / Tailwind styling matching `NIAExportDialog.tsx`.
- Include bill check gate, invoice metadata form, preview summary, Excel download, and extension send trigger.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/dialogs/__tests__/OICExportDialog.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/dialogs/OICExportDialog.tsx
git commit -m "feat(ui): add OIC export dialog with bill check gate and painting preview"
```

---

### Task 3: Hook "OIC Excel" Button into AssessmentGrid

**Files:**
- Modify: `src/components/claim/AssessmentGrid.tsx`

**Step 1: Update `AssessmentGrid.tsx`**
- Import `OICExportDialog`.
- Add state `showOicExport`.
- Add "OIC Excel" button with indigo styling alongside UIIC and NIA buttons in toolbar:
  ```tsx
  <button
    onClick={() => setShowOicExport(true)}
    title="Excel for Oriental Insurance portal"
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 transition-colors border border-indigo-500/20 text-xs font-semibold"
  >
    <ClipboardList size={14} /> OIC Excel
  </button>
  ```
- Render `<OICExportDialog ... />` conditionally when `showOicExport` is true.

**Step 2: Run TypeScript and test suite**
Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass.

**Step 3: Commit**
```bash
git add src/components/claim/AssessmentGrid.tsx
git commit -m "feat(assessment): add OIC Excel export button to AssessmentGrid toolbar"
```

---

### Task 4: Portal Mapping Specification & Extension Support

**Files:**
- Create: `scripts/portal-map/oic-assessment.overlay.json`
- Modify: `extension/manifest.json`
- Modify: `extension/filler.js` (or `extension/fill-core.js` for PrimeReact input handling)

**Step 1: Create `oic-assessment.overlay.json`**
- Map all fields identified from `Oriental Insurance Company Limited generate assessment.html`:
  - `claimNumber` (search)
  - Vehicle details: `regNumber`, `make`, `model`, `chasisNumber`, `engineNumber`, `cubicCapacity`, `manufacturingYear`, `colorOfVehicle`, `typeOfFuel`, `unladenWeight`, `registeredLadenWeight`, `seatingLoadCarryingCapacity`.
  - Loss details: `closeProximity`, `vbConfirmed`, `nillDepreciationCover`, `lossDescription`.
  - Driver details: `driverName`, `driverDob`, `licenseType`, `driverLicenseNoOne`, `driverLicenseNoTwo`, `driverLicenseNoThree`, `ownerDriver`, `thirdPartyInvolved`, `address`.
  - Workshop details: `workshopName`, `workshopEstimateAmount`, `workshopEstimateDate`, `workshopGstNo`.

**Step 2: Update `extension/manifest.json`**
- Add `*://orientalinsurance.org.in/*` to `host_permissions` and `content_scripts.matches`.

**Step 3: Ensure PrimeReact synthetic event dispatch in extension filler**
- Ensure `setFieldValue` sets the value and dispatches `input`, `change`, and React `_valueTracker` events so PrimeReact and MUI controlled components register the update.

**Step 4: Verify extension build and existing tests**
Run: `npx vitest run`
Expected: PASS.

**Step 5: Commit**
```bash
git add scripts/portal-map/oic-assessment.overlay.json extension/
git commit -m "feat(extension): add oriental insurance portal overlay and field mapping"
```

---

### Task 5: KnowledgeBase & Protocol Updates

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-11-05-oic-excel-and-portal-mapping.md`

**Step 1: Update documentation and session log**
- Document completion of OIC assessment excel generator and portal mapping.

**Step 2: Run final verification**
- `npx tsc --noEmit`
- `npx vitest run`
- Sibling scan check: verify no touched files in Android project.

**Step 3: Commit**
```bash
git add SurveyOS-Antigravity-Prime-V2-KnowledgeBase/
git commit -m "docs(oic): log oic assessment excel generator and portal mapping completion"
```
