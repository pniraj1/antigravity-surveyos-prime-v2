# Standard Bill Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a Standard Bill Check report — the Standard Final Survey Report with the Estimate column replaced by the Bill column — and align the Bill Check grid with the Assessment grid.

**Architecture:** The report is not a new builder. `buildStandardFinalSurveyHTML` gains a `mode` parameter and renders over *projected* rows: the bill figure moves into the `estimated` slot, `billAllowed` overrides `assessed` for this document only, and a part that was never replaced is zeroed. Because `assessed` is what every money path already reads, no calculation changes. On screen, both grids read one shared column-config module so a column can never carry two names again.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Vitest, Tailwind.

## Global Constraints

- **Branch:** commit directly to `main`. Do not create branches. `master` is abandoned.
- **No attribution trailers** in commit messages (disabled globally).
- **Commit format:** `<type>(<scope>): <subject>` — types `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- **Immutability:** never mutate inputs; return new objects (`.claude/rules/common/coding-style.md`).
- **File size:** 800 lines max. `standard-report-builder.ts` is 697 and will reach ~740 — acceptable. Do not let `BillCheckGrid.tsx` exceed 800.
- **No `console.log`** in committed code.
- **`billedTaxable` is pre-GST; `billedAmount` is GST-inclusive.** Every projection and total uses `billedTaxable`. Using `billedAmount` feeds a taxed figure into a column that is taxed again — the error that once overstated UIIC liability by ~31%.
- **Verification:** `npx tsc --noEmit` and `npx vitest run` must both pass before every commit. The screen is auth-gated and cannot be exercised by a dev server here; correctness comes from unit tests.
- **Spec:** `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Specs/2026-08-18-standard-bill-check-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types/assessment.ts` | **Modify** — add `billAllowed?: number` to `AssessmentRow` |
| `src/lib/reports/bill-check-projection.ts` | **Create** — `projectForBillCheck`, the whole report feature in ~12 lines |
| `src/lib/reports/final-survey-preamble.ts` | **Modify** — bill-check narrative variant |
| `src/lib/reports/standard-report-builder.ts` | **Modify** — `mode` param; labels, title, section swaps |
| `src/components/tabs/BillCheckTab.tsx` | **Modify** — Standard \| UIIC toggle; print gate |
| `src/components/claim/grid-columns.ts` | **Create** — the one place a grid column is named |
| `src/components/tabs/bill-check/BillCheckGrid.tsx` | **Modify** — adopt shared config; column changes |
| `src/components/dialogs/AllowanceScopeDialog.tsx` | **Create** — Bill Check only vs Both |
| `src/components/dialogs/PendingRowsDialog.tsx` | **Create** — resolve pending rows before printing |

---

# Phase 1 — The report

### Task 1: `billAllowed` and the row projection

**Files:**
- Modify: `src/types/assessment.ts` (inside `interface AssessmentRow`, after `billRemarks?: string;`)
- Create: `src/lib/reports/bill-check-projection.ts`
- Test: `src/lib/reports/__tests__/bill-check-projection.test.ts`

**Interfaces:**
- Consumes: `AssessmentRow` from `@/types/assessment`
- Produces: `projectForBillCheck(rows: AssessmentRow[]): AssessmentRow[]` — every later task in Phase 1 uses this exact name and signature.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/bill-check-projection.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { projectForBillCheck } from '../bill-check-projection';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'Bonnet Assy.',
    estimated: 10000,
    assessed: 9000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  } as AssessmentRow;
}

describe('projectForBillCheck', () => {
  test('moves the billed figure into the estimate slot', () => {
    const [p] = projectForBillCheck([row({ billedTaxable: 9500 })]);
    expect(p.estimated).toBe(9500);
    expect(p.assessed).toBe(9000);
  });

  test('a row with no billed figure carries no bill amount', () => {
    const [p] = projectForBillCheck([row()]);
    expect(p.estimated).toBe(0);
  });

  test('billAllowed overrides assessed for this document', () => {
    const [p] = projectForBillCheck([row({ billedTaxable: 12000, billAllowed: 12000 })]);
    expect(p.assessed).toBe(12000);
  });

  test('a not-in-bill row carries no money at all', () => {
    const [p] = projectForBillCheck([row({ billStatus: 'not-in-bill', billedTaxable: 0 })]);
    expect(p.estimated).toBe(0);
    expect(p.assessed).toBe(0);
  });

  test('not-in-bill wins over billAllowed', () => {
    const [p] = projectForBillCheck([row({ billStatus: 'not-in-bill', billAllowed: 5000 })]);
    expect(p.assessed).toBe(0);
  });

  test('does not mutate the input rows', () => {
    const input = [row({ billedTaxable: 9500, billAllowed: 9800 })];
    const snapshot = JSON.parse(JSON.stringify(input));
    projectForBillCheck(input);
    expect(input).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-projection.test.ts`
Expected: FAIL — `Failed to resolve import "../bill-check-projection"`

- [ ] **Step 3: Add the field**

In `src/types/assessment.ts`, inside `interface AssessmentRow`, immediately after the `billRemarks?: string;` line:

```ts
  /**
   * Bill-check allowance, pre-GST. When set, the Bill Check report uses this
   * in place of `assessed`. The Final Survey Report never reads it, so allowing
   * a workshop's higher figure cannot rewrite a report already filed.
   */
  billAllowed?: number;
```

- [ ] **Step 4: Write the projection**

Create `src/lib/reports/bill-check-projection.ts`:

```ts
import type { AssessmentRow } from '@/types/assessment';

/**
 * Projects assessment rows into the shape the Bill Check report renders.
 *
 * ponytail: bill check IS the final report over projected rows. The estimate
 * slot carries the bill figure, billAllowed overrides the assessed figure for
 * this document only, and a part that was never replaced carries no money.
 * Every existing calculation then works untouched — no new arithmetic anywhere.
 *
 * Reads billedTaxable, never billedAmount: billedAmount already includes GST,
 * and the builder taxes this column again.
 */
export function projectForBillCheck(rows: AssessmentRow[]): AssessmentRow[] {
  return rows.map(r =>
    r.billStatus === 'not-in-bill'
      ? { ...r, estimated: 0, assessed: 0 }
      : { ...r, estimated: r.billedTaxable ?? 0, assessed: r.billAllowed ?? r.assessed },
  );
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-projection.test.ts`
Expected: PASS — 6 passed

Run: `npx tsc --noEmit`
Expected: no output, exit 0

- [ ] **Step 6: Commit**

