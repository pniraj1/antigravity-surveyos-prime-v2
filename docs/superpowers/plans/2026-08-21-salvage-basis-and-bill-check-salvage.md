# Salvage — Basis and Bill Check Figure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strike the salvage suggestion on the metal parts the surveyor actually allowed, priced as they will be claimed, and give the Bill Check its own salvage figure and its own input without ever rewriting the Final Survey Report's.

**Architecture:** One pure function, `salvageBasis(rows, lens)`, produces both bases — the default lens reads `assessed`, and passing `billCheckAssessed` produces the bill-check basis for free. A second pure function, `resolveBillSalvage`, picks the figure the Bill Check reports use: a typed `feeBill.billSalvage` wins, otherwise the final report's salvage rescaled by the ratio between the two bases. No engine function changes signature, and no new field is added to `AssessmentSummary` or `BillCheckSummary`. The salvage input, its band and its 5%/10% buttons move into one component used by both tabs.

**Tech Stack:** TypeScript, React 19, Next.js 16, Zustand, Vitest (environment `node` — no component rendering tests in this repo; UI tasks verify with `tsc` plus the full suite).

## Global Constraints

- Salvage is a **suggestion**. The band and the buttons only fill the box. A figure the surveyor has typed is the decision: nothing warns about it, nags about it, or overrides it.
- The Bill Check never writes `feeBill.salvageValue`. The Final Survey Report keeps the figure it was filed with.
- Basis = allowed **metal parts** rows only, at their assessed amount **before depreciation**, with **each row's own GST**. Disposal rows carry no GST.
- Rejected rows are excluded by testing `allowed`, never by testing `assessed === 0` — `toggleRowAllowed` leaves a stale `assessed` on a row it switches off.
- `billSalvage` is optional with **no default**. `undefined` means "rescale automatically"; `0` means the surveyor typed zero.
- Rescaling runs in **both directions**. No special case for a rising basis.
- Commit directly to `main`. No branches, no worktrees. No attribution trailers in commit messages.
- Every task ends with `npx tsc --noEmit` exiting 0 and `npx vitest run` fully green before its commit.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/calculations/salvage.ts` (create) | `salvageBasis` — the only place the basis rule exists |
| `src/lib/reports/bill-check-projection.ts` (modify) | `resolveBillSalvage` — the only place the bill-check figure is decided |
| `src/types/assessment.ts` (modify) | `billSalvage?: number` on `FeeBill` |
| `src/components/claim/SalvageInput.tsx` (create) | the box, the band, the two buttons — one copy, both tabs |
| `src/components/claim/AssessmentSummary.tsx` (modify) | renders `SalvageInput`, passes the final basis |
| `src/components/tabs/bill-check/BillCheckSummaryPanel.tsx` (modify) | renders `SalvageInput`, passes the bill-check basis |
| `src/components/tabs/BillCheckTab.tsx` (modify) | resolves the figure once, feeds both summaries and the panel |
| `src/lib/reports/standard-report-builder.ts` (modify) | resolved figure in bill-check mode only |
| `src/lib/reports/uiic-final-builder.ts` (modify) | resolved figure in the bill-check builder only |

---

### Task 1: The basis

**Files:**
- Create: `src/lib/calculations/salvage.ts`
- Test: `src/lib/calculations/__tests__/salvage.test.ts` (create)

**Interfaces:**
- Consumes: `AssessmentRow` from `@/types/assessment`
- Produces: `salvageBasis(rows: AssessmentRow[], amount?: (r: AssessmentRow) => number): number`

  Tasks 2, 3 and 4 all call this. The second parameter is the lens; Task 2 passes `billCheckAssessed`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/calculations/__tests__/salvage.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { salvageBasis } from '../salvage';
import { billCheckAssessed } from '@/lib/reports/bill-check-projection';
import type { AssessmentRow } from '@/types/assessment';

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

describe('salvageBasis', () => {
  test('no rows is zero', () => {
    expect(salvageBasis([])).toBe(0);
  });

  test('an allowed metal part counts at its assessed amount plus its own GST', () => {
    expect(salvageBasis([row({ assessed: 10000, gst: 18 })])).toBe(11800);
  });

  test('each row is taxed at its own rate', () => {
    // 10,000 at 18% = 11,800 and 5,000 at 28% = 6,400 → 18,200
    expect(salvageBasis([
      row({ assessed: 10000, gst: 18 }),
      row({ assessed: 5000, gst: 28 }),
    ])).toBe(18200);
  });

  test('only metal parts count', () => {
    expect(salvageBasis([
      row({ assessed: 10000, gst: 18 }),
      row({ assessed: 9000, partType: 'plastic' }),
      row({ assessed: 9000, partType: 'glass' }),
      row({ assessed: 9000, partType: 'fiberglass' }),
    ])).toBe(11800);
  });

  test('labour and paint never count, whatever their partType says', () => {
    expect(salvageBasis([
      row({ assessed: 9000, section: 'labour' }),
      row({ assessed: 9000, section: 'paint' }),
    ])).toBe(0);
  });

  // toggleRowAllowed does not zero `assessed` when it switches a row off, so a
  // rejected row keeps its old figure. Filtering on the amount would count it.
  test('a rejected metal part carrying a stale assessed figure counts nothing', () => {
    expect(salvageBasis([row({ assessed: 9000, allowed: false })])).toBe(0);
  });

  test('a disposal row counts its assessed amount with no GST', () => {
    expect(salvageBasis([row({ assessed: 4000, isDisposal: true, gst: 18 })])).toBe(4000);
  });

  test('a missing GST rate falls back to 18%', () => {
    expect(salvageBasis([row({ assessed: 10000, gst: undefined })])).toBe(11800);
  });
});

describe('salvageBasis, through the bill-check lens', () => {
  test('a capped row counts the billed figure, not the assessed one', () => {
    expect(salvageBasis(
      [row({ assessed: 10000, billedTaxable: 5000, gst: 18 })],
      billCheckAssessed,
    )).toBe(5900);
  });

  test('a not-in-bill row counts nothing — no old part came off', () => {
    expect(salvageBasis(
      [row({ assessed: 10000, billStatus: 'not-in-bill', billedTaxable: 0 })],
      billCheckAssessed,
    )).toBe(0);
  });

  test('billAllowed above the assessment raises the basis', () => {
    expect(salvageBasis(
      [row({ assessed: 10000, billedTaxable: 15000, billAllowed: 20000, gst: 18 })],
      billCheckAssessed,
    )).toBe(23600);
  });

  test('a row with no bill yet counts its assessed amount', () => {
    expect(salvageBasis([row({ assessed: 10000, gst: 18 })], billCheckAssessed)).toBe(11800);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/calculations/__tests__/salvage.test.ts`
