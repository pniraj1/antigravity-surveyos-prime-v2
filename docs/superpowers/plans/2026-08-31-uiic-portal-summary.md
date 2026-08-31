# UIIC Portal Summary Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the surveyor a panel that shows the exact figures United India's
surveyor portal asks for, in the portal's own wording, so they read them off
instead of recomputing them by hand.

**Architecture:** One pure selector over the existing `AssessmentRow[]`, reusing
`getDepreciationRate`, `computeRowNet` and `aggregateGst`. One dialog that
renders it. One button in `AssessmentGrid` that opens the dialog. Nothing
existing is modified apart from adding that button, so no report output can
regress.

**Tech Stack:** TypeScript, React 19, Next.js 16, Zustand, Vitest, Tailwind,
lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-31-uiic-portal-summary-design.md`
**Portal reference:** `docs/uiic-portal-integration.md`

## Global Constraints

- **The parts buckets are pre-depreciation; the GST tables are post-depreciation.**
  This is what the portal wants. It looks like a bug. Do not "fix" it — the
  spec calls this out in §2.1 and Task 1's test locks it.
- Disposal rows are tested **before** the nil-depreciation policy. Both send the
  row to `nilDep`; only disposal preserves the disposal percentage.
- Labour carries no depreciation in practice. Paint depreciation is real and is
  shown as a separate `lessPaintDep` line.
- All money outputs are rounded to whole rupees with `Math.round`.
- Rows with `allowed === false` are excluded everywhere.
- Existing calculation modules are **read-only** for this work. Do not edit
  `assessment.ts`, `gst-bands.ts`, `row-net.ts`, `depreciation.ts`, or
  `types/assessment.ts`.
- Tests use Vitest with `describe` / `test` / `expect` imported from `vitest`,
  matching `src/lib/calculations/__tests__/gst-bands.test.ts`.

---

### Task 1: The `uiicPortalSummary` selector

**Files:**
- Create: `src/lib/calculations/uiic-portal-summary.ts`
- Test: `src/lib/calculations/__tests__/uiic-portal-summary.test.ts`

**Interfaces:**
- Consumes: `getDepreciationRate(partType, ageMonths, policyType)` from
  `../depreciation`; `computeRowNet(row, depRate): { afterDep, isDisposal, netBeforeGst }`
  from `../row-net`; `aggregateGst(rows, depRateFor): { bands: { rate, base, ... }[] }`
  from `../gst-bands`; types `AssessmentRow` from `@/types/assessment` and
  `DepreciationType` from `@/types`.
- Produces: `uiicPortalSummary(rows, ageMonths, depType): UiicPortalSummary`
  and the exported types `UiicPortalSummary` and `UiicGstSlab`. Task 2 renders
  exactly these.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/uiic-portal-summary.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { uiicPortalSummary } from '../uiic-portal-summary';
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
  };
}

describe('uiicPortalSummary — parts buckets', () => {
  test('a metal part goes in at its FULL pre-depreciation price', () => {
    // R1. The portal depreciates; we must not do it for them.
    // 100 months old => 40% metal depreciation.
    const s = uiicPortalSummary([row({ assessed: 10000, partType: 'metal' })], 100, 'standard');
    expect(s.parts.ageBasedDep).toBe(10000);
    expect(s.parts.dep50).toBe(0);
    expect(s.parts.dep30).toBe(0);
    expect(s.parts.nilDep).toBe(0);
  });

  test('the GST slab for that same part is POST-depreciation', () => {
    // R3, and the asymmetry in spec §2.1. If someone "fixes" the pre/post
    // mismatch, this is the test that fails.
    const s = uiicPortalSummary([row({ assessed: 10000, partType: 'metal', gst: 18 })], 100, 'standard');
    expect(s.partsGst).toEqual([{ rate: 18, amount: 6000 }]); // 10000 x 60%
  });

  test('splits plastic, fibreglass and glass into their own buckets', () => {
    const s = uiicPortalSummary(
      [
        row({ assessed: 4000, partType: 'plastic' }),
        row({ assessed: 3000, partType: 'fiberglass' }),
        row({ assessed: 2000, partType: 'glass' }),
      ],
      100,
      'standard',
    );
    expect(s.parts.dep50).toBe(4000);
    expect(s.parts.dep30).toBe(3000);
    expect(s.parts.nilDep).toBe(2000);
    expect(s.parts.ageBasedDep).toBe(0);
  });

  test('ignores rows the surveyor disallowed', () => {
    const s = uiicPortalSummary(
      [row({ assessed: 10000, partType: 'metal', allowed: false })],
      100,
      'standard',
    );
    expect(s.parts.ageBasedDep).toBe(0);
  });
});

describe('uiicPortalSummary — disposal parts', () => {
  test('disposal parts land in nilDep at their allowed value, with zero GST', () => {
    // R2. Octavia-shaped: every part allowed on a disposal basis.
    const s = uiicPortalSummary(
      [
        row({ assessed: 8000, partType: 'glass', isDisposal: true, disposalPercent: 100 }),
        row({ assessed: 15000, partType: 'glass', isDisposal: true, disposalPercent: 100 }),
        row({ assessed: 4500, partType: 'glass', isDisposal: true, disposalPercent: 100 }),
      ],
      82,
      'standard',
    );
    expect(s.parts.nilDep).toBe(27500);
    expect(s.partsGst).toEqual([{ rate: 0, amount: 27500 }]);
  });

  test('a disposal metal part goes to nilDep, not ageBasedDep', () => {
    // 100 months => 40% dep, then 50% disposal => 10000 x 0.6 x 0.5 = 3000
    const s = uiicPortalSummary(
      [row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })],
      100,
      'standard',
    );
    expect(s.parts.nilDep).toBe(3000);
    expect(s.parts.ageBasedDep).toBe(0);
  });
});

describe('uiicPortalSummary — nil depreciation policy', () => {
  test('puts the whole parts amount into nilDep', () => {
    // R5
    const s = uiicPortalSummary(
      [
        row({ assessed: 10000, partType: 'metal' }),
        row({ assessed: 5000, partType: 'glass' }),
      ],
      100,
      'nil',
    );
    expect(s.parts.nilDep).toBe(15000);
    expect(s.parts.ageBasedDep).toBe(0);
  });

  test('a disposal part on a nil policy keeps its disposal reduction', () => {
    // Disposal is tested BEFORE the policy. Reversing that order enters
    // 10000 here and overstates the claim.
    const s = uiicPortalSummary(
      [row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })],
      100,
      'nil',
    );
    expect(s.parts.nilDep).toBe(5000);
  });
});

describe('uiicPortalSummary — labour and paint', () => {
  test('combines labour with paint after paint depreciation', () => {
    // R4/R7, the figures from the SWAR panel: 23200 + (24000 - 3000) = 44200
    const s = uiicPortalSummary(
      [
        row({ assessed: 23200, section: 'labour', partType: 'labour' }),
        row({ assessed: 24000, section: 'paint', partType: 'paint', depOverride: 12.5 }),
      ],
      100,
      'standard',
    );
    expect(s.labour.labour).toBe(23200);
    expect(s.labour.paint).toBe(24000);
    expect(s.labour.lessPaintDep).toBe(3000);
    expect(s.labour.totalLabour).toBe(44200);
  });

  test('labour and paint do not leak into the parts buckets', () => {
    const s = uiicPortalSummary(
      [
        row({ assessed: 23200, section: 'labour', partType: 'labour' }),
        row({ assessed: 24000, section: 'paint', partType: 'paint' }),
      ],
      100,
      'standard',
    );
    expect(s.parts.ageBasedDep).toBe(0);
    expect(s.parts.nilDep).toBe(0);
  });

  test('labour GST is banded separately from parts GST', () => {
    const s = uiicPortalSummary(
      [
        row({ assessed: 10000, partType: 'metal', gst: 28 }),
        row({ assessed: 20000, section: 'labour', partType: 'labour', gst: 18 }),
      ],
      100,
      'standard',
    );
    expect(s.partsGst).toEqual([{ rate: 28, amount: 6000 }]);
    expect(s.labourGst).toEqual([{ rate: 18, amount: 20000 }]);
  });
});

describe('uiicPortalSummary — tie-out', () => {
  test('reports the rupee lost to rounding the buckets', () => {
    // Both buckets round down: 1000.4 -> 1000 and 2000.4 -> 2000, so the
    // rounded total is 3000 against an exact 3000.8.
    const s = uiicPortalSummary(
      [
        row({ assessed: 1000.4, partType: 'metal' }),
        row({ assessed: 2000.4, partType: 'plastic' }),
      ],
      100,
      'standard',
    );
    expect(s.parts.ageBasedDep).toBe(1000);
    expect(s.parts.dep50).toBe(2000);
    expect(s.tieOut.exact).toBeCloseTo(3000.8, 2);
    expect(s.tieOut.rounded).toBe(3000);
    expect(s.tieOut.delta).toBeCloseTo(-0.8, 2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/calculations/__tests__/uiic-portal-summary.test.ts
```

