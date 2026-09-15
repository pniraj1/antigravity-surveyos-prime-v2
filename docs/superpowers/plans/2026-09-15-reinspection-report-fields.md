# Reinspection Report Field Completeness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every field the Re-inspection report prints has an input in the Reinspection tab, unwanted fields are dropped, and the photo sheet header's Report No is editable.

**Architecture:** Inputs in the RI tab bind directly to the existing Zustand store actions (`updateClaim`, `updatePolicy`, `updateAccident`, `updateReinspection`), so cross-tab fields are two-way with zero sync code. The report builder is a pure `ClaimData → HTML string` function, tested with vitest. Photo-sheet Report No is a session-local option in `PhotoSheetOptions`, not claim data.

**Tech Stack:** Next.js 16, React, Zustand, vitest, @react-pdf/renderer (photo sheet).

**Spec:** `docs/superpowers/specs/2026-09-15-reinspection-report-fields-design.md`

## Global Constraints

- Commit to `main` directly (no branches — project convention).
- Immutable updates only: every store write goes through the existing `update*` actions; never mutate `currentClaim`.
- The surveyor is the only author of assessment facts — no auto-fill of RI certification fields.
- Test runner: `npx vitest run <file>` (do **not** run `npm test`; it also runs the functions suite).
- Files stay under 800 lines; `ReinspectionTab.tsx` is 170 today and will grow to ~300 — fine.

---

### Task 1: Type + default for `ri.placeOfSurvey`

**Files:**
- Modify: `src/types/assessment.ts:259-274` (`ReinspectionDetails`)
- Modify: `src/types/claim.ts:364-380` (blank-claim `reinspection` default)

**Interfaces:**
- Produces: `ReinspectionDetails.placeOfSurvey?: string` — used by Task 2 (builder) and Task 3 (tab).

- [ ] **Step 1: Add the field to the type**

In `src/types/assessment.ts`, inside `export interface ReinspectionDetails {`, after `surveyDate: string;` add:

```ts
  /** Where the re-inspection was done. Blank = same as accident.placeOfSurvey. */
  placeOfSurvey?: string;
```

- [ ] **Step 2: Add the default**

In `src/types/claim.ts`, in the `reinspection: {` block of `createBlankClaim`, after `surveyDate: '',` add:

```ts
      placeOfSurvey: '',
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors (exit 0).

- [ ] **Step 4: Commit**

```bash
git add src/types/assessment.ts src/types/claim.ts
git commit -m "feat(ri): add placeOfSurvey to ReinspectionDetails

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Report builder — new field layout (TDD)

**Files:**
- Create: `src/lib/reports/__tests__/reinspection-report.test.ts`
- Modify: `src/lib/reports/reinspection-report-builder.ts:56-107`

**Interfaces:**
- Consumes: `buildReinspectionHTML(claim: ClaimData, profile: SurveyorProfile | null): string` (unchanged signature); `createBlankClaim()` from `@/types/claim`; `ReinspectionDetails.placeOfSurvey` from Task 1.
- Produces: nothing new — same function, different HTML.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/reinspection-report.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildReinspectionHTML } from '../reinspection-report-builder';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types';

function claim(): ClaimData {
  const base = createBlankClaim();
  return {
    ...base,
    reportNo: 'FSR/001',
    reportDate: '2026-09-01',
    policy: {
      ...base.policy,
      insurerName: 'United India',
      policyIssuingOffice: 'Pune DO-3',
      appointingOffice: 'Pune Claims Hub',
    },
    accident: {
      ...base.accident,
      dateAndTime: '2026-08-10T09:30',
      dateOfSurvey: '2026-08-12',
      placeOfSurvey: 'ABC Motors, Pune',
    },
    reinspection: {
      ...base.reinspection,
      refNo: 'RI/007',
      date: '2026-09-10',
      riAppointmentDate: '2026-09-09',
      repairAuthDate: '2026-08-15',
      estCompletionDate: '2026-09-05',
      actualCompletionDate: '2026-09-08',
    },
  };
}