Expected: FAIL — `Failed to resolve import "../salvage"`

- [ ] **Step 3: Write the module**

Create `src/lib/calculations/salvage.ts`:

```ts
import type { AssessmentRow } from '@/types/assessment';

/**
 * The metal-parts figure a salvage suggestion is a percentage of.
 *
 * Allowed metal parts only, at their assessed amount before depreciation, with
 * each row's own GST — the amount the claim will actually carry for that part.
 * Salvage is scrap: what matters is the part that came off, which exists only
 * for parts the surveyor allowed.
 *
 * `amount` is the lens. Pass nothing for the Final Survey Report's basis; pass
 * `billCheckAssessed` for the Bill Check's, and the cap and the not-in-bill
 * rows fall out on their own.
 *
 * The `allowed` test cannot be replaced by `assessed === 0`: toggleRowAllowed
 * writes `assessed` only when switching a row on, so a rejected row keeps its
 * old figure sitting there.
 *
 * Disposal rows carry no GST, matching the engine everywhere else.
 */
export const salvageBasis = (
  rows: AssessmentRow[],
  amount: (r: AssessmentRow) => number = r => r.assessed,
) => rows.reduce((s, r) =>
  r.allowed && r.section === 'parts' && r.partType === 'metal'
    ? s + amount(r) * (r.isDisposal ? 1 : 1 + (r.gst ?? 18) / 100)
    : s, 0);
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/calculations/__tests__/salvage.test.ts`
Expected: PASS — 12 passed

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/salvage.ts src/lib/calculations/__tests__/salvage.test.ts
git commit -m "feat(salvage): derive the basis from allowed metal parts

Salvage is scrap off the part that came off, so the figure it is a
percentage of is the part the surveyor allowed, priced as it will be
claimed — assessed, before depreciation, with that row's own GST.

The lens argument gives the bill-check basis from the same code: pass
billCheckAssessed and the cap and the not-in-bill rows fall out on their
own. That is why this is a function taking a lens rather than two new
fields on two summary interfaces.

