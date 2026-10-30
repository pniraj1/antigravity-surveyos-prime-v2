# Unify Goods Nature/Description, HPA/Financier, and Valuation Odometer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify Goods Nature & Description, Financier/HPA, and Valuation/Vehicle Odometer across forms, state slices, AI extraction, and report builders into a synchronized single source of truth without impacting extraction or scan coupling.

**Architecture:** 
Implement store-level two-way synchronization in Zustand (`claimSlice` and `vehicleSlice`) between `spotDetails.loadDesc` and `vehicle.natureOfGoods`/`vehicle.detailsOfGoodsCarried`, between `policy.hpaWith` and `vehicle.hypothecation`/`vehicle.rcEndorsement`, and between `vehicle.odometer` and `valuationDetails.odometer`. Remove the separate "Nature of Goods" input in `AtAccidentForm.tsx` to provide a single "Nature / Description of Goods" input, wire cross-fallbacks in `PolicyForm.tsx`, `VehicleForm.tsx`, `SurveyForm.tsx`, and `ValuationTab.tsx`, update AI document parsers in `aiDataSlice.ts`, and add fallbacks to all report builders.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Vitest.

---

### Task 1: Store Synchronization for Goods, HPA, and Odometer

**Files:**
- Create: `src/stores/slices/__tests__/goods-hpa-odometer-sync.test.ts`
- Modify: `src/stores/slices/claimSlice.ts:161-172, 200-241, 243-254`
- Modify: `src/stores/slices/vehicleSlice.ts:10-80`

**Step 1: Write the failing tests**
Create `src/stores/slices/__tests__/goods-hpa-odometer-sync.test.ts` verifying:
1. `updateSpotDetails({ loadDesc: 'STEEL COILS' })` syncs `vehicle.natureOfGoods = 'STEEL COILS'` and `vehicle.detailsOfGoodsCarried = 'STEEL COILS'`.
2. `updateVehicle({ natureOfGoods: 'IRON PIPES' })` syncs `spotDetails.loadDesc = 'IRON PIPES'` and `vehicle.detailsOfGoodsCarried = 'IRON PIPES'`.
3. `updateVehicle({ detailsOfGoodsCarried: 'BAGS' })` syncs `spotDetails.loadDesc = 'BAGS'` and `vehicle.natureOfGoods = 'BAGS'`.
4. `updatePolicy({ hpaWith: 'HDFC BANK LTD.' })` syncs `vehicle.hypothecation = 'HDFC BANK LTD.'` and `vehicle.rcEndorsement = 'HDFC BANK LTD.'`.
5. `updateVehicle({ hypothecation: 'SBI' })` syncs `policy.hpaWith = 'SBI'` and `vehicle.rcEndorsement = 'SBI'`.
6. `updateVehicle({ rcEndorsement: 'ICICI BANK' })` syncs `policy.hpaWith = 'ICICI BANK'` and `vehicle.hypothecation = 'ICICI BANK'`.
7. `updateVehicle({ odometer: '45000' })` syncs `valuationDetails.odometer = '45000'`.
8. `updateValuationDetails({ odometer: '52000' })` syncs `vehicle.odometer = '52000'`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/stores/slices/__tests__/goods-hpa-odometer-sync.test.ts`
Expected: FAIL.

**Step 3: Implement minimal store synchronization**
- In `src/stores/slices/claimSlice.ts`:
  - In `updatePolicy`:
    - When `hpaWith` in updates: also sync `vehicle.hypothecation = updates.hpaWith` and `vehicle.rcEndorsement = updates.hpaWith`.
  - In `updateSpotDetails`:
    - When `loadDesc` in updates: also sync `vehicle.natureOfGoods = updates.loadDesc` and `vehicle.detailsOfGoodsCarried = updates.loadDesc`.
  - In `updateValuationDetails`:
    - When `odometer` in updates: also sync `vehicle.odometer = updates.odometer`.
- In `src/stores/slices/vehicleSlice.ts`:
  - When `natureOfGoods` or `detailsOfGoodsCarried` in updates: sync `spotDetails.loadDesc` and mirror across both vehicle fields.
  - When `hypothecation` or `rcEndorsement` in updates: sync `policy.hpaWith` and mirror across both vehicle fields.
  - When `odometer` in updates: sync `valuationDetails.odometer = updates.odometer`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/stores/slices/__tests__/goods-hpa-odometer-sync.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/stores/slices/claimSlice.ts src/stores/slices/vehicleSlice.ts src/stores/slices/__tests__/goods-hpa-odometer-sync.test.ts
git commit -m "feat(store): bi-directional sync for goods description, HPA and odometer"
```

