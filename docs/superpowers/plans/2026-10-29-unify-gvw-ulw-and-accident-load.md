# Unify GVW, ULW, and Accident Load Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify duplicate GVW, ULW, and Accident Load inputs and data fields into a bi-directionally synchronized single source of truth across forms, AI extraction, and print reports.

**Architecture:** 
Implement store-level two-way synchronization in Zustand (`vehicleSlice` and `claimSlice`) between `vehicle.registeredLoadWeight`/`vehicle.grossWeight`/`vehicle.unladenWeight` and `spotDetails.gvw`/`spotDetails.ulw`/`spotDetails.loadCapacity`, and between `spotDetails.actualLoad` and `vehicle.goodsWeightAtAccident`. Remove the duplicate "Goods Weight at Accident" input in `AtAccidentForm.tsx`, and add cross-field fallbacks across all Spot and Final report builders to guarantee report rendering accuracy regardless of which form field was originally populated.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Vitest.

---

### Task 1: Store Synchronization in `vehicleSlice.ts` and `claimSlice.ts`

**Files:**
- Create: `src/stores/slices/__tests__/weights-and-load-unification.test.ts`
- Modify: `src/stores/slices/vehicleSlice.ts:10-25`
- Modify: `src/stores/slices/claimSlice.ts:200-211`

**Step 1: Write the failing tests**
Create `src/stores/slices/__tests__/weights-and-load-unification.test.ts` verifying:
1. `updateVehicle({ registeredLoadWeight: '16200 KG' })` syncs `spotDetails.gvw = 16200`, `vehicle.grossWeight = 16200`, and computes `spotDetails.loadCapacity`.
2. `updateVehicle({ unladenWeight: 6200 })` syncs `spotDetails.ulw = 6200` and computes `spotDetails.loadCapacity`.
3. `updateVehicle({ goodsWeightAtAccident: '10000' })` syncs `spotDetails.actualLoad = 10000`.
4. `updateSpotDetails({ gvw: 18000 })` syncs `vehicle.registeredLoadWeight = '18000'`, `vehicle.grossWeight = 18000`, and computes `spotDetails.loadCapacity`.
5. `updateSpotDetails({ ulw: 7000 })` syncs `vehicle.unladenWeight = 7000` and computes `spotDetails.loadCapacity`.
6. `updateSpotDetails({ actualLoad: 11000 })` syncs `vehicle.goodsWeightAtAccident = '11000'` and `vehicle.actualPayload = '11000'`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/stores/slices/__tests__/weights-and-load-unification.test.ts`
Expected: FAIL (missing ULW sync, load capacity recalculation, and actualLoad sync).

**Step 3: Implement minimal store synchronization**
- In `src/stores/slices/vehicleSlice.ts`:
  - When `registeredLoadWeight` or `grossWeight` is in updates, parse numeric value; if > 0, set `spotDetails.gvw` and compute `spotDetails.loadCapacity = (gvw > ulw && ulw > 0) ? gvw - ulw : (gvw || 0)`.
  - When `unladenWeight` is in updates, set `spotDetails.ulw = unladenWeight` and recompute `loadCapacity`.
  - When `goodsWeightAtAccident` is in updates, set `spotDetails.actualLoad = parseFloat(goodsWeightAtAccident) || null` and `vehicle.actualPayload = goodsWeightAtAccident`.
- In `src/stores/slices/claimSlice.ts` (`updateSpotDetails`):
  - When `gvw` is in updates, sync `vehicle.registeredLoadWeight = gvw ? String(gvw) : ''` and `vehicle.grossWeight = gvw`. Recompute `loadCapacity`.
  - When `ulw` is in updates, sync `vehicle.unladenWeight = ulw`. Recompute `loadCapacity`.
  - When `actualLoad` is in updates, sync `vehicle.goodsWeightAtAccident = actualLoad ? String(actualLoad) : ''` and `vehicle.actualPayload = actualLoad ? String(actualLoad) : ''`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/stores/slices/__tests__/weights-and-load-unification.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/stores/slices/vehicleSlice.ts src/stores/slices/claimSlice.ts src/stores/slices/__tests__/weights-and-load-unification.test.ts
git commit -m "feat(store): bi-directional sync for GVW, ULW and accident load"
```

---

### Task 2: Deduplicate "Goods Weight at Accident" in `AtAccidentForm.tsx`

**Files:**
- Create: `src/components/claim/__tests__/AtAccidentForm.test.tsx`
- Modify: `src/components/claim/AtAccidentForm.tsx:88-120`

