# Final Survey Report — Preamble, Cause-Font & Closing Wording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an editable free-text narrative preamble above the assessment sheet, make the Cause & Nature of Accident text readable/scaling, and replace the closing wording — in both the HTML and React-PDF Final Survey renderers.

**Architecture:** A single pure module (`final-survey-preamble.ts`) composes the default narrative from claim data; both renderers and the editor reuse it. A new optional `reportPreamble` claim field stores any free-text override; when empty, renderers fall back to the composed default. Font fix binds the cause text to the existing `scale.cellFont` tier so it scales with the Report Centre control.

**Tech Stack:** Next.js 16, React, TypeScript, Zustand store, @react-pdf/renderer, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-18-final-survey-report-preamble-design.md`

---

## File Structure

- **Create** `src/lib/reports/final-survey-preamble.ts` — pure composer + `estimateTotalInclGst` helper. One responsibility: produce the narrative string.
- **Create** `src/lib/reports/__tests__/final-survey-preamble.test.ts` — unit tests for the composer.
- **Modify** `src/types/claim.ts` — add `reportPreamble?: string` to `ClaimData` + factory default.
- **Modify** `src/lib/reports/standard-report-builder.ts` — insert preamble, fix cause font, replace closing wording.
- **Modify** `src/components/pdf/SurveyReportDocument.tsx` — add preamble, add Cause & Nature section, add closing block.
- **Modify** `src/components/tabs/ReportTab.tsx` — add the "Report Preamble" editor card for the survey report.

---

## Task 1: Add `reportPreamble` to the claim model

**Files:**
- Modify: `src/types/claim.ts:120` (interface) and `src/types/claim.ts:400` (factory)

- [ ] **Step 1: Add the field to the `ClaimData` interface**

In `src/types/claim.ts`, find the line (≈120):

```ts
  reportSettings?: ReportSettings;
```

Add immediately below it:

```ts
  reportSettings?: ReportSettings;
  /** Free-text narrative shown above the assessment sheet in the Final Survey report. Empty = auto-composed default. */
  reportPreamble?: string;
```

- [ ] **Step 2: Add the factory default**

In `src/types/claim.ts`, find the line (≈400):

```ts
    reportSettings: { fontScale: 'compact' },
```

Add immediately below it:

```ts
    reportSettings: { fontScale: 'compact' },
    reportPreamble: '',
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/claim.ts
git commit -m "feat: add reportPreamble field to claim model"
```

---

## Task 2: Create the preamble composer (TDD)

**Files:**
- Create: `src/lib/reports/final-survey-preamble.ts`
- Test: `src/lib/reports/__tests__/final-survey-preamble.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/final-survey-preamble.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  composeFinalSurveyPreamble,
  estimateTotalInclGst,
} from '../final-survey-preamble';
import type { AssessmentRow } from '@/types';

const row = (over: Partial<AssessmentRow>): AssessmentRow => ({
  id: 'r', particulars: '', estimated: 0, assessed: 0,
  partType: 'metal', gst: 18, section: 'parts', allowed: true,
  isDisposal: false, disposalPercent: 50, ...over,
});

describe('estimateTotalInclGst', () => {
  it('adds GST to normal rows and skips GST on disposal rows', () => {
    const rows = [
      row({ estimated: 1000, gst: 18 }),                  // 1180
      row({ estimated: 500, gst: 18, isDisposal: true }), // 500 (no GST)
    ];
    expect(estimateTotalInclGst(rows)).toBeCloseTo(1680, 2);
  });

  it('defaults missing gst to 18%', () => {
    const rows = [row({ estimated: 200, gst: undefined as unknown as number })];
    expect(estimateTotalInclGst(rows)).toBeCloseTo(236, 2);
  });
});