---

### Task 2: Form Consolidation and Fallbacks across Claims and Valuation

**Files:**
- Modify: `src/components/claim/AtAccidentForm.tsx:118-138`
- Modify: `src/components/claim/PolicyForm.tsx:98-106`
- Modify: `src/components/claim/VehicleForm.tsx:224-245`
- Modify: `src/components/claim/SurveyForm.tsx:115-124`
- Modify: `src/components/tabs/ValuationTab.tsx:145-155`
- Modify: `src/components/claim/__tests__/AtAccidentForm.test.tsx`
- Create: `src/components/claim/__tests__/HpaAndOdometerFormSync.test.tsx`

**Step 1: Write the failing tests**
- In `AtAccidentForm.test.tsx`:
  - Assert that separate "Nature of Goods" input (`v-goods-nature`) is no longer present.
  - Assert that "Nature / Description of Goods" input (`c-goods`) displays fallback from `natureOfGoods` or `loadDesc`.
  - Assert that typing into `c-goods` updates both `spotDetails.loadDesc` and `vehicle.natureOfGoods`.
- Create `src/components/claim/__tests__/HpaAndOdometerFormSync.test.tsx`:
  - Test PolicyForm HPA displays fallback from `vehicle.hypothecation` when `policy.hpaWith` is empty.
  - Test VehicleForm HPA and RC Endorsement display fallback from `policy.hpaWith`.
  - Test SurveyForm Odometer displays fallback from `valuationDetails.odometer`.
  - Test ValuationTab Odometer displays fallback from `vehicle.odometer`.

**Step 2: Run tests to verify they fail**
Run: `npx vitest run src/components/claim/__tests__/AtAccidentForm.test.tsx src/components/claim/__tests__/HpaAndOdometerFormSync.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal form updates**
- In `src/components/claim/AtAccidentForm.tsx`:
  - Remove the separate `{currentClaim.surveyType !== 'spot' && <div className="space-y-1"><Label htmlFor="v-goods-nature">Nature of Goods</Label>...</div>}` block.
  - Change Label to: `<Label htmlFor="c-goods">Nature / Description of Goods</Label>`.
  - Value fallback: `sd.loadDesc || v?.natureOfGoods || v?.detailsOfGoodsCarried || ''`.
  - On change: updates `updateSpotDetails({ loadDesc: e.target.value })` and `updateVehicle({ natureOfGoods: e.target.value, detailsOfGoodsCarried: e.target.value })`.
- In `src/components/claim/PolicyForm.tsx`:
  - Value fallback: `p?.hpaWith || v?.hypothecation || v?.rcEndorsement || ''`.
  - On change: `updatePolicy({ hpaWith: e.target.value }); updateVehicle({ hypothecation: e.target.value, rcEndorsement: e.target.value });`.
- In `src/components/claim/VehicleForm.tsx`:
  - `v-hpa` value fallback: `v?.hypothecation || p?.hpaWith || ''`.
  - `v-rc-end` value fallback: `v?.rcEndorsement || v?.hypothecation || p?.hpaWith || ''`.
  - On change: update both `vehicle` and `policy`.
- In `src/components/claim/SurveyForm.tsx`:
  - Odometer value fallback: `v?.odometer || claim.valuationDetails?.odometer || ''`.
  - On change: `updateVehicle({ odometer: e.target.value }); updateValuationDetails({ odometer: e.target.value });`.
- In `src/components/tabs/ValuationTab.tsx`:
  - Odometer value fallback: `vd.odometer || currentClaim.vehicle?.odometer || ''`.
  - On change: `handle({ odometer: e.target.value }); updateVehicle({ odometer: e.target.value });`.

**Step 4: Run tests to verify they pass**
Run: `npx vitest run src/components/claim/__tests__/AtAccidentForm.test.tsx src/components/claim/__tests__/HpaAndOdometerFormSync.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/claim/AtAccidentForm.tsx src/components/claim/PolicyForm.tsx src/components/claim/VehicleForm.tsx src/components/claim/SurveyForm.tsx src/components/tabs/ValuationTab.tsx src/components/claim/__tests__/AtAccidentForm.test.tsx src/components/claim/__tests__/HpaAndOdometerFormSync.test.tsx
git commit -m "fix(claim): consolidate goods description, HPA and odometer inputs with cross-fallback"
```

---

### Task 3: AI Document Extraction Alignment in `aiDataSlice.ts`

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts:349-405, 430-445, 582-600`
- Modify: `src/stores/slices/__tests__/aiDataSlice.test.ts`