**Step 1: Write the failing test**
Create `src/components/claim/__tests__/AtAccidentForm.test.tsx` asserting:
1. "Load at Accident (KG)" input is rendered for commercial vehicles.
2. The redundant "Goods Weight at Accident" input is no longer present in the DOM.
3. Changing "Load at Accident (KG)" updates both `spotDetails.actualLoad` and `vehicle.goodsWeightAtAccident`.
4. Fallback: if `spotDetails.actualLoad` is unset but `vehicle.goodsWeightAtAccident` has a value, the input displays that value.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/claim/__tests__/AtAccidentForm.test.tsx`
Expected: FAIL (detects "Goods Weight at Accident" still present).

**Step 3: Implement minimal form cleanup**
In `src/components/claim/AtAccidentForm.tsx`:
- Remove the `<div className="space-y-1"><Label htmlFor="v-goods-weight">Goods Weight at Accident</Label>...</div>` block.
- For `<Input id="c-actual-load" />`:
  - `value={sd.actualLoad ?? (parseFloat(v?.goodsWeightAtAccident) || '')}`
  - `onChange={(e) => { const n = Number(e.target.value); updateSpotDetails({ actualLoad: n || null }); updateVehicle({ goodsWeightAtAccident: e.target.value }); }}`

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/claim/__tests__/AtAccidentForm.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/claim/AtAccidentForm.tsx src/components/claim/__tests__/AtAccidentForm.test.tsx
git commit -m "fix(claim): remove duplicate goods weight field from AtAccidentForm"
```

---

### Task 3: Bi-directional Sync in `SpotTab.tsx` and `VehicleForm.tsx`

**Files:**
- Modify: `src/components/tabs/SpotTab.tsx:81-125`
- Modify: `src/components/claim/VehicleForm.tsx:200-223`
- Create: `src/components/tabs/__tests__/SpotTabWeights.test.tsx`

**Step 1: Write the failing test**
Create `src/components/tabs/__tests__/SpotTabWeights.test.tsx` asserting:
1. In `SpotTab`, GVW input displays `spotDetails.gvw || vehicle.registeredLoadWeight`.
2. In `SpotTab`, ULW input displays `spotDetails.ulw || vehicle.unladenWeight`.
3. In `SpotTab`, Payload Capacity computes `gvw - ulw` automatically even when values originated in `VehicleForm`.
4. Editing GVW or ULW in `SpotTab` triggers synchronization to `vehicle`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/tabs/__tests__/SpotTabWeights.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal updates**
- In `src/components/tabs/SpotTab.tsx`:
  - Read `effectiveGvw = spotDetails.gvw || parseFloat(String(currentClaim.vehicle.registeredLoadWeight).replace(/,/g, '')) || 0`
  - Read `effectiveUlw = spotDetails.ulw || currentClaim.vehicle.unladenWeight || 0`
  - Read `effectiveCap = spotDetails.loadCapacity || (effectiveGvw > effectiveUlw && effectiveUlw > 0 ? effectiveGvw - effectiveUlw : 0)`
  - Use these for input values and calculation.
- In `src/components/claim/VehicleForm.tsx`:
  - GVW value fallback: `v?.registeredLoadWeight || (currentClaim.spotDetails?.gvw ? String(currentClaim.spotDetails.gvw) : '')`
  - ULW value fallback: `v?.unladenWeight ?? (currentClaim.spotDetails?.ulw ?? '')`

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/tabs/__tests__/SpotTabWeights.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/tabs/SpotTab.tsx src/components/claim/VehicleForm.tsx src/components/tabs/__tests__/SpotTabWeights.test.tsx
git commit -m "feat(claim): cross-populate GVW, ULW and load capacity between Vehicle and Spot tabs"
```

---

### Task 4: Report Cross-Fallbacks in Print and Report Builders

**Files:**
- Modify: `src/components/print/SpotPrintReport.tsx:40-47, 236-238, 494-506`
- Modify: `src/lib/reports/standard-report-builder.ts:618-622, 754-755`
- Modify: `src/lib/reports/uiic-final-builder.ts:265-266`
- Modify: `src/components/print/UIICPrintReport.tsx:89-90`
- Modify: `src/lib/reports/__tests__/tp-and-load-challan.test.ts`
- Modify: `src/components/print/__tests__/spot-report-sections.test.tsx`

**Step 1: Write test cases for cross-fallback**
In `src/lib/reports/__tests__/tp-and-load-challan.test.ts`:
- Add test: "standard final report prints load at accident when provided only via vehicle.goodsWeightAtAccident".
- Add test: "spot print report Section E prints GVW and ULW when provided only via vehicle.registeredLoadWeight and vehicle.unladenWeight".

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/reports/__tests__/tp-and-load-challan.test.ts`
Expected: FAIL.

