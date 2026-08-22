# Reachable Scene Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every field the final reports print editable on a final-survey claim, and replace the third-party dropdown with one free-text field.

**Architecture:** Fields move screen, not storage. Every key stays exactly where it is (`spotDetails.*`, `accident.*`), so AI extraction, saved claims and the Spot report are untouched — only the component holding the input changes. Scene fields go into the always-visible `AccidentForm`; the commercial permit and load block becomes a new always-visible `CommercialLoadForm` card in `DetailsTab`. `SpotTab` keeps only what a spot surveyor observes at the scene.

**Tech Stack:** Next.js 16, React, TypeScript, Zustand (`useClaimStore`), Vitest, Tailwind + shadcn/ui.

**Spec:** [2026-08-22-reachable-scene-fields-design.md](../specs/2026-08-22-reachable-scene-fields-design.md)

## Global Constraints

- Storage keys never change. `spotDetails.challanNo`, `spotDetails.panchanama`, `accident.thirdPartyDetails` etc. keep their exact names and objects.
- No field is deleted from any type. `spotDetails.tpInvolved` stays declared and stays in saved claims; it simply stops being read or written.
- `policeReported` and `panchanama` remain Yes/No `<select>` elements. Only third party becomes free text.
- Each field ends with exactly one input in the whole app.
- Run `npx vitest run src/lib/reports` after every report change; `npx tsc --noEmit` after every component change.
- Commit after each task. Work directly on `main` — this repo does not branch.

---

### Deviation from the spec, needs confirmation before Task 4

The spec §4 says the commercial fields go "into `VehicleForm`'s commercial group". On inspection `VehicleForm` has no commercial group — it is a single flat 4-column grid of 30+ fields ([VehicleForm.tsx:32](../../../src/components/claim/VehicleForm.tsx)), already 386 lines. Adding eleven more fields plus a `vehicleType` gate inside that grid would make it worse, not better.

Task 4 instead creates a **new `CommercialLoadForm` card** rendered by `DetailsTab` beside the other form cards, gated on `vehicleType !== 'private'`. This meets the spec's actual requirement — always visible, correct section, one input per field — with a focused file. Confirm this before starting Task 4.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/reports/standard-report-builder.ts` | Standard Final + Bill Check HTML | Modify — drop duplicate GVW/ULW rows, collapse TP rows to free text |
| `src/lib/reports/uiic-final-builder.ts` | UIIC Final + Bill Check HTML | Modify — merge two TP rows into one `TPPI / TPPD` row |
| `src/lib/reports/report-utils.ts` | Shared report formatting helpers | Modify — delete `tpInvolvementLabel` |
| `src/components/print/SpotPrintReport.tsx` | Spot report (React) | Modify — TP row prints free text |
| `src/components/claim/AccidentForm.tsx` | Accident and survey inputs, all survey types | Modify — gain TP textarea, Police Reported, Panchanama |
| `src/components/claim/CommercialLoadForm.tsx` | Permit, load and challan inputs for commercial vehicles | **Create** |
| `src/components/tabs/DetailsTab.tsx` | Claim Details layout | Modify — render `CommercialLoadForm` |
| `src/components/tabs/SpotTab.tsx` | Spot-only scene assessment | Modify — remove moved fields |
| `src/lib/reports/__tests__/tp-and-load-challan.test.ts` | Report field coverage | Modify — replace enum tests, add no-spot-survey test |

---

## Task 1: Remove the duplicate GVW/ULW rows from report Section 5