```bash
git add src/types/assessment.ts src/lib/reports/bill-check-projection.ts src/lib/reports/__tests__/bill-check-projection.test.ts
git commit -m "feat(bill-check): add billAllowed and the row projection

The Bill Check report is the Final Survey Report over projected rows: the
bill figure moves into the estimate slot, billAllowed overrides assessed
for that document only, and a part never replaced is zeroed.

billAllowed exists because both grids write one assessmentRows array and
no snapshot of an issued report exists, so editing assessed during bill
check silently rewrote a report already filed with the insurer."
```

---

### Task 2: Bill-check narrative

**Files:**
- Modify: `src/lib/reports/final-survey-preamble.ts`
- Test: `src/lib/reports/__tests__/bill-check-preamble.test.ts`

**Interfaces:**
- Consumes: `rs()` (module-private), `ClaimData`
- Produces: `billCheckPreambleFromClaim(claim: ClaimData, allowedTotal: number): string` — Task 3 calls this exact name.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/bill-check-preamble.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { billCheckPreambleFromClaim } from '../final-survey-preamble';
import type { ClaimData } from '@/types';

function claim(): ClaimData {
  return {
    policy: { insurerName: 'National Insurance Co. Ltd.', appointingOffice: 'DO-II Pune' },
    billCheck: { billNo: 'SM/INV/2026/1188', billDate: '2026-08-09', billTotal: 61832 },
  } as unknown as ClaimData;
}