**Step 1: Write test cases for unified extraction**
In `src/stores/slices/__tests__/aiDataSlice.test.ts`:
- Test that `applyRC` populates `vehicle.hypothecation`, `vehicle.rcEndorsement`, and `policy.hpaWith`.
- Test that `applyPolicy` populates `policy.hpaWith`, `vehicle.hypothecation`, and `vehicle.rcEndorsement`.
- Test that `applyLokChallan` populates `spotDetails.loadDesc`, `vehicle.natureOfGoods`, and `vehicle.detailsOfGoodsCarried`.
- Test that `applyRC` odometer (if present) updates both `vehicle.odometer` and `valuationDetails.odometer`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/stores/slices/__tests__/aiDataSlice.test.ts`
Expected: FAIL.

**Step 3: Implement minimal extraction synchronization**
- In `applyRC`:
  - `rcEndorsement: hypothecation || data.rc_endorsement || claim.vehicle.rcEndorsement`
  - Ensure `hpaWith: hypothecation || claim.policy.hpaWith`
  - If `data.odometer`, set both `vehicle.odometer` and `spotDetails/valuationDetails.odometer`.
- In `applyPolicy`:
  - `const hpa = data.hpa_with || claim.policy.hpaWith;`
  - Sync `vehicle.hypothecation = hpa || claim.vehicle.hypothecation`
  - Sync `vehicle.rcEndorsement = hpa || claim.vehicle.rcEndorsement`
- In `applyLokChallan`:
  - `const goods = data.goods_description || claim.spotDetails.loadDesc;`
  - Set `spotDetails.loadDesc = goods;`
  - Set `vehicle.natureOfGoods = goods || claim.vehicle.natureOfGoods;`
  - Set `vehicle.detailsOfGoodsCarried = goods || claim.vehicle.detailsOfGoodsCarried;`

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/stores/slices/__tests__/aiDataSlice.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/stores/slices/aiDataSlice.ts src/stores/slices/__tests__/aiDataSlice.test.ts
git commit -m "feat(ai): synchronize HPA, goods description and odometer across document extraction"
```

---

### Task 4: Report Builder Cross-Fallbacks

**Files:**
- Modify: `src/components/print/SpotPrintReport.tsx:265, 514-516`
- Modify: `src/lib/reports/standard-report-builder.ts:623-628, 715-717`
- Modify: `src/lib/reports/uiic-final-builder.ts:198, 258, 311-312`
- Modify: `src/components/print/UIICPrintReport.tsx:82`
- Modify: `src/lib/reports/valuation-report-builder.ts:134`
- Modify: `src/lib/reports/__tests__/tp-and-load-challan.test.ts`
- Modify: `src/lib/reports/__tests__/valuation-report-builder.test.ts` (or create if not present)