Expected: FAIL — `Failed to resolve import "../uiic-portal-summary"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/calculations/uiic-portal-summary.ts`:

```ts
// ═══════════════════════════════════════════════════════════
// UIIC PORTAL SUMMARY
// The figures United India's surveyor portal asks for, in its shape.
// Spec: docs/superpowers/specs/2026-08-31-uiic-portal-summary-design.md
// ═══════════════════════════════════════════════════════════

import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import { getDepreciationRate } from './depreciation';
import { computeRowNet } from './row-net';
import { aggregateGst } from './gst-bands';

/** One row of the portal's GST table: a rate and its taxable amount. */
export interface UiicGstSlab {
  rate: number;
  amount: number;
}

export interface UiicPortalSummary {
  /** The portal's four parts boxes. Amounts are BEFORE depreciation. */
  parts: {
    ageBasedDep: number; // portal: ageBasedDep — metal
    dep50: number;       // portal: dep50       — plastic, rubber, tyres
    dep30: number;       // portal: dep30       — fibreglass
    nilDep: number;      // portal: nilDep      — glass, plus every disposal part
  };
  /** portal: gst28AmountP … gst0AmountP. Amounts are AFTER depreciation. */
  partsGst: UiicGstSlab[];
  labour: {
    labour: number;
    paint: number;
    lessPaintDep: number;
    totalLabour: number; // portal: labourCharge
  };
  /** portal: gst18AmountL, gst0AmountL. */
  labourGst: UiicGstSlab[];
  /** What rounding the four buckets to rupees costs against the exact sum. */
  tieOut: { rounded: number; exact: number; delta: number };
}

const rupees = (n: number) => Math.round(n);

/**
 * Collapses `aggregateGst`'s bands into one row per rate.
 *
 * `aggregateGst` bands by `hsnSac|rate` because the printed GST summary shows
 * the HSN. The portal has one field per rate, so several HSN codes at 18% are
 * one number here.
 */
function slabsByRate(
  rows: AssessmentRow[],
  depRateFor: (row: AssessmentRow) => number,
): UiicGstSlab[] {
  const byRate = new Map<number, number>();
  for (const band of aggregateGst(rows, depRateFor).bands) {
    byRate.set(band.rate, (byRate.get(band.rate) ?? 0) + band.base);
  }
  return Array.from(byRate.entries())
    .map(([rate, amount]) => ({ rate, amount: rupees(amount) }))
    .sort((a, b) => a.rate - b.rate);
}

/**
 * Builds the portal's assessment figures from the claim's rows.
 *
 * The parts boxes carry the amount BEFORE depreciation and the GST table
 * carries it AFTER. That asymmetry is deliberate: the portal's own help text
 * says "User should enter full amount for all parts. The system will calculate
 * depreciated amount automatically", while the GST it wants is on the net
 * assessed figure. Do not make the two consistent.
 */
export function uiicPortalSummary(
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
): UiicPortalSummary {
  const allowed = rows.filter((r) => r.allowed);

  const depRateFor = (r: AssessmentRow) =>
    r.depOverride !== undefined
      ? r.depOverride
      : getDepreciationRate(r.partType, ageMonths, depType);

  const netOf = (r: AssessmentRow) => computeRowNet(r, depRateFor(r)).netBeforeGst;

  const partRows = allowed.filter((r) => r.section === 'parts');
  const labourRows = allowed.filter((r) => r.section === 'labour');
  const paintRows = allowed.filter((r) => r.section === 'paint');

  let ageBasedDep = 0;
  let dep50 = 0;
  let dep30 = 0;
  let nilDep = 0;

  for (const r of partRows) {
    // Disposal first, and before the nil-depreciation policy. Both send the row
    // to nilDep, but only this branch keeps the disposal percentage — testing
    // the policy first would enter the full price of a used part.
    if (r.isDisposal) {
      nilDep += netOf(r);
      continue;
    }
    if (depType === 'nil') {
      nilDep += r.assessed;
      continue;
    }
    switch (r.partType) {
      case 'metal':
        ageBasedDep += r.assessed;
        break;
      case 'plastic':
        dep50 += r.assessed;
        break;
      case 'fiberglass':
        dep30 += r.assessed;
        break;
      default:
        nilDep += r.assessed;
    }
  }

  const labour = labourRows.reduce((sum, r) => sum + netOf(r), 0);
  const paint = paintRows.reduce((sum, r) => sum + r.assessed, 0);
  const paintNet = paintRows.reduce((sum, r) => sum + netOf(r), 0);

  const exact = ageBasedDep + dep50 + dep30 + nilDep;
  const rounded = rupees(ageBasedDep) + rupees(dep50) + rupees(dep30) + rupees(nilDep);

  return {
    parts: {
      ageBasedDep: rupees(ageBasedDep),
      dep50: rupees(dep50),
      dep30: rupees(dep30),
      nilDep: rupees(nilDep),
    },
    partsGst: slabsByRate(partRows, depRateFor),
    labour: {
      labour: rupees(labour),
      paint: rupees(paint),
      lessPaintDep: rupees(paint - paintNet),
      totalLabour: rupees(labour + paintNet),
    },
    labourGst: slabsByRate([...labourRows, ...paintRows], depRateFor),
    tieOut: { rounded, exact, delta: rounded - exact },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/calculations/__tests__/uiic-portal-summary.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Check types**

```bash
npx tsc --noEmit
```

Expected: no errors from `uiic-portal-summary.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/uiic-portal-summary.ts src/lib/calculations/__tests__/uiic-portal-summary.test.ts
git commit -m "feat(uiic): compute the portal's assessment figures