Rejected rows are excluded by testing allowed, never by testing the
amount — toggleRowAllowed leaves a stale assessed figure behind."
```

---

### Task 2: The Bill Check figure

**Files:**
- Modify: `src/types/assessment.ts` (add `billSalvage?` to `FeeBill`, near `salvageValue` at :287)
- Modify: `src/lib/reports/bill-check-projection.ts` (add `resolveBillSalvage`)
- Test: `src/lib/reports/__tests__/bill-check-salvage.test.ts` (create)

**Interfaces:**
- Consumes: `salvageBasis` (Task 1), `billCheckAssessed` (already in `bill-check-projection.ts`)
- Produces:
  - `FeeBill.billSalvage?: number`
  - `resolveBillSalvage(fb: FeeBill | undefined, rows: AssessmentRow[]): number`

  Tasks 4 and 5 both call `resolveBillSalvage`. Task 4 also reads `fb.billSalvage` directly to decide whether to show its note.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reports/__tests__/bill-check-salvage.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { resolveBillSalvage } from '../bill-check-projection';
import type { AssessmentRow, FeeBill } from '@/types/assessment';

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

function fee(overrides: Partial<FeeBill> = {}): FeeBill {
  return { salvageValue: 1600, compulsoryExcess: 0, voluntaryExcess: 0, ...overrides } as FeeBill;
}

// Two allowed metal parts at 10,000 each, 18% GST → a final basis of 23,600.
const twoParts = () => [
  row({ id: 'fender', assessed: 10000 }),
  row({ id: 'bonnet', assessed: 10000 }),
];

describe('resolveBillSalvage', () => {
  test('a figure typed on the Bill Check tab wins', () => {
    expect(resolveBillSalvage(fee({ billSalvage: 999 }), twoParts())).toBe(999);
  });

  // undefined means "automatic"; zero is a decision, and must survive.
  test('a typed zero is honoured, not treated as absent', () => {
    expect(resolveBillSalvage(fee({ billSalvage: 0 }), twoParts())).toBe(0);
  });

  test('an unchanged bill leaves the salvage alone', () => {
    expect(resolveBillSalvage(fee(), twoParts())).toBe(1600);
  });

  test('a basis cut to a quarter cuts the salvage to a quarter', () => {
    // fender capped to 5,000 (= 5,900 with GST), bonnet never billed (= 0).
    // 5,900 / 23,600 = 0.25, so 1,600 → 400.
    const rows = [
      row({ id: 'fender', assessed: 10000, billedTaxable: 5000 }),
      row({ id: 'bonnet', assessed: 10000, billStatus: 'not-in-bill', billedTaxable: 0 }),
    ];
    expect(resolveBillSalvage(fee(), rows)).toBe(400);
  });

  test('a risen basis raises the salvage', () => {
    // bonnet allowed at 20,000 (= 23,600) plus fender 11,800 → 35,400.
    // 35,400 / 23,600 = 1.5, so 1,600 → 2,400.
    const rows = [
      row({ id: 'fender', assessed: 10000 }),
      row({ id: 'bonnet', assessed: 10000, billedTaxable: 25000, billAllowed: 20000 }),
    ];
    expect(resolveBillSalvage(fee(), rows)).toBe(2400);
  });

  test('no allowed metal at all carries the figure through unchanged', () => {
    // No ratio exists, and inventing one is worse than leaving the number be.
    expect(resolveBillSalvage(fee(), [row({ partType: 'plastic' })])).toBe(1600);
  });

  test('a salvage of zero stays zero whatever the bases do', () => {
    const rows = [row({ assessed: 10000, billedTaxable: 5000 })];
    expect(resolveBillSalvage(fee({ salvageValue: 0 }), rows)).toBe(0);
  });

  test('no fee bill at all is zero', () => {
    expect(resolveBillSalvage(undefined, twoParts())).toBe(0);
  });

  test('the result is a whole rupee', () => {
    // 3,333 taxable is 3,932.94 with GST, against a final basis of 23,600 —
    // a ratio that does not divide cleanly into 1,600.
    const rows = [
      row({ id: 'fender', assessed: 10000, billedTaxable: 3333 }),
      row({ id: 'bonnet', assessed: 10000, billStatus: 'not-in-bill', billedTaxable: 0 }),
    ];
    expect(Number.isInteger(resolveBillSalvage(fee(), rows))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-salvage.test.ts`
Expected: FAIL — `resolveBillSalvage is not a function` (the module resolves; the export does not exist)

- [ ] **Step 3: Add the field**

In `src/types/assessment.ts`, in the `FeeBill` interface, directly after `salvageValue: number;` (:287):

```ts
  salvageValue: number;
  /**
   * Bill-check-only salvage. `undefined` means "rescale salvageValue by how
   * far the metal basis has moved"; a number is the surveyor's decision and
   * is used as typed. Zero is a decision, which is why this is optional with
   * no default rather than defaulting to 0.
   */
  billSalvage?: number;
```

- [ ] **Step 4: Write the resolver**