**Step 1: Write failing tests for report fallbacks**
- In `tp-and-load-challan.test.ts`:
  - Test Spot Report prints Goods Carried when populated only via `vehicle.natureOfGoods`.
  - Test Standard Final Report prints Description of Goods when populated only via `vehicle.natureOfGoods`.
  - Test UIIC Report prints both Details of Goods and Nature of Goods when either is filled.
  - Test UIIC Report prints RC endorsement when populated only via `policy.hpaWith`.
  - Test Valuation Report prints Kilometerage when odometer was provided only via `vehicle.odometer`.

**Step 2: Run tests to verify they fail**
Run: `npx vitest run src/lib/reports/__tests__/tp-and-load-challan.test.ts`
Expected: FAIL.

**Step 3: Implement cross-fallbacks in report builders**
- In `src/components/print/SpotPrintReport.tsx`:
  - Goods: `{spotDetails.loadDesc || vehicle.natureOfGoods || (vehicle as any)?.detailsOfGoodsCarried || '—'}`
  - HPA: `{policy.hpaWith || vehicle.hypothecation || vehicle.rcEndorsement || 'NIL'}`
- In `src/lib/reports/standard-report-builder.ts`:
  - Goods: `${sd?.loadDesc || (vehicle as any)?.natureOfGoods || (vehicle as any)?.detailsOfGoodsCarried || '—'}`
  - HPA: `${policy.hpaWith || vehicle.hypothecation || vehicle.rcEndorsement || 'NIL'}`
- In `src/lib/reports/uiic-final-builder.ts`:
  - Line 198: `FINANCIER INTEREST: ${g(p.hpaWith || v.hypothecation || v.rcEndorsement) || 'NIL'}`
  - Line 258: `RC endorsement on financier interest: ${g(v.rcEndorsement || v.hypothecation || p.hpaWith)}`
  - Line 311: `Details of goods carried: ${g((v as any).detailsOfGoodsCarried || sd.loadDesc || (v as any).natureOfGoods)}`
  - Line 312: `Nature of goods carried: ${g((v as any).natureOfGoods || sd.loadDesc || (v as any).detailsOfGoodsCarried)}`
- In `src/components/print/UIICPrintReport.tsx`:
  - RC Endorsement: `{claim.vehicle.rcEndorsement || claim.vehicle.hypothecation || claim.policy.hpaWith || ''}`
- In `src/lib/reports/valuation-report-builder.ts`:
  - Line 134: `'Kilometerage', g(vd.odometer || v.odometer)`

**Step 4: Run tests to verify they pass**
Run: `npx vitest run src/lib/reports/`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/print/SpotPrintReport.tsx src/lib/reports/standard-report-builder.ts src/lib/reports/uiic-final-builder.ts src/components/print/UIICPrintReport.tsx src/lib/reports/valuation-report-builder.ts src/lib/reports/__tests__/tp-and-load-challan.test.ts
git commit -m "fix(reports): cross-fallback goods description, HPA/financier and valuation odometer"
```

---

### Task 5: Full Verification & Documentation Update

**Files:**
- Update: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`
- Update: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-10-30-unify-goods-hpa-odometer.md`

**Step 1: Run TypeScript compiler**
Run: `npx tsc --noEmit`
Expected: Clean exit (0 errors).

**Step 2: Run complete Vitest suite**
Run: `npx vitest run`
Expected: All test suites passing.

**Step 3: Verify SurveyOS Scan Coupling**
Ensure `src/lib/scan-import/notes.ts` passes all tests without drift.

**Step 4: Update Documentation**
Update `Tasks.md`, `Changelog.md`, and create new session log.

**Step 5: Commit**
```bash
git add docs/superpowers/specs/2026-10-30-unify-goods-hpa-odometer-workflow-design.md docs/superpowers/plans/2026-10-30-unify-goods-hpa-odometer-workflow.md SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-10-30-unify-goods-hpa-odometer.md
git commit -m "docs: record goods description, HPA and odometer unification in knowledge base"
```
