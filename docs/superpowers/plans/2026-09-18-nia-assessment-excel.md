# NIA Assessment Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the `Primary_Assessment_Template` Excel that New India's
surveyor portal imports, straight from the claim's assessment rows, and show
the two painting figures the portal wants typed beside it.

**Architecture:** One pure mapping module over `AssessmentRow[]` that emits
the portal's 11-column rows and the painting pair, plus an exporter that
writes them with ExcelJS and `file-saver` exactly as `irdai-summary-builder.ts`
already does. One small dialog renders the painting figures and the download
button. One button in `AssessmentGrid` opens it. Nothing existing changes
except that button.

**Tech Stack:** TypeScript, React 19, Next.js 16, Vitest, ExcelJS 4, file-saver,
Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-18-nia-assessment-excel-design.md`
**Portal reference:** `docs/portal-integration.md` §5

## Global Constraints

- `assessedAmount` is **pre-depreciation** (R1). Never apply our depreciation
  to it — the portal does that from `description` and `depreciationPercentage`.
- HSN is chosen **by GST rate only**: 18 → `8512`, 28 → `8708`, 0 → `72041000`
  (R4). Never read the garage's `hsnSac`.
- Disposal parts: `Parts at Cost`, assessed = `computeRowNet().netBeforeGst`,
  dep `0`, GST `0`, HSN `72041000` (R5).
- `serviceType` takes only `REPLACE`, `ALLOW`, `NOT ALLOWED` (R6).
- Paint rows are **excluded** from the sheet and summed into the painting pair
  (R7).
- Disallowed rows are **included** with assessed `0.00` (R8).
- Every amount is a **string** with two decimals; percentages are integer
  strings; no cell is ever empty; the sheet is named exactly
  `Primary_Assessment_Template` (R9).
- `billedAmount` is `billedTaxable`, falling back to `0` (R10).
- Existing modules are read-only: do not edit `assessment.ts`, `row-net.ts`,
  `depreciation.ts`, `types/assessment.ts`, `irdai-summary-builder.ts`.
- Tests use Vitest with `describe` / `test` / `expect` from `vitest`, matching
  `src/lib/reports/__tests__/bill-check-projection.test.ts`.

---

### Task 1: The mapping — `niaAssessmentRows` and `niaPainting`

**Files:**
- Create: `src/lib/reports/nia-assessment-excel.ts`
- Test: `src/lib/reports/__tests__/nia-assessment-excel.test.ts`

**Interfaces:**
- Consumes: `getDepreciationRate(partType, ageMonths, policyType): number`
  from `@/lib/calculations/depreciation`; `computeRowNet(row, depRate):
  { afterDep, isDisposal, netBeforeGst }` from `@/lib/calculations/row-net`;
  types `AssessmentRow` from `@/types/assessment` and `DepreciationType`
  from `@/types`.
- Produces: `niaAssessmentRows(rows, ageMonths, depType): NiaAssessmentRow[]`,
  `niaPainting(rows): NiaPainting`, `NIA_COLUMNS: readonly string[]`, and the
  exported types `NiaAssessmentRow`, `NiaPainting`. Task 2 adds the exporter to
  this same file; Task 3 renders these.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reports/__tests__/nia-assessment-excel.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { NIA_COLUMNS, niaAssessmentRows, niaPainting } from '../nia-assessment-excel';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 10000,
    assessed: 10000,
    billedTaxable: 9000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

// 100 months old => 40% metal depreciation under the IRDAI scale.
const AGE = 100;

describe('niaAssessmentRows — parts', () => {
  test('a metal part goes in at its FULL pre-depreciation price', () => {
    // R1. The portal depreciates; we send the raw assessed figure.
    const [r] = niaAssessmentRows([row({ assessed: 10000, partType: 'metal' })], AGE, 'standard');
    expect(r.category).toBe('Spare Parts');
    expect(r.description).toBe('Parts at Agewise Depreciation');
    expect(r.serviceType).toBe('REPLACE');
    expect(r.assessedAmount).toBe('10000.00');
    expect(r.depreciationPercentage).toBe('40');
    expect(r.hsnCode).toBe('8512');
    expect(r.gstPercentage).toBe('18');
  });

  test('plastic, fibreglass and glass map to their descriptions', () => {
    const rows = niaAssessmentRows(
      [
        row({ partType: 'plastic' }),
        row({ partType: 'fiberglass' }),
        row({ partType: 'glass' }),
      ],
      AGE,
      'standard',
    );
    expect(rows.map((r) => r.description)).toEqual([
      'Parts at 50% Depreciation',
      'Parts at 30% Depreciation',
      'Parts at Cost',
    ]);
    expect(rows.map((r) => r.depreciationPercentage)).toEqual(['50', '30', '0']);
  });

  test('a disposal part is Parts at Cost at its allowed value, zero GST, scrap HSN', () => {
    // R5. 40% dep then 50% disposal => 10000 x 0.6 x 0.5 = 3000.
    const [r] = niaAssessmentRows(
      [row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })],
      AGE,
      'standard',
    );
    expect(r.description).toBe('Parts at Cost');
    expect(r.assessedAmount).toBe('3000.00');
    expect(r.depreciationPercentage).toBe('0');
    expect(r.gstPercentage).toBe('0');
    expect(r.hsnCode).toBe('72041000');
  });

  test('a disallowed part is still emitted, as NOT ALLOWED with assessed 0', () => {
    // R8. The insurer sees what was claimed.
    const [r] = niaAssessmentRows([row({ allowed: false, estimated: 500 })], AGE, 'standard');
    expect(r.serviceType).toBe('NOT ALLOWED');
    expect(r.estimatedAmount).toBe('500.00');
    expect(r.assessedAmount).toBe('0.00');
  });

  test('HSN follows the GST rate: 28% is 8708, 0% is 72041000', () => {
    // R4
    const rows = niaAssessmentRows([row({ gst: 28 }), row({ gst: 0 })], AGE, 'standard');
    expect(rows.map((r) => r.hsnCode)).toEqual(['8708', '72041000']);
  });

  test('a surveyor override on depreciation is what goes in the file', () => {
    const [r] = niaAssessmentRows([row({ partType: 'metal', depOverride: 25 })], AGE, 'standard');
    expect(r.depreciationPercentage).toBe('25');
  });
});

describe('niaAssessmentRows — labour and paint', () => {
  test('labour rows are Labor Charges / ALLOW with zero depreciation', () => {
    const [r] = niaAssessmentRows(
      [row({ section: 'labour', partType: 'labour', assessed: 737.5 })],
      AGE,
      'standard',
    );
    expect(r.category).toBe('Labor Charges');
    expect(r.description).toBe('Labor charges for Removing and Refitting');
    expect(r.serviceType).toBe('ALLOW');
    expect(r.depreciationPercentage).toBe('0');
    expect(r.assessedAmount).toBe('737.50');
  });

  test('paint rows are excluded from the sheet', () => {
    // R7. Painting is typed into the portal separately.
    const rows = niaAssessmentRows(
      [row({ section: 'parts' }), row({ section: 'paint', partType: 'paint' })],
      AGE,
      'standard',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('Spare Parts');
  });

  test('billedAmount is the billed taxable figure, or 0 when absent', () => {
    // R10
    const rows = niaAssessmentRows(
      [row({ billedTaxable: 9645.76 }), row({ billedTaxable: undefined })],
      AGE,
      'standard',
    );
    expect(rows.map((r) => r.billedAmount)).toEqual(['9645.76', '0.00']);
  });
});

describe('niaAssessmentRows — shape', () => {
  test('SlNo runs 1..n and every key is in the portal order with no empty cell', () => {
    // R9. The portal counts keys on row 1 and rejects any blank.
    const rows = niaAssessmentRows(
      [row(), row({ section: 'labour', partType: 'labour' }), row({ allowed: false })],
      AGE,
      'standard',
    );
    expect(rows.map((r) => r.SlNo)).toEqual([1, 2, 3]);
    for (const r of rows) {
      expect(Object.keys(r)).toEqual([...NIA_COLUMNS]);
      for (const v of Object.values(r)) expect(String(v)).not.toBe('');
    }
  });

  test('partName is trimmed and cut at 100 characters', () => {
    const [r] = niaAssessmentRows([row({ particulars: '  ' + 'x'.repeat(150) + '  ' })], AGE, 'standard');
    expect(r.partName).toHaveLength(100);
    expect(r.partName.startsWith('x')).toBe(true);
  });
});

describe('niaPainting', () => {
  test('sums estimate over all paint rows and assessed over allowed ones, pre-dep', () => {
    // R7. The Tigor figures: estimate 28003.76, assessed 23732.
    const p = niaPainting([
      row({ section: 'paint', partType: 'paint', estimated: 20000, assessed: 17000, depOverride: 12.5 }),
      row({ section: 'paint', partType: 'paint', estimated: 8003.76, assessed: 6732 }),
      row({ section: 'paint', partType: 'paint', estimated: 1000, assessed: 900, allowed: false }),
      row({ section: 'parts', estimated: 5000, assessed: 5000 }),
    ]);
    expect(p.estimate).toBeCloseTo(29003.76, 2);
    expect(p.assessed).toBeCloseTo(23732, 2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/reports/__tests__/nia-assessment-excel.test.ts
```