The portal wants parts split into four depreciation classes at their
pre-depreciation price, a GST table on the post-depreciation net, and
labour and paint as one figure. None of those are shapes the report
prints, so the surveyor re-derives them by hand on every claim.

The pre/post-depreciation asymmetry is the portal's, not a mistake, and
a test pins it so it does not get tidied away."
```

---

### Task 2: The dialog

**Files:**
- Create: `src/components/dialogs/UIICSummaryDialog.tsx`

**Interfaces:**
- Consumes: `uiicPortalSummary`, `UiicPortalSummary`, `UiicGstSlab` from Task 1;
  `projectForBillCheck(rows: AssessmentRow[]): AssessmentRow[]` from
  `@/lib/reports/bill-check-projection`.
- Produces: `UIICSummaryDialog({ rows, ageMonths, depType, onClose })`, which
  Task 3 mounts.

- [ ] **Step 1: Write the component**

Create `src/components/dialogs/UIICSummaryDialog.tsx`:

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import { uiicPortalSummary, type UiicGstSlab } from '@/lib/calculations/uiic-portal-summary';
import { projectForBillCheck } from '@/lib/reports/bill-check-projection';
import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import { X, Check, Copy, ClipboardList } from 'lucide-react';

interface Props {
  rows: AssessmentRow[];
  ageMonths: number;
  depType: DepreciationType;
  onClose: () => void;
}

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * One portal field: its label, its value, a tick to keep your place, and a
 * copy button.
 *
 * The tick matters more than the copy. 45 of the portal's inputs carry
 * onpaste="return false;", including every money field here, so these numbers
 * get typed by hand down a long form.
 */
function Field({ label, value }: { label: string; value: number }) {
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(String(value)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => undefined,
    );
  };

  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${done ? 'opacity-45' : 'hover:bg-muted/40'}`}>
      <button
        onClick={() => setDone((d) => !d)}
        aria-label={done ? `Mark ${label} not entered` : `Mark ${label} entered`}
        className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          done ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
        }`}
      >
        {done && <Check size={13} />}
      </button>
      <span className="flex-1 text-xs text-muted-foreground leading-snug">{label}</span>
      <span className="font-mono text-base font-semibold tabular-nums">{money(value)}</span>
      <button
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function GstTable({ title, slabs }: { title: string; slabs: UiicGstSlab[] }) {
  if (!slabs.length) return null;
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold text-muted-foreground px-3 pb-1">{title}</div>
      {slabs.map((s) => (
        <Field key={s.rate} label={`${s.rate}% — Amount`} value={s.amount} />
      ))}
    </div>
  );
}

export function UIICSummaryDialog({ rows, ageMonths, depType, onClose }: Props) {
  const [source, setSource] = useState<'assessment' | 'billcheck'>('assessment');

  const summary = useMemo(() => {
    const basis = source === 'billcheck' ? projectForBillCheck(rows) : rows;
    return uiicPortalSummary(basis, ageMonths, depType);
  }, [rows, ageMonths, depType, source]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl bg-card border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" />
            <span className="text-sm font-semibold">United India — Portal Entry</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
            {(['assessment', 'billcheck'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  source === s ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
                }`}
              >
                {s === 'assessment' ? 'Assessment' : 'Bill Check'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2">
          <div className="text-[11px] font-semibold text-muted-foreground px-3 pt-2 pb-1">
            PARTS — enter the full amount, the portal depreciates
          </div>
          <Field label="Vehicle Age Based Depreciation (Excluding GST)" value={summary.parts.ageBasedDep} />
          <Field label="Parts at 50% Depreciation (rubber, nylon, plastic, tyres and tubes, batteries, air bags) (Excluding GST)" value={summary.parts.dep50} />
          <Field label="Parts at 30% Depreciation (fibre glass components) (Excluding GST)" value={summary.parts.dep30} />
          <Field label="Parts at Nil Depreciation (parts made of glass) (Excluding GST)" value={summary.parts.nilDep} />

          <GstTable title="GST — PARTS (amount after depreciation)" slabs={summary.partsGst} />

          <div className="text-[11px] font-semibold text-muted-foreground px-3 pt-4 pb-1">LABOUR</div>
          <Field label="Labour" value={summary.labour.labour} />
          <Field label="Paint" value={summary.labour.paint} />
          <Field label="Less: Paint Depreciation" value={summary.labour.lessPaintDep} />
          <div className="border-t border-border my-1" />
          <Field label="Labour Charges (Excluding GST) — total" value={summary.labour.totalLabour} />

          <GstTable title="GST — LABOUR (amount after depreciation)" slabs={summary.labourGst} />

          {Math.abs(summary.tieOut.delta) >= 0.005 && (
            <div className="mt-3 mx-3 mb-1 px-3 py-2 rounded-lg bg-muted/50 text-[11px] text-muted-foreground">
              Rounding the four boxes differs from the exact total by{' '}
              <span className="font-mono font-semibold">{money(summary.tieOut.delta)}</span>. Absorb it in
              excess or salvage.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Check it compiles and lints**

```bash
npx tsc --noEmit
npx eslint src/components/dialogs/UIICSummaryDialog.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dialogs/UIICSummaryDialog.tsx
git commit -m "feat(uiic): add the portal entry panel

Shows the portal's figures under its own labels, with a tick per field
so the surveyor keeps their place down a long form. The tick leads and
the copy button follows deliberately: the portal blocks paste on every
money field, so these are typed.

Toggling to Bill Check reruns the same figures over the bill-check
projection."
```

---

### Task 3: Open it from the assessment grid

**Files:**
- Modify: `src/components/claim/AssessmentGrid.tsx`

**Interfaces:**
- Consumes: `UIICSummaryDialog` from Task 2. `assessmentRows`, `ageMonths` and
  `depreciationType` already exist in this component at
  `AssessmentGrid.tsx:209-216`.
- Produces: nothing. This is the last task.

- [ ] **Step 1: Add the imports**

In `src/components/claim/AssessmentGrid.tsx`, add to the existing
lucide-react import on line 9 the `ClipboardList` icon, so it reads:

```tsx
import { Trash2, PlusCircle, Wrench, Settings2, Eye, EyeOff, ClipboardList } from 'lucide-react';
```

Then add below it:

```tsx
import { UIICSummaryDialog } from '@/components/dialogs/UIICSummaryDialog';
```

- [ ] **Step 2: Add the open/close state**

Immediately after the line `const assessmentRows = allRows;` (about line 209),
add:

```tsx
  const [showUiicSummary, setShowUiicSummary] = useState(false);
```

- [ ] **Step 3: Add the toolbar button**

In the header's `<div className="flex gap-2 items-center">`, immediately before
the existing "Paint Row" button, add:

```tsx
          <button
            onClick={() => setShowUiicSummary(true)}
            title="Figures for the United India portal"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-colors border border-amber-500/20 text-xs font-semibold"
          >
            <ClipboardList size={14} /> UIIC Portal
          </button>
```

- [ ] **Step 4: Render the dialog**

At the end of the component's returned JSX, immediately before the closing
`</Card>`, add:

```tsx
      {showUiicSummary && (
        <UIICSummaryDialog
          rows={assessmentRows}
          ageMonths={ageMonths}
          depType={depreciationType}
          onClose={() => setShowUiicSummary(false)}
        />
      )}
```

- [ ] **Step 5: Verify the whole suite and the build**

```bash
npx tsc --noEmit
npx vitest run src/lib/calculations
npx next build
```

Expected: types clean, all calculation tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/claim/AssessmentGrid.tsx
git commit -m "feat(uiic): open the portal panel from the assessment grid

The grid already holds the rows, the vehicle age and the depreciation
type, so the button belongs beside the row controls rather than in a
menu the surveyor has to go looking for."
```

---

## Verification

After Task 3, confirm by hand against the Octavia claim in
`docs/samples/`, or any claim where every part was allowed on a disposal basis:

- all four parts boxes read zero except **Parts at Nil Depreciation**
- the parts GST table shows a single **0%** row equal to that same figure
- **Labour Charges** equals labour plus paint minus paint depreciation
- toggling to **Bill Check** changes the figures where billed amounts differ
  from assessed, and leaves them alone where they do not
