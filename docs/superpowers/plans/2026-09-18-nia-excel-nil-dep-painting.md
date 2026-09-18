# NIA Excel — Nil-Dep Painting and Bill-Check Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a nil-depreciation policy, put painting into the NIA Excel as a
labour row so the portal cannot depreciate it; gate the dialog on the surveyor
confirming the bill check is done; tell the surveyor exactly what to do in the
Painting section for each policy type.

**Architecture:** Amendment to the shipped feature (spec R11, R12). The builder
gains a `billed` painting sum and appends one labour row when `depType ===
'nil'`. The dialog gains a confirmation checkbox that hides everything until
ticked, and branches its painting section and tip on `depType`. Nothing else
changes.

**Tech Stack:** TypeScript, React 19, Vitest, ExcelJS (unchanged).

**Spec:** `docs/superpowers/specs/2026-09-18-nia-assessment-excel-design.md` — R7, R11, R12, §3.1 "Nil-dep painting row", §3.3.

## Global Constraints

- The nil-dep painting row is exactly: `category` `Labor Charges`,
  `description` `Other Labor Charges`, `partName` `Painting Charges`,
  `serviceType` `ALLOW`, `depreciationPercentage` `'0'`, `hsnCode` `'8512'`,
  `gstPercentage` `'18'`, amounts = the three painting sums as
  two-decimal strings. It is the **last** row, `SlNo` = n+1.
- It is appended only when `depType === 'nil'` **and** at least one paint row
  exists. Never on a standard policy.
- `niaPainting.assessed` and `.billed` sum **allowed** paint rows only;
  `.estimate` sums all paint rows. `assessed` uses `effectiveAssessed`.
- The gate checkbox is local `useState(false)`, so it resets on every open.
  Until ticked, the upload section, painting section and Download button do
  not render. The header and the tip do.
- Tip and painting-section wording are taken **verbatim** from spec §3.3.
- The dialog header shows which policy it detected: "Standard policy" or
  "Nil Depreciation policy".
- Only `nia-assessment-excel.ts`, its test, and `NIAExportDialog.tsx` change.
- Commit with explicit file paths only. Never `git add -A` / `git add .` —
  the tree has an untracked `design/` folder that must not be committed.

---

### Task 1: Builder — painting `billed` sum and the nil-dep labour row

**Files:**
- Modify: `src/lib/reports/nia-assessment-excel.ts`
- Test: `src/lib/reports/__tests__/nia-assessment-excel.test.ts`

**Interfaces:**
- Consumes: everything already in the module — `NiaAssessmentRow`,
  `NiaDescription`, `money`, `whole`, `effectiveAssessed`.
- Produces: `NiaPainting` now `{ estimate, assessed, billed }`;
  `NiaDescription` gains `'Other Labor Charges'`; `niaAssessmentRows(rows,
  ageMonths, depType)` appends the painting row on nil-dep. Task 2 reads
  `niaPainting(...).assessed` for the nil-dep notice.

- [ ] **Step 1: Write the failing tests**

In `src/lib/reports/__tests__/nia-assessment-excel.test.ts`, append a new
describe block at the end of the file:

```ts
describe('niaAssessmentRows — nil-dep painting row', () => {
  const paintRows = [
    row({ section: 'paint', partType: 'paint', estimated: 20000, assessed: 17000, billedTaxable: 16500 }),
    row({ section: 'paint', partType: 'paint', estimated: 8003.76, assessed: 6732, billedTaxable: 6732 }),
    row({ section: 'paint', partType: 'paint', estimated: 1000, assessed: 900, billedTaxable: 900, allowed: false }),
  ];

  test('on a nil-dep policy painting goes in as one final labour row the portal cannot depreciate', () => {
    // R11. The portal's 50% on paint material is hardcoded; a labour row is
    // the only place painting passes through untouched.
    const rows = niaAssessmentRows([row({ partType: 'metal' }), ...paintRows], AGE, 'nil');
    expect(rows).toHaveLength(2);
    const p = rows[1];
    expect(p.SlNo).toBe(2);
    expect(p.category).toBe('Labor Charges');
    expect(p.description).toBe('Other Labor Charges');
    expect(p.partName).toBe('Painting Charges');
    expect(p.serviceType).toBe('ALLOW');
    expect(p.estimatedAmount).toBe('29003.76');
    expect(p.billedAmount).toBe('23232.00');
    expect(p.assessedAmount).toBe('23732.00');
    expect(p.depreciationPercentage).toBe('0');
    expect(p.hsnCode).toBe('8512');
    expect(p.gstPercentage).toBe('18');
  });

  test('on a nil-dep policy with no paint rows, no painting row is added', () => {
    const rows = niaAssessmentRows([row({ partType: 'metal' })], AGE, 'nil');
    expect(rows).toHaveLength(1);
  });

  test('on a standard policy no painting row is added, whatever the paint rows', () => {
    // R7. Standard-policy painting is typed into the Painting section.
    const rows = niaAssessmentRows([row({ partType: 'metal' }), ...paintRows], AGE, 'standard');
    expect(rows).toHaveLength(1);
    expect(rows.some((r) => r.partName === 'Painting Charges')).toBe(false);
  });

  test('niaPainting also sums the billed figure over allowed paint rows', () => {
    const p = niaPainting(paintRows);
    expect(p.billed).toBeCloseTo(23232, 2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/lib/reports/__tests__/nia-assessment-excel.test.ts
```