Expected: FAIL — `Failed to resolve import "../nia-assessment-excel"`.

- [ ] **Step 3: Write the mapping**

Create `src/lib/reports/nia-assessment-excel.ts`:

```ts
// ═══════════════════════════════════════════════════════════
// NIA ASSESSMENT EXCEL
// The Primary_Assessment_Template that New India's surveyor portal imports.
// Spec: docs/superpowers/specs/2026-09-18-nia-assessment-excel-design.md
// Portal behaviour: docs/portal-integration.md §5.3
// ═══════════════════════════════════════════════════════════

import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import { getDepreciationRate } from '@/lib/calculations/depreciation';
import { computeRowNet } from '@/lib/calculations/row-net';

/** The portal's header row, in the order it expects. It counts these keys. */
export const NIA_COLUMNS = [
  'SlNo',
  'category',
  'description',
  'partName',
  'serviceType',
  'estimatedAmount',
  'billedAmount',
  'assessedAmount',
  'depreciationPercentage',
  'hsnCode',
  'gstPercentage',
] as const;

export type NiaDescription =
  | 'Parts at Agewise Depreciation'
  | 'Parts at 50% Depreciation'
  | 'Parts at 30% Depreciation'
  | 'Parts at Cost'
  | 'Labor charges for Removing and Refitting';

export interface NiaAssessmentRow {
  SlNo: number;
  category: 'Spare Parts' | 'Labor Charges';
  description: NiaDescription;
  partName: string;
  serviceType: 'REPLACE' | 'ALLOW' | 'NOT ALLOWED';
  /** All amounts are strings: the portal reads assessedAmount with a string method. */
  estimatedAmount: string;
  billedAmount: string;
  /** Pre-depreciation. The portal applies the rate itself. */
  assessedAmount: string;
  depreciationPercentage: string;
  hsnCode: string;
  gstPercentage: string;
}

export interface NiaPainting {
  estimate: number;
  assessed: number;
}

const money = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2);
const whole = (n: number) => String(Math.round(Number.isFinite(n) ? n : 0));

/**
 * The portal validates HSN against its own table and takes the GST rate from
 * it, so the code must be one known to be on that table. Motor rows carry only
 * these three rates.
 */
function hsnForRate(gst: number): string {
  if (gst === 28) return '8708';
  if (gst === 0) return '72041000';
  return '8512';
}

/**
 * The portal sets and locks the depreciation rate from this string for every
 * value except "Parts at Agewise Depreciation", which reads our number.
 */
function descriptionFor(r: AssessmentRow): NiaDescription {
  if (r.section === 'labour') return 'Labor charges for Removing and Refitting';
  if (r.isDisposal) return 'Parts at Cost';
  switch (r.partType) {
    case 'plastic':
      return 'Parts at 50% Depreciation';
    case 'fiberglass':
      return 'Parts at 30% Depreciation';
    case 'glass':
      return 'Parts at Cost';
    default:
      return 'Parts at Agewise Depreciation';
  }
}

/**
 * Builds the sheet rows. Parts and labour only; paint is typed into the
 * portal separately (see `niaPainting`). Disallowed rows are kept, at zero,
 * so the insurer sees what was claimed.
 */
export function niaAssessmentRows(
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
): NiaAssessmentRow[] {
  const depRateFor = (r: AssessmentRow) =>
    r.depOverride !== undefined
      ? r.depOverride
      : getDepreciationRate(r.partType, ageMonths, depType);

  return rows
    .filter((r) => r.section === 'parts' || r.section === 'labour')
    .map((r, i): NiaAssessmentRow => {
      const isLabour = r.section === 'labour';
      const disposal = !isLabour && !!r.isDisposal;

      // A used part's allowed value is already what the surveyor is paying —
      // it must not be depreciated again, and it carries no GST.
      const assessed = !r.allowed
        ? 0
        : disposal
          ? computeRowNet(r, depRateFor(r)).netBeforeGst
          : r.assessed;
      const gst = disposal ? 0 : r.gst;
      const dep = isLabour || disposal ? 0 : depRateFor(r);

      return {
        SlNo: i + 1,
        category: isLabour ? 'Labor Charges' : 'Spare Parts',
        description: descriptionFor(r),
        partName: (r.particulars ?? '').trim().slice(0, 100) || 'Item',
        serviceType: !r.allowed ? 'NOT ALLOWED' : isLabour ? 'ALLOW' : 'REPLACE',
        estimatedAmount: money(r.estimated),
        billedAmount: money(r.billedTaxable ?? 0),
        assessedAmount: money(assessed),
        depreciationPercentage: whole(dep),
        hsnCode: disposal ? '72041000' : hsnForRate(gst),
        gstPercentage: whole(gst),
      };
    });
}

/**
 * The two painting figures typed into the portal under "Consolidated". The
 * portal splits them 75/25 and depreciates the material half itself, so both
 * are pre-depreciation sums.
 */
export function niaPainting(rows: AssessmentRow[]): NiaPainting {
  const paint = rows.filter((r) => r.section === 'paint');
  return {
    estimate: paint.reduce((s, r) => s + (r.estimated || 0), 0),
    assessed: paint.filter((r) => r.allowed).reduce((s, r) => s + (r.assessed || 0), 0),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/reports/__tests__/nia-assessment-excel.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/nia-assessment-excel.ts src/lib/reports/__tests__/nia-assessment-excel.test.ts
git commit -m "feat(nia): map assessment rows to the portal's Excel template

New India's surveyor portal imports the assessment as an eleven-column
sheet and then recomputes depreciation from the description column and
GST from the HSN code, so those two columns are chosen to drive the
portal rather than to describe the row. Amounts are strings because the
portal reads assessedAmount with a string method."
```

