# Assessment Towing Charges Implementation Plan

> **For Claude / Agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Disconnect surveyor travel expenses (`feeBill.travelExpenses`) from vehicle towing charges, add a dedicated `towingCharges` field to the assessment financial inputs, and display a permanent "Add: Towing Charges" line in both UIIC and Standard report formats.

**Architecture:** 
1. Add `towingCharges` to `FeeBill` in `types/assessment.ts` and `types/claim.ts`.
2. Incorporate `towingCharges` into assessment calculation engine (`src/lib/calculations/assessment.ts`).
3. Add a dedicated "Towing Charges (₹)" input in `AssessmentSummary.tsx` alongside Salvage and Excess.
4. Update `uiic-final-builder.ts` and `SurveyReportDocument.tsx` to read `claim.feeBill?.towingCharges` instead of `travelExpenses`.
5. Update `standard-report-builder.ts` Section 8 to include a permanent "Add: Towing Charges" line in the summary table.

**Tech Stack:** TypeScript, Next.js 16 App Router, Zustand, Vitest.

---

### Task 1: Type Definitions and Default Claim Model

**Files:**
- Modify: `src/types/assessment.ts`
- Modify: `src/types/claim.ts`
- Test: `src/types/__tests__/claim-types.test.ts` (or verify via existing tests/build)

**Step 1: Write the failing test**
Create/update `src/lib/calculations/__tests__/assessment-towing.test.ts` checking that `FeeBill` accepts `towingCharges` and returns `towingCharges` in `AssessmentSummary`.

```ts
import { describe, it, expect } from 'vitest';
import { calculateAssessmentSummary } from '../assessment';

describe('Assessment Towing Charges', () => {
  it('incorporates towing charges into netAssessedLoss', () => {
    const summary = calculateAssessmentSummary([], 0, 'standard', 0, 0, 0, undefined, 1500);
    expect(summary.towingCharges).toBe(1500);
    expect(summary.netAssessedLoss).toBe(1500);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npm test -- src/lib/calculations/__tests__/assessment-towing.test.ts`
Expected: FAIL (towingCharges not accepted/defined).

**Step 3: Modify types and default claim**
In `src/types/assessment.ts`:
- Add `towingCharges?: number;` to `FeeBill`.
- Add `towingCharges: number;` to `AssessmentSummary` and `BillCheckSummary`.

In `src/types/claim.ts`:
- In `defaultClaim.feeBill`: add `towingCharges: 0`.

**Step 4: Update assessment calculation engine**
In `src/lib/calculations/assessment.ts`:
- Update `calculateAssessmentSummary` to accept `towingCharges: number = 0` (or extract from feeBill).
- Update `netAssessedLoss = Math.max(0, grandTotal + towingCharges - salvage - totalExcess)`.
- Return `towingCharges` in `AssessmentSummary`.
- Similarly update `calculateBillCheckSummary`.

**Step 5: Run test to verify it passes**
Run: `npm test -- src/lib/calculations/__tests__/assessment-towing.test.ts`
Expected: PASS.

**Step 6: Commit**
`git commit -m "feat(assessment): add towingCharges to FeeBill and assessment calculation engine"`

---

### Task 2: Assessment Tab UI (`AssessmentSummary.tsx`)

**Files:**
- Modify: `src/components/claim/AssessmentSummary.tsx`
- Test: `src/components/claim/__tests__/AssessmentSummary.test.tsx` (if present) or component test

**Step 1: Write the test**
Ensure `AssessmentSummary` renders the "Towing Charges" input field and calls `updateFeeBill({ towingCharges: val })`.

**Step 2: Run test to verify it fails**
Expected: FAIL (input not present).

**Step 3: Implement minimal UI**
In `src/components/claim/AssessmentSummary.tsx`:
- Pass `fb.towingCharges || 0` into `calculateAssessmentSummary(...)`.
- Add a Towing Charges input block in the adjustments card (alongside Salvage, Compulsory Excess, Voluntary Excess).
- Bind onChange to `updateFeeBill({ towingCharges: parseFloat(e.target.value) || 0 })`.

