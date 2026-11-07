# Session: OIC Portal Auto-Fill Strengthening, Safe Step 2 Field Mapping & Painting 12.5% Statutory Fix
**Date:** 2026-11-07  
**Agent:** Antigravity  
**Goal:** Address real OIC insurer files in `c:\Users\Manasi\Downloads\OIC`, fix portal extension bridge on `surveyos.in`, implement type-safe `buildOicPacket`, solve the painting 12.5% depreciation portal error, and keep portal auto-fill safe by strictly omitting tricky fields and preserving Step 4 assessment grid Excel upload boundaries.

---

## 1. Problem & Root Cause Analysis

### A. Extension Relay Bridge on Production
`extension/manifest.json` previously listed only `https://motorsurveyos-in.web.app/*` and `http://localhost:3000/*` under `content_scripts[0].matches` and `host_permissions`. Users visiting Prime on the production domain `https://surveyos.in` were unable to communicate with the extension relay script (`relay.js`).

### B. Missing `buildOicPacket`
`OICExportDialog.tsx` was previously wired to call `buildPortalPacket(claim, { ageMonths })`, which generated a `portal: 'nia'` packet. The extension rejected or misrouted the packet because it was destined for Oriental Insurance, not New India.

### C. Non-Angular Portal Safety in `extension/src/filler.js`
In `extension/src/filler.js`, `ctrlScope` and `fill.read.current` assumed the presence of the global `angular` object when searching element scopes. On modern non-Angular portals (like OIC's PrimeVue/Vue setup), calling `ng().element(el)` caused a runtime `TypeError`, aborting the fill process.

### D. The Painting 12.5% Depreciation Error
In user's live test with `3096Assessment.xlsx`:
- Painting was uploaded as `Labour Charge | TOTAL PAINTING CHARGES | 15000 | dep=0`.
- Because `depreciationRate` was 0, OIC's portal applied 0% depreciation on ₹15,000, failing to enforce the statutory 12.5% depreciation mandated by the Indian Motor Tariff (GR-9).
- OIC's portal dropdown for `depRate` only permits `{ 0, 5, 10, 15, 20, 25, 30, 35, 40, 50 }`—there is no `12.5%` dropdown option.
- In the live official PDF report (`180012_31_2027_PRTLC_00030098_SURVEYOR_ASSESSMENT_REPORT760054751.pdf`), the surveyor resolved this by entering Item 1 as `Labour Charge | Painting charges FRONT | 13,125.0 | dep=0 | HSN 9987` (where ₹13,125 is exactly ₹15,000 minus 12.5%).

---

## 2. Changes Implemented

### 1. Extension Manifest & Bridge (`extension/manifest.json`)
- Added `"https://surveyos.in/*"` to `host_permissions` and `content_scripts[0].matches`.
- Rebuilt extension using `python scripts/build-ext.py`.

### 2. Non-Angular Robustness (`extension/src/filler.js`)
- Updated `ctrlScope(map)` to return `null` immediately if `!ng()`.
- Updated `fill.read.current` to check `el && ng()` before invoking `ng().element(el)`, falling back to native input value `el.value`.

### 3. Type-Safe OIC Packet (`src/lib/portal/packet.ts`)
- Defined `OIC_FIELDS` and `OicPortalPacket` (`portal: 'oic'`, `flow: 'assessment'`).
- Implemented `buildOicPacket(claim, opts)` mapping 23 safe, high-confidence Step 2 Basic Details fields.
- Respects strict safety constraints: excludes tricky dynamic MUI datepicker IDs (`:r1o:`, `:r1k:`, `:r1m:`), declaration checkboxes, and verification questions.
- Automatically compiles the 2-sheet OIC assessment Excel workbook and attaches it in `files` under slot `'assessmentExcel'`.

### 4. Painting 12.5% Statutory Fix (`src/lib/reports/oic-assessment-excel.ts`, `OICExportDialog.tsx`)
- Added `OicPaintingMode` (`'split'` vs `'net_single'`).
- For Standard Depreciation policies:
  - `split` (default): 75% Labour (0% dep) + 25% Plastic (50% dep) = statutory 12.5% net deduction.
  - `net_single`: Single net pre-deducted line under `Labour Charge` (`Painting charges (Net 12.5% Dep)` @ 0% dep, HSN 9987) matching live OIC surveyor assessment reports (e.g. Item 1 FRONT 13,125.0).
- Enhanced `OICExportDialog.tsx` with a mode selector, allowing surveyors to choose their preferred representation before downloading or relaying to the extension.
- Step 4 Assessment Grid remains strictly handled via Excel upload (`#fileInput`), never through DOM typing.

---

## 3. Verification & Compliance
- **Vitest:** 310 test files passed (2,720 tests, 100% green).
- **Extension Tests:** 10 test files (124 tests, 100% green).
- **TypeScript:** `npx tsc --noEmit` returned 0 errors.
- **Next.js 16 Build:** `npm run build` completed successfully with all static routes generated.
- **SurveyOS Scan Coupling:** `:app:testDebugUnitTest` passed (28 tasks green).