**Step 3: Implement cross-fallbacks**
- In `src/components/print/SpotPrintReport.tsx`:
  - `gvwVal = parseFloat(String(spotDetails.gvw || vehicle.grossWeight || vehicle.registeredLoadWeight).replace(/[^0-9.]/g, '')) || 0;`
  - `ulwVal = parseFloat(String(spotDetails.ulw || vehicle.unladenWeight)) || 0;`
  - `capVal = parseFloat(String(spotDetails.loadCapacity)) || (gvwVal > ulwVal && ulwVal > 0 ? gvwVal - ulwVal : 0);`
  - `actualLoad = parseFloat(String(spotDetails.actualLoad || (vehicle as any)?.goodsWeightAtAccident)) || 0;`
  - Section C: `{vehicle.registeredLoadWeight || (gvwVal ? `${gvwVal} kg` : '—')}`
- In `src/lib/reports/standard-report-builder.ts`:
  - Section 2 GVW: `${vehicle.registeredLoadWeight || (sd?.gvw ? `${sd.gvw} kg` : '—')}`
  - Section 5 Load at Accident: `${sd?.actualLoad ?? (vehicle as any)?.goodsWeightAtAccident ?? '—'}`
- In `src/lib/reports/uiic-final-builder.ts`:
  - Registered Laden Weight: `${g(v.registeredLoadWeight || v.grossWeight || sd?.gvw)}`
  - Registered Unladen Weight: `${g(v.unladenWeight || sd?.ulw)}`
- In `src/components/print/UIICPrintReport.tsx`:
  - Gross Weight: `{claim.vehicle.grossWeight || claim.vehicle.registeredLoadWeight || claim.spotDetails?.gvw ? `${claim.vehicle.grossWeight || claim.vehicle.registeredLoadWeight || claim.spotDetails?.gvw} KG` : ''}`

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/reports/__tests__/tp-and-load-challan.test.ts src/components/print/__tests__/spot-report-sections.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/print/SpotPrintReport.tsx src/lib/reports/standard-report-builder.ts src/lib/reports/uiic-final-builder.ts src/components/print/UIICPrintReport.tsx src/lib/reports/__tests__/tp-and-load-challan.test.ts src/components/print/__tests__/spot-report-sections.test.tsx
git commit -m "fix(reports): add cross-fallbacks for GVW, ULW, and actual load across all builders"
```

---

### Task 5: AI Document Extraction Alignment in `aiDataSlice.ts`

**Files:**
- Modify: `src/stores/slices/aiDataSlice.ts:349-405, 560-580, 582-599`
- Modify: `src/stores/slices/__tests__/aiDataSlice.test.ts`

**Step 1: Write test case for unified AI extraction**
In `src/stores/slices/__tests__/aiDataSlice.test.ts`:
- Verify `applyRC` sets `vehicle.grossWeight`, `vehicle.registeredLoadWeight`, `spotDetails.gvw`, `vehicle.unladenWeight`, `spotDetails.ulw`, and computes `spotDetails.loadCapacity`.
- Verify `applyFitness` sets both `vehicle.*` and `spotDetails.*` for GVW and ULW.
- Verify `applyLokChallan` sets both `spotDetails.actualLoad` and `vehicle.goodsWeightAtAccident`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/stores/slices/__tests__/aiDataSlice.test.ts`
Expected: FAIL.

**Step 3: Implement minimal AI slice updates**
- In `applyRC`:
  - `grossWeight: gvw || null` on vehicle.
  - Compute `loadCapacity: (gvw > ulw && ulw > 0) ? gvw - ulw : null`.
- In `applyFitness`:
  - If `gvwStr`, update both `updated.spotDetails.gvw` and `updated.vehicle.grossWeight` and `updated.vehicle.registeredLoadWeight`.
  - If `ulwStr`, update both `updated.spotDetails.ulw` and `updated.vehicle.unladenWeight`.
  - Update `loadCapacity`.
- In `applyLokChallan`:
  - Set `goodsWeightAtAccident: data.weight_kg ? String(data.weight_kg) : claim.vehicle.goodsWeightAtAccident`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/stores/slices/__tests__/aiDataSlice.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/stores/slices/aiDataSlice.ts src/stores/slices/__tests__/aiDataSlice.test.ts
git commit -m "feat(ai): synchronize weight and load fields across RC, fitness and challan extraction"
```

---

### Task 6: Full Verification & Coupling Check

**Files:**
- Read/Check: `../SurveyOS Scan/app/src/test/java/surveyos/scan/contract/`
- Run test suite & typechecker

**Step 1: Run TypeScript compiler**
Run: `npx tsc --noEmit`
Expected: Clean exit (0 errors).

**Step 2: Run complete Vitest suite**
Run: `npx vitest run`
Expected: All test files passing (~1,910+ tests).

**Step 3: Verify SurveyOS Scan Coupling**
Verify `src/lib/scan-import/notes.ts` is intact and `spotDetails.actualLoad` contract remains untouched.

**Step 4: Update Documentation**
Update `Tasks.md`, `Changelog.md`, and add session log in `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/`.

**Step 5: Commit**
```bash
git add SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/
git commit -m "docs: record GVW, ULW and accident load unification in knowledge base"
```