In `src/lib/reports/bill-check-projection.ts`, add the import at the top, beside the existing type import:

```ts
import type { AssessmentRow, FeeBill } from '@/types/assessment';
import { salvageBasis } from '@/lib/calculations/salvage';
```

(The existing first line is `import type { AssessmentRow } from '@/types/assessment';` — replace it with the two lines above.)

Then append to the end of the file:

```ts
/**
 * The salvage figure the Bill Check reports and screen use.
 *
 * A figure typed on the Bill Check tab wins and is used exactly as typed —
 * salvage is the surveyor's decision, and nothing here second-guesses it.
 * Otherwise the final report's salvage is rescaled by how far the metal basis
 * has moved: the same percentage of a smaller, or larger, pile of allowed
 * metal. A part that was never billed was never replaced, so no old part came
 * off it and it stops earning salvage.
 *
 * Both directions, with no special case for a rising basis.
 *
 * Bill-check only. `feeBill.salvageValue` is never written here; the Final
 * Survey Report keeps the figure it was filed with.
 */
export function resolveBillSalvage(fb: FeeBill | undefined, rows: AssessmentRow[]): number {
  if (fb?.billSalvage !== undefined) return fb.billSalvage;
  const final = salvageBasis(rows);
  if (!final) return fb?.salvageValue ?? 0;
  return Math.round((fb?.salvageValue ?? 0) * salvageBasis(rows, billCheckAssessed) / final);
}
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-salvage.test.ts`
Expected: PASS — 9 passed

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

- [ ] **Step 6: Commit**

```bash
git add src/types/assessment.ts src/lib/reports/bill-check-projection.ts src/lib/reports/__tests__/bill-check-salvage.test.ts
git commit -m "feat(salvage): give the Bill Check a salvage figure of its own

The Bill Check shared the final report's salvage and had no way to
change it, so a part the workshop never replaced kept earning salvage
the insurer never receives — money off the insured for a part that
still exists.

billSalvage is the surveyor's typed figure and wins outright. Absent
one, the final report's salvage is rescaled by how far the metal basis
moved. Both directions: a bigger part replaced is bigger scrap.

Optional with no default, because undefined must stay distinguishable
from a deliberate zero."
```

---

### Task 3: One salvage input, used by the Assessment tab

**Files:**
- Create: `src/components/claim/SalvageInput.tsx`
- Modify: `src/components/claim/AssessmentSummary.tsx` (delete the inline block at :43-44 and :155-193, render the component)

**Interfaces:**
- Consumes: `salvageBasis` (Task 1)
- Produces: `<SalvageInput value={number} onChange={(v: number | undefined) => void} basis={number} note?={string} id?={string} />`

  Task 4 renders the same component with the bill-check basis.

- [ ] **Step 1: Create the component**

Create `src/components/claim/SalvageInput.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/calculations/utils';

interface SalvageInputProps {
  /** The rupee figure in force. */
  value: number;
  /** Reports `undefined` when the field is cleared. */
  onChange: (value: number | undefined) => void;
  /** Allowed metal parts, assessed, with GST — what the 5–10% band is struck on. */
  basis: number;
  /** Optional line beneath the band, e.g. where a carried-over figure came from. */
  note?: string;
  /** Distinct id per tab, so two rendered copies do not share a label target. */
  id?: string;
}

/**
 * The salvage figure and its suggested band.
 *
 * One component for both tabs, because two copies of a 5–10% rule is how this
 * codebase once ended up with three depreciation tables that disagreed.
 *
 * The band is a suggestion and the buttons only fill the box. The surveyor
 * decides the number: nothing here warns about, nags about, or overrides a
 * figure they have entered.
 *
 * Clearing the field reports `undefined`. The Bill Check tab reads that as
 * "back to automatic"; the Assessment tab reads it as zero.
 */
export function SalvageInput({ value, onChange, basis, note, id = 'salvage-value' }: SalvageInputProps) {
  const low = Math.round(basis * 0.05);
  const high = Math.round(basis * 0.10);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label htmlFor={id} className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Salvage value (₹)</Label>
      </div>
      <Input
        id={id}
        type="number"
        value={value || ''}
        onChange={e => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
        className="text-right font-medium text-[var(--color-status-danger)] bg-white border-[var(--color-neutral-200)] hover:border-[var(--color-status-danger)] focus:border-[var(--color-status-danger)] focus:ring-1 focus:ring-[var(--color-status-danger-tint)] shadow-sm transition-all h-9"
        placeholder="0.00"
        min="0"
      />
      {basis > 0 && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[10px] text-muted-foreground">
            Metal allowed {formatCurrency(basis)} · suggest {formatCurrency(low)}–{formatCurrency(high)}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange(low)}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-[var(--color-neutral-300)] bg-white text-muted-foreground hover:border-[var(--color-status-danger)] hover:text-[var(--color-status-danger)] transition-colors"
              title={`Apply 5% of the allowed metal basis (${formatCurrency(low)})`}
            >
              5%
            </button>
            <button
              type="button"
              onClick={() => onChange(high)}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-[var(--color-neutral-300)] bg-white text-muted-foreground hover:border-[var(--color-status-danger)] hover:text-[var(--color-status-danger)] transition-colors"
              title={`Apply 10% of the allowed metal basis (${formatCurrency(high)})`}
            >
              10%
            </button>
          </div>
        </div>
      )}
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Delete the old suggestion figures**

In `src/components/claim/AssessmentSummary.tsx`, delete these three lines (:42-44):

```tsx
  // Suggested salvage: 5–10% of allowed metal-parts estimate. Surveyor edits/rounds.
  const salvageLow = Math.round(summary.estimateMetalBase * 0.05);
  const salvageHigh = Math.round(summary.estimateMetalBase * 0.10);