---

### Task 2: The exporter — `exportNiaAssessmentExcel`

**Files:**
- Modify: `src/lib/reports/nia-assessment-excel.ts` (append)
- Test: `src/lib/reports/__tests__/nia-assessment-excel.test.ts` (append)

**Interfaces:**
- Consumes: `niaAssessmentRows`, `NIA_COLUMNS` from Task 1; `ExcelJS` default
  export from `exceljs`; `saveAs` from `file-saver`.
- Produces: `buildNiaWorkbook(rows: NiaAssessmentRow[]): ExcelJS.Workbook`
  (pure, testable) and `exportNiaAssessmentExcel(claimNo: string, rows:
  AssessmentRow[], ageMonths: number, depType: DepreciationType):
  Promise<void>` (browser only, triggers the download). Task 3 calls the
  latter.

- [ ] **Step 1: Write the failing test**

In `src/lib/reports/__tests__/nia-assessment-excel.test.ts`, change the
existing import line to:

```ts
import { NIA_COLUMNS, buildNiaWorkbook, niaAssessmentRows, niaPainting } from '../nia-assessment-excel';
```

then append at the end of the file:

```ts
describe('buildNiaWorkbook', () => {
  test('one sheet named Primary_Assessment_Template, header row is the portal columns, amounts are text', () => {
    const rows = niaAssessmentRows([row({ assessed: 1234.5 })], AGE, 'standard');
    const wb = buildNiaWorkbook(rows);

    expect(wb.worksheets.map((w) => w.name)).toEqual(['Primary_Assessment_Template']);
    const ws = wb.getWorksheet('Primary_Assessment_Template')!;

    const header = ws.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual([...NIA_COLUMNS]); // ExcelJS row values are 1-based

    const first = ws.getRow(2);
    expect(first.getCell(1).value).toBe(1); // SlNo stays numeric
    expect(first.getCell(8).value).toBe('1234.50'); // assessedAmount, a string
    expect(typeof first.getCell(8).value).toBe('string');
    expect(ws.rowCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/reports/__tests__/nia-assessment-excel.test.ts
```