Section 2 of the Standard Final already prints GVW from `vehicle.registeredLoadWeight` ([standard-report-builder.ts:607](../../../src/lib/reports/standard-report-builder.ts)). Section 5 prints it again from `spotDetails.gvw`, which is blank on every final claim. Delete the Section 5 rows.

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts` (the `loadSectionHtml` template)
- Test: `src/lib/reports/__tests__/tp-and-load-challan.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `loadSectionHtml` no longer references `sd?.gvw` or `sd?.ulw`. Later tasks must not reintroduce them.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/reports/__tests__/tp-and-load-challan.test.ts`, inside the existing `describe('Load challan section on the standard final report', ...)` block:

```ts
  test('does not repeat GVW and ULW that section 2 already prints', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).not.toContain('G.V.W. (KG)');
    expect(t).not.toContain('U.L.W. (KG)');
    // Section 2 still carries the vehicle record's GVW.
    expect(t).toContain('GVW');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reports/__tests__/tp-and-load-challan.test.ts -t "does not repeat GVW"`
Expected: FAIL — `expected '...' not to contain 'G.V.W. (KG)'`

- [ ] **Step 3: Delete the two rows**

In `src/lib/reports/standard-report-builder.ts`, find this block inside `loadSectionHtml` and delete it entirely:

```
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">G.V.W. (KG)</td>
    <td style="${td}">${sd?.gvw || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">U.L.W. (KG)</td>
    <td style="${td}">${sd?.ulw || '—'}</td>
  </tr>
```

Then replace the Payload Capacity row that follows it — Payload Capacity is derived from the GVW/ULW just removed and belongs with them, per spec D7:

```
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Payload Capacity (KG)</td>
    <td style="${td}">${sd?.loadCapacity || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Load at Accident (KG)</td>
    <td style="${td}${sd?.flagOverload ? 'color:#b00020;font-weight:700;' : ''}">${sd?.actualLoad || '—'}${sd?.flagOverload ? ' — OVERLOADED' : ''}</td>
  </tr>
```

with this, which keeps only the load-specific number:

```
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Load at Accident (KG)</td>
    <td style="${td}${sd?.flagOverload ? 'color:#b00020;font-weight:700;' : ''}" colspan="3">${sd?.actualLoad || '—'}${sd?.flagOverload ? ' — OVERLOADED' : ''}</td>
  </tr>
```

- [ ] **Step 4: Run the whole report suite**

Run: `npx vitest run src/lib/reports`
Expected: PASS. The existing test `prints challan, load and route for a goods vehicle` asserts `expect(t).toContain('16200')` — that was the GVW value. Change that line to assert the load instead:

```ts
    expect(t).toContain('12400');
```

Re-run until green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/__tests__/tp-and-load-challan.test.ts
git commit -m "fix(reports): stop printing GVW twice on the standard final"
```

---

## Task 2: Third party becomes one free-text field

Removes the `tpInvolved` dropdown and `tpInvolvementLabel`, and gives `accident.thirdPartyDetails` a multi-line input in the always-visible `AccidentForm`.

**Files:**
- Modify: `src/lib/reports/report-utils.ts` — delete `tpInvolvementLabel`
- Modify: `src/lib/reports/standard-report-builder.ts` — TP row
- Modify: `src/lib/reports/uiic-final-builder.ts` — merge two rows into one
- Modify: `src/components/print/SpotPrintReport.tsx` — TP row
- Modify: `src/components/claim/AccidentForm.tsx` — add textarea
- Modify: `src/components/tabs/SpotTab.tsx` — remove dropdown and old TP input
- Test: `src/lib/reports/__tests__/tp-and-load-challan.test.ts`

**Interfaces:**
- Consumes: Task 1's `loadSectionHtml` with no GVW rows.
- Produces: `tpInvolvementLabel` no longer exists in `report-utils.ts`. `accident.thirdPartyDetails` is the only third-party field any report reads.

- [ ] **Step 1: Replace the enum tests with free-text tests**

In `src/lib/reports/__tests__/tp-and-load-challan.test.ts`, delete the whole `describe('Third-party involvement on the final reports', ...)` block and replace it with:

```ts
describe('Third party as free text', () => {
  test('standard final prints the free text', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).toContain('Third Party Details');
    expect(t).toContain('One pedestrian injured, admitted at Sassoon');
  });

  test('standard final no longer prints a TPPD/TPPI classification', () => {
    const t = text(buildStandardFinalSurveyHTML(claim(), profile));
    expect(t).not.toContain('Third Party Involvement');
    expect(t).not.toContain('Property Damage and Injury');
  });

  test('UIIC final prints the free text under a TPPI / TPPD label', () => {
    const t = text(buildUIICFinalHTML(claim(), null));
    expect(t).toMatch(/TPPI \/ TPPD\s+One pedestrian injured/);
  });

  test('UIIC final prints the third-party text once, not twice', () => {
    const t = text(buildUIICFinalHTML(claim(), null));
    const hits = t.split('One pedestrian injured').length - 1;
    expect(hits).toBe(1);
  });

  test('empty third party prints NIL', () => {
    const c = claim({ accident: { thirdPartyDetails: '' } });
    expect(text(buildUIICFinalHTML(c, null))).toMatch(/TPPI \/ TPPD\s+NIL/);
  });
});
```

The `claim()` helper spreads `over` at the top level, so `claim({ accident: {...} })` replaces the whole accident object. For the last test, pass the full object instead:

```ts
    const c = claim({
      accident: {
        dateAndTime: '2026-06-24T10:00',
        policeStation: 'Hadapsar',
        firNumber: 'FIR/442/2026',
        thirdPartyDetails: '',
      },
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/reports/__tests__/tp-and-load-challan.test.ts`
Expected: FAIL — the UIIC tests fail on the `TPPI / TPPD` label, the standard tests fail on `Third Party Involvement` still being present.

- [ ] **Step 3: Delete the helper**

In `src/lib/reports/report-utils.ts`, delete the entire `tpInvolvementLabel` function and its doc comment (the block starting `/**` above `export function tpInvolvementLabel`).

Remove it from the three import statements:

- `src/lib/reports/standard-report-builder.ts` line 15 — drop `, tpInvolvementLabel` from the `./report-utils` import
- `src/lib/reports/uiic-final-builder.ts` line 29 — change to `import { formatSurveyDateTime } from './report-utils';`
- `src/components/print/SpotPrintReport.tsx` line 6 — change to `import { formatSurveyDateTime } from '@/lib/reports/report-utils';`

- [ ] **Step 4: Update the Standard Final**

In `src/lib/reports/standard-report-builder.ts`, replace this row:

```
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Third Party Involvement</td>
    <td style="${td}font-weight:700;">${tpInvolvementLabel(sd?.tpInvolved)}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Panchanama</td>
    <td style="${td}">${yesNoDash(sd?.panchanama)}</td>
  </tr>
```

with:

```
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Panchanama</td>
    <td style="${td}" colspan="3">${yesNoDash(sd?.panchanama)}</td>
  </tr>
```

The `Third Party Details` row directly below it already prints `accident.thirdPartyDetails` and needs no change.

- [ ] **Step 5: Update the UIIC Final**

In `src/lib/reports/uiic-final-builder.ts`, replace these two consecutive lines:

```
<tr><td style="padding:2px 3px;color:#333;">Third Party Involved</td><td style="padding:2px 3px;">${g(a.thirdPartyDetails) || 'NIL'}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Type of TP Liability</td><td style="padding:2px 3px;">${tpInvolvementLabel(sd.tpInvolved)}</td></tr>
```

with this single row:

```
<tr><td style="padding:2px 3px;color:#333;">TPPI / TPPD</td><td style="padding:2px 3px;">${g(a.thirdPartyDetails) || 'NIL'}</td></tr>
```

- [ ] **Step 6: Update the Spot report**

In `src/components/print/SpotPrintReport.tsx`, replace this row:

```tsx
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: fs.labelFont }}>Third Party</td>
            <td style={{ ...parseInline(styles.td) }}>{tpInvolvementLabel(spotDetails.tpInvolved)}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: fs.labelFont }}>TP Details</td>
            <td style={{ ...parseInline(styles.td) }}>{accident.thirdPartyDetails || 'NIL'}</td>
          </tr>
```

with:

```tsx
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: fs.labelFont }}>Third Party</td>
            <td style={{ ...parseInline(styles.td) }} colSpan={3}>{accident.thirdPartyDetails || 'NIL'}</td>
          </tr>
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/reports`
Expected: PASS, all files.

- [ ] **Step 8: Add the textarea to AccidentForm**

In `src/components/claim/AccidentForm.tsx`, add the `Textarea` import. The file currently imports only `Input` and `Label` from the UI kit, so change:

```tsx
import { Label } from '@/components/ui/label';
```

to:

```tsx
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
```

Insert this block immediately after the `Fire Brigade Report No.` field's closing `</div>`:

```tsx
          {/* Third party is free text, not a classification. The information is
              extensive — property damage, injuries, deaths, TP vehicle, hospital
              — and the surveyor writes as much as the claim needs. */}
          <div className="space-y-1 lg:col-span-2 xl:col-span-4">
            <Label htmlFor="a-tp">Third Party Details (TPPI / TPPD)</Label>
            <Textarea
              id="a-tp"
              rows={3}
              value={a?.thirdPartyDetails || ''}
              onChange={(e) => updateAccident({ thirdPartyDetails: e.target.value })}
              placeholder="Property damage, injuries, deaths, TP vehicle, hospital — as much detail as available"
            />
          </div>
```

- [ ] **Step 9: Remove the dropdown from SpotTab**

In `src/components/tabs/SpotTab.tsx`, delete this whole block:

```tsx
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Third Party Involvement<S /></Label>
              <select
                value={spotDetails.tpInvolved}
                onChange={(e) => handleUpdate({ tpInvolved: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="no">NIL — No Third Party</option>
                <option value="tppd">TPPD — Property Damage Only</option>
                <option value="tppi">TPPI — Personal Injury / Death</option>
                <option value="both">Both — Property Damage & Injury</option>
              </select>
            </div>
            
            {(spotDetails.tpInvolved !== 'no') && (
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">TP Details<S /></Label>
                <Input
                  value={accident.thirdPartyDetails}
                  onChange={(e) => updateAccident({ thirdPartyDetails: e.target.value })}
                  placeholder="Details of TP victim/property"
                />
              </div>
            )}
```

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. If it reports `'updateAccident' is declared but its value is never read` in `SpotTab.tsx`, leave it — Task 3 removes more code from the same file and the destructure is resolved there. If it reports an unused `accident` binding, same.

- [ ] **Step 11: Commit**

```bash
git add src/lib/reports/report-utils.ts src/lib/reports/standard-report-builder.ts src/lib/reports/uiic-final-builder.ts src/components/print/SpotPrintReport.tsx src/components/claim/AccidentForm.tsx src/components/tabs/SpotTab.tsx src/lib/reports/__tests__/tp-and-load-challan.test.ts
git commit -m "feat(claims): third party becomes one free-text field"
```

---

## Task 3: Move Police Reported and Panchanama to AccidentForm

These two are stored on `spotDetails` but describe the accident scene, and both print on the Standard Final. `AccidentForm` renders for every survey type; `SpotTab` does not.

**Files:**
- Modify: `src/components/claim/AccidentForm.tsx`
- Modify: `src/components/tabs/SpotTab.tsx` — remove the now-empty `Scene & Authorities` card
- Test: manual (see Step 5)

**Interfaces:**
- Consumes: Task 2's `AccidentForm` with the TP textarea already added.
- Produces: `AccidentForm` writes `spotDetails.policeReported` and `spotDetails.panchanama` via `updateSpotDetails`. `SpotTab` no longer references either.

- [ ] **Step 1: Add the store action to AccidentForm**

In `src/components/claim/AccidentForm.tsx`, change:

```tsx
  const { currentClaim, updateAccident } = useClaimStore();
```

to:

```tsx
  const { currentClaim, updateAccident, updateSpotDetails } = useClaimStore();
```

Then change:

```tsx
  const a = currentClaim?.accident || {} as any;
```

to:

```tsx
  const a = currentClaim?.accident || {} as any;
  const sd = currentClaim?.spotDetails || {} as any;
```

`updateSpotDetails` is already exported by the claim store
([claimSlice.ts:189](../../../src/stores/slices/claimSlice.ts)) and takes
`Partial<ClaimData['spotDetails']>`.

- [ ] **Step 2: Add the two selects**

Insert immediately before the Third Party Details block added in Task 2:

```tsx
          {/* Stored on spotDetails but asked here, because AccidentForm renders
              for every survey type and SpotTab renders only for spot claims. */}
          <div className="space-y-1">
            <Label htmlFor="a-police-reported">Police Reported?</Label>
            <select
              id="a-police-reported"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={sd?.policeReported || ''}
              onChange={(e) => updateSpotDetails({ policeReported: e.target.value })}
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-panchanama">Panchanama?</Label>
            <select
              id="a-panchanama"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={sd?.panchanama || ''}
              onChange={(e) => updateSpotDetails({ panchanama: e.target.value })}
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
```

Note the empty `—` option: the report prints an em dash for an unanswered question rather than asserting `No`, and the form must be able to express that state.

- [ ] **Step 3: Remove the Scene & Authorities card from SpotTab**

In `src/components/tabs/SpotTab.tsx`, the `{/* SECTION 1: SCENE & POLICE */}` card now holds only the two selects being moved. Delete the entire card, from the `{/* SECTION 1: SCENE & POLICE */}` comment through its closing `</Card>` — that is lines 94–156 in the current file, ending just before `{/* SECTION 3: VEHICLE STATUS */}`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. If `MapPin` is now an unused import in `SpotTab.tsx`, remove it from the `lucide-react` import list.

- [ ] **Step 5: Verify the report still reads them**

Run: `npx vitest run src/lib/reports/__tests__/tp-and-load-challan.test.ts`
Expected: PASS — the three panchanama tests are unchanged and still green, because storage did not move.

- [ ] **Step 6: Commit**

```bash
git add src/components/claim/AccidentForm.tsx src/components/tabs/SpotTab.tsx
git commit -m "refactor(claims): ask police reported and panchanama on every survey type"
```

---

## Task 4: Commercial permit, load and challan form

**Confirm the deviation noted above before starting.**

Creates `CommercialLoadForm`, an always-visible card for the eleven permit and load fields that only `SpotTab` could edit. Rendered by `DetailsTab` for commercial vehicles on any survey type.

**Files:**
- Create: `src/components/claim/CommercialLoadForm.tsx`
- Modify: `src/components/tabs/DetailsTab.tsx`
- Modify: `src/components/tabs/SpotTab.tsx`
- Test: `src/lib/reports/__tests__/tp-and-load-challan.test.ts`

**Interfaces:**
- Consumes: Task 3's `SpotTab` with the scene card removed.
- Produces: `export function CommercialLoadForm()` — no props, reads `currentClaim` from `useClaimStore`, returns `null` for private vehicles.

- [ ] **Step 1: Write the failing test**

The case that motivated this spec: a final claim with no spot survey must still print its load block. Add to the `describe('Load challan section on the standard final report', ...)` block:

```ts
  test('prints the load block on a final claim built without a spot survey', () => {
    const c = claim({ surveyType: 'final' });
    const t = text(buildStandardFinalSurveyHTML(c, profile));
    expect(t).toContain('LOAD CHALLAN &amp; GOODS CARRIED');
    expect(t).toContain('CN/8891');
    expect(t).toContain('Cement bags');
  });
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/lib/reports/__tests__/tp-and-load-challan.test.ts -t "without a spot survey"`
Expected: PASS immediately. The report reads storage, which never depended on survey type — this test guards the report side and documents the requirement. The gap it partners with is in the UI, which the remaining steps close.

- [ ] **Step 3: Create the form**

Create `src/components/claim/CommercialLoadForm.tsx`:

```tsx
'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck } from 'lucide-react';

/**
 * Permit, load and challan details for goods and passenger vehicles.
 *
 * These live on `spotDetails` for historical reasons but are read off the
 * permit and challan documents, not observed at the scene, and both final
 * reports print them. SpotTab renders only for spot claims, so this card
 * carries them for every survey type instead.
 */
export function CommercialLoadForm() {
  const { currentClaim, updateSpotDetails } = useClaimStore();

  if (!currentClaim) return null;
  if (currentClaim.vehicleType === 'private') return null;

  const sd = currentClaim.spotDetails;
  const overWeightNumeric = (sd.actualLoad || 0) > (sd.loadCapacity || 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <Truck size={18} />
          Permit, Load &amp; Challan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="c-permit-no">Permit No.</Label>
            <Input
              id="c-permit-no"
              value={sd.permitNo || ''}
              onChange={(e) => updateSpotDetails({ permitNo: e.target.value.toUpperCase() })}
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-permit-type">Permit Type</Label>
            <select
              id="c-permit-type"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={sd.permitType || ''}
              onChange={(e) => updateSpotDetails({ permitType: e.target.value })}
            >
              <option value="">Select Type</option>
              <option value="National">National Permit</option>
              <option value="State">State Permit</option>
              <option value="Zonal">Zonal Permit</option>
              <option value="Service">Service Permit</option>
              <option value="Contract">Contract Carriage</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-permit-nature">Nature of Permit</Label>
            <Input
              id="c-permit-nature"
              value={sd.natureOfPermit || ''}
              onChange={(e) => updateSpotDetails({ natureOfPermit: e.target.value })}
              placeholder="e.g. Goods Carriage, Stage Carriage"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-permit-to">Permit Valid Upto</Label>
            <Input
              id="c-permit-to"
              type="date"
              value={sd.permitTo || ''}
              onChange={(e) => updateSpotDetails({ permitTo: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-auth-no">Auth No.</Label>
            <Input
              id="c-auth-no"
              value={sd.authNo || ''}
              onChange={(e) => updateSpotDetails({ authNo: e.target.value.toUpperCase() })}
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-auth-valid">Auth Valid Upto</Label>
            <Input
              id="c-auth-valid"
              type="date"
              value={sd.authValid || ''}
              onChange={(e) => updateSpotDetails({ authValid: e.target.value })}
            />
          </div>

          <div className="space-y-1 @2xl:col-span-2">
            <Label htmlFor="c-area">Area of Operation</Label>
            <Input
              id="c-area"
              value={sd.areaOfOperation || ''}
              onChange={(e) => updateSpotDetails({ areaOfOperation: e.target.value })}
              placeholder="e.g. All India, State-wide"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-challan-no">Load Challan No.</Label>
            <Input
              id="c-challan-no"
              value={sd.challanNo || ''}
              onChange={(e) => updateSpotDetails({ challanNo: e.target.value.toUpperCase() })}
              placeholder="CN Number"
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-challan-date">Load Challan Date</Label>
            <Input
              id="c-challan-date"
              type="date"
              value={sd.challanDate || ''}
              onChange={(e) => updateSpotDetails({ challanDate: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-actual-load">Load at Accident (KG)</Label>
            <Input
              id="c-actual-load"
              type="number"
              className={`font-mono font-bold ${sd.flagOverload ? 'text-red-600 border-red-200 bg-red-50' : ''}`}
              value={sd.actualLoad || ''}
              onChange={(e) => updateSpotDetails({ actualLoad: Number(e.target.value) })}
            />
            {overWeightNumeric && (
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={!!sd.flagOverload}
                  onChange={(e) => updateSpotDetails({ flagOverload: e.target.checked })}
                />
                Flag as overloaded in report
              </label>
            )}
          </div>

          <div className="space-y-1 @2xl:col-span-3">
            <Label htmlFor="c-goods">Description of Goods</Label>
            <Input
              id="c-goods"
              value={sd.loadDesc || ''}
              onChange={(e) => updateSpotDetails({ loadDesc: e.target.value })}
              placeholder="Type of goods being carried"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-route-from">Route From</Label>
            <Input
              id="c-route-from"
              value={sd.loadOrigin || ''}
              onChange={(e) => updateSpotDetails({ loadOrigin: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-route-to">Route To</Label>
            <Input
              id="c-route-to"
              value={sd.loadDest || ''}
              onChange={(e) => updateSpotDetails({ loadDest: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

The overload checkbox appears only when the numeric condition holds, matching the existing rule: overload is never auto-flagged, the surveyor opts in.

- [ ] **Step 4: Render it in DetailsTab**

In `src/components/tabs/DetailsTab.tsx`, add the import beside the other form imports:

```tsx
import { CommercialLoadForm } from '@/components/claim/CommercialLoadForm';
```

Then change this block:

```tsx
          <div className="space-y-6">
            <VehicleDetailsForm />
            <PolicyDetailsForm />
            {currentClaim.surveyType !== 'valuation' && <DriverDetailsForm />}
            {currentClaim.surveyType !== 'valuation' && <AccidentDetailsForm />}
          </div>
```

to:

```tsx
          <div className="space-y-6">
            <VehicleDetailsForm />
            <CommercialLoadForm />
            <PolicyDetailsForm />
            {currentClaim.surveyType !== 'valuation' && <DriverDetailsForm />}
            {currentClaim.surveyType !== 'valuation' && <AccidentDetailsForm />}
          </div>
```

`CommercialLoadForm` returns `null` for private vehicles, so it needs no gate here.

- [ ] **Step 5: Remove the moved fields from SpotTab**

In `src/components/tabs/SpotTab.tsx`, inside `{/* SECTION 4: LEGAL & LOGISTICS (CONDITIONAL) */}`:

Delete the entire `Commercial Compliance (Permit/Fitness)` `<Card>` **except** the `Log Book / Tax Paid` field, which is out of scope for this plan. Keep that one field by leaving the card in place with only that input, and rename its title to `Log Book / Tax`:

```tsx
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  Log Book / Tax
                </CardTitle>
```

Then from the `Load Logistics & Challan` card, delete the Load Challan No. / Load Challan Date grid, the Actual Load field with its overload checkbox, the Goods Description field, and both Route fields. Keep GVW, ULW and Payload Capacity — spec D6 leaves those in place.

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit`
Expected: no output. Remove any now-unused imports `SpotTab.tsx` reports (likely `Truck` stays, `FileText` stays).

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/claim/CommercialLoadForm.tsx src/components/tabs/DetailsTab.tsx src/components/tabs/SpotTab.tsx src/lib/reports/__tests__/tp-and-load-challan.test.ts
git commit -m "feat(claims): permit, load and challan editable on every survey type"
```

---

## Task 5: Verify and deploy

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1–4 complete and committed.
- Produces: a deployed build.

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, TypeScript finished, 24 static pages generated.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all test files pass.

- [ ] **Step 3: Manual check — cannot be automated**

The forms are behind login, so a human must confirm on a real claim:

1. Open a **final** survey claim for a **goods** vehicle.
2. Claim Details shows a `Permit, Load & Challan` card with all eleven fields.
3. Accident Details shows Police Reported, Panchanama, and a multi-line Third Party Details box.
4. Fill challan no., goods, route, third party, panchanama.
5. Print the Standard Final. Section 4 shows Panchanama and Third Party Details. Section 5 shows Load Challan, Load at Accident, Description of Goods, Route — and **no** G.V.W. or U.L.W. row.
6. Open a **private** vehicle claim. The `Permit, Load & Challan` card is absent, and the final report has no Section 5.
7. Open a **spot** claim. The Spot tab still shows damage matrix, severity, airbags, drivable, comments and the survey dates.

- [ ] **Step 4: Deploy**

Only after the manual check passes.

```bash
npx firebase deploy --only hosting --project surveyos-v2-antigravity-in
```

Expected: `Deploy complete!`, hosting URL `https://motorsurveyos-in.web.app`.

---

## Self-review notes

**Spec coverage:** §3 third party free text → Task 2. §4 move to AccidentForm → Tasks 2, 3. §4 move commercial block → Task 4. §4 SpotTab retains scene fields → Tasks 3, 4. §5 duplicate GVW → Task 1. §6 testing → tests in Tasks 1, 2, 4. §7 out of scope respected: `fitnessType` explicitly retained in Task 4 Step 5, no field deleted from any type.

**One spec detail changed:** §5 said Section 5 keeps Payload Capacity. Task 1 Step 3 removes it, because Payload Capacity is computed from the GVW and ULW being removed and would print alone without its inputs. Spec D7 already says payload does not appear on the final report; the §5 body contradicted D7 and D7 wins.