```

- [ ] **Step 3: Replace the inline block**

In the same file, replace the whole salvage block — from `<div className="space-y-2">` immediately inside `<div className="bg-[var(--color-neutral-50)] p-5 border-y ...">` down to its matching `</div>` just before `<div className="grid grid-cols-2 gap-3">` — with:

```tsx
          <SalvageInput
            value={fb.salvageValue}
            onChange={v => updateFeeBill({ salvageValue: v ?? 0 })}
            basis={salvageBasis(currentClaim.assessmentRows)}
          />
```

The deleted block is the one containing `<Label htmlFor="salvage-value">`, the `<Input id="salvage-value">`, and the `{summary.estimateMetalBase > 0 && (…)}` suggestion row with its 5% and 10% buttons.

- [ ] **Step 4: Fix the imports**

At the top of `src/components/claim/AssessmentSummary.tsx`, add:

```tsx
import { salvageBasis } from '@/lib/calculations/salvage';
import { SalvageInput } from './SalvageInput';
```

`Input` and `Label` may now be unused in this file. Run the check in Step 5 and delete either import only if `tsc` or the linter reports it unused — other fields on this card still use them.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass
Run: `npx next build` → completes without error

Then read the rendered block back: `AssessmentSummary.tsx` must contain exactly one `<SalvageInput`, no remaining reference to `salvageLow`, `salvageHigh`, or `estimateMetalBase`.

```bash
grep -n "salvageLow\|salvageHigh\|estimateMetalBase\|SalvageInput" src/components/claim/AssessmentSummary.tsx
```

Expected: one line, the `SalvageInput` import, and one line, its use. Nothing else.

- [ ] **Step 6: Commit**

```bash
git add src/components/claim/SalvageInput.tsx src/components/claim/AssessmentSummary.tsx
git commit -m "feat(salvage): one input, and strike the band on the right number

The suggested range was 5-10% of the garage's estimate for metal parts,
pre-GST, over every metal row including ones the surveyor rejected. It
is now the parts actually allowed, at their assessed amount, with GST —
what the claim will carry for them.

That also settles the side-effect accepted on 20 Aug when the allowed
guard came off the per-material estimate split: the estimate figures
stay unfiltered, and salvage stops reading them.

The box, the band and the two buttons move into one component so the
Bill Check tab can render the same thing rather than a second copy of
the rule."
```

---

### Task 4: The Bill Check tab

**Files:**
- Modify: `src/components/tabs/BillCheckTab.tsx` (:103-108 summary calls, :219-226 panel render)
- Modify: `src/components/tabs/bill-check/BillCheckSummaryPanel.tsx` (props and one new block)

**Interfaces:**
- Consumes: `salvageBasis` (Task 1), `resolveBillSalvage` (Task 2), `SalvageInput` (Task 3)
- Produces: nothing later tasks depend on

- [ ] **Step 1: Resolve the figure in the tab**

In `src/components/tabs/BillCheckTab.tsx`, add to the imports:

```tsx
import { salvageBasis } from '@/lib/calculations/salvage';
import { SalvageInput } from '@/components/claim/SalvageInput';
```

and extend the existing projection import to bring in the resolver:

```tsx
import { rowsNeedingRemark, billCheckAssessed, resolveBillSalvage } from '@/lib/reports/bill-check-projection';
```

Directly above the two `calculate…Summary` calls (currently at :103), add:

```tsx
  // Both summaries on this tab describe the bill check, so both get the
  // bill-check salvage. feeBill.salvageValue is never written from here.
  const finalSalvageBasis = salvageBasis(allRows);
  const bcSalvageBasis = salvageBasis(allRows, billCheckAssessed);
  const bcSalvage = resolveBillSalvage(fb, allRows);