describe('composeFinalSurveyPreamble', () => {
  it('fills all slots with provided values', () => {
    const text = composeFinalSurveyPreamble({
      appointingOffice: 'DO-12 Pune',
      insurerName: 'United India',
      placeOfSurvey: 'ABC Motors',
      estimateTotal: 1680,
      assessedTotal: 1180,
    });
    expect(text).toContain('As per instructions received from DO-12 Pune');
    expect(text).toContain('at ABC Motors');
    expect(text).toContain('Rs. 1,680.00');
    expect(text).toContain('Rs. 1,180.00');
    expect(text).toContain('worked out in detail as follows');
  });

  it('falls back to insurer when appointing office is blank', () => {
    const text = composeFinalSurveyPreamble({
      appointingOffice: '', insurerName: 'United India',
      placeOfSurvey: '', estimateTotal: 0, assessedTotal: 0,
    });
    expect(text).toContain('received from United India');
    expect(text).toContain('at the workshop');
  });

  it('falls back to "the insurer" when both office and insurer are blank', () => {
    const text = composeFinalSurveyPreamble({
      estimateTotal: 0, assessedTotal: 0,
    });
    expect(text).toContain('received from the insurer');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/final-survey-preamble.test.ts`
Expected: FAIL — cannot resolve `../final-survey-preamble`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/reports/final-survey-preamble.ts`:

```ts
import type { AssessmentRow, ClaimData } from '@/types';

export interface PreambleInputs {
  appointingOffice?: string;
  insurerName?: string;
  placeOfSurvey?: string;
  /** Estimate total inclusive of GST */
  estimateTotal: number;
  /** Net assessed loss */
  assessedTotal: number;
}

/** Format a number as "Rs. 1,180.00" using Indian digit grouping. */
function rs(n: number): string {
  const v = Number(n) || 0;
  return `Rs. ${v.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Estimate total inclusive of GST. Mirrors calculateAssessmentSummary's
 * estimate logic: every row's estimated amount plus its GST, except disposal
 * rows which carry no GST. No `allowed` filter, to match summary.totalEstimated.
 */
export function estimateTotalInclGst(rows: AssessmentRow[]): number {
  return rows.reduce((sum, r) => {
    const gstFactor = r.isDisposal ? 1 : 1 + ((r.gst || 18) / 100);
    return sum + (r.estimated || 0) * gstFactor;
  }, 0);
}

/** Build the default Final Survey narrative paragraph from explicit inputs. */
export function composeFinalSurveyPreamble(i: PreambleInputs): string {
  const instructedBy = (i.appointingOffice || i.insurerName || 'the insurer').trim();
  const place = (i.placeOfSurvey || 'the workshop').trim();
  return (
    `As per instructions received from ${instructedBy} to conduct the final survey of the ` +
    `Insured Vehicle (I.V.) at ${place}, the undersigned has visited the Garage/Workshop & ` +
    `snapped few photos before and after dismantling the vehicle & carried out the survey. ` +
    `The Insured/Repairer has submitted the estimate for ${rs(i.estimateTotal)}. ` +
    `After discussion with the Insured/Repairer, the loss has been finally assessed for ` +
    `${rs(i.assessedTotal)}, which is subject to the Policy Terms and Conditions. ` +
    `The loss has been worked out in detail as follows.`
  );
}

/** Convenience wrapper: derive the narrative from a claim + computed totals. */
export function preambleFromClaim(
  claim: ClaimData,
  estimateTotal: number,
  assessedTotal: number,
): string {
  return composeFinalSurveyPreamble({
    appointingOffice: claim.policy?.appointingOffice,
    insurerName: claim.policy?.insurerName,
    placeOfSurvey: claim.accident?.placeOfSurvey,
    estimateTotal,
    assessedTotal,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/reports/__tests__/final-survey-preamble.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/final-survey-preamble.ts src/lib/reports/__tests__/final-survey-preamble.test.ts
git commit -m "feat: add final survey preamble composer with tests"
```

---

## Task 3: HTML builder — preamble, cause font, closing wording

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts` (import; line ~362-363 cause; line ~364-365 preamble insert; line 539 closing)

- [ ] **Step 1: Add the import**

At the top of `src/lib/reports/standard-report-builder.ts`, alongside the other `./` imports (e.g. near the `getHtmlScale` import), add:

```ts
import { preambleFromClaim, estimateTotalInclGst } from './final-survey-preamble';
```

- [ ] **Step 2: Fix the Cause & Nature font (bind to scale)**

Find (≈line 363):

```ts
<div style="font-size:7.2pt;margin-bottom:4px;padding:2px 4px;border:0.4pt solid #bbb;background:#fafaf7;line-height:1.5;">${accident.causeOfAccident || '—'}</div>
```

Replace with:

```ts
<div style="font-size:${scale.cellFont};margin-bottom:4px;padding:2px 4px;border:0.4pt solid #bbb;background:#fafaf7;line-height:1.5;">${accident.causeOfAccident || '—'}</div>
```

- [ ] **Step 3: Insert the preamble above Section 8 (Assessment Summary)**

Find (≈line 364-365):

```ts
<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">8. ASSESSMENT SUMMARY</div>
```

Replace with (preamble paragraph added immediately before the Section 8 bar):

```ts
<p style="font-size:${scale.cellFont};line-height:1.5;text-align:justify;margin:4px 0;color:#000;">${(claim.reportPreamble && claim.reportPreamble.trim()) ? claim.reportPreamble : preambleFromClaim(claim, estimateTotalInclGst(rows), net)}</p>
<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">8. ASSESSMENT SUMMARY</div>
```

(`rows` and `net` are already defined locals in this function — see lines 100-117.)

- [ ] **Step 4: Replace the closing wording**

Find (line 539):

```ts
<p style="font-size:6.5pt;line-height:1.5;margin-bottom:5px;text-align:justify;color:#333;">We have carried out survey of the above motor vehicle in connection with the captioned claim and assessed the loss as per Surveyors and Loss Assessors Regulations 2015 under the Insurance Act 1938. This is a final report without prejudice, subject to terms and conditions of the policy including any applicable policy excess and depreciation as per IRDAI guidelines.</p>
```

Replace with:

```ts
<p style="font-size:${scale.cellFont};line-height:1.5;margin-bottom:3px;text-align:left;color:#000;">The damages sustained by the vehicle were concurrent with the cause and nature of the accident.</p>
<p style="font-size:${scale.cellFont};font-weight:700;text-align:left;margin-bottom:5px;color:#000;">ISSUED WITHOUT PREJUDICE</p>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts
git commit -m "feat: add preamble, scale cause font, update closing wording in HTML final survey report"
```

---

## Task 4: React-PDF doc — preamble, cause section, closing block

**Files:**
- Modify: `src/components/pdf/SurveyReportDocument.tsx` (import ~line 3; styles ~line 47-171; computed value ~line 222; cause + preamble before line 259; closing before line 312)

- [ ] **Step 1: Add the import**

At the top of `src/components/pdf/SurveyReportDocument.tsx`, below the existing imports (after line 3), add:

```ts
import { preambleFromClaim, estimateTotalInclGst } from '@/lib/reports/final-survey-preamble';
```

- [ ] **Step 2: Add styles**

In the `StyleSheet.create({ ... })` block, before the closing `});` (line 171), add these style keys:

```ts
  causeTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#eee',
    padding: '2 4',
    border: '0.5pt solid #000',
    marginBottom: 4,
  },
  causeText: {
    fontSize: 8.5,
    lineHeight: 1.4,
    padding: '3 4',
    border: '0.5pt solid #000',
  },
  preamble: {
    fontSize: 8,
    lineHeight: 1.4,
    textAlign: 'justify',
    marginTop: 8,
    marginBottom: 8,
  },
  closingText: {
    fontSize: 8,
    lineHeight: 1.4,
    marginTop: 12,
    textAlign: 'left',
  },
  closingBold: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'left',
    marginTop: 4,
  },
```

- [ ] **Step 3: Compute the preamble text**

Find (≈line 222):

```ts
  const finalNet = Math.max(0, totalNet + tow - salvage - volEx - comEx);
```

Add immediately below it:

```ts
  const preambleText = (claim.reportPreamble && claim.reportPreamble.trim())
    ? claim.reportPreamble
    : preambleFromClaim(claim, estimateTotalInclGst(claim.assessmentRows || []), finalNet);
```

- [ ] **Step 4: Add the Cause & Nature section + preamble before the assessment table**

Find (line 259):

```tsx
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. DETAILED LOSS ASSESSMENT</Text>
```

Replace with (cause section + preamble inserted before Section III; `a` is `claim.accident`, already defined in this component):

```tsx
        <View style={styles.section}>
          <Text style={styles.causeTitle}>CAUSE &amp; NATURE OF ACCIDENT</Text>
          <Text style={styles.causeText}>{g(a.causeOfAccident) || '—'}</Text>
        </View>

        <Text style={styles.preamble}>{preambleText}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. DETAILED LOSS ASSESSMENT</Text>
```

- [ ] **Step 5: Add the closing block before the signature area**

Find (line 312):

```tsx
        <View style={styles.signatureArea}>
```

Replace with:

```tsx
        <Text style={styles.closingText}>The damages sustained by the vehicle were concurrent with the cause and nature of the accident.</Text>
        <Text style={styles.closingBold}>ISSUED WITHOUT PREJUDICE</Text>

        <View style={styles.signatureArea}>
```

- [ ] **Step 6: Verify `a` is defined**

Confirm the component body defines `const a = claim.accident;` (used at line 251). If absent, add `const a = claim.accident;` alongside the other destructures near line 178-180. (It is present — this step is a guard.)

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/pdf/SurveyReportDocument.tsx
git commit -m "feat: add preamble, cause section, and closing block to React-PDF final survey report"
```

---

## Task 5: Report tab — preamble editor card

**Files:**
- Modify: `src/components/tabs/ReportTab.tsx` (import; render the editor when `activeReport === 'survey'`)

- [ ] **Step 1: Add the import**

In `src/components/tabs/ReportTab.tsx`, alongside the other `@/lib/reports` imports (≈line 36), add:

```ts
import { preambleFromClaim } from '@/lib/reports/final-survey-preamble';
```

- [ ] **Step 2: Compute the default preamble and resolved value**

In the component body, after `safeSummary` is defined (≈line 143), add:

```ts
  const defaultPreamble = preambleFromClaim(
    currentClaim,
    safeSummary.totalEstimated,
    safeSummary.netAssessedLoss,
  );
  const preambleValue = (currentClaim.reportPreamble && currentClaim.reportPreamble.trim())
    ? currentClaim.reportPreamble
    : defaultPreamble;
```

- [ ] **Step 3: Confirm the store action is available**

At the top of the component, ensure `updateClaim` is pulled from the store. Find the `useClaimStore` destructure and add `updateClaim` if not already present, e.g.:

```ts
  const { currentClaim, updateClaim, /* ...existing... */ } = useClaimStore();
```

(`updateClaim(updates: Partial<ClaimData>)` is defined in `src/stores/slices/claimSlice.ts:31`.)

- [ ] **Step 4: Render the editor card for the survey report**

In the returned JSX, inside the main container and only for the final survey report, add the card immediately before the report preview/PDF area. Insert this block where the survey report body begins (within the `activeReport === 'survey'` region, above the preview):

```tsx
        {activeReport === 'survey' && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="report-preamble" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Report Preamble (shown above the assessment sheet)
                </label>
                <button
                  type="button"
                  onClick={() => updateClaim({ reportPreamble: '' })}
                  className="text-[11px] font-semibold text-primary hover:underline"
                  title="Discard edits and re-generate from current claim data"
                >
                  Reset to auto-generated
                </button>
              </div>
              <textarea
                id="report-preamble"
                value={preambleValue}
                onChange={(e) => updateClaim({ reportPreamble: e.target.value })}
                rows={6}
                className="w-full text-xs rounded-md border border-input bg-background p-2 leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Narrative shown above the assessment sheet…"
              />
            </CardContent>
          </Card>
        )}
```

If the JSX has no clearly-scoped `activeReport === 'survey'` block to nest within, place the card directly above the `<PDFViewer>`/preview element so it appears for all report types but only stores/affects the survey report (the guard `activeReport === 'survey'` keeps it survey-only).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open a claim with assessment rows, go to the Report tab (final survey):
- Verify the "Report Preamble" card shows the auto-composed sentence with the appointing office/insurer, place of survey, estimate total, and net assessed loss.
- Edit the text → the preview/PDF reflects the edit above the assessment sheet.
- Click "Reset to auto-generated" → text reverts to the composed default.
- Confirm Cause & Nature of Accident is clearly readable and grows when the Report Centre font scale is increased.
- Confirm the report ends with the concurrent-damages sentence and a bold, left-aligned **ISSUED WITHOUT PREJUDICE**.

- [ ] **Step 7: Commit**

```bash
git add src/components/tabs/ReportTab.tsx
git commit -m "feat: add editable report preamble card to Report tab"
```

---

## Final verification

- [ ] Run the full test suite: `npx vitest run` — expect all green.
- [ ] Run `npx tsc --noEmit` — expect no new errors.
- [ ] Confirm both the on-screen HTML preview/Print and the React-PDF download show: the preamble above the assessment sheet, readable scaling Cause & Nature, and the new closing wording.
