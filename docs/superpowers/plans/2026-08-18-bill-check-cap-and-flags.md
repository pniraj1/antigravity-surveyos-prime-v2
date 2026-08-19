# Bill Check — Cap, Flags and Estimate Figures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the billed-amount cap, surface every disagreement between the bill and the assessment as a decision the surveyor must make, and make the estimate figures state what the garage actually estimated.

**Architecture:** Three independent layers. Part 1 corrects arithmetic already in the reports and ships on its own. Part 2 is one line inside `billCheckAssessed`, which every money path already routes through. Part 3 derives flags as a pure function over rows — no new stored state except one boolean marking a row reviewed.

**Tech Stack:** TypeScript, React 19, Vitest. No new dependencies.

## Global Constraints

- **Branch:** commit directly to `main`. No branches, no worktrees (project convention).
- **Commit format:** `<type>(<scope>): <subject>`. No attribution trailers.
- **Verification:** `npx tsc --noEmit` and `npx vitest run` must both pass before every commit. Baseline entering this plan: **104 files / 800 tests**.
- **Immutability:** never mutate a row; return new objects.
- **`billedTaxable` is pre-GST. `billedAmount` is GST-inclusive.** Never feed `billedAmount` into a column that is taxed again.
- **The Final Survey Report must never see the cap.** Tasks 1, 2 and 5 touch code it shares; each carries a test proving its output is unaffected.
- **No discount handling anywhere.** Confirmed with the surveyor: lump-sum discounts do not occur in this domain, so any reconciliation gap is an error.
- **Spec:** `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Specs/2026-08-18-bill-check-cap-and-flags-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/calculations/assessment.ts` | **Modify** — unfilter the per-material estimate split |
| `src/lib/reports/standard-report-builder.ts` | **Modify** — read engine estimates instead of private copies; relabel; §9 subtotals; §8 rejected-but-billed lines |
| `src/lib/reports/bill-check-projection.ts` | **Modify** — `billCheckAssessed` applies the cap |
| `src/types/assessment.ts` | **Modify** — add `billVerified`, drop `'partial'` from `BillStatus` |
| `src/lib/reports/bill-check-flags.ts` | **Create** — derives flags and the invoice reconciliation. Pure, no React. Lives beside the projection so bill-check logic stays together and the dependency runs reports → calculations, never back. |
| `src/components/tabs/bill-check/BillCheckFlagRow.tsx` | **Create** — the mark and its inline explanation |
| `src/components/tabs/bill-check/BillCheckAttentionBanner.tsx` | **Create** — claim-level banner and bulk actions |
| `src/components/tabs/bill-check/BillCheckGrid.tsx` | **Modify** — render mark and explanation, pass flags down |
| `src/components/tabs/BillCheckTab.tsx` | **Modify** — banner, reconciliation, extended print gate |
| `src/stores/slices/aiDataSlice.ts` | **Modify** — stop writing `'partial'` |
| `src/stores/slices/assessmentSlice.ts` | **Modify** — stop writing `'partial'` |

Part 1 is Tasks 1–4 and deploys without Parts 2 or 3.

---

# PART 1 — The numbers

### Task 1: Estimates stop being filtered in the engine

**Files:**
- Modify: `src/lib/calculations/assessment.ts:145`
- Test: `src/lib/calculations/__tests__/estimate-totals.test.ts` (create)

**Interfaces:**
- Produces: `calculateAssessmentSummary(...).estimatePartsBase` now equals the sum of `estimateMetalBase + estimatePlasticBase + estimateGlassBase + estimateFiberglassBase`. Task 2 depends on this holding.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/estimate-totals.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { calculateAssessmentSummary, getVehicleAgeMonths } from '../index';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
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

const AGE = getVehicleAgeMonths('2024-08-05', 2024, '2026-08-05T10:00');
const sum = (rows: AssessmentRow[]) => calculateAssessmentSummary(rows, AGE, 'nil', 0, 0, 0);