```

Then replace `fb?.salvageValue ?? 0` with `bcSalvage` in **both** summary calls:

```tsx
  const summary = calculateAssessmentSummary(
    allRows, ageMonths, currentClaim.depreciationType,
    bcSalvage, fb?.compulsoryExcess ?? 0, fb?.voluntaryExcess ?? 0,
  );
  const bcSummary = calculateBillCheckSummary(
    allRows, ageMonths, currentClaim.depreciationType,
    bcSalvage, fb?.compulsoryExcess ?? 0, fb?.voluntaryExcess ?? 0,
  );
```

- [ ] **Step 2: Pass it to the panel**

Still in `BillCheckTab.tsx`, extend the panel render (:219):

```tsx
            <BillCheckSummaryPanel
              summary={summary}
              bcSummary={bcSummary}
              inBillTotal={inBillTotal}
              notInBillTotal={notInBillTotal}
              partialTotal={partialTotal}
              fmt={fmt}
              salvageValue={bcSalvage}
              salvageBasis={bcSalvageBasis}
              salvageNote={
                fb?.billSalvage === undefined && finalSalvageBasis !== bcSalvageBasis
                  ? `Carried from the final report and rescaled — metal allowed went ${fmt(finalSalvageBasis)} → ${fmt(bcSalvageBasis)}. Type a figure to set your own.`
                  : undefined
              }
              onSalvageChange={v => updateFeeBill({ billSalvage: v })}
            />
```

`updateFeeBill` is already in scope in this file; confirm with `grep -n "updateFeeBill" src/components/tabs/BillCheckTab.tsx` and add it to the store selectors beside `updateAssessmentRow` (:67) if it is not:

```tsx
  const updateFeeBill = useClaimStore(s => s.updateFeeBill);