Expected: FAIL — `buildNiaWorkbook` is not exported.

- [ ] **Step 3: Write the exporter**

Append to `src/lib/reports/nia-assessment-excel.ts`, with these two imports
added at the top of the file beneath the existing ones:

```ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
```

and this at the end:

```ts
/** Pure: the workbook the portal expects. Kept separate so it can be tested. */
export function buildNiaWorkbook(rows: NiaAssessmentRow[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Primary_Assessment_Template');
  ws.addRow([...NIA_COLUMNS]);
  for (const r of rows) ws.addRow(NIA_COLUMNS.map((c) => r[c]));
  return wb;
}

/** Browser only. Builds and downloads `<claimNo>_Primary_Assessment_Template.xlsx`. */
export async function exportNiaAssessmentExcel(
  claimNo: string,
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
): Promise<void> {
  const wb = buildNiaWorkbook(niaAssessmentRows(rows, ageMonths, depType));
  const buffer = await wb.xlsx.writeBuffer();
  const safe = (claimNo || 'claim').replace(/[^A-Za-z0-9_-]+/g, '_');
  saveAs(new Blob([buffer]), `${safe}_Primary_Assessment_Template.xlsx`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/reports/__tests__/nia-assessment-excel.test.ts
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors mentioning `nia-assessment-excel`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/nia-assessment-excel.ts src/lib/reports/__tests__/nia-assessment-excel.test.ts
git commit -m "feat(nia): write the assessment template as an xlsx download

Same ExcelJS and file-saver path the IRDAI return already uses. The
workbook builder is split from the download so the sheet name, header
order and text-typed amounts can be asserted."
```