Expected: 4 new tests FAIL (`toHaveLength(2)` gets 1; `p.billed` is
undefined). The existing 18 still pass.

- [ ] **Step 3: Implement**

In `src/lib/reports/nia-assessment-excel.ts`:

(a) Add the description to the union:

```ts
export type NiaDescription =
  | 'Parts at Agewise Depreciation'
  | 'Parts at 50% Depreciation'
  | 'Parts at 30% Depreciation'
  | 'Parts at Cost'
  | 'Labor charges for Removing and Refitting'
  | 'Other Labor Charges';
```

(b) Extend the painting type:

```ts
export interface NiaPainting {
  estimate: number;
  assessed: number;
  billed: number;
}
```

(c) Replace `niaPainting` with:

```ts
/**
 * The painting figures. On a standard policy the surveyor types estimate and
 * assessed into the portal's Painting section under "Consolidated" and the
 * portal depreciates the material half itself, so both are pre-depreciation
 * sums. On a nil-dep policy they feed the labour row below instead.
 */
export function niaPainting(rows: AssessmentRow[]): NiaPainting {
  const paint = rows.filter((r) => r.section === 'paint');
  const allowed = paint.filter((r) => r.allowed);
  return {
    estimate: paint.reduce((s, r) => s + (r.estimated || 0), 0),
    assessed: allowed.reduce((s, r) => s + effectiveAssessed(r), 0),
    billed: allowed.reduce((s, r) => s + (r.billedTaxable ?? 0), 0),
  };
}
```

(d) In `niaAssessmentRows`, change the body so the mapped rows are held in a
variable and the painting row is appended on nil-dep. Replace the
`return rows.filter(...).map(...)` with:

```ts
  const sheet = rows
    .filter((r) => r.section === 'parts' || r.section === 'labour')
    .map((r, i): NiaAssessmentRow => {
      // … existing body unchanged …
    });

  // The portal takes 50% off paint material in every painting mode, with no
  // policy check. On a nil-depreciation policy surveyors route painting
  // through the labour column, where no depreciation applies; do it for them.
  if (depType === 'nil' && rows.some((r) => r.section === 'paint')) {
    const p = niaPainting(rows);
    sheet.push({
      SlNo: sheet.length + 1,
      category: 'Labor Charges',
      description: 'Other Labor Charges',
      partName: 'Painting Charges',
      serviceType: 'ALLOW',
      estimatedAmount: money(p.estimate),
      billedAmount: money(p.billed),
      assessedAmount: money(p.assessed),
      depreciationPercentage: '0',
      hsnCode: '8512',
      gstPercentage: '18',
    });
  }

  return sheet;
```

Keep the existing `.map` body exactly as it is; only the surrounding
`return` becomes `const sheet =` and the block above follows it.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/lib/reports/__tests__/nia-assessment-excel.test.ts
```

Expected: **22 passed**.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "nia-assessment-excel|NIAExportDialog"
```