**Step 4: Run test / typecheck**
Run: `npm run lint` or `npx tsc --noEmit`
Expected: PASS.

**Step 5: Commit**
`git commit -m "feat(ui): add Towing Charges input to AssessmentSummary"`

---

### Task 3: UIIC Report Builder Update

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts`
- Test: `src/lib/reports/__tests__/uiic-final-towing.test.ts`

**Step 1: Write the failing test**
Verify that `uiic-final-builder.ts`:
- Reads `towingCharges` from `claim.feeBill?.towingCharges`.
- Ignores `claim.feeBill?.travelExpenses`.
- When `towingCharges` = 1000 and `travelExpenses` = 500, Towing Charges on Page 3 is 1000.00, NOT 500.00.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/lib/reports/__tests__/uiic-final-towing.test.ts`
Expected: FAIL.

**Step 3: Implement minimal fix**
In `src/lib/reports/uiic-final-builder.ts`:
- Replace:
  ```ts
  const tow = parseFloat(String(claim.feeBill?.travelExpenses || 0)) || 0; // towing mapped from travelExpenses or 0
  ```
  With:
  ```ts
  const tow = parseFloat(String(claim.feeBill?.towingCharges || 0)) || 0;
  ```
- Do the same in `buildUIICBillCheckHTML`.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/lib/reports/__tests__/uiic-final-towing.test.ts`
Expected: PASS.

**Step 5: Commit**
`git commit -m "fix(reports): map UIIC towing charges from feeBill.towingCharges instead of travelExpenses"`

---

### Task 4: Standard Report Builder Update (Option C)

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts`
- Modify: `src/components/pdf/SurveyReportDocument.tsx`
- Test: `src/lib/reports/__tests__/standard-report-towing.test.ts`

**Step 1: Write the failing test**
In `src/lib/reports/__tests__/standard-report-towing.test.ts`:
- Check that Section 8 summary table in standard report always renders `Add: Towing Charges` with the formatted towing amount (even if 0.00).
- Check that `NET ASSESSED LOSS` formula correctly calculates `grand + towing - salvage - excess`.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/lib/reports/__tests__/standard-report-towing.test.ts`
Expected: FAIL.

**Step 3: Implement minimal code**
In `src/lib/reports/standard-report-builder.ts`:
- Read `const towing = parseFloat(String(claim.feeBill?.towingCharges || 0)) || 0;`
- Update `net` calculation:
  ```ts
  const net = Math.max(0, grand + towing - excess - salvage);
  ```
- In Section 8 summary table (lines ~853), insert:
  ```html
  <tr>
    <td style="${td}">Add: Towing Charges</td>
    <td colspan="2" style="border:0.4pt solid #bbb;"></td>
    <td style="${tdr}">${fa(towing)}</td>
  </tr>
  ```
In `src/components/pdf/SurveyReportDocument.tsx`:
- Replace `const tow = fb.travelExpenses || 0;` with `const tow = fb.towingCharges || 0;`.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/lib/reports/__tests__/standard-report-towing.test.ts`
Expected: PASS.

**Step 5: Commit**
`git commit -m "feat(reports): add permanent Towing Charges row in Standard report summary"`

---

### Task 5: End-to-End Verification & Knowledge Base Log

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`

**Step 1: Run full test suite**
Run: `npm test`
Verify all unit tests pass without regressions.

**Step 2: Verify Scan Impact**
Check drift tests or coupling points: Scan impact is None (no changes to documents, spot/valuation, or folder layout).

**Step 3: Update Tasks.md & Changelog.md**
Document the resolution of the surveyor complaint and the separation of travelExpenses from towingCharges.

**Step 4: Commit**
`git commit -m "docs: update Tasks.md and Changelog.md for assessment towing charges fix"`