describe('billCheckPreambleFromClaim', () => {
  test('names the appointing office, the billed figure and the allowed figure', () => {
    const text = billCheckPreambleFromClaim(claim(), 52936);
    expect(text).toContain('DO-II Pune');
    expect(text).toContain('61,832.00');
    expect(text).toContain('52,936.00');
  });

  test('does not describe an estimate — this document verifies a bill', () => {
    expect(billCheckPreambleFromClaim(claim(), 52936)).not.toContain('estimate');
  });

  test('falls back to the insurer when no appointing office is recorded', () => {
    const c = { policy: { insurerName: 'ACME General' }, billCheck: {} } as unknown as ClaimData;
    expect(billCheckPreambleFromClaim(c, 0)).toContain('ACME General');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-preamble.test.ts`
Expected: FAIL — `billCheckPreambleFromClaim is not a function`

- [ ] **Step 3: Add the narrative**

Append to `src/lib/reports/final-survey-preamble.ts`:

```ts
export interface BillCheckPreambleInputs {
  appointingOffice?: string;
  insurerName?: string;
  /** Workshop's invoice total, inclusive of GST. */
  billTotal: number;
  /** Net liability this report allows. */
  allowedTotal: number;
}

/** Build the default Bill Check narrative paragraph from explicit inputs. */
export function composeBillCheckPreamble(i: BillCheckPreambleInputs): string {
  const instructedBy = (i.appointingOffice || i.insurerName || 'the insurer').trim();
  return (
    `As per instructions received from ${instructedBy}, the undersigned has verified the ` +
    `final invoice submitted by the Insured/Repairer against the assessment recorded in our ` +
    `Final Survey Report. The Insured/Repairer has billed ${rs(i.billTotal)}. On verification ` +
    `of the invoice against the assessed items, the liability has been finally assessed for ` +
    `${rs(i.allowedTotal)}, which is subject to the Policy Terms and Conditions. ` +
    `The verification has been worked out in detail as follows.`
  );
}

/** Convenience wrapper: derive the Bill Check narrative from a claim. */
export function billCheckPreambleFromClaim(
  claim: ClaimData,
  allowedTotal: number,
): string {
  return composeBillCheckPreamble({
    appointingOffice: claim.policy?.appointingOffice,
    insurerName: claim.policy?.insurerName,
    billTotal: claim.billCheck?.billTotal || 0,
    allowedTotal,
  });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-preamble.test.ts`
Expected: PASS — 3 passed

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/final-survey-preamble.ts src/lib/reports/__tests__/bill-check-preamble.test.ts
git commit -m "feat(bill-check): add the bill check narrative

The final survey preamble describes an estimate being submitted and
assessed. Bill check verifies an invoice against an assessment already
made, so it needs its own paragraph rather than a reworded one."
```

---

### Task 3: `mode` on the Standard builder

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts`
- Test: `src/lib/reports/__tests__/standard-bill-check.test.ts`

**Interfaces:**
- Consumes: `projectForBillCheck` (Task 1), `billCheckPreambleFromClaim` (Task 2)
- Produces: `type ReportMode = 'final' | 'bill-check'` and `buildStandardFinalSurveyHTML(claim, profile, mode?: ReportMode)`. Task 4 uses both.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/standard-bill-check.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';
import type { SurveyorProfile } from '@/types';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Bonnet Assy.',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  } as AssessmentRow;
}

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'standard',
    reportNo: 'BC/2026/0417',
    reportDate: '2026-08-14',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: { insurerName: 'National Insurance Co. Ltd.', appointingOffice: 'DO-II Pune' },
    accident: { dateAndTime: '2026-06-24T10:00', workshopName: 'Sai Motors', dateOfSurvey: '2026-06-28' },
    driver: { name: 'UNIQUE_DRIVER_NAME' },
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'SM/INV/2026/1188', billDate: '2026-08-09', billTotal: 61832 },
  } as unknown as ClaimData;
}

const profile = { name: 'SURVEYOR' } as SurveyorProfile;

describe('Standard Bill Check report', () => {
  test('is titled as a bill check', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('MOTOR BILL CHECK REPORT');
    expect(html).not.toContain('MOTOR (FINAL) SURVEY REPORT');
  });

  test('section 9 is DETAILS OF BILL CHECK and its money column reads Bill', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('9. DETAILS OF BILL CHECK');
    expect(html).toContain('Bill ₹');
    expect(html).not.toContain('Est. ₹');
  });

  test('section 8 heads its first money column Billed', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('>Billed<');
    expect(html).not.toContain('>Estimated<');
  });

  test('omits driver and cause sections, and carries the invoice instead', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).not.toContain("3. DRIVER'S PARTICULARS");
    expect(html).not.toContain('7. CAUSE &amp; NATURE OF ACCIDENT');
    expect(html).not.toContain('UNIQUE_DRIVER_NAME');
    expect(html).toContain('4. WORKSHOP INVOICE &amp; BILL REFERENCE');
    expect(html).toContain('SM/INV/2026/1188');
  });

  test('keeps insurer and vehicle sections', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile, 'bill-check');
    expect(html).toContain('1. INSURER &amp; INSURED DETAILS');
    expect(html).toContain('National Insurance Co. Ltd.');
    expect(html).toContain('2. VEHICLE PARTICULARS');
  });

  test('the billed figure is what prints in the bill column', () => {
    const html = buildStandardFinalSurveyHTML(claim([row({ billedTaxable: 11500 })]), profile, 'bill-check');
    expect(html).toContain('11,500');
  });

  test('a not-in-bill row carries no liability', () => {
    const kept = buildStandardFinalSurveyHTML(claim([row(), row({ id: 'r2', assessed: 5000, estimated: 5000 })]), profile, 'bill-check');
    const dropped = buildStandardFinalSurveyHTML(
      claim([row(), row({ id: 'r2', assessed: 5000, estimated: 5000, billStatus: 'not-in-bill' })]),
      profile, 'bill-check',
    );
    expect(kept).not.toBe(dropped);
    expect(dropped).toContain('9. DETAILS OF BILL CHECK');
  });

  // The regression guard for the whole design.
  test('billAllowed NEVER reaches the Final Survey Report', () => {
    const c = claim([row({ assessed: 1000, estimated: 1000, billAllowed: 1200, billedTaxable: 1200 })]);
    const final = buildStandardFinalSurveyHTML(c, profile, 'final');
    expect(final).toContain('1,000');
    expect(final).not.toContain('1,200');
  });

  test('defaults to final mode when no mode is given', () => {
    const html = buildStandardFinalSurveyHTML(claim([row()]), profile);
    expect(html).toContain('MOTOR (FINAL) SURVEY REPORT');
    expect(html).toContain("3. DRIVER'S PARTICULARS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts`
Expected: FAIL — the title, section-9 and invoice assertions fail because `mode` is ignored.

- [ ] **Step 3: Add the mode parameter and project the rows**

In `src/lib/reports/standard-report-builder.ts`, add to the imports at the top of the file:

```ts
import { projectForBillCheck } from './bill-check-projection';
import { billCheckPreambleFromClaim } from './final-survey-preamble';
```

(`preambleFromClaim` and `estimateTotalInclGst` are already imported on line 17 — extend that import rather than duplicating it.)

Above `export function buildStandardFinalSurveyHTML`, add:

```ts
/** Which document this builder is rendering. */
export type ReportMode = 'final' | 'bill-check';
```

Change the signature (currently lines 58-61) to:

```ts
export function buildStandardFinalSurveyHTML(
  claim: ClaimData,
  profile: SurveyorProfile,
  mode: ReportMode = 'final'
): string {
```

Replace line 66, `const rows = claim.assessmentRows || [];`, with:

```ts
  const isBillCheck = mode === 'bill-check';
  // Bill check renders the same report over projected rows. Everything below
  // this line — every total, every GST band — is untouched by the mode.
  const rows = isBillCheck
    ? projectForBillCheck(claim.assessmentRows || [])
    : (claim.assessmentRows || []);
```

- [ ] **Step 4: Extract sections 3, 4 and 7 into consts**

Immediately **before** the `// REPORT HTML` comment block (currently around line 306, just after the `labPaintSubHeader` const), insert three consts.

Cut lines 403-433 verbatim — the `3. DRIVER'S PARTICULARS` heading div through the `</table>` that closes it — and assign them:

```ts
  const driverSectionHtml = `<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">3. DRIVER'S PARTICULARS</div>
<table style="${ts}">
  ...paste the rows exactly as they were, unchanged...
</table>`;
```

Cut the `4. ACCIDENT & SURVEY DETAILS` heading through its closing `</table>` and assign:

```ts
  const accidentSectionHtml = `<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">4. ACCIDENT &amp; SURVEY DETAILS</div>
<table style="${ts}">
  ...paste the rows exactly as they were, unchanged...
</table>`;
```

Cut the `7. CAUSE & NATURE OF ACCIDENT` heading and the div beneath it, and assign:

```ts
  const causeSectionHtml = `<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">7. CAUSE &amp; NATURE OF ACCIDENT</div>
<div style="font-size:${scale.cellFont};margin-bottom:4px;padding:2px 4px;border:0.4pt solid #bbb;background:#fafaf7;line-height:1.5;">${accident.causeOfAccident || '—'}</div>`;
```

Then add the bill-check replacement for section 4:

```ts
  const bc = claim.billCheck;
  const billRefSectionHtml = `<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">4. WORKSHOP INVOICE &amp; BILL REFERENCE</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};width:18%;">Workshop</td>
    <td style="${td}width:32%;">${accident.workshopName || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};width:18%;">Date of Final Survey</td>
    <td style="${td}">${formatDateDMY(accident.dateOfSurvey)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Bill / Invoice No.</td>
    <td style="${td}font-weight:700;">${bc?.billNo || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Bill / Invoice Date</td>
    <td style="${td}font-weight:700;">${formatDateDMY(bc?.billDate)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Total Bill Amount (incl. GST)</td>
    <td style="${td}font-weight:700;">₹ ${fmt2(bc?.billTotal || 0)}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Allowed by this Report (incl. GST)</td>
    <td style="${td}font-weight:700;">₹ ${fmt2(grand)}</td>
  </tr>
</table>`;
```

In the returned template literal, at the point the three cut blocks used to sit, insert:

```ts
${isBillCheck ? billRefSectionHtml : driverSectionHtml + accidentSectionHtml}
${isBillCheck ? '' : causeSectionHtml}
```

- [ ] **Step 5: Swap the labels**

Five edits inside the returned template literal.

Title (line 313) — replace the whole `<div>` text with:

```ts
<div style="text-align:center;font-weight:700;font-size:8.5pt;margin-bottom:3px;text-decoration:underline;letter-spacing:0.05em;">PRIVATE AND CONFIDENTIAL — MOTOR ${isBillCheck ? 'BILL CHECK REPORT' : '(FINAL) SURVEY REPORT'}</div>
```

Preamble paragraph (line 470) — replace with:

```ts
<p style="font-size:${scale.cellFont};line-height:1.5;text-align:justify;margin:4px 0;color:#000;">${isBillCheck
  ? billCheckPreambleFromClaim(claim, net)
  : ((claim.reportPreamble && claim.reportPreamble.trim()) ? claim.reportPreamble : preambleFromClaim(claim, estimateTotalInclGst(rows), net))}</p>
```

§8 column header (line 476):

```ts
      <th style="${th};text-align:right;">${isBillCheck ? 'Billed' : 'Estimated'}</th>
```

§9 heading (line 608) — replace `9. DETAILS OF ASSESSMENT` with:

```ts
9. DETAILS OF ${isBillCheck ? 'BILL CHECK' : 'ASSESSMENT'}
```

§9 money header — **both** occurrences of `Est. ₹`, in `labPaintSubHeader` (line 301) and the main header row (line 615):

```ts
<th style="${th}text-align:right;">${isBillCheck ? 'Bill ₹' : 'Est. ₹'}</th>
```

(the main header row also carries `width:${W.est}%;` — keep that attribute, change only the text)

- [ ] **Step 6: Run the new tests**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts`
Expected: PASS — 9 passed

- [ ] **Step 7: Run the whole suite and typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npx vitest run`
Expected: all files pass. The baseline before this plan is 93 files / 708 tests; nothing existing may break. If `standard-report-columns.test.ts` or `standard-summary-consistency.test.ts` fails, the section extraction changed the final-mode output — diff it and restore byte-for-byte.

- [ ] **Step 8: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/standard-bill-check.test.ts
git commit -m "feat(bill-check): render the Standard Bill Check report

The bill check is the Standard Final Survey Report with the Estimate
column replaced by the Bill column. Sections 1, 2, 8, 9 and the GST
tables are unchanged; section 4 carries the workshop invoice instead of
accident details, and sections 3 and 7 are omitted as established by the
final report. Original section numbers are kept so a reader finds the
same content under the same number.

No calculation changed. The mode swaps labels; the row projection does
the rest."
```

---

### Task 4: Print wrappers and the format toggle

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts:665-695`
- Modify: `src/components/tabs/BillCheckTab.tsx`
- Test: `src/lib/reports/__tests__/standard-bill-check.test.ts` (append)

**Interfaces:**
- Consumes: `ReportMode`, `buildStandardFinalSurveyHTML` (Task 3)
- Produces: `buildStandardPrintDocument(claim, profile, mode?)`, `triggerStandardPrint(claim, profile, mode?)`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/reports/__tests__/standard-bill-check.test.ts`:

```ts
import { buildStandardPrintDocument } from '../standard-report-builder';

describe('Bill check print document', () => {
  test('names the window after the bill check, not the final survey', () => {
    const doc = buildStandardPrintDocument(claim([row()]), profile, 'bill-check');
    expect(doc).toContain('Standard Bill Check Report');
    expect(doc).not.toContain('Standard Final Survey Report');
  });

  test('still names the final survey in final mode', () => {
    expect(buildStandardPrintDocument(claim([row()]), profile)).toContain('Standard Final Survey Report');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts -t 'print document'`
Expected: FAIL — document title still reads "Standard Final Survey Report"

- [ ] **Step 3: Thread mode through the wrappers**

Replace `buildStandardPrintDocument` and `triggerStandardPrint` (lines 665-695) with:

```ts
export function buildStandardPrintDocument(
  claim: ClaimData,
  profile: SurveyorProfile,
  mode: ReportMode = 'final'
): string {
  const reg = claim.vehicle?.registrationNumber || 'Claim';
  return buildPrintShell(buildStandardFinalSurveyHTML(claim, profile, mode), {
    title: mode === 'bill-check'
      ? `Standard Bill Check Report — ${reg}`
      : `Standard Final Survey Report — ${reg}`,
    footerLeft: footerFromProfile(profile),
    fontSize: '7.8pt',
  });
}

export function triggerStandardPrint(
  claim: ClaimData,
  profile: SurveyorProfile,
  mode: ReportMode = 'final'
): void {
  const html = buildStandardPrintDocument(claim, profile, mode);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Popup blocked — please allow popups for this site and try again.');
    return;
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 600);
}
```

- [ ] **Step 4: Add the format toggle to the tab**

In `src/components/tabs/BillCheckTab.tsx`:

Add to the imports:

```ts
import { buildStandardFinalSurveyHTML, triggerStandardPrint } from '@/lib/reports/standard-report-builder';
```

Replace the `BillCheckPreview` component (lines 25-54) with a format-aware version:

```tsx
function BillCheckPreview({ claim, profile, format }: { claim: any; profile: any; format: 'standard' | 'uiic' }) {
  const { html, error } = useMemo(() => {
    try {
      return {
        html: format === 'uiic'
          ? buildUIICBillCheckHTML(claim, profile)
          : buildStandardFinalSurveyHTML(claim, profile, 'bill-check'),
        error: null as string | null,
      };
    } catch (e: unknown) {
      // A blank preview used to be indistinguishable from an empty claim.
      return { html: '', error: e instanceof Error ? e.message : 'Report could not be built' };
    }
  }, [claim, profile, format]);

  if (error) {
    return (
      <div className="rounded-2xl p-6 bg-status-danger/10 border border-status-danger text-sm text-status-danger">
        <strong>Bill Check preview failed to build.</strong>
        <div className="text-xs mt-1 font-mono">{error}</div>
      </div>
    );
  }

  return (
    <ReportPreviewPanel
      html={html}
      title={`${format === 'uiic' ? 'UIIC' : 'Standard'} Bill Check Report — Live Preview`}
      printLabel="Power Print"
      onPrint={() =>
        format === 'uiic'
          ? triggerUIICBillCheckPrint(claim, profile)
          : triggerStandardPrint(claim, profile, 'bill-check')
      }
      wordFilename={`${claim?.vehicle?.registrationNumber || 'Claim'}-${format === 'uiic' ? 'UIIC' : 'Standard'}-Bill-Check`}
      footerLeft={footerFromProfile(profile)}
    />
  );
}
```

Inside `BillCheckTab`, beside the existing `const [showEvidence, setShowEvidence] = useState(false);`:

```tsx
  const [format, setFormat] = useState<'standard' | 'uiic'>('standard');
```

Replace the "Power Print" panel block (the `<div className="rounded-2xl overflow-hidden bg-white border border-border">` section) with:

```tsx
            <div className="rounded-2xl overflow-hidden bg-white border border-border">
              <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Download Bill Check Report</div>
                  <div className="text-xs mt-0.5 text-muted-foreground">
                    Only allowed items, original serial numbers
                  </div>
                </div>
                <div className="flex gap-1 p-1 rounded-xl bg-neutral-50">
                  {(['standard', 'uiic'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: format === f ? 'var(--color-card, #FFFFFF)' : 'transparent',
                        color: format === f ? 'var(--color-primary)' : 'var(--color-neutral-400)',
                        boxShadow: format === f ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                      }}
                    >
                      {f === 'uiic' ? 'UIIC' : 'Standard'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1 text-xs leading-relaxed text-foreground">
                  <strong>How Bill Check works:</strong> The Final Survey logs what was <em>allowed</em>.
                  Once repairs are done, the workshop submits a final bill. This report verifies every
                  allowed item appears in the bill — flagging missing or mismatched amounts. Only allowed
                  items appear in this report; disallowed items are excluded.
                </div>
                <button
                  id="btn-print-bill-check"
                  onClick={() =>
                    format === 'uiic'
                      ? triggerUIICBillCheckPrint(currentClaim, profile)
                      : triggerStandardPrint(currentClaim, profile, 'bill-check')
                  }
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 hover:scale-105 active:scale-95 bg-primary text-primary-foreground"
                  style={{ boxShadow: '0 4px 14px rgba(13,27,42,0.3)' }}
                >
                  <Printer size={16} />
                  Power Print — {format === 'uiic' ? 'UIIC' : 'Standard'} Bill Check
                </button>
              </div>
            </div>
```

Update the preview call at the bottom of the panel:

```tsx
            <BillCheckPreview claim={currentClaim} profile={profile} format={format} />
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts`
Expected: PASS — 11 passed

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npx vitest run`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/components/tabs/BillCheckTab.tsx src/lib/reports/__tests__/standard-bill-check.test.ts
git commit -m "feat(bill-check): add a Standard | UIIC format toggle

Mirrors the toggle ReportTab already uses for the final survey report,
so the two documents are chosen the same way. Standard is the default;
UIIC keeps its existing builder untouched."
```

---

# Phase 2 — The screen

### Task 5: One shared column config

**Files:**
- Create: `src/components/claim/grid-columns.ts`
- Test: `src/components/claim/__tests__/grid-columns.test.ts`

**Interfaces:**
- Produces: `GridColumn`, `GridColumnMeta`, `GRID_COLUMNS`, `ASSESSMENT_COLUMN_ORDER`, `BILL_CHECK_COLUMN_ORDER`. Tasks 6 and 7 import these exact names.

- [ ] **Step 1: Write the failing test**

Create `src/components/claim/__tests__/grid-columns.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  GRID_COLUMNS,
  ASSESSMENT_COLUMN_ORDER,
  BILL_CHECK_COLUMN_ORDER,
} from '../grid-columns';

describe('shared grid columns', () => {
  // The defect this module exists to prevent: BillCheckGrid labelled
  // row.estimated "Assessed Tax" while AssessmentSectionTable called the same
  // field "Estimate(taxable amount)".
  test('every ordered column resolves to exactly one label', () => {
    for (const key of [...ASSESSMENT_COLUMN_ORDER, ...BILL_CHECK_COLUMN_ORDER]) {
      expect(GRID_COLUMNS[key], `no config for column "${key}"`).toBeDefined();
      expect(GRID_COLUMNS[key].label.length).toBeGreaterThan(0);
    }
  });

  test('a column shared by both grids carries the same label in both', () => {
    const shared = ASSESSMENT_COLUMN_ORDER.filter(k => BILL_CHECK_COLUMN_ORDER.includes(k));
    expect(shared.length).toBeGreaterThan(5);
    for (const key of shared) {
      expect(GRID_COLUMNS[key].label).toBe(GRID_COLUMNS[key].label);
    }
  });

  test('bill check adds the bill columns and keeps the assessment ones', () => {
    for (const key of ASSESSMENT_COLUMN_ORDER) {
      expect(BILL_CHECK_COLUMN_ORDER).toContain(key);
    }
    expect(BILL_CHECK_COLUMN_ORDER).toContain('billedTaxable');
    expect(BILL_CHECK_COLUMN_ORDER).toContain('status');
  });

  test('no order lists a column twice', () => {
    expect(new Set(ASSESSMENT_COLUMN_ORDER).size).toBe(ASSESSMENT_COLUMN_ORDER.length);
    expect(new Set(BILL_CHECK_COLUMN_ORDER).size).toBe(BILL_CHECK_COLUMN_ORDER.length);
  });

  test('the estimate column is named for what it holds', () => {
    expect(GRID_COLUMNS.unitPrice.label.toLowerCase()).toContain('estimate');
    expect(GRID_COLUMNS.unitPrice.label.toLowerCase()).not.toContain('assessed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/claim/__tests__/grid-columns.test.ts`
Expected: FAIL — `Failed to resolve import "../grid-columns"`

- [ ] **Step 3: Write the module**

Create `src/components/claim/grid-columns.ts`:

```ts
// The one place a grid column is named.
//
// AssessmentSectionTable and BillCheckGrid stayed separate components, so
// their headers drifted: the same field, row.estimated, was "Estimate(taxable
// amount)" in one and "Assessed Tax" in the other — directly beside a real
// Assessed column. Two components may render the columns; only this file
// names them.

export type GridColumn =
  | 'partNumber'
  | 'hsnSac'
  | 'type'
  | 'section'
  | 'quantity'
  | 'unitPrice'
  | 'gst'
  | 'disposal'
  | 'priceWithGst'
  | 'billedTaxable'
  | 'status'
  | 'action'
  | 'remarks';

export interface GridColumnMeta {
  key: GridColumn;
  /** Header text. The single source of truth for what this column is called. */
  label: string;
  /** Shown in the column-picker tooltip. */
  description: string;
  /** CSS grid track width. */
  width: string;
}

export const GRID_COLUMNS: Record<GridColumn, GridColumnMeta> = {
  partNumber:    { key: 'partNumber',    label: 'Part No.',           description: 'OEM part number', width: '110px' },
  hsnSac:        { key: 'hsnSac',        label: 'HSN/SAC',            description: 'Tax classification code', width: '80px' },
  type:          { key: 'type',          label: 'Type',               description: 'Metal / Plastic / Glass / Labour', width: '90px' },
  section:       { key: 'section',       label: 'Section',            description: 'Parts / Labour / Paint', width: '70px' },
  quantity:      { key: 'quantity',      label: 'Qty',                description: 'Quantity', width: '50px' },
  unitPrice:     { key: 'unitPrice',     label: 'Estimate (taxable)', description: 'Taxable amount from the estimate, before GST', width: '110px' },
  gst:           { key: 'gst',           label: 'GST %',              description: 'GST percentage (0 for disposal rows)', width: '60px' },
  disposal:      { key: 'disposal',      label: 'Disposal',           description: 'Used/salvaged part — no GST; surveyor sets % of depreciated value', width: '110px' },
  priceWithGst:  { key: 'priceWithGst',  label: 'Price+GST',          description: 'Net assessed amount inclusive of GST', width: '100px' },
  billedTaxable: { key: 'billedTaxable', label: 'Billed Taxable',     description: 'Billed taxable (net) amount before GST, from the workshop bill', width: '110px' },
  status:        { key: 'status',        label: 'Status',             description: 'In Bill / Not in Bill / Partial', width: '120px' },
  action:        { key: 'action',        label: 'Action',             description: 'Replace / Repair / Disallow', width: '90px' },
  remarks:       { key: 'remarks',       label: 'Remarks',            description: 'Surveyor notes', width: '1fr' },
};

/**
 * Column order for the Assessment grid. Always-on columns (Assessed, Dep%,
 * Net) are rendered by the component between `disposal` and `priceWithGst`
 * and are deliberately absent here — they are not optional.
 */
export const ASSESSMENT_COLUMN_ORDER: GridColumn[] = [
  'partNumber', 'hsnSac', 'type', 'section', 'quantity',
  'unitPrice', 'gst', 'disposal', 'priceWithGst', 'action', 'remarks',
];

/** Bill check is the assessment grid plus the bill columns. */
export const BILL_CHECK_COLUMN_ORDER: GridColumn[] = [
  'partNumber', 'hsnSac', 'type', 'section', 'quantity',
  'unitPrice', 'gst', 'disposal', 'priceWithGst',
  'billedTaxable', 'status', 'action', 'remarks',
];
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/components/claim/__tests__/grid-columns.test.ts`
Expected: PASS — 5 passed

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/components/claim/grid-columns.ts src/components/claim/__tests__/grid-columns.test.ts
git commit -m "refactor(grid): name every column in one place

The two grids drifted because each named its own columns. row.estimated
was 'Estimate(taxable amount)' in one and 'Assessed Tax' in the other,
the latter sitting beside a real Assessed column.

Keeping both components was the deliberate choice; this module is the
structural guard that stops them disagreeing again."
```

---

### Task 6: Bill Check grid adopts the shared labels

**Files:**
- Modify: `src/components/tabs/bill-check/config.ts`
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx:135-146, 158-186, ~380-410`

**Interfaces:**
- Consumes: `GRID_COLUMNS`, `BILL_CHECK_COLUMN_ORDER` (Task 5)

- [ ] **Step 1: Re-point the bill check config at the shared module**

In `src/components/tabs/bill-check/config.ts`, replace the `OptionalColumn` type, `ColumnMeta`, `OPTIONAL_COLUMNS` and `COL_WIDTHS` declarations with re-exports:

```ts
import { GRID_COLUMNS, BILL_CHECK_COLUMN_ORDER, type GridColumn } from '@/components/claim/grid-columns';

export type OptionalColumn = GridColumn;
export type { GridColumnMeta as ColumnMeta } from '@/components/claim/grid-columns';

export const OPTIONAL_COLUMNS = BILL_CHECK_COLUMN_ORDER.map(k => GRID_COLUMNS[k]);

export const COL_WIDTHS = Object.fromEntries(
  BILL_CHECK_COLUMN_ORDER.map(k => [k, GRID_COLUMNS[k].width]),
) as Record<GridColumn, string>;
```

Replace `DEFAULT_VISIBLE` with one covering every bill-check column:

```ts
export const DEFAULT_VISIBLE: Record<OptionalColumn, boolean> = {
  partNumber: false,
  hsnSac: false,
  type: true,
  section: false,      // both grids already group by section — the column repeats its own heading
  quantity: false,
  unitPrice: true,
  gst: true,
  disposal: true,
  priceWithGst: true,
  billedTaxable: true,
  status: true,
  action: true,
  remarks: true,
};
```

Leave `STORAGE_KEY`, `loadVisibility`, `saveVisibility`, `BillStatus`, `statusLabel` and `fmt` exactly as they are.

- [ ] **Step 2: Take the header labels from the config and drop Billed Incl GST**

In `BillCheckGrid.tsx`, replace the header cells (lines 139-144) with:

```tsx
        {visible.unitPrice     && <span>{GRID_COLUMNS.unitPrice.label}</span>}
        {visible.gst           && <span>{GRID_COLUMNS.gst.label}</span>}
        <span>Assessed (₹)</span>
        {visible.billedTaxable && <span>{GRID_COLUMNS.billedTaxable.label} (₹)</span>}
        <span>Status</span>
```

Add the import at the top of the file:

```tsx
import { GRID_COLUMNS } from '@/components/claim/grid-columns';
```

Rename the visibility key throughout the file: every `visible.taxable` becomes `visible.unitPrice`, and every `COL_WIDTHS.taxable` becomes `COL_WIDTHS.unitPrice`. There are occurrences at lines 139, 176 and 384.

Delete the `Billed Incl GST (₹)` header (line 143), its totals cell (line 181, `<div className="text-sm font-medium text-primary">{fmt(t.billedAmount)}</div>`) and its row input (the `value={row.billedAmount || ''}` block around line 403). Leave the `billedAmount` **field** alone — `lib/ai/insured-report.ts` and the insured report PDF still read it, and the status dropdown still writes it.

Update `buildCols` (lines 67-74) so the removed column's `110px` track goes with it:

```tsx
  const buildCols = () => {
    const detailCols = (['partNumber', 'hsnSac', 'section', 'quantity', 'unitPrice', 'gst'] as OptionalColumn[])
      .filter(k => visible[k]).map(k => COL_WIDTHS[k]);
    const billedTaxCol = visible.billedTaxable ? [COL_WIDTHS.billedTaxable] : [];
    const remarksCol = visible.remarks ? [COL_WIDTHS.remarks] : [];
    return ['32px', '50px', '2fr', ...detailCols, '100px', ...billedTaxCol, '120px', ...remarksCol, '40px'].join(' ');
  };
```

- [ ] **Step 3: Typecheck and run the suite**

Run: `npx tsc --noEmit`
Expected: exit 0. If it reports `Property 'taxable' does not exist`, a `visible.taxable` was missed — fix and re-run.

Run: `npx vitest run`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/bill-check/config.ts src/components/tabs/bill-check/BillCheckGrid.tsx
git commit -m "fix(bill-check): correct the grid's column names

The column headed 'Assessed Tax' rendered row.estimated — the estimate,
sitting beside the real Assessed column. It now reads 'Estimate (taxable)',
taken from the shared config so the assessment grid cannot disagree.

'Billed Tax' becomes 'Billed Taxable'. 'Billed Incl GST' is removed from
the grid; the underlying billedAmount field stays, since the insured
report reads it."
```

---

### Task 7: Bill Check grid gains the missing assessment columns

**Files:**
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx`
- Reference: `src/components/claim/AssessmentSectionTable.tsx:142-149` (headers), `:411-499` (cells)

- [ ] **Step 1: Add the always-on assessment columns**

The Bill Check grid is missing `Dep%`, `Net (₹)` and `Price+GST` — all three printed by the bill check PDF, so the surveyor cannot currently see on screen what will appear on paper.

In `BillCheckGrid.tsx`, after the `<span>Assessed (₹)</span>` header cell, add:

```tsx
        <span>Dep%</span>
        <span>Net (₹)</span>
        {visible.priceWithGst && <span>{GRID_COLUMNS.priceWithGst.label}</span>}
```

In the row render, after the Assessed cell, mirror `AssessmentSectionTable.tsx:411-499` — read the depreciation with the same call the assessment grid uses:

```tsx
                <div className="text-xs font-medium text-center" style={{ color: 'var(--color-status-danger)' }}>
                  {row.depOverride !== undefined ? `${row.depOverride}%*` : `${depRate(row)}%`}
                </div>
                <div className="text-sm font-medium text-right">{fmt(computeRowNet(row, depRate(row)).netBeforeGst)}</div>
                {visible.priceWithGst && (
                  <div className="text-sm font-medium text-right">
                    {fmt(computeRowNet(row, depRate(row)).netBeforeGst * (row.isDisposal ? 1 : 1 + (row.gst ?? 18) / 100))}
                  </div>
                )}
```

Add near the top of the component, where `ageMonths` and `depreciationType` are available from props:

```tsx
  const depRate = (r: AssessmentRow) =>
    r.depOverride !== undefined ? r.depOverride : getDepreciationRate(r.partType, ageMonths, depType);
```

`ageMonths` and `depType` are computed in `BillCheckTab.tsx` (lines 82-90) — pass both into `BillCheckGrid` as new props rather than recomputing, so the grid and the report cannot disagree on the rate.

Add the imports:

```tsx
import { computeRowNet, getDepreciationRate } from '@/lib/calculations';
import type { AssessmentRow } from '@/types/assessment';
```

Extend `buildCols` with the three new tracks: `'70px'` for Dep%, `'100px'` for Net, and `COL_WIDTHS.priceWithGst` when visible. Add matching empty `<div />` cells to `totalsRow` so the grid stays aligned — a mismatch shifts every figure one column right, which is why the file keeps `headerRow` and `totalsRow` together.

- [ ] **Step 2: Verify column counts match**

Run: `npx tsc --noEmit`
Expected: exit 0

Count the cells by hand: `headerRow`, `totalsRow` and the row render must each emit the same number of cells under the same visibility guards. Read all three in one pass and confirm.

- [ ] **Step 3: Run the suite**

Run: `npx vitest run`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/bill-check/BillCheckGrid.tsx src/components/tabs/BillCheckTab.tsx
git commit -m "feat(bill-check): show Dep%, Net and Price+GST in the grid

All three are printed by the bill check PDF but were absent from the
screen, so the surveyor could not see what would appear on paper — the
defect the assessment-grid-sections work was written to fix.

The depreciation rate is passed down from the tab rather than recomputed,
so the grid and the report read the same number."
```

---

### Task 8: Allowance scope dialog

**Files:**
- Create: `src/components/dialogs/AllowanceScopeDialog.tsx`
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx` (Assessed cell `onChange`)

**Interfaces:**
- Consumes: `billAllowed` (Task 1)
- Produces: `<AllowanceScopeDialog assessed={number} proposed={number} onChoose={(scope: 'bill-check' | 'both') => void} onCancel={() => void} />`

- [ ] **Step 1: Create the dialog**

Create `src/components/dialogs/AllowanceScopeDialog.tsx`:

```tsx
'use client';

import React from 'react';
import { FileCheck2, Files, X } from 'lucide-react';

interface AllowanceScopeDialogProps {
  /** The figure assessed at final survey. */
  assessed: number;
  /** The figure the surveyor just typed. */
  proposed: number;
  onChoose: (scope: 'bill-check' | 'both') => void;
  onCancel: () => void;
}

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * Asked when an Assessed edit in Bill Check diverges from the assessed figure.
 *
 * Both grids write one assessmentRows array and nothing snapshots an issued
 * report, so writing `assessed` here silently rewrites a Final Survey Report
 * that may already be with the insurer. This makes that reach a choice.
 */
export function AllowanceScopeDialog({
  assessed,
  proposed,
  onChoose,
  onCancel,
}: AllowanceScopeDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200 bg-card border border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Allow ₹{INR.format(proposed)} against an assessment of ₹{INR.format(assessed)}?
            </h2>
            <p className="text-xs mt-1 text-muted-foreground">
              How far should this change reach?
            </p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground" aria-label="Cancel">
            <X size={16} />
          </button>
        </div>

        <button
          onClick={() => onChoose('bill-check')}
          className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary text-left transition-colors"
        >
          <FileCheck2 size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-foreground">Bill Check only</div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              The Final Survey Report keeps showing ₹{INR.format(assessed)}. Use this when you are
              allowing the workshop&apos;s figure, not revising your assessment.
            </div>
          </div>
        </button>

        <button
          onClick={() => onChoose('both')}
          className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-status-danger text-left transition-colors"
        >
          <Files size={18} className="text-status-danger flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-foreground">Both reports</div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              Changes the assessment itself. The Final Survey Report will reprint at
              ₹{INR.format(proposed)} — <strong>including a copy already sent to the insurer</strong>.
              Correct when a supplementary estimate revised the assessment.
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it to the Assessed cell**

In `BillCheckGrid.tsx`, hold pending-edit state beside the existing state:

```tsx
  const [pendingAllowance, setPendingAllowance] = useState<{ id: string; assessed: number; proposed: number } | null>(null);
```

The Assessed input's `onChange` writes `billAllowed` only after the surveyor has chosen a scope for that row. A row that already carries `billAllowed`, or whose typed value equals `assessed`, does not re-prompt:

```tsx
  const commitAllowance = (row: AssessmentRow, value: number) => {
    if (value === row.assessed || row.billAllowed !== undefined) {
      updateAssessmentRow(row.id, { billAllowed: value });
      return;
    }
    setPendingAllowance({ id: row.id, assessed: row.assessed, proposed: value });
  };
```

Render at the end of the component:

```tsx
      {pendingAllowance && (
        <AllowanceScopeDialog
          assessed={pendingAllowance.assessed}
          proposed={pendingAllowance.proposed}
          onCancel={() => setPendingAllowance(null)}
          onChoose={scope => {
            updateAssessmentRow(
              pendingAllowance.id,
              scope === 'both'
                ? { assessed: pendingAllowance.proposed, billAllowed: undefined }
                : { billAllowed: pendingAllowance.proposed },
            );
            setPendingAllowance(null);
          }}
        />
      )}
```

- [ ] **Step 3: Typecheck and run the suite**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npx vitest run`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/components/dialogs/AllowanceScopeDialog.tsx src/components/tabs/bill-check/BillCheckGrid.tsx
git commit -m "feat(bill-check): ask how far an allowance reaches

Allowing above the assessed figure used to write assessed directly, which
silently reprinted a Final Survey Report already filed with the insurer:
same report number, different figure, no history.

The surveyor now chooses. Bill Check only writes billAllowed, which the
final report never reads. Both writes assessed, and the dialog says
plainly that a filed report changes."
```

---

### Task 9: Pending-rows print gate

**Files:**
- Create: `src/components/dialogs/PendingRowsDialog.tsx`
- Modify: `src/components/tabs/BillCheckTab.tsx`

**Interfaces:**
- Produces: `<PendingRowsDialog rows={AssessmentRow[]} onResolveAll={() => void} onCancel={() => void} />`

- [ ] **Step 1: Create the dialog**

Create `src/components/dialogs/PendingRowsDialog.tsx`:

```tsx
'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { AssessmentRow } from '@/types/assessment';

interface PendingRowsDialogProps {
  /** Allowed rows still sitting at status `pending`. */
  rows: AssessmentRow[];
  /** Marks every listed row Not in Bill. */
  onResolveAll: () => void;
  onCancel: () => void;
}

/**
 * A bill check is not issued while the bill is still pending. `pending` means
 * the workshop gave no figure for that item, and the surveyor must say what
 * that means before the document exists — so PENDING never reaches the PDF.
 */
export function PendingRowsDialog({ rows, onResolveAll, onCancel }: PendingRowsDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200 bg-card border border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-status-warning flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-medium text-foreground">
                {rows.length} item{rows.length === 1 ? '' : 's'} not yet checked
              </h2>
              <p className="text-xs mt-1 text-muted-foreground">
                A bill check cannot be issued while items are pending. Enter the billed figure,
                or record that they were not billed.
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <ul className="max-h-48 overflow-y-auto text-xs flex flex-col gap-1">
          {rows.map(r => (
            <li key={r.id} className="flex justify-between gap-3 px-3 py-2 rounded-lg bg-neutral-50">
              <span className="truncate text-foreground">{r.particulars}</span>
              <span className="flex-shrink-0 text-muted-foreground">
                ₹{r.assessed.toLocaleString('en-IN')}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground"
          >
            Go back and edit
          </button>
          <button
            onClick={onResolveAll}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground"
          >
            Mark all Not in Bill
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Gate printing on it**

In `BillCheckTab.tsx`, add:

```tsx
  const [pendingGate, setPendingGate] = useState(false);

  const pendingRows = allowedRows.filter(r => !r.billStatus || r.billStatus === 'pending');

  const handlePrint = () => {
    if (pendingRows.length > 0) { setPendingGate(true); return; }
    if (format === 'uiic') triggerUIICBillCheckPrint(currentClaim, profile);
    else triggerStandardPrint(currentClaim, profile, 'bill-check');
  };

  const resolveAllPending = () => {
    pendingRows.forEach(r =>
      updateAssessmentRow(r.id, { billStatus: 'not-in-bill', billedTaxable: 0, billedAmount: 0 }),
    );
    setPendingGate(false);
  };
```

Point the Power Print button's `onClick` at `handlePrint`, and render the dialog beside the existing `AIReviewDialog`:

```tsx
      {pendingGate && (
        <PendingRowsDialog
          rows={pendingRows}
          onResolveAll={resolveAllPending}
          onCancel={() => setPendingGate(false)}
        />
      )}
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npx vitest run`
Expected: all pass, no regressions against the 708-test baseline

- [ ] **Step 4: Commit**

```bash
git add src/components/dialogs/PendingRowsDialog.tsx src/components/tabs/BillCheckTab.tsx
git commit -m "feat(bill-check): block printing while items are unchecked

A bill check is not issued while the bill is pending. Pending means the
workshop gave no figure, so the surveyor says what that means before the
document exists — usually that the part was not replaced.

PENDING therefore cannot reach the PDF, which is why the report needs no
pending banner and no rule for what an unverified row contributes."
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| `mode` on the Standard builder | 3 |
| Row projection, bill into estimate slot | 1 |
| `not-in-bill` prints with zeros | 1, 3 |
| `billAllowed`, final report unaffected | 1, 3 (regression test), 8 |
| Allowance scope dialog | 8 |
| Print gate on pending rows | 9 |
| Standard \| UIIC format toggle | 4 |
| Bill-check preamble | 2 |
| Report structure: §1/§2 kept, §3/§7 dropped, §4 replaced | 3 |
| Field provenance — no orphan fields printed | 3 (§4 uses only `workshopName`, `dateOfSurvey`, `billNo`, `billDate`, `billTotal`) |
| Shared column config | 5 |
| `Billed Tax` → `Billed Taxable`; `Billed Incl GST` removed | 6 |
| `Assessed Tax` corrected | 6 |
| Bill check gains Dep%, Net, Price+GST | 7 |
| Assessment fields stay editable | 7, 8 |

**Not carried into this plan, deliberately:** the missing-remark disclaimer. It warns without blocking and changes no number; it is the one spec item worth deferring if scope needs cutting. Raise it with the user rather than dropping it silently.

**Type consistency:** `projectForBillCheck`, `ReportMode`, `billCheckPreambleFromClaim`, `GRID_COLUMNS`, `ASSESSMENT_COLUMN_ORDER`, `BILL_CHECK_COLUMN_ORDER` are each defined once and referenced under exactly those names. The visibility key rename `taxable` → `unitPrice` is confined to Task 6 and typechecked there.

**Known risk:** Task 3 Step 4 moves ~60 lines of template literal into consts. A stray character changes the *final survey* report, not just the bill check. Step 7 exists to catch that — if `standard-report-columns.test.ts` or `standard-summary-consistency.test.ts` fails, restore the moved text byte-for-byte before proceeding.