```

Passing `v` straight through is deliberate: `undefined` from a cleared field is exactly the value that means "back to automatic".

- [ ] **Step 3: Render it in the panel**

In `src/components/tabs/bill-check/BillCheckSummaryPanel.tsx`, add the import:

```tsx
import { SalvageInput } from '@/components/claim/SalvageInput';
```

Extend `Props`:

```tsx
interface Props {
  summary: AssessmentSummary;
  bcSummary: BcSummary;
  inBillTotal: number;
  notInBillTotal: number;
  partialTotal: number;
  fmt: (n: number) => string;
  /** Bill-check salvage: the typed figure, or the rescaled one. */
  salvageValue: number;
  /** Allowed metal through the bill-check lens — what the band is struck on. */
  salvageBasis: number;
  salvageNote?: string;
  onSalvageChange: (value: number | undefined) => void;
}
```

Extend the signature:

```tsx
export function BillCheckSummaryPanel({
  summary, bcSummary, inBillTotal, notInBillTotal, partialTotal, fmt,
  salvageValue, salvageBasis, salvageNote, onSalvageChange,
}: Props) {
```

Then, inside the Final Liability Summary card, immediately **before** its `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">`, insert:

```tsx
        {/* Salvage feeds Final Liability directly, so it is edited beside it
            rather than back on the Assessment tab — where typing would rewrite
            a Final Survey Report already sent. */}
        <div className="mb-6 pb-6 border-b border-border max-w-sm">
          <SalvageInput
            id="bc-salvage-value"
            value={salvageValue}
            onChange={onSalvageChange}
            basis={salvageBasis}
            note={salvageNote}
          />
        </div>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass
Run: `npx next build` → completes without error

Then confirm the tab no longer feeds the final report's salvage to either summary:

```bash
grep -n "salvageValue" src/components/tabs/BillCheckTab.tsx
```

Expected: no match. Every salvage reference on this tab goes through `bcSalvage`.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/BillCheckTab.tsx src/components/tabs/bill-check/BillCheckSummaryPanel.tsx
git commit -m "feat(bill-check): put salvage on the tab that owns it

The surveyor had to walk back to the Assessment tab to change salvage,
where typing rewrites a Final Survey Report already sent to the insurer.
The box now sits next to Final Liability, the figure it feeds, and
writes billSalvage.

Both summaries on this tab describe the bill check, so both take the
bill-check salvage. Clearing the field returns it to automatic, and a
carried-over figure says so and names the bases it moved between."
```

---

### Task 5: Both Bill Check reports

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts` (:122 and :134)
- Modify: `src/lib/reports/uiic-final-builder.ts` (:587 and :594, inside `buildUIICBillCheckHTML`)
- Test: `src/lib/reports/__tests__/bill-check-salvage-report.test.ts` (create)

**Interfaces:**
- Consumes: `resolveBillSalvage` (Task 2)
- Produces: nothing later tasks depend on

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reports/__tests__/bill-check-salvage-report.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { buildUIICBillCheckHTML } from '../uiic-final-builder';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

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
    billStatus: 'in-bill',
    billedTaxable: 10000,
    ...overrides,
  } as AssessmentRow;
}

// Fender capped to 5,000 taxable (5,900 with GST); bonnet never billed (0).
// Final basis 23,600, bill-check basis 5,900 → salvage 1,600 rescales to 400.
function claim(billSalvage?: number): ClaimData {
  return {
    id: 'c1',
    assessmentRows: [
      row({ id: 'fender', particulars: 'Fender LH', assessed: 10000, billedTaxable: 5000 }),
      row({ id: 'bonnet', assessed: 10000, billStatus: 'not-in-bill', billedTaxable: 0 }),
    ],
    depreciationType: 'standard',
    reportNo: 'BC/2026/0417',
    reportDate: '2026-08-14',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: { insurerName: 'National Insurance Co. Ltd.', appointingOffice: 'DO-II Pune' },
    accident: { dateAndTime: '2026-06-24T10:00', workshopName: 'Sai Motors', dateOfSurvey: '2026-06-28' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 1600, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0, billSalvage },
    billCheck: { billNo: 'SM/INV/2026/1188', billDate: '2026-08-09', billTotal: 5900 },
  } as unknown as ClaimData;
}

describe('salvage in the bill-check reports', () => {
  // The regression that matters most: a bill-check figure must never reach
  // the report already filed with the insurer.
  test('the Final Survey Report prints the salvage it was filed with', () => {
    const html = buildStandardFinalSurveyHTML(claim(750), null, 'final');
    expect(html).toContain('₹ 1,600.00');
    expect(html).not.toContain('₹ 750.00');
  });

  test('the Final Survey Report ignores the rescaling too', () => {
    const html = buildStandardFinalSurveyHTML(claim(), null, 'final');
    expect(html).toContain('₹ 1,600.00');
    expect(html).not.toContain('₹ 400.00');
  });

  test('the Standard Bill Check prints the rescaled figure', () => {
    const html = buildStandardFinalSurveyHTML(claim(), null, 'bill-check');
    expect(html).toContain('₹ 400.00');
    expect(html).not.toContain('₹ 1,600.00');
  });

  test('the Standard Bill Check prints a typed figure as typed', () => {
    const html = buildStandardFinalSurveyHTML(claim(750), null, 'bill-check');
    expect(html).toContain('₹ 750.00');
  });

  test('the UIIC Bill Check prints the rescaled figure', () => {
    const html = buildUIICBillCheckHTML(claim(), null);
    expect(html).toContain('400.00');
    expect(html).not.toContain('1,600.00');
  });

  test('the UIIC Bill Check prints a typed figure as typed', () => {
    const html = buildUIICBillCheckHTML(claim(750), null);
    expect(html).toContain('750.00');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-salvage-report.test.ts`
Expected: FAIL — the four bill-check assertions fail because both builders still print `₹ 1,600.00`. The two Final Survey Report tests pass already; that is correct, they are the regression guard.

- [ ] **Step 3: Branch the standard builder**

In `src/lib/reports/standard-report-builder.ts`, add to the projection import (:18):

```ts
import { projectForBillCheck, resolveBillSalvage } from './bill-check-projection';
```

Directly above the `calculateAssessmentSummary` call (:118), add:

```ts
  // The Bill Check rescales salvage by how far the allowed-metal basis moved,
  // or uses the figure typed on its own tab. The Final Survey Report must keep
  // the number it was filed with — this builder serves both, so the branch is
  // load-bearing.
  const salvageFigure = isBillCheck
    ? resolveBillSalvage(claim.feeBill, claim.assessmentRows || [])
    : (claim.feeBill?.salvageValue ?? 0);
```

Note it reads `claim.assessmentRows`, not the local `rows` — in bill-check mode `rows` has already been through `projectForBillCheck`, and the resolver needs both the projected and unprojected figures to form its ratio.

Then replace both reads:

- :122, inside the summary call — `claim.feeBill?.salvageValue ?? 0,` becomes `salvageFigure,`
- :134 — `const salvage = claim.feeBill?.salvageValue || 0;` becomes `const salvage = salvageFigure;`

- [ ] **Step 4: Change the UIIC bill-check builder**

In `src/lib/reports/uiic-final-builder.ts`, add `resolveBillSalvage` to the existing import from `./bill-check-projection` (if this file has no such import, add `import { resolveBillSalvage } from './bill-check-projection';` beside the other report imports at the top).

Inside `buildUIICBillCheckHTML` only — the function beginning at :489, whose `rows` comes from `claim.assessmentRows` at :495 — add above the `calculateAssessmentSummary` call (:585):

```ts
  const salvageFigure = resolveBillSalvage(claim.feeBill, rows);
```

Then replace:

- :587 — `claim.feeBill?.salvageValue ?? 0,` becomes `salvageFigure,`
- :594 — `const salvage    = claim.feeBill?.salvageValue    || 0;` becomes `const salvage    = salvageFigure;`

Leave the UIIC **final** report builder (the `salvage` at :144) alone. It is a different function and must keep reading `salvageValue`.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/reports/__tests__/bill-check-salvage-report.test.ts`
Expected: PASS — 6 passed

Run: `npx tsc --noEmit` → exit 0
Run: `npx vitest run` → all pass

Then confirm no bill-check path still reads the raw field:

```bash
grep -n "salvageValue" src/lib/reports/standard-report-builder.ts src/lib/reports/uiic-final-builder.ts
```

Expected: exactly two matches — the `salvageFigure` fallback in the standard builder's non-bill-check branch, and the UIIC **final** builder at :144. Any third match is a bill-check path that was missed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/bill-check-salvage-report.test.ts
git commit -m "feat(bill-check): print the bill check's own salvage

Both Bill Check reports now take the resolved figure — typed on the tab,
or rescaled by how far the allowed-metal basis moved.

The standard builder serves the Final Survey Report and the Standard
Bill Check from one salvage read, so the branch there is load-bearing:
without it the filed report starts printing a bill-check number. A test
pins that directly rather than trusting the branch to survive editing."
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| §1 `salvageBasis`, allowed metal, assessed, with GST, disposal untaxed | 1 |
| §1 filter on `allowed`, never on the amount | 1 (explicit test) |
| §1 Assessment tab suggestion changes basis | 3 |
| §2 `feeBill.billSalvage?`, optional, no default | 2 |
| §2 `resolveBillSalvage` — typed wins, else rescale, both directions | 2 |
| §2 zero final basis carries the figure unchanged | 2 (explicit test) |
| §3 one `SalvageInput` for both tabs, band is a suggestion | 3 |
| §3 clearing returns to automatic; typed figure never overridden | 3 (component), 4 (tab passes `undefined` through) |
| §3 carried-over figure names where it came from | 4 (`salvageNote`) |
| §3 box sits beside the excess/liability figures | 4 |
| §4 both summaries on the tab take the bill-check figure | 4 |
| §4 standard builder branches on mode | 5 (with the regression test) |
| §4 UIIC bill-check builder only | 5 |

No gaps.

**Type consistency:** `salvageBasis(rows, amount?)` is defined in Task 1 and called under that name in Tasks 2, 3 and 4. `resolveBillSalvage(fb, rows)` is defined in Task 2 and called under that name in Tasks 4 and 5. `SalvageInput`'s four props — `value`, `onChange`, `basis`, `note`, plus `id` — are defined in Task 3 and passed under those names in Tasks 3 and 4. `BillCheckSummaryPanel`'s new props are named `salvageValue`, `salvageBasis`, `salvageNote`, `onSalvageChange` in both Task 4 steps. `billCheckAssessed` keeps its existing signature.

**Known risks**

- **One salvage read serves two reports in the standard builder.** Task 5 branches it and pins the branch with a test that fails if the Final Survey Report ever prints a bill-check figure. This is the single most damaging thing that can go wrong here.
- **Task 5's assertions match formatted currency inside a large HTML string.** `₹ 1,600.00` could in principle appear coincidentally as some other total. The chosen figures — 1,600, 400, 750 — do not collide with any other amount these fixtures produce, but if an assertion fails unexpectedly, check what else on the page carries that number before changing the assertion.
- **Tasks 3 and 4 are not verifiable here.** Both tabs are auth-gated and need real claim data; this repo has no component-rendering test setup (vitest runs with `environment: 'node'`). They verify with `tsc`, the full suite, a production build, and the two greps. The surveyor must exercise the box on a live claim.
- **`AssessmentSummary.tsx` may keep unused imports.** Task 3 Step 4 says to remove `Input`/`Label` only if reported unused; other fields on that card still use them, so removing them blindly breaks the build.