Expected: no output. (The dialog still compiles: it reads `.estimate` and
`.assessed`, both still present.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/nia-assessment-excel.ts src/lib/reports/__tests__/nia-assessment-excel.test.ts
git commit -m "feat(nia): put painting through the labour column on nil-dep policies

The portal takes 50% off paint material in every painting mode and never
checks the policy, so on a nil-depreciation policy the Painting section
would depreciate painting that the report allows in full. Surveyors route
it through a labour row, where no depreciation applies; the export now
does that for them when the claim's Policy Depreciation is nil.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Dialog — bill-check gate, policy branch, tips

**Files:**
- Modify: `src/components/dialogs/NIAExportDialog.tsx`

**Interfaces:**
- Consumes: `niaPainting(rows): { estimate, assessed, billed }` and
  `niaAssessmentRows` from Task 1; `depType: DepreciationType` prop already
  present (`'standard' | 'nil'`).
- Produces: nothing new. Same props.

- [ ] **Step 1: Add the gate state**

Directly under `const [error, setError] = useState('');` add:

```tsx
  // Reset on every open: a file built before the bill check carries billed = 0
  // on every row, and nothing here should make that easy.
  const [billCheckDone, setBillCheckDone] = useState(false);
  const isNilDep = depType === 'nil';
```

- [ ] **Step 2: Show the detected policy in the header**

Replace the header title span:

```tsx
            <span className="text-sm font-semibold">New India — Assessment Upload</span>
```

with:

```tsx
            <div className="flex flex-col">
              <span className="text-sm font-semibold">New India — Assessment Upload</span>
              <span className="text-[11px] text-muted-foreground">
                {isNilDep ? 'Nil Depreciation policy' : 'Standard policy'} — from the Assessment tab
              </span>
            </div>
```

- [ ] **Step 3: Replace the body**

Replace everything from `<div className="p-4 space-y-4">` down to its matching
closing `</div>` (the block that currently holds the upload section, the
painting section and the tip) with:

```tsx
        <div className="p-4 space-y-4">
          <label className="mx-3 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={billCheckDone}
              onChange={(e) => setBillCheckDone(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border"
            />
            <span className="text-xs">
              <span className="font-semibold">Bill amounts verified and bill check complete</span>{' '}
              <span className="text-muted-foreground">
                for this claim. The file carries every row&apos;s billed figure; before the bill check
                those are all zero.
              </span>
            </span>
          </label>

          {billCheckDone && (
            <>
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground px-3 pb-1">
                  1 · UPLOAD — Primary Assessment Template
                </div>
                <div className="px-3 text-xs text-muted-foreground">
                  {sheetRows.length} rows: parts and labour
                  {isNilDep ? ', including the painting row' : '. Paint is entered separately below'}.
                </div>
                {rowError && <div className="px-3 text-xs text-destructive">{rowError}</div>}
                <button
                  onClick={download}
                  disabled={busy || sheetRows.length === 0 || !!rowError}
                  className="mt-2 mx-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Download Excel
                </button>
                {error && <div className="mt-2 px-3 text-xs text-destructive">{error}</div>}
              </div>

              <div>
                <div className="text-[11px] font-semibold text-muted-foreground px-3 pb-1">
                  {isNilDep ? '2 · PAINTING' : '2 · PAINTING — work details "Consolidated"'}
                </div>
                {isNilDep ? (
                  <div className="px-3 text-xs">
                    Painting Charges{' '}
                    <span className="font-mono font-semibold">{money(painting.assessed)}</span> is inside
                    the file as a labour row. Leave the Painting section empty.
                  </div>
                ) : (
                  <>
                    <Field label="Painting Charges — Estimated" value={painting.estimate} />
                    <Field label="Painting Charges — Assessed" value={painting.assessed} />
                  </>
                )}
              </div>
            </>
          )}

          <div className="mx-3 px-3 py-2 rounded-lg bg-muted/50 text-[11px] text-muted-foreground">
            {isNilDep
              ? 'Do not enter painting in the Painting section. The portal depreciates painting material on every policy, including nil-dep; the labour row in the file is how it goes through untouched.'
              : 'Choose Consolidated in the Painting section. The portal takes 25% as material and depreciates that half — the same 12.5% as your report. Do not reduce the assessed figure yourself or it will be depreciated twice.'}
            {' '}On the portal: upload the file, then click <span className="font-semibold">Validate</span>.
          </div>
        </div>
```

Note the `"Consolidated"` in the standard heading is inside a JS string
expression, so it needs no `&quot;` escaping; the `&apos;` in the gate text
is required for `react/no-unescaped-entities`.

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit 2>&1 | grep NIAExportDialog
npx eslint src/components/dialogs/NIAExportDialog.tsx
```

Expected: no output from tsc; eslint reports no errors.

- [ ] **Step 5: Full verification**

```bash
npx vitest run src/lib/reports
npx next build
```

Expected: all `src/lib/reports` tests pass (22 in the NIA file); build
succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/dialogs/NIAExportDialog.tsx
git commit -m "feat(nia): gate the export on the bill check and branch painting on policy type

Nothing shows until the surveyor confirms the bill check is done — the
file is post-bill by design and a premature one carries zero billed on
every row. The painting section and the tip then follow the claim's
Policy Depreciation: figures to type under Consolidated on a standard
policy, or a notice that painting is already in the file on nil-dep.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verification

After Task 2, on a claim with paint rows:

- Open **NIA Excel**: only the header (with the policy name), the checkbox and
  the tip are visible. Tick it → upload section and painting section appear.
- With Policy Depreciation = **Standard**: two painting figures; the Excel has
  no `Painting Charges` row.
- Switch Policy Depreciation to **Nil** and reopen: header says "Nil
  Depreciation policy", the painting section is a notice, the row count is one
  higher, and the Excel's last row is `Painting Charges` under `Labor Charges`
  / `Other Labor Charges` with dep 0.
- Close and reopen: the checkbox is unticked again.