describe('reinspection report fields', () => {
  test('prints the RI reference and the claim-reference fields', () => {
    const html = buildReinspectionHTML(claim(), null);
    for (const s of [
      'RI Ref Number', 'RI/007',
      'Report Number', 'FSR/001',
      'Date of Accident', '10/08/2026',
      'Date of Survey', '12/08/2026',
      'Insurance Company', 'United India',
      'Policy Issuing Office', 'Pune DO-3',
      'Claim Appointing Office', 'Pune Claims Hub',
      'RI Appointment Date', '09/09/2026',
      'Repair Auth. Date', '15/08/2026',
      'Est. Completion Date', '05/09/2026',
      'Actual Completion Date', '08/09/2026',
    ]) expect(html).toContain(s);
  });

  test('no longer prints report date, survey ref or survey date', () => {
    const html = buildReinspectionHTML(claim(), null);
    expect(html).not.toContain('Date of Report');
    expect(html).not.toContain('Survey Ref No');
    expect(html).not.toContain('>Survey Date<');
    expect(html).not.toContain('01/09/2026');
  });

  test('place of re-inspection falls back to the original survey place', () => {
    const html = buildReinspectionHTML(claim(), null);
    expect(html).toContain('Place of Re-inspection');
    expect(html).toContain('ABC Motors, Pune');
  });

  test('place of re-inspection uses the RI value when set', () => {
    const c = claim();
    const html = buildReinspectionHTML(
      { ...c, reinspection: { ...c.reinspection, placeOfSurvey: 'XYZ Body Shop, Mumbai' } },
      null,
    );
    expect(html).toContain('XYZ Body Shop, Mumbai');
    expect(html).not.toContain('ABC Motors, Pune');
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run src/lib/reports/__tests__/reinspection-report.test.ts`
Expected: FAIL — `expected ... to contain 'RI Appointment Date'`; the "no longer prints" test fails on `Date of Report`.

- [ ] **Step 3: Rewrite the REPORT DETAILS / ORIGINAL SURVEY / POLICY sections**

In `src/lib/reports/reinspection-report-builder.ts`, add `const a = claim.accident;` after `const p = claim.policy;`. Then replace everything from `<div style="${sec}">REPORT DETAILS</div>` up to and including the closing `</table>` of the ORIGINAL SURVEY DETAILS section with:

```ts
<div style="${sec}">REPORT DETAILS</div>
<table style="${ts}">
<tr>
  <td style="${tdl}width:25%;">Report Number</td>
  <td style="${tdb}width:25%;">${g(claim.reportNo)}</td>
  <td style="${tdl}width:25%;">RI Ref Number</td>
  <td style="${tdb}">${g(ri.refNo)}</td>
</tr>
<tr>
  <td style="${tdl}">Date of Accident</td>
  <td style="${tdb}">${fd(a.dateAndTime)}</td>
  <td style="${tdl}">Date of Survey</td>
  <td style="${tdb}">${fd(a.dateOfSurvey)}</td>
</tr>
<tr>
  <td style="${tdl}">RI Appointment Date</td>
  <td style="${tdb}">${fd(ri.riAppointmentDate)}</td>
  <td style="${tdl}">Date of RI</td>
  <td style="${tdb}">${fd(ri.date)}</td>
</tr>
<tr>
  <td style="${tdl}">Place of Re-inspection</td>
  <td style="${tdb}" colspan="3">${g(ri.placeOfSurvey || a.placeOfSurvey)}</td>
</tr>
<tr>
  <td style="${tdl}">Repair Auth. Date</td>
  <td style="${tdb}">${fd(ri.repairAuthDate)}</td>
  <td style="${tdl}">Est. Completion Date</td>
  <td style="${tdb}">${fd(ri.estCompletionDate)}</td>
</tr>
<tr>
  <td style="${tdl}">Actual Completion Date</td>
  <td style="${tdb}" colspan="3">${fd(ri.actualCompletionDate)}</td>
</tr>
</table>
```

Then in the `POLICY & CLAIM DETAILS` table, insert **before** the `<tr>` containing `Policy Number`:

```ts
<tr>
  <td style="${tdl}width:25%;">Insurance Company</td>
  <td style="${tdb}width:25%;">${g(p.insurerName)}</td>
  <td style="${tdl}width:25%;">Policy Issuing Office</td>
  <td style="${tdb}">${g(p.policyIssuingOffice)}</td>
</tr>
<tr>
  <td style="${tdl}">Claim Appointing Office</td>
  <td style="${tdb}" colspan="3">${g(p.appointingOffice)}</td>
</tr>
```

and remove the `width:25%;` fragments from the Policy Number row (they now live on the first row).

- [ ] **Step 4: Run test — expect pass**

Run: `npx vitest run src/lib/reports/__tests__/reinspection-report.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Run the reports suite to check nothing else asserted the old layout**

Run: `npx vitest run src/lib/reports`
Expected: all passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/reinspection-report-builder.ts src/lib/reports/__tests__/reinspection-report.test.ts
git commit -m "feat(ri): print accident/survey dates, insurer offices, RI dates; drop report date and survey ref

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Reinspection tab — Claim Reference card + new RI inputs

**Files:**
- Modify: `src/components/tabs/ReinspectionTab.tsx`

**Interfaces:**
- Consumes: `useClaimStore()` → `updateClaim(Partial<ClaimData>)`, `updatePolicy(Partial<ClaimData['policy']>)`, `updateAccident(Partial<ClaimData['accident']>)`, `updateReinspection(Partial<ClaimData['reinspection']>)`; `ri.placeOfSurvey` from Task 1.
- Produces: nothing consumed later.

- [ ] **Step 1: Destructure the extra store actions and add shared class constants**

Replace

```tsx
  const { currentClaim, updateReinspection } = useClaimStore();
```

with

```tsx
  const { currentClaim, updateClaim, updatePolicy, updateAccident, updateReinspection } = useClaimStore();
```

Add `Link2` to the lucide import:

```tsx
import { RotateCcw, Calendar, FileText, Link2 } from 'lucide-react';
```

Directly above `export function ReinspectionTab()` add:

```tsx
const INPUT = 'w-full px-3 py-2 rounded-lg border border-border outline-none text-sm font-medium';
const LABEL = 'text-[10px] font-medium uppercase tracking-widest text-muted-foreground block mb-1.5';

/** Label with a hint that the value is shared with another tab (two-way). */
function SharedLabel({ text, tab }: { text: string; tab: string }) {
  return (
    <label className={LABEL}>
      {text}
      <span className="ml-1.5 normal-case tracking-normal text-[9px] text-muted-foreground/70">· shared with {tab} tab</span>
    </label>
  );
}
```

- [ ] **Step 2: Insert the Claim Reference card**

Inside `<div className="px-6 lg:px-12 py-8 max-w-5xl mx-auto space-y-6">`, **before** the `{/* ── Inspection Details ── */}` card, add:

```tsx
        {/* ── Claim Reference (two-way with Policy / Vehicle tabs) ── */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-foreground">
            <Link2 size={16} className="text-primary" />
            Claim Reference
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <SharedLabel text="Report Number" tab="Vehicle" />
              <input type="text" className={INPUT}
                value={currentClaim.reportNo || ''}
                onChange={e => updateClaim({ reportNo: e.target.value })} />
            </div>
            <div>
              <SharedLabel text="Insurance Company" tab="Policy" />
              <input type="text" className={INPUT}
                value={currentClaim.policy.insurerName || ''}
                onChange={e => updatePolicy({ insurerName: e.target.value })} />
            </div>
            <div>
              <SharedLabel text="Policy Issuing Office" tab="Policy" />
              <input type="text" className={INPUT}
                value={currentClaim.policy.policyIssuingOffice || ''}
                onChange={e => updatePolicy({ policyIssuingOffice: e.target.value })} />
            </div>
            <div>
              <SharedLabel text="Claim Appointing Office" tab="Policy" />
              <input type="text" className={INPUT}
                value={currentClaim.policy.appointingOffice || ''}
                onChange={e => updatePolicy({ appointingOffice: e.target.value })} />
            </div>
            <div>
              <SharedLabel text="Date of Accident" tab="Vehicle" />
              <input type="datetime-local" className={INPUT}
                value={currentClaim.accident.dateAndTime || ''}
                onChange={e => updateAccident({ dateAndTime: e.target.value })} />
            </div>
            <div>
              <SharedLabel text="Date of Survey" tab="Vehicle" />
              <input type="date" className={INPUT}
                value={currentClaim.accident.dateOfSurvey || ''}
                onChange={e => updateAccident({ dateOfSurvey: e.target.value })} />
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Add the new RI inputs to the Inspection Details card**

Inside the Inspection Details `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">`, **before** the existing "Date of Re-inspection" `<div>`, add:

```tsx
            <div>
              <label className={LABEL}>RI Ref Number</label>
              <input type="text" className={INPUT} placeholder="e.g. RI/2026/007"
                value={currentClaim.reinspection.refNo || ''}
                onChange={e => updateReinspection({ refNo: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>RI Appointment Date</label>
              <input type="date" className={INPUT}
                value={currentClaim.reinspection.riAppointmentDate || ''}
                onChange={e => updateReinspection({ riAppointmentDate: e.target.value })} />
            </div>
```

Then **after** the existing "Date of Re-inspection" `<div>` (before "Actual Completion Date"), add:

```tsx
            <div className="sm:col-span-2">
              <label className={LABEL}>
                Place of Re-inspection
                <span className="ml-1.5 normal-case tracking-normal text-[9px] text-muted-foreground/70">· defaults to original survey place</span>
              </label>
              <input type="text" className={INPUT}
                value={currentClaim.reinspection.placeOfSurvey || currentClaim.accident.placeOfSurvey || ''}
                onChange={e => updateReinspection({ placeOfSurvey: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Repair Authorisation Date</label>
              <input type="date" className={INPUT}
                value={currentClaim.reinspection.repairAuthDate || ''}
                onChange={e => updateReinspection({ repairAuthDate: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Est. Completion Date</label>
              <input type="date" className={INPUT}
                value={currentClaim.reinspection.estCompletionDate || ''}
                onChange={e => updateReinspection({ estCompletionDate: e.target.value })} />
            </div>
```

Place of Re-inspection rule: displayed value is `ri.placeOfSurvey || accident.placeOfSurvey`. Once the surveyor types, `ri.placeOfSurvey` holds the text; clearing the box sets it to `''` and the display falls back to the accident place again. This matches the builder in Task 2.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit -p .`
Expected: exit 0.
Run: `npx eslint src/components/tabs/ReinspectionTab.tsx`
Expected: no errors.

- [ ] **Step 5: Manual smoke**

Start the dev server via the Browser pane (`preview_start`), open a local claim, go to the Reinspection tab:
- type in "Insurance Company" → switch to Policy tab → same value is there.
- type an RI Ref Number → the live preview below shows it under "RI Ref Number".
- Place of Re-inspection shows the Vehicle tab's place of survey until edited.

If no local claim / login is available, say so and skip — do not fake it.

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/ReinspectionTab.tsx
git commit -m "feat(ri): claim-reference card and RI ref/place/date inputs in Reinspection tab

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Photo sheet — editable Report No

**Files:**
- Modify: `src/types/assessment.ts:332-343` (`PhotoSheetOptions`)
- Modify: `src/components/pdf/PhotoSheetDocument.tsx:223`
- Modify: `src/components/tabs/PhotosTab.tsx:229-243` (options panel, after Page Orientation)

**Interfaces:**
- Produces: `PhotoSheetOptions.reportNo?: string`. `PhotoSheetDocument` prints `opts.reportNo ?? claim.reportNo`.

- [ ] **Step 1: Add the option to the type**

In `src/types/assessment.ts`, inside `export interface PhotoSheetOptions {`, after `pageOrientation?: PageOrientation;` add:

```ts
  /** Report No printed in the sheet header. Undefined = claim.reportNo. */
  reportNo?: string;
```

- [ ] **Step 2: Use it in the document**

In `src/components/pdf/PhotoSheetDocument.tsx` replace

```ts
  const reportNo  = claim?.reportNo                   || '';
```

with

```ts
  const reportNo  = opts.reportNo ?? (claim?.reportNo || '');
```

- [ ] **Step 3: Add the input + "Use RI Ref" chip in PhotosTab**

In `src/components/tabs/PhotosTab.tsx`, directly after the Page Orientation block (the `<div className="space-y-1.5 mt-4">` that wraps the orientation `<select>`), add:

```tsx
              {/* Report No on sheet — RI photo sheets carry the RI ref instead */}
              <div className="space-y-1.5 mt-4">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">Report No on sheet</Label>
                  {currentClaim.reinspection?.refNo && (
                    <button
                      type="button"
                      onClick={() => setOpt('reportNo', currentClaim.reinspection.refNo)}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10"
                    >
                      Use RI Ref
                    </button>
                  )}
                </div>
                <Input
                  value={options.reportNo ?? currentClaim.reportNo ?? ''}
                  onChange={e => setOpt('reportNo', e.target.value)}
                  placeholder="Final survey report no."
                  className="h-9 text-sm"
                />
              </div>
```

`Input`, `Label`, `setOpt`, `options` and `currentClaim` are already in scope in this file.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit -p .`
Expected: exit 0.
Run: `npx eslint src/components/tabs/PhotosTab.tsx src/components/pdf/PhotoSheetDocument.tsx`
Expected: no errors.

- [ ] **Step 5: Manual smoke**

In the Photos tab of a claim with an RI Ref Number set: click "Use RI Ref" → the input shows the RI ref → the PDF preview header reads `Report No: <RI ref>`. The existing "Reset options" button clears it back to the final report number because `DEFAULT_PHOTO_SHEET_OPTIONS` has no `reportNo`.

If no claim is available locally, say so and skip.

- [ ] **Step 6: Commit**

```bash
git add src/types/assessment.ts src/components/pdf/PhotoSheetDocument.tsx src/components/tabs/PhotosTab.tsx
git commit -m "feat(photos): editable Report No on photo sheet header, one-click RI ref

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Vault bookkeeping

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-09-15-reinspection-fields.md`

- [ ] **Step 1: Changelog entry**

Prepend under the latest heading, following the file's existing bullet format:

```md
- feat(ri): Reinspection tab now holds every field the RI report prints (RI ref, place, RI/auth/est dates, plus two-way Report No / insurer / offices / accident & survey dates). RI report drops Date of Report, Survey Ref No, Survey Date. Photo sheet Report No editable with "Use RI Ref".
```

- [ ] **Step 2: Session log**

Create the session file with three sections: **What changed** (the four feature commits by hash), **Rules** (place-of-survey fallback: `ri.placeOfSurvey || accident.placeOfSurvey`; photo-sheet `reportNo` is session-local, never saved on the claim), **Dead fields** (`ri.surveyRef`, `ri.surveyDate` remain on the type for old data but nothing reads them).

- [ ] **Step 3: Tasks.md**

Mark the reinspection-fields item done (add it as done if absent).

- [ ] **Step 4: Commit**

```bash
git add SurveyOS-Antigravity-Prime-V2-KnowledgeBase
git commit -m "docs(vault): log reinspection field completeness

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