describe('estimate totals are a fact about the garage document', () => {
  test('a rejected part still counts toward the parts estimate', () => {
    const s = sum([
      row({ estimated: 10000, assessed: 10000 }),
      row({ estimated: 2000, assessed: 0, allowed: false }),
    ]);
    expect(s.estimatePartsBase).toBe(12000);
  });

  // The engine used to filter the material split but not the total, so these
  // two disagreed and any report printing both showed a breakdown that did
  // not sum to its own heading.
  test('the parts estimate equals the sum of its material parts', () => {
    const s = sum([
      row({ estimated: 10000, assessed: 10000, partType: 'metal' }),
      row({ estimated: 2000, assessed: 0, partType: 'metal', allowed: false }),
      row({ estimated: 3000, assessed: 3000, partType: 'glass' }),
    ]);
    const materials =
      s.estimateMetalBase + s.estimatePlasticBase + s.estimateGlassBase + s.estimateFiberglassBase;
    expect(materials).toBe(s.estimatePartsBase);
    expect(s.estimatePartsBase).toBe(15000);
  });

  test('a rejected labour line still counts toward the labour estimate', () => {
    const s = sum([
      row({ section: 'labour', partType: 'labour', estimated: 1000, assessed: 1000 }),
      row({ section: 'labour', partType: 'labour', estimated: 400, assessed: 0, allowed: false }),
    ]);
    expect(s.estimateLabourOnlyBase).toBe(1400);
  });

  test('assessed totals are unaffected — rejected rows still carry no money', () => {
    const s = sum([
      row({ estimated: 10000, assessed: 10000 }),
      row({ estimated: 2000, assessed: 0, allowed: false }),
    ]);
    expect(s.partsBase).toBe(10000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/estimate-totals.test.ts`
Expected: FAIL — the material sum reads 13,000 against `estimatePartsBase` of 15,000

- [ ] **Step 3: Remove the guard**

In `src/lib/calculations/assessment.ts`, the parts branch currently reads:

```ts
      estPartsBase += r.estimated;
      // Disposal parts carry no GST on the estimate either
      if (!r.isDisposal) estPartsGST += r.estimated * gstRate;
      if (r.allowed) {
        if (r.partType === 'metal') estMetal += r.estimated;
        else if (r.partType === 'glass') estGlass += r.estimated;
        else if (r.partType === 'fiberglass') estFiberglass += r.estimated;
        else estPlastic += r.estimated;
      }
```

Replace with:

```ts
      estPartsBase += r.estimated;
      // Disposal parts carry no GST on the estimate either
      if (!r.isDisposal) estPartsGST += r.estimated * gstRate;
      // No `allowed` guard. An estimate is a fact about the garage's document;
      // nothing the surveyor decides changes what was estimated. The guard used
      // to sit here made this split disagree with estPartsBase directly above.
      if (r.partType === 'metal') estMetal += r.estimated;
      else if (r.partType === 'glass') estGlass += r.estimated;
      else if (r.partType === 'fiberglass') estFiberglass += r.estimated;
      else estPlastic += r.estimated;
```

Also update the stale comment above the accumulator declarations — it currently reads `// Per-material estimate (allowed parts only) — pairs with assessed metal/plastic/... totals`:

```ts
  // Per-material estimate, every row — pairs with the assessed material totals,
  // which ARE allowed-only, because an estimate and an assessment answer
  // different questions.
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/calculations/__tests__/estimate-totals.test.ts`
Expected: PASS — 4 passed

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass. This changes the on-screen Assessment tab and the UIIC Bill Check summary too, both of which read these fields; nothing should break, but a failure here means a test encoded the old contradiction.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/assessment.ts src/lib/calculations/__tests__/estimate-totals.test.ts
git commit -m "fix(calc): stop filtering the per-material estimate split

calculateAssessmentSummary summed estimatePartsBase over every row but
split it by material over allowed rows only, so the two disagreed. Any
report printing both showed a Spare Parts heading above a breakdown that
did not add up to it — the UIIC Bill Check summary and the Assessment
tab on screen both do.

An estimate is a fact about the garage's document. The assessed totals
stay allowed-only, because an estimate and an assessment answer
different questions."
```

---

### Task 2: The Standard builder reads the engine's estimates

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts:140-145` (delete), §8 header and rows
- Test: `src/lib/reports/__tests__/standard-bill-check.test.ts` (extend)

**Interfaces:**
- Consumes: `summary.estimatePartsBase`, `.estimateMetalBase`, `.estimatePlasticBase`, `.estimateGlassBase`, `.estimateFiberglassBase`, `.estimateLabourOnlyBase`, `.estimatePaintOnlyBase`, `.estimateLabourBase` — all already returned by `calculateAssessmentSummary`
- Produces: local names `estPartsBase`, `estMetal`, `estPlastic`, `estGlass`, `estFbr`, `estLabOnly`, `estPaintOnly`, `estLabBase` keep their identifiers so §8's markup needs no edit beyond the header

- [ ] **Step 1: Write the failing test**

Append to `src/lib/reports/__tests__/standard-bill-check.test.ts`:

```ts
describe('Standard report — the Estimated column states the garage estimate', () => {
  test('a rejected item still counts, and the column says its basis', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 10000, assessed: 10000 }),
      row({ particulars: 'REJECTED', estimated: 2000, assessed: 0, allowed: false }),
      row({ particulars: 'LAB', section: 'labour', partType: 'labour', estimated: 1000, assessed: 1000 }),
    ]), profile, 'final');

    expect(html).toContain('Estimated (before GST)');
    const sec8 = html.split('8. ASSESSMENT SUMMARY')[1].split('</table>')[0];
    // Parts estimate is 12,000 — the garage's figure, not the 10,000 allowed
    expect(sec8).toContain('12,000.00');
    // Grand total estimate is 13,000
    expect(sec8).toContain('13,000.00');
  });

  test('section 8 reconciles with the narrative paragraph', () => {
    const c = claim([
      row({ particulars: 'KEPT', estimated: 10000, assessed: 10000 }),
      row({ particulars: 'REJECTED', estimated: 2000, assessed: 0, allowed: false }),
      row({ particulars: 'LAB', section: 'labour', partType: 'labour', estimated: 1000, assessed: 1000 }),
    ]);
    const html = buildStandardFinalSurveyHTML(c, profile, 'final');
    // Narrative quotes the GST-inclusive estimate: 13,000 x 1.18 = 15,340
    expect(html).toContain('15,340.00');
    // Section 8 quotes the same figure before GST
    expect(html.split('8. ASSESSMENT SUMMARY')[1].split('</table>')[0]).toContain('13,000.00');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts -t 'Estimated column'`
Expected: FAIL — `Estimated (before GST)` absent, and §8 shows 10,000 / 11,000

- [ ] **Step 3: Delete the private accumulators**

In `src/lib/reports/standard-report-builder.ts`, delete these five lines entirely:

```ts
  const estPartsBase = rows.filter(r => r.section === 'parts' && r.allowed !== false).reduce((s, r) => s + r.estimated, 0);
  const estByType = (t: string) => rows.filter(r => r.section === 'parts' && r.allowed !== false && r.partType === t).reduce((s, r) => s + r.estimated, 0);
  const estMetal = estByType('metal'), estPlastic = estByType('plastic'), estGlass = estByType('glass'), estFbr = estByType('fiberglass');
  const estLabOnly = rows.filter(r => r.section === 'labour' && r.allowed !== false).reduce((s, r) => s + r.estimated, 0);
  const estPaintOnly = rows.filter(r => r.section === 'paint' && r.allowed !== false).reduce((s, r) => s + r.estimated, 0);
```

Replace with reads from the summary the builder already computed above:

```ts
  // The engine already derives every one of these. This file used to compute
  // its own, filtered by `allowed`, and the two drifted — the builder printed
  // an estimate that excluded whatever the surveyor rejected, which is the one
  // thing the Estimated column exists to show.
  const estPartsBase = summary.estimatePartsBase;
  const estMetal = summary.estimateMetalBase;
  const estPlastic = summary.estimatePlasticBase;
  const estGlass = summary.estimateGlassBase;
  const estFbr = summary.estimateFiberglassBase;
  const estLabOnly = summary.estimateLabourOnlyBase;
  const estPaintOnly = summary.estimatePaintOnlyBase;
```

The existing line `const estLabBase = estLabOnly + estPaintOnly;` stays as it is.

- [ ] **Step 4: Label the column**

In §8's header row, replace:

```ts
      <th style="${th};text-align:right;">${isBillCheck ? 'Billed' : 'Estimated'}</th>
```

with:

```ts
      <th style="${th};text-align:right;">${isBillCheck ? 'Billed' : 'Estimated (before GST)'}</th>
```

Bill-check mode keeps `Billed` — that column carries the invoice figure, and the narrative for bill check quotes the invoice total rather than an estimate, so there is no basis to disambiguate.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts` → all pass
Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/standard-bill-check.test.ts
git commit -m "fix(report): state the garage's estimate in section 8

The builder computed its own estimate totals filtered by allowed,
duplicating the engine and drifting from it. On a claim with a rejected
item the page contradicted itself: the narrative quoted the full
estimate and section 8 quoted a smaller one.

Worse, the Estimated column exists to show what the surveyor cut, so
filtering it by what was allowed hid the surveyor's own deduction.

The engine already exposes all seven figures. The duplication was the
bug, so it is deleted rather than patched. Column now names its basis,
so it visibly reconciles with the paragraph above it."
```

---

### Task 3: Per-section Estimate and Assessed subtotals

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts` (three §9 subtotal rows)
- Test: `src/lib/reports/__tests__/standard-bill-check.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

```ts
describe('Standard report — section 9 subtotals', () => {
  test('each section subtotals its Estimate and Assessed columns', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'P1', estimated: 10000, assessed: 9000 }),
      row({ particulars: 'P2', estimated: 2000, assessed: 1500 }),
      row({ particulars: 'L1', section: 'labour', partType: 'labour', estimated: 800, assessed: 700 }),
    ]), profile, 'final');

    const sec9 = html.split('9. DETAILS OF ASSESSMENT')[1].split('</table>')[0];
    const partsSub = sec9.slice(sec9.indexOf('Sub-Total Parts'), sec9.indexOf('LABOUR'));
    expect(partsSub).toContain('12,000.00'); // estimate 10,000 + 2,000
    expect(partsSub).toContain('10,500.00'); // assessed 9,000 + 1,500

    const labSub = sec9.slice(sec9.indexOf('Sub-Total Labour'));
    expect(labSub).toContain('800.00');
    expect(labSub).toContain('700.00');
  });

  test('every row still spans the full column count', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'P1', estimated: 10000, assessed: 9000 }),
      row({ particulars: 'L1', section: 'labour', partType: 'labour', estimated: 800, assessed: 700 }),
      row({ particulars: 'T1', section: 'paint', partType: 'paint', estimated: 900, assessed: 900 }),
    ]), profile, 'final');
    const sec9 = html.split('9. DETAILS OF ASSESSMENT')[1].split('</table>')[0];
    const spans = (tr: string) => [...tr.matchAll(/<t[dh]\b[^>]*>/g)]
      .reduce((n, c) => n + (Number((/colspan="(\d+)"/.exec(c[0]) || [])[1]) || 1), 0);
    const rows_ = sec9.split('<tr').slice(1);
    const counts = new Set(rows_.map(spans));
    expect(counts.size, `rows span differing column counts: ${[...counts].join(', ')}`).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts -t 'section 9 subtotals'`
Expected: FAIL — `12,000.00` absent from the parts subtotal; the label's `colspan="6"` covers those columns

- [ ] **Step 3: Add the raw assessed accumulators**

Immediately after the `const estLabBase = estLabOnly + estPaintOnly;` line, add:

```ts
  // Section 9's Assessed column prints the pre-depreciation figure, so its
  // subtotal must too. The engine only exposes post-depreciation totals, which
  // is a different number and belongs in a different column.
  const rawAssessed = (section: 'parts' | 'labour' | 'paint') =>
    rows.filter(r => r.section === section && r.allowed !== false).reduce((s, r) => s + r.assessed, 0);
  const assessedPartsRaw = rawAssessed('parts');
  const assessedLabourRaw = rawAssessed('labour');
  const assessedPaintRaw = rawAssessed('paint');
```

- [ ] **Step 4: Rebuild the three subtotal rows**

Replace the parts subtotal row:

```ts
    <tr>
      <td colspan="6" style="${sub}text-align:right;font-size:${scale.labelFont};">Sub-Total Parts (after dep, before GST)</td>
      <td style="${sub}text-align:right;">${m9(metal)}</td>
```

with:

```ts
    <tr>
      <td colspan="3" style="${sub}text-align:right;font-size:${scale.labelFont};">Sub-Total Parts (after dep, before GST)</td>
      <td style="${sub}text-align:right;">${m9(estPartsBase)}</td>
      <td style="${sub}text-align:right;">${m9(assessedPartsRaw)}</td>
      <td style="${sub}text-align:center;">—</td>
      <td style="${sub}text-align:right;">${m9(metal)}</td>
```

Replace the labour subtotal row:

```ts
    <tr>
      <td colspan="6" style="${sub}text-align:right;font-size:${scale.labelFont};">Sub-Total Labour (incl. GST)</td>
      <td colspan="${NMAT + 1}" style="${sub}text-align:right;">${m9(labOnlyBase)}</td>
      <td style="${sub}text-align:right;font-weight:700;">${m9(labT)}</td>
    </tr>
```

with:

```ts
    <tr>
      <td colspan="3" style="${sub}text-align:right;font-size:${scale.labelFont};">Sub-Total Labour (incl. GST)</td>
      <td style="${sub}text-align:right;">${m9(estLabOnly)}</td>
      <td style="${sub}text-align:right;">${m9(assessedLabourRaw)}</td>
      <td style="${sub}text-align:center;">—</td>
      <td colspan="${NMAT + 1}" style="${sub}text-align:right;">${m9(labOnlyBase)}</td>
      <td style="${sub}text-align:right;font-weight:700;">${m9(labT)}</td>
    </tr>
```

Replace the painting subtotal row:

```ts
    <tr>
      <td colspan="6" style="${sub}text-align:right;font-size:${scale.labelFont};">Sub-Total Painting (incl. GST)</td>
      <td colspan="${NMAT + 1}" style="${sub}text-align:right;">${m9(paintOnlyBase)}</td>
      <td style="${sub}text-align:right;font-weight:700;">${m9(paintT)}</td>
    </tr>
```

with:

```ts
    <tr>
      <td colspan="3" style="${sub}text-align:right;font-size:${scale.labelFont};">Sub-Total Painting (incl. GST)</td>
      <td style="${sub}text-align:right;">${m9(estPaintOnly)}</td>
      <td style="${sub}text-align:right;">${m9(assessedPaintRaw)}</td>
      <td style="${sub}text-align:center;">—</td>
      <td colspan="${NMAT + 1}" style="${sub}text-align:right;">${m9(paintOnlyBase)}</td>
      <td style="${sub}text-align:right;font-weight:700;">${m9(paintT)}</td>
    </tr>
```

Column arithmetic, unchanged at `NCOLS = 8 + NMAT` for all three: 3 (label) + 1 (Est) + 1 (Assessed) + 1 (Dep%) + NMAT + 1 (GST%) + 1 (Price+GST) for parts; 3 + 1 + 1 + 1 + (NMAT + 1) + 1 for labour and painting.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts` → all pass
Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/standard-bill-check.test.ts
git commit -m "feat(report): subtotal the Estimate and Assessed columns

Section 9 subtotalled its material columns and Price+GST but not the two
money columns a reader compares first. The label spanned six columns and
swallowed them.

Label now spans three. Assessed subtotals use a pre-depreciation sum,
matching what that column prints — the engine only exposes the
post-depreciation figure, which belongs in a different column."
```

---

### Task 4: §8's Billed total ties to the invoice

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts` (§8, after GRAND TOTAL)
- Test: `src/lib/reports/__tests__/standard-bill-check.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1 and 2 — with estimates unfiltered, §8's Billed grand total in bill-check mode already sums every row's `billedTaxable`, including rows rejected at final survey. This task explains that figure rather than computing it.

- [ ] **Step 1: Write the failing test**

```ts
describe('Standard Bill Check — billed but rejected', () => {
  test('the Billed total ties to the invoice, with one line explaining the gap', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 12000, assessed: 12000, billedTaxable: 12000 }),
      row({ particulars: 'SEATCOVERS', estimated: 2400, assessed: 0, allowed: false, billedTaxable: 2400 }),
    ]), profile, 'bill-check');

    const sec8 = html.split('8. ASSESSMENT SUMMARY')[1].split('</table>')[0];
    expect(sec8).toContain('14,400.00');                              // invoice figure
    expect(sec8).toContain('billed for items rejected at survey');
    expect(sec8).toContain('2,400.00');                               // the deduction
    expect(sec8).toContain('12,000.00');                              // ties to section 9
  });

  test('three rejected items still produce one line', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 12000, assessed: 12000, billedTaxable: 12000 }),
      row({ particulars: 'R1', estimated: 800, assessed: 0, allowed: false, billedTaxable: 800 }),
      row({ particulars: 'R2', estimated: 800, assessed: 0, allowed: false, billedTaxable: 800 }),
      row({ particulars: 'R3', estimated: 800, assessed: 0, allowed: false, billedTaxable: 800 }),
    ]), profile, 'bill-check');
    const sec8 = html.split('8. ASSESSMENT SUMMARY')[1].split('</table>')[0];
    const occurrences = sec8.split('billed for items rejected at survey').length - 1;
    expect(occurrences).toBe(1);
    expect(sec8).toContain('2,400.00'); // 800 x 3, aggregated
  });

  test('nothing appears when no rejected item was billed', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 12000, assessed: 12000, billedTaxable: 12000 }),
      row({ particulars: 'REJECTED', estimated: 900, assessed: 0, allowed: false }),
    ]), profile, 'bill-check');
    expect(html).not.toContain('billed for items rejected at survey');
  });

  test('never appears in the final report', () => {
    const html = buildStandardFinalSurveyHTML(claim([
      row({ particulars: 'KEPT', estimated: 12000, assessed: 12000, billedTaxable: 12000 }),
      row({ particulars: 'SEATCOVERS', estimated: 2400, assessed: 0, allowed: false, billedTaxable: 2400 }),
    ]), profile, 'final');
    expect(html).not.toContain('billed for items rejected at survey');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts -t 'billed but rejected'`
Expected: FAIL — no such line in §8

- [ ] **Step 3: Compute the rejected-but-billed total**

After the `assessedPaintRaw` line added in Task 3, add:

```ts
  // Money on the workshop's invoice for items rejected at final survey. Section
  // 9 excludes those rows, so without this the summary and the table below it
  // would differ with nothing on the page saying why. One line however many
  // items — the Final Survey Report lists each of them as NOT ALLOWED, and the
  // serial gaps point at them, so the detail already exists elsewhere.
  const rejectedBilledTotal = isBillCheck
    ? rows.filter(r => r.allowed === false).reduce((s, r) => s + (r.billedTaxable ?? 0), 0)
    : 0;
```

- [ ] **Step 4: Add the two rows to §8**

In §8, immediately after the `GRAND TOTAL` row and before `Less: Policy Excess`, insert:

```ts
    ${rejectedBilledTotal > 0 ? `
    <tr>
      <td style="${td}">Less: billed for items rejected at survey</td>
      <td style="${tdr}">( ${fa(rejectedBilledTotal)} )</td>
      <td colspan="2" style="border:0.4pt solid #bbb;"></td>
    </tr>
    <tr>
      <td style="${td}font-weight:700;">Billed against allowed items</td>
      <td style="${tdr}font-weight:700;">${fa(estPartsBase + estLabBase - rejectedBilledTotal)}</td>
      <td colspan="2" style="border:0.4pt solid #bbb;"></td>
    </tr>` : ''}
```

Both rows carry four columns, matching §8's `Head | Billed | Assessed | Incl. GST` layout: label, figure, then a two-column spacer.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts` → all pass
Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

- [ ] **Step 6: Commit and deploy Part 1**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/standard-bill-check.test.ts
git commit -m "feat(bill-check): tie section 8's Billed total to the invoice

A workshop billing for an item rejected at final survey put money on the
invoice that section 9 excludes, so the summary and the table disagreed
with nothing explaining it.

Section 8 now states the invoice figure and deducts the rejected total in
one line, however many items — the Final Survey Report already lists each
one as NOT ALLOWED with the serial gaps pointing at them."
```

Part 1 is complete and independently deployable. Build and deploy before starting Part 2:

```bash
npm run build
npx firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in
```

---

# PART 2 — The cap

### Task 5: Billed caps assessed, per item

**Files:**
- Modify: `src/lib/reports/bill-check-projection.ts`
- Test: `src/lib/reports/__tests__/bill-check-projection.test.ts` (extend)

**Interfaces:**
- Produces: `billCheckAssessed` gains the cap. Its three existing callers — the report projection, the grid's derived cells, the missing-remark check — pick it up with no change of their own.

- [ ] **Step 1: Write the failing tests**

```ts
describe('billed is the cap per item', () => {
  test('a bill below the assessment caps the claim', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 700 }))).toBe(700);
  });

  test('a bill above the assessment does not raise it', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 1200 }))).toBe(1000);
  });

  test('no billed figure means nothing to cap against', () => {
    expect(billCheckAssessed(row({ assessed: 1000 }))).toBe(1000);
  });

  test('a billed figure of zero caps to zero', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 0 }))).toBe(0);
  });

  test('an explicit allowance overrides the cap downward', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 700, billAllowed: 500 }))).toBe(500);
  });

  test('an explicit allowance overrides the cap upward', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 1200, billAllowed: 1200 }))).toBe(1200);
  });

  test('not-in-bill still wins over everything', () => {
    expect(billCheckAssessed(row({ assessed: 1000, billedTaxable: 700, billStatus: 'not-in-bill' }))).toBe(0);
  });
});
```

Add to `src/lib/reports/__tests__/standard-bill-check.test.ts` the guard that matters most:

```ts
  test('the cap NEVER reaches the Final Survey Report', () => {
    const c = claim([row({ particulars: 'BONNET', estimated: 1000, assessed: 1000, billedTaxable: 700 })]);
    const final = buildStandardFinalSurveyHTML(c, profile, 'final');
    expect(final).toContain('1,000');
    expect(final).not.toContain('700.00');
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-projection.test.ts -t 'cap per item'`
Expected: FAIL — a 700 bill against 1,000 assessed returns 1,000

- [ ] **Step 3: Apply the cap**

Replace `billCheckAssessed` entirely:

```ts
/**
 * The assessed figure this document works from.
 *
 * What is billed is the cap per item: the insurer pays no more than the
 * workshop charged. A bill above the assessment does not raise it — the
 * assessment is already the lower figure and the cap does not bite.
 *
 * `billAllowed` overrides the cap in either direction; it is the surveyor
 * deliberately allowing something other than min(assessed, billed), and the
 * flag that offers it demands a remark.
 *
 * One definition, three callers: the report's projection, the grid's derived
 * cells, and the missing-remark check.
 */
export function billCheckAssessed(r: AssessmentRow): number {
  if (r.billStatus === 'not-in-bill') return 0;
  if (r.billAllowed !== undefined) return r.billAllowed;
  if (r.billedTaxable === undefined) return r.assessed;
  return Math.min(r.assessed, r.billedTaxable);
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-projection.test.ts` → all pass
Run: `npx vitest run src/lib/reports/__tests__/standard-bill-check.test.ts` → all pass
Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass. A failure in `bill-check-report.test.ts` means an existing test encoded the uncapped behaviour — read it before changing it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/bill-check-projection.ts src/lib/reports/__tests__/bill-check-projection.test.ts src/lib/reports/__tests__/standard-bill-check.test.ts
git commit -m "feat(bill-check): apply the billed amount as the cap per item

The insurer pays no more than the workshop charged, but nothing
implemented that — projectForBillCheck read billAllowed ?? assessed and
never consulted billedTaxable, so a 700 bill against a 1000 assessment
still claimed 1000.

A bill above the assessment does not raise it; the assessment is already
lower and the cap does not bite. billAllowed remains the deliberate
override in either direction.

The Final Survey Report does not call this function and a test pins that
it never sees a capped figure."
```

---

# PART 3 — The flags

### Task 6: `billVerified`, and `partial` is retired

**Files:**
- Modify: `src/types/assessment.ts` (both `AssessmentRow` and `BillStatus`)
- Modify: `src/components/tabs/bill-check/config.ts` (its own `BillStatus` copy and `statusLabel`)
- Modify: `src/stores/slices/aiDataSlice.ts:568`
- Modify: `src/stores/slices/assessmentSlice.ts:264`
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx` (the status `<select>`)
- Modify: `src/components/tabs/BillCheckTab.tsx` (`partialTotal`)

**Interfaces:**
- Produces: `billVerified?: boolean` on `AssessmentRow`. Task 7 reads it.

- [ ] **Step 1: Add the field**

In `src/types/assessment.ts`, after `billAllowed`:

```ts
  /**
   * The surveyor has looked at this row's billed figure against the bill.
   *
   * Set by either button on a divergence flag. Nothing else derives from it —
   * the flag itself is computed, not stored — but printing is gated on every
   * divergent row carrying it.
   */
  billVerified?: boolean;
```

- [ ] **Step 2: Retire `partial`**

`partial` changes no arithmetic anywhere. `applyFinalBill` set it when the billed figure differed from the **estimate**, which is a real signal but the wrong comparison — the cap and the flags compare against the **assessment**. The derived flag in Task 7 subsumes it.

In `src/types/assessment.ts`:

```ts
export type BillStatus = 'in-bill' | 'not-in-bill' | 'pending' | 'not-allowed';
```

In `src/components/tabs/bill-check/config.ts`, the same union, and delete the `'partial'` case from `statusLabel`:

```ts
export type BillStatus = 'in-bill' | 'not-in-bill' | 'pending' | 'not-allowed';
```

```ts
export function statusLabel(s: BillStatus) {
  switch (s) {
    case 'in-bill':     return { label: 'In Bill',        color: '#059669', bg: 'rgba(5,150,105,0.1)' };
    case 'not-in-bill': return { label: 'Not in Bill',    color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
    case 'not-allowed': return { label: 'Not Allowed',    color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
    default:            return { label: 'Pending Review', color: '#8D99AE', bg: 'rgba(141,153,174,0.1)' };
  }
}
```

In `src/stores/slices/aiDataSlice.ts`, replace:

```ts
    const status: 'in-bill' | 'partial' = partial ? 'partial' : 'in-bill';
    const remark = m.ambiguous ? 'Ambiguous match — please verify' : row.billRemarks;
    return { ...row, billedTaxable: billedTax, billedAmount: billedAmt, billStatus: status, billRemarks: remark };
```

with:

```ts
    // The bill differing from the estimate is exactly the surveyor's "wrong
    // pricings during estimates which are later corrected". It is surfaced as
    // a divergence flag against the ASSESSMENT, which is what drives the cap,
    // rather than as a status against the estimate that changed no arithmetic.
    const remark = m.ambiguous ? 'Ambiguous match — please verify' : row.billRemarks;
    return { ...row, billedTaxable: billedTax, billedAmount: billedAmt, billStatus: 'in-bill' as const, billRemarks: remark };
```

The now-unused `partial` local and the `AMT_TOL` constant above it become dead — delete both.

In `src/stores/slices/assessmentSlice.ts:264`, replace `billStatus: partial ? ('partial' as const) : ('in-bill' as const)` with `billStatus: 'in-bill' as const`, and delete whatever local computes `partial` there if it becomes unused.

In `BillCheckGrid.tsx`, delete the option from the status dropdown:

```tsx
                    <option value="partial">Partial</option>
```

In `BillCheckTab.tsx`, delete the `partialTotal` line and its use in `<BillCheckSummaryPanel partialTotal={…} />`, and the corresponding prop in `BillCheckSummaryPanel`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → exit 0. Any error naming `'partial'` is a site the compiler found that this list missed — fix it there.
Run: `npx vitest run` → all pass

- [ ] **Step 4: Commit**

```bash
git add src/types/assessment.ts src/components/tabs/bill-check/config.ts src/stores/slices/aiDataSlice.ts src/stores/slices/assessmentSlice.ts src/components/tabs/bill-check/BillCheckGrid.tsx src/components/tabs/BillCheckTab.tsx src/components/tabs/bill-check/BillCheckSummaryPanel.tsx
git commit -m "refactor(bill-check): add billVerified, retire partial

partial changed no arithmetic anywhere. It was set when the billed
figure differed from the estimate — a real signal, but the wrong
comparison: the cap and the flags both measure against the assessment.

billVerified records that the surveyor has looked at a divergent row.
The divergence itself stays derived rather than stored."
```

---

### Task 7: The flag engine

**Files:**
- Create: `src/lib/reports/bill-check-flags.ts`
- Test: `src/lib/reports/__tests__/bill-check-flags.test.ts` (create)

**Interfaces:**
- Consumes: `billCheckAssessed` (Task 5), `billVerified` (Task 6)
- Produces:
  - `type BillFlagKind = 'billed-below' | 'billed-above' | 'billed-rejected' | 'ambiguous'`
  - `interface BillFlag { rowId, kind, blocking, estimate, assessed, billed, delta, heading, detail }`
  - `billCheckFlags(rows: AssessmentRow[]): BillFlag[]`
  - `interface InvoiceReconciliation { lineTotal, invoiceTotal, gap, reconciles }`
  - `reconcileInvoice(rows: AssessmentRow[], invoiceTotal: number): InvoiceReconciliation`

  Tasks 8, 9 and 10 consume all of these.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reports/__tests__/bill-check-flags.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { billCheckFlags, reconcileInvoice } from '../bill-check-flags';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
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

describe('billCheckFlags', () => {
  test('a row where the bill agrees with the assessment never flags', () => {
    expect(billCheckFlags([row({ assessed: 1000, billedTaxable: 1000 })])).toHaveLength(0);
  });

  test('a row with no billed figure never flags — that is the pending gate', () => {
    expect(billCheckFlags([row({ assessed: 1000 })])).toHaveLength(0);
  });

  test('billed below the assessment flags, and blocks', () => {
    const [f] = billCheckFlags([row({ estimated: 8500, assessed: 8500, billedTaxable: 6000 })]);
    expect(f.kind).toBe('billed-below');
    expect(f.blocking).toBe(true);
    expect(f.delta).toBe(-2500);
    expect(f.heading).toBe('The workshop billed less than you allowed');
  });

  test('billed above the assessment flags, and blocks', () => {
    const [f] = billCheckFlags([row({ estimated: 6200, assessed: 6200, billedTaxable: 7400 })]);
    expect(f.kind).toBe('billed-above');
    expect(f.blocking).toBe(true);
    expect(f.delta).toBe(1200);
  });

  // The third number does the diagnosing.
  test('billed above, estimate allowed in full — the estimate underpriced it', () => {
    const [f] = billCheckFlags([row({ estimated: 6200, assessed: 6200, billedTaxable: 7400 })]);
    expect(f.detail).toContain('allowed the estimate in full');
  });

  test('billed above, estimate cut at survey — the workshop is pushing back', () => {
    const [f] = billCheckFlags([row({ estimated: 9800, assessed: 7000, billedTaxable: 9200 })]);
    expect(f.detail).toContain('reduced this');
    expect(f.detail).not.toContain('allowed the estimate in full');
  });

  test('a verified row stops flagging', () => {
    const flags = billCheckFlags([
      row({ assessed: 8500, billedTaxable: 6000, billVerified: true }),
    ]);
    expect(flags).toHaveLength(0);
  });

  test('a rejected item the workshop billed flags, but advises only', () => {
    const [f] = billCheckFlags([row({ assessed: 0, allowed: false, billedTaxable: 2400 })]);
    expect(f.kind).toBe('billed-rejected');
    expect(f.blocking).toBe(false);
  });

  test('a rejected item nobody billed does not flag', () => {
    expect(billCheckFlags([row({ assessed: 0, allowed: false })])).toHaveLength(0);
  });

  test('a low-confidence match advises', () => {
    const [f] = billCheckFlags([
      row({ assessed: 1000, billedTaxable: 1000, billRemarks: 'Ambiguous match — please verify' }),
    ]);
    expect(f.kind).toBe('ambiguous');
    expect(f.blocking).toBe(false);
  });

  test('a not-in-bill row is the print gate’s business, not this one’s', () => {
    expect(billCheckFlags([row({ assessed: 1000, billStatus: 'not-in-bill', billedTaxable: 0 })])).toHaveLength(0);
  });
});

describe('reconcileInvoice', () => {
  test('line items matching the invoice reconcile', () => {
    // 10,000 at 18% = 11,800
    const r = reconcileInvoice([row({ assessed: 10000, billedTaxable: 10000, gst: 18 })], 11800);
    expect(r.reconciles).toBe(true);
    expect(r.gap).toBe(0);
  });

  test('a missed line shows as a gap', () => {
    const r = reconcileInvoice([row({ assessed: 10000, billedTaxable: 10000, gst: 18 })], 14200);
    expect(r.reconciles).toBe(false);
    expect(r.gap).toBe(2400);
  });

  test('rounding under a rupee is not a gap', () => {
    const r = reconcileInvoice([row({ assessed: 10000, billedTaxable: 10000, gst: 18 })], 11800.4);
    expect(r.reconciles).toBe(true);
  });

  test('each line is taxed at its own rate', () => {
    // 10,000 at 18% = 11,800 and 5,000 at 28% = 6,400 → 18,200
    const r = reconcileInvoice([
      row({ assessed: 10000, billedTaxable: 10000, gst: 18 }),
      row({ assessed: 5000, billedTaxable: 5000, gst: 28 }),
    ], 18200);
    expect(r.reconciles).toBe(true);
  });

  test('an invoice total of zero is not yet entered, so it cannot fail', () => {
    expect(reconcileInvoice([row({ billedTaxable: 10000 })], 0).reconciles).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-flags.test.ts`
Expected: FAIL — `Failed to resolve import "../bill-check-flags"`

- [ ] **Step 3: Write the module**

Create `src/lib/reports/bill-check-flags.ts`:

```ts
import type { AssessmentRow } from '@/types/assessment';

/**
 * What the Bill Check screen has noticed and the surveyor has not yet answered.
 *
 * Screen only — none of this is ever printed. It is a check for the surveyor,
 * not a statement to the insurer, and it is resolved or accepted before the
 * report exists.
 *
 * Lives beside the projection rather than under lib/calculations so bill-check
 * logic stays together and the dependency runs reports → calculations, never
 * back.
 */
export type BillFlagKind =
  | 'billed-below'     // cap bit; the claim already dropped
  | 'billed-above'     // the assessment holds; the surveyor may raise it
  | 'billed-rejected'  // the workshop billed for something rejected at survey
  | 'ambiguous';       // the bill was read with low confidence

export interface BillFlag {
  rowId: string;
  kind: BillFlagKind;
  /** Blocks printing until the row is verified. */
  blocking: boolean;
  estimate: number;
  assessed: number;
  billed: number;
  /** billed − assessed. Negative when the bill came in lower. */
  delta: number;
  heading: string;
  detail: string;
}

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rs = (n: number) => `₹${INR.format(n)}`;

/**
 * Every row where the bill and the assessment disagree, plus the two advisory
 * cases the screen already detects and never showed.
 *
 * A row with no billed figure does not appear here: that is the pending gate's
 * business, and flagging it twice would say the same thing in two voices.
 */
export function billCheckFlags(rows: AssessmentRow[]): BillFlag[] {
  const flags: BillFlag[] = [];

  for (const r of rows) {
    const billed = r.billedTaxable;

    if (r.allowed === false) {
      if ((billed ?? 0) > 0) {
        flags.push({
          rowId: r.id,
          kind: 'billed-rejected',
          blocking: false,
          estimate: r.estimated,
          assessed: 0,
          billed: billed ?? 0,
          delta: billed ?? 0,
          heading: 'The workshop billed for an item you rejected',
          detail:
            `You disallowed this at final survey. The invoice bills ${rs(billed ?? 0)} for it. ` +
            `It carries no liability — the report shows it as billed against rejected items, ` +
            `so the insurer sees the claim was made and refused.`,
        });
      }
      continue;
    }

    if (r.billStatus === 'not-in-bill' || billed === undefined) continue;

    if (billed !== r.assessed && !r.billVerified) {
      const below = billed < r.assessed;
      // The estimate is what tells you WHY the bill differs, and it changes the
      // advice: a surveyor who allowed the estimate in full is looking at an
      // underpriced estimate, not a workshop pushing back on a cut.
      const allowedInFull = r.assessed >= r.estimated;
      flags.push({
        rowId: r.id,
        kind: below ? 'billed-below' : 'billed-above',
        blocking: true,
        estimate: r.estimated,
        assessed: r.assessed,
        billed,
        delta: billed - r.assessed,
        heading: below
          ? 'The workshop billed less than you allowed'
          : 'Priced higher than the estimate you assessed from',
        detail: below
          ? `You allowed ${rs(r.assessed)} and the invoice shows ${rs(billed)}. ` +
            `The claim is capped at the billed figure, so it now reads ${rs(billed)}. ` +
            `Check the bill was read correctly.`
          : allowedInFull
          ? `You allowed the estimate in full at ${rs(r.assessed)}. The workshop has invoiced ` +
            `${rs(billed)}, which suggests the estimate underpriced this item. ` +
            `The claim holds at ${rs(r.assessed)} unless you raise it.`
          : `You reduced this from the estimate of ${rs(r.estimated)} to ${rs(r.assessed)} at ` +
            `final survey, and the invoice has come back at ${rs(billed)}. ` +
            `The claim holds at ${rs(r.assessed)} unless you raise it.`,
      });
      continue;
    }

    if (r.billRemarks?.startsWith('Ambiguous match')) {
      flags.push({
        rowId: r.id,
        kind: 'ambiguous',
        blocking: false,
        estimate: r.estimated,
        assessed: r.assessed,
        billed,
        delta: billed - r.assessed,
        heading: 'This line was matched to the invoice with low confidence',
        detail: 'Check the billed figure against the bill before issuing.',
      });
    }
  }

  return flags;
}

export interface InvoiceReconciliation {
  /** Σ over billed rows of (billedTaxable + its own GST). */
  lineTotal: number;
  invoiceTotal: number;
  /** Absolute difference. */
  gap: number;
  reconciles: boolean;
}

/**
 * The invoice total the surveyor typed against the sum of the line items.
 *
 * No discounts exist in this domain, so a gap is always an error — a line
 * missed or misread when the bill was read. That means this warning has no
 * legitimate source of false positives, which is what makes it worth heeding.
 *
 * An invoice total of zero means it has not been entered yet, so nothing is
 * asserted about it.
 */
export function reconcileInvoice(rows: AssessmentRow[], invoiceTotal: number): InvoiceReconciliation {
  const lineTotal = rows.reduce((s, r) => {
    if (r.billedTaxable === undefined) return s;
    const gst = r.isDisposal ? 0 : (r.gst ?? 18) / 100;
    return s + r.billedTaxable * (1 + gst);
  }, 0);
  const gap = Math.abs(lineTotal - invoiceTotal);
  return {
    lineTotal,
    invoiceTotal,
    gap,
    reconciles: invoiceTotal === 0 || gap <= 1,
  };
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-flags.test.ts`
Expected: PASS — 16 passed

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/bill-check-flags.ts src/lib/reports/__tests__/bill-check-flags.test.ts
git commit -m "feat(bill-check): derive the divergence flags

One rule: any row where the bill and the assessment disagree needs the
surveyor's decision. Both directions, because both cost someone — billed
under over-claims against the insurer, billed over leaves the insured
paying the difference.

The estimate is the third number that says why, and it changes the
advice: a surveyor who allowed the estimate in full is looking at an
underpriced estimate, not a workshop pushing back on a cut.

Also surfaces two things the screen already detected and never showed —
a workshop billing for a rejected item, and a low-confidence read.

Reconciliation has no false-positive source: no discounts exist here, so
a gap is always a line missed or misread."
```

---

### Task 8: The mark and its explanation

**Files:**
- Create: `src/components/tabs/bill-check/BillCheckFlagRow.tsx`
- Modify: `src/components/tabs/bill-check/BillCheckGrid.tsx`

**Interfaces:**
- Consumes: `BillFlag` and `billCheckFlags` (Task 7), `AllowanceScopeDialog` (already built)
- Produces: `<BillCheckFlagMark flag={BillFlag} open={boolean} onToggle={() => void} />` and `<BillCheckFlagDetail flag={BillFlag} onConfirm={() => void} onRaise={(n: number) => void} colSpan={number} />`

- [ ] **Step 1: Create the component**

Create `src/components/tabs/bill-check/BillCheckFlagRow.tsx`:

```tsx
'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { BillFlag } from '@/lib/reports/bill-check-flags';

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rs = (n: number) => `₹${INR.format(n)}`;

/**
 * The mark sits in its own narrow column beside Sr, so one edge can be scanned
 * for every row wanting attention.
 */
export function BillCheckFlagMark({ flag, open, onToggle }: {
  flag: BillFlag; open: boolean; onToggle: () => void;
}) {
  const blocking = flag.blocking;
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      title={flag.heading}
      className="flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-bold"
      style={{
        background: blocking ? 'var(--color-status-danger)' : 'var(--color-status-warning)',
        color: '#fff',
      }}
    >
      {blocking ? '!' : '?'}
    </button>
  );
}

/**
 * Opened by clicking the mark, not by hovering. Hover cannot hold buttons you
 * need to press, vanishes on scroll, and does not exist on a tablet in a
 * workshop. This stays open until a decision is made.
 */
export function BillCheckFlagDetail({ flag, onConfirm, onRaise, colSpan }: {
  flag: BillFlag;
  onConfirm: () => void;
  onRaise: (amount: number) => void;
  colSpan: number;
}) {
  const blocking = flag.blocking;
  return (
    <div
      className="px-6 py-4"
      style={{
        gridColumn: `span ${colSpan}`,
        borderLeft: `4px solid ${blocking ? 'var(--color-status-danger)' : 'var(--color-status-warning)'}`,
        background: 'var(--color-neutral-50)',
      }}
    >
      <div className="flex items-start gap-2.5">
        {blocking
          ? <AlertTriangle size={16} className="text-status-danger shrink-0 mt-0.5" />
          : <Info size={16} className="text-status-warning shrink-0 mt-0.5" />}
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{flag.heading}</div>

          <div className="mt-2 grid gap-x-4 gap-y-1 text-xs" style={{ gridTemplateColumns: 'auto auto', width: 'fit-content' }}>
            <span className="text-muted-foreground">Estimate</span>
            <span className="text-right font-medium text-foreground">{rs(flag.estimate)}</span>
            <span className="text-muted-foreground">You allowed</span>
            <span className="text-right font-medium text-foreground">{rs(flag.assessed)}</span>
            <span className="text-muted-foreground">Invoice</span>
            <span className="text-right font-medium" style={{ color: blocking ? 'var(--color-status-danger)' : 'var(--color-status-warning)' }}>
              {rs(flag.billed)}
            </span>
          </div>

          <p className="text-xs mt-2.5 text-muted-foreground" style={{ maxWidth: '62ch', lineHeight: 1.6 }}>
            {flag.detail}
          </p>

          {(flag.kind === 'billed-below' || flag.kind === 'billed-above') && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onConfirm}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground"
              >
                Confirm {rs(flag.kind === 'billed-below' ? flag.billed : flag.assessed)}
              </button>
              <button
                onClick={() => onRaise(flag.billed)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground"
              >
                {flag.kind === 'billed-below' ? 'Allow a different amount' : `Raise to ${rs(flag.billed)}`}
              </button>
            </div>
          )}

          {!blocking && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onConfirm}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground"
              >
                Noted
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

`Confirm` is the default in both directions — the claim never rises without the surveyor pressing for it.

- [ ] **Step 2: Wire into the grid**

In `BillCheckGrid.tsx`, add the imports:

```tsx
import { billCheckFlags, type BillFlag } from '@/lib/reports/bill-check-flags';
import { BillCheckFlagMark, BillCheckFlagDetail } from './BillCheckFlagRow';
```

Beside the existing state:

```tsx
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  const flagsByRow = useMemo(() => {
    const m = new Map<string, BillFlag>();
    for (const f of billCheckFlags(allRows)) m.set(f.rowId, f);
    return m;
  }, [allRows]);
```

`useMemo` needs adding to the React import if absent.

Add a `28px` track to the front of `buildCols`, immediately after the checkbox column:

```tsx
    return ['32px', '28px', '50px', '2fr', ...detailCols, '100px', '70px', '100px', ...priceWithGstCol, ...billedTaxCol, '120px', ...remarksCol, '40px'].join(' ');
```

Add the matching header cell in `headerRow`, immediately after the select-all checkbox `<span>`:

```tsx
        <span></span>
```

Add the matching empty cell in `totalsRow`, immediately after its leading `<div /><div />` — that pair becomes three:

```tsx
        <div /><div /><div />
```

In the row render, immediately after the row checkbox cell, add the mark:

```tsx
                <div className="flex items-center justify-center">
                  {flagsByRow.get(row.id) && (
                    <BillCheckFlagMark
                      flag={flagsByRow.get(row.id)!}
                      open={openFlag === row.id}
                      onToggle={() => setOpenFlag(openFlag === row.id ? null : row.id)}
                    />
                  )}
                </div>
```

After the row's closing `</div>`, inside the same returned array, add the detail panel:

```tsx
              openFlag === row.id && flagsByRow.get(row.id) && (
                <BillCheckFlagDetail
                  key={`flag-${row.id}`}
                  flag={flagsByRow.get(row.id)!}
                  colSpan={gridCols.split(' ').length}
                  onConfirm={() => {
                    updateAssessmentRow(row.id, { billVerified: true });
                    setOpenFlag(null);
                  }}
                  onRaise={amount => {
                    updateAssessmentRow(row.id, { billVerified: true });
                    commitAllowance(row, amount);
                    setOpenFlag(null);
                  }}
                />
              ),
```

`onRaise` routes through `commitAllowance`, so raising above the assessment still opens `AllowanceScopeDialog` and *Bill Check only* stays the default.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

Then count cells by hand: `headerRow`, `totalsRow` and the row render must each emit the same number under the same visibility guards, and `buildCols` must emit that many tracks. A mismatch shifts every figure one column right.

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/bill-check/BillCheckFlagRow.tsx src/components/tabs/bill-check/BillCheckGrid.tsx
git commit -m "feat(bill-check): mark divergent rows and explain them in place

The mark sits in its own column beside Sr so one edge can be scanned for
everything wanting attention. Clicking it opens the explanation in
place — not a hover tooltip, which cannot hold buttons, vanishes on
scroll, and does not exist on a tablet in a workshop.

The panel shows estimate, assessed and billed together, because the
estimate is what says why the bill differs. Confirm is the default in
both directions; raising routes through the existing scope dialog so
Bill Check only stays the default there too."
```

---

### Task 9: The banner and bulk actions

**Files:**
- Create: `src/components/tabs/bill-check/BillCheckAttentionBanner.tsx`
- Modify: `src/components/tabs/BillCheckTab.tsx`

**Interfaces:**
- Consumes: `billCheckFlags`, `reconcileInvoice` (Task 7)
- Produces: `<BillCheckAttentionBanner flags={BillFlag[]} reconciliation={InvoiceReconciliation} onConfirmAllBelow={() => void} onKeepAllAbove={() => void} />`

- [ ] **Step 1: Create the banner**

Create `src/components/tabs/bill-check/BillCheckAttentionBanner.tsx`:

```tsx
'use client';

import { AlertTriangle, Ban } from 'lucide-react';
import type { BillFlag, InvoiceReconciliation } from '@/lib/reports/bill-check-flags';

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const rs = (n: number) => `₹${INR.format(n)}`;

/**
 * Two concerns, two bars. The red one blocks Power Print; the amber one never
 * does — blocking on things the report already states correctly trains a
 * surveyor to click through warnings, including the ones that matter.
 */
export function BillCheckAttentionBanner({
  flags,
  reconciliation,
  onConfirmAllBelow,
  onKeepAllAbove,
}: {
  flags: BillFlag[];
  reconciliation: InvoiceReconciliation;
  onConfirmAllBelow: () => void;
  onKeepAllAbove: () => void;
}) {
  const below = flags.filter(f => f.kind === 'billed-below');
  const above = flags.filter(f => f.kind === 'billed-above');
  const rejected = flags.filter(f => f.kind === 'billed-rejected');
  const blocking = below.length + above.length;

  if (blocking === 0 && rejected.length === 0 && reconciliation.reconciles) return null;

  return (
    <div className="flex flex-col gap-2">
      {blocking > 0 && (
        <div className="flex gap-3 items-start p-3.5 rounded-xl border border-status-danger bg-status-danger/10">
          <Ban size={17} className="text-status-danger shrink-0 mt-0.5" />
          <div className="flex-1 text-xs" style={{ lineHeight: 1.6 }}>
            <div className="text-sm font-medium text-foreground mb-0.5">
              {blocking} item{blocking === 1 ? '' : 's'} need your decision before this bill check can be issued
            </div>
            {below.length > 0 && <>{below.length} billed below your assessment. </>}
            {above.length > 0 && <>{above.length} billed above it. </>}
            Printing is blocked until each has been looked at.
            <div className="flex gap-2 mt-2.5">
              {below.length > 0 && (
                <button onClick={onConfirmAllBelow} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground">
                  Confirm all {below.length} billed under
                </button>
              )}
              {above.length > 0 && (
                <button onClick={onKeepAllAbove} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground">
                  Keep my assessment on all {above.length}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {(!reconciliation.reconciles || rejected.length > 0) && (
        <div className="flex gap-3 items-start p-3.5 rounded-xl border border-status-warning bg-status-warning/10">
          <AlertTriangle size={17} className="text-status-warning shrink-0 mt-0.5" />
          <div className="flex-1 text-xs" style={{ lineHeight: 1.6 }}>
            {!reconciliation.reconciles && (
              <>
                <div className="text-sm font-medium text-foreground mb-0.5">
                  The line items don&apos;t add up to the invoice total
                </div>
                The invoice states <b>{rs(reconciliation.invoiceTotal)}</b>. The items total{' '}
                <b>{rs(reconciliation.lineTotal)}</b> — a gap of <b>{rs(reconciliation.gap)}</b>.
                A line was missed or misread when the bill was read.
              </>
            )}
            {rejected.length > 0 && (
              <div className={reconciliation.reconciles ? '' : 'mt-2'}>
                The workshop billed for {rejected.length} item{rejected.length === 1 ? '' : 's'} you
                rejected at final survey. {rejected.length === 1 ? 'It carries' : 'They carry'} no
                liability and the report shows {rejected.length === 1 ? 'it' : 'them'} as billed
                against rejected items.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into the tab**

In `BillCheckTab.tsx`, add:

```tsx
import { billCheckFlags, reconcileInvoice } from '@/lib/reports/bill-check-flags';
import { BillCheckAttentionBanner } from './bill-check/BillCheckAttentionBanner';
```

Beside the existing derived values:

```tsx
  const flags = billCheckFlags(allRows);
  const reconciliation = reconcileInvoice(allRows, bc.billTotal ?? 0);

  const confirmAllBelow = () => {
    flags.filter(f => f.kind === 'billed-below')
      .forEach(f => updateAssessmentRow(f.rowId, { billVerified: true }));
  };
  // Keeps the assessment: verified, with no allowance written, so the claim
  // stays where the surveyor put it at final survey.
  const keepAllAbove = () => {
    flags.filter(f => f.kind === 'billed-above')
      .forEach(f => updateAssessmentRow(f.rowId, { billVerified: true }));
  };
```

Render it directly above `<BillCheckGrid …>`:

```tsx
            <BillCheckAttentionBanner
              flags={flags}
              reconciliation={reconciliation}
              onConfirmAllBelow={confirmAllBelow}
              onKeepAllAbove={keepAllAbove}
            />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/bill-check/BillCheckAttentionBanner.tsx src/components/tabs/BillCheckTab.tsx
git commit -m "feat(bill-check): add the attention banner and bulk actions

Two concerns, two bars: blocking divergences in red, advisory ones in
amber. Blocking on things the report already states correctly would
train a surveyor to click through warnings that matter.

Bulk actions are not a convenience. A systematically underpriced
estimate flags every row, and unlike the cap direction there is no
automatic action absorbing them, so without Keep my assessment on all
this becomes twenty presses on exactly the claims where the estimate was
worst."
```

---

### Task 10: Printing waits for every divergence

**Files:**
- Modify: `src/components/tabs/BillCheckTab.tsx` (`handlePrint`)
- Modify: `src/components/dialogs/PendingRowsDialog.tsx` (accept a reason)

**Interfaces:**
- Consumes: `flags` (Task 9)

- [ ] **Step 1: Extend the gate**

`handlePrint` currently blocks on pending rows only. Replace it with:

```tsx
  const blockingFlags = flags.filter(f => f.blocking);

  const handlePrint = () => {
    if (pendingRows.length > 0) { setPendingGate(true); return; }
    // A row whose bill and assessment disagree has not been looked at. The cap
    // has already moved the money on the billed-below rows, so printing here
    // would issue figures nobody verified.
    if (blockingFlags.length > 0) { setFlagGate(true); return; }
    if (remarkRows.length > 0) { setRemarkWarning(true); return; }
    doPrint();
  };
```

Add the state beside the others:

```tsx
  const [flagGate, setFlagGate] = useState(false);
```

- [ ] **Step 2: Render the gate**

Beside the existing dialogs:

```tsx
      {flagGate && (
        <PendingRowsDialog
          rows={allRows.filter(r => blockingFlags.some(f => f.rowId === r.id))}
          title={`${blockingFlags.length} item${blockingFlags.length === 1 ? '' : 's'} not yet checked against the bill`}
          body="The bill and your assessment disagree on these. Look at each before issuing — the claim has already been capped where the workshop billed less."
          resolveLabel="Confirm all"
          onResolveAll={() => {
            blockingFlags.forEach(f => updateAssessmentRow(f.rowId, { billVerified: true }));
            setFlagGate(false);
          }}
          onCancel={() => setFlagGate(false)}
        />
      )}
```

- [ ] **Step 3: Make the dialog take its wording**

`PendingRowsDialog` currently hardcodes its heading, body and button. Add three optional props with the existing strings as defaults, so the pending gate is unchanged:

```tsx
interface PendingRowsDialogProps {
  rows: AssessmentRow[];
  onResolveAll: () => void;
  onCancel: () => void;
  title?: string;
  body?: string;
  resolveLabel?: string;
}
```

```tsx
export function PendingRowsDialog({
  rows, onResolveAll, onCancel,
  title,
  body = 'A bill check cannot be issued while items are pending. Enter the billed figure, or record that they were not billed.',
  resolveLabel = 'Mark all Not in Bill',
}: PendingRowsDialogProps) {
```

Use `title ?? \`${rows.length} item${rows.length === 1 ? '' : 's'} not yet checked\`` for the heading, `body` for the paragraph, and `resolveLabel` for the confirm button.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/BillCheckTab.tsx src/components/dialogs/PendingRowsDialog.tsx
git commit -m "feat(bill-check): block printing until every divergence is checked

The cap applies on its own, which is what makes a skipped row safe on
the billed-under side — but it also means money has already moved on
figures nobody verified. The gate is what makes that safe rather than
merely likely to be caught.

PendingRowsDialog takes its wording as props so the same dialog serves
both gates; its existing strings are the defaults, so the pending gate
is untouched."
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| 1.1 Estimates unfiltered — engine | 1 |
| 1.1 Estimates unfiltered — builder duplication deleted | 2 |
| 1.2 `Estimated (before GST)` | 2 |
| 1.3 Per-section Estimate and Assessed subtotals | 3 |
| 1.4 §8 Billed ties to invoice, one aggregate line | 4 |
| 2.1 The cap rule | 5 |
| 2.2 Applies on its own | 5 (behaviour), 10 (the gate that makes it safe) |
| 2.3 Never touches the Final Survey Report | 5 (explicit test) |
| 3.1 One rule, both directions, Confirm default | 7 (logic), 8 (buttons) |
| 3.2 Three-way diagnosis | 7 (two `detail` variants, both tested) |
| 3.3 Two tiers | 7 (`blocking`), 9 (two bars), 10 (gate) |
| 3.4 Banner, mark, in-place explanation | 8, 9 |
| 3.5 Invoice reconciliation, screen only | 7 (`reconcileInvoice`), 9 (rendered only in the banner) |
| Data model — `billVerified` added, `partial` retired | 6 |

No gaps.

**Type consistency:** `BillFlag`, `BillFlagKind`, `billCheckFlags`, `InvoiceReconciliation` and `reconcileInvoice` are defined once in Task 7 and consumed under those names in Tasks 8, 9 and 10. `billVerified` is added in Task 6 and read in Task 7, written in Tasks 8 and 9. `billCheckAssessed` keeps its existing signature.

**Known risks**

- **Task 8 changes the grid's column count.** `buildCols`, `headerRow`, `totalsRow` and the row render must all gain the mark column together; Step 3 is a hand count because no test covers grid geometry.
- **Task 6 touches AI extraction.** Removing `'partial'` from the union makes the compiler find every write site, which is the intended safety net — but `assessmentSlice` and `aiDataSlice` must go together or the build breaks between commits.
- **Task 5 changes claimed money.** Every existing bill-check test runs against uncapped behaviour. A failure there needs reading before it is changed: it may be encoding the bug.
- **Parts 2 and 3 are not verifiable here.** The Bill Check screen is auth-gated and needs real claim data. Correctness rests on the unit tests and on the surveyor exercising the grid.