---

### Task 3: The dialog

**Files:**
- Create: `src/components/dialogs/NIAExportDialog.tsx`

**Interfaces:**
- Consumes: `niaAssessmentRows`, `niaPainting`, `exportNiaAssessmentExcel`
  from Task 1/2.
- Produces: `NIAExportDialog({ claimNo, rows, ageMonths, depType, onClose })`,
  mounted by Task 4.

- [ ] **Step 1: Write the component**

Create `src/components/dialogs/NIAExportDialog.tsx`:

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  exportNiaAssessmentExcel,
  niaAssessmentRows,
  niaPainting,
} from '@/lib/reports/nia-assessment-excel';
import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import { X, Check, Copy, FileSpreadsheet, Download, Loader2 } from 'lucide-react';

interface Props {
  claimNo: string;
  rows: AssessmentRow[];
  ageMonths: number;
  depType: DepreciationType;
  onClose: () => void;
}

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One painting figure: label, value, a tick to keep your place, a copy button. */
function Field({ label, value }: { label: string; value: number }) {
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(value.toFixed(2)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => undefined,
    );
  };

  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
        done ? 'opacity-45' : 'hover:bg-muted/40'
      }`}
    >
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

export function NIAExportDialog({ claimNo, rows, ageMonths, depType, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sheetRows = useMemo(() => niaAssessmentRows(rows, ageMonths, depType), [rows, ageMonths, depType]);
  const painting = useMemo(() => niaPainting(rows), [rows]);

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      await exportNiaAssessmentExcel(claimNo, rows, ageMonths, depType);
    } catch {
      setError('Could not build the Excel file. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl bg-card border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-primary" />
            <span className="text-sm font-semibold">New India — Assessment Upload</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground px-3 pb-1">
              1 · UPLOAD — Primary Assessment Template
            </div>
            <div className="px-3 text-xs text-muted-foreground">
              {sheetRows.length} rows: parts and labour. Paint is entered separately below.
            </div>
            <button
              onClick={download}
              disabled={busy || sheetRows.length === 0}
              className="mt-2 mx-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download Excel
            </button>
            {error && <div className="mt-2 px-3 text-xs text-destructive">{error}</div>}
          </div>

          <div>
            <div className="text-[11px] font-semibold text-muted-foreground px-3 pb-1">
              2 · PAINTING — work details "Consolidated"
            </div>
            <Field label="Painting Charges — Estimated" value={painting.estimate} />
            <Field label="Painting Charges — Assessed" value={painting.assessed} />
          </div>

          <div className="mx-3 px-3 py-2 rounded-lg bg-muted/50 text-[11px] text-muted-foreground">
            On the portal: upload the file, click <span className="font-semibold">Validate</span>,
            then type the two painting figures. The portal fills depreciation and GST itself.
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint src/components/dialogs/NIAExportDialog.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dialogs/NIAExportDialog.tsx
git commit -m "feat(nia): dialog with the Excel download and painting figures

Two steps in the order the portal wants them: the file, then the
painting pair typed under Consolidated. Paste is not blocked on NIA, so
the copy button is genuinely useful here."
```

---

### Task 4: Open it from the assessment grid

**Files:**
- Modify: `src/components/claim/AssessmentGrid.tsx`

**Interfaces:**
- Consumes: `NIAExportDialog` from Task 3. `assessmentRows`, `ageMonths`,
  `depreciationType` and `currentClaim` already exist in the component; the
  UIIC button and dialog it mirrors are at lines 211, 288–294 and 431–438.
- Produces: nothing. Last task.

- [ ] **Step 1: Add the import**

In `src/components/claim/AssessmentGrid.tsx`, directly under
`import { UIICSummaryDialog } from '@/components/dialogs/UIICSummaryDialog';`
add:

```tsx
import { NIAExportDialog } from '@/components/dialogs/NIAExportDialog';
```

- [ ] **Step 2: Add the state**

Directly under `const [showUiicSummary, setShowUiicSummary] = useState(false);`
add:

```tsx
  const [showNiaExport, setShowNiaExport] = useState(false);
```

- [ ] **Step 3: Add the button**

Directly after the closing `</button>` of the "UIIC Portal" button (the one
whose text is `<ClipboardList size={14} /> UIIC Portal`), add:

```tsx
          <button
            onClick={() => setShowNiaExport(true)}
            title="Excel for the New India portal"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors border border-emerald-500/20 text-xs font-semibold"
          >
            <ClipboardList size={14} /> NIA Excel
          </button>
```

- [ ] **Step 4: Render the dialog**

Directly after the closing `)}` of the `{showUiicSummary && ( … )}` block, add:

```tsx
      {showNiaExport && (
        <NIAExportDialog
          claimNo={currentClaim?.claimNumber ?? ''}
          rows={assessmentRows}
          ageMonths={ageMonths}
          depType={depreciationType}
          onClose={() => setShowNiaExport(false)}
        />
      )}
```

- [ ] **Step 5: Verify everything**

```bash
npx tsc --noEmit
npx vitest run src/lib
npx next build
```

Expected: types clean, all `src/lib` tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/claim/AssessmentGrid.tsx
git commit -m "feat(nia): open the assessment upload dialog from the grid

Sits beside the UIIC button; the grid already holds every input the
export needs."
```

---

## Verification

After Task 4, on any claim with parts, labour and paint rows:

- **NIA Excel** opens the dialog; the row count equals parts + labour rows
- Download produces `<claimNo>_Primary_Assessment_Template.xlsx`; opened in
  Excel it has one sheet of that name, the 11 headers, and amounts shown as
  text (left-aligned, no thousands separator)
- The two painting figures match the Painting section of the Final Survey
  Report's *estimate* and *pre-depreciation assessed* totals

**Then, once, on the portal** — a test or closed claim: upload the file, click
Validate, and save the page. That confirms the portal's `.includes()` accepts
our text cells, and that every HSN survived its table check. If a row's
`amountAllowed` after Validate equals `assessed × (1 − dep%)`, the pre-dep
convention is proven end to end.
