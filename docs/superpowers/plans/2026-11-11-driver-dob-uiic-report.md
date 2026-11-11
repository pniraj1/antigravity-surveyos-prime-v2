# Driver Date of Birth on every report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The driver's Date of Birth, read from the DL, appears on every report that prints driver particulars.

**Architecture:** The rest of the chain already carries DOB. Only the UIIC Final report leaves it out. One row goes into its Driving Licence block. That HTML also feeds print, the Word download and the floating preview, so one change covers all three.

**Tech Stack:** Next.js 16, TypeScript, Vitest.

**Spec:** The owner's request (2026-11-11): "add Date of birth of Driver on the report, and complete workflow… right from ai extraction to in report… keep it surgical."

## Impact map (traced 2026-11-11)

| Stage | Where | DOB today |
|---|---|---|
| AI extraction | `src/lib/ai/prompts.ts:82` DL prompt `date_of_birth` | ✓ |
| Apply to claim | `src/stores/slices/aiDataSlice.ts` `applyDL` → `driver.dateOfBirth` (via `parseDate`) | ✓ |
| Cross-check / evidence | `reconciliation.ts:66`, `RECONCILE_DATE_PATHS`, `useFieldEvidence.ts:60` | ✓ |
| Form | `src/components/claim/DriverForm.tsx:46` (Details tab) | ✓ |
| Portal fill packet | `src/lib/portal/packet.ts:257,412` `driverDob` | ✓ |
| Spot report | `src/components/print/SpotPrintReport.tsx:292` | ✓ |
| Standard Final report (NIA/OIC/other) | `src/lib/reports/standard-report-builder.ts:543` | ✓ |
| **UIIC Final report** (print, Word, preview) | `src/lib/reports/uiic-final-builder.ts:276-287` | **✗ missing** |
| NIA / OIC assessment Excel | no driver section | n/a |
| `UIICPrintReport.tsx` | used only by `src/app/screenshots/final/page.tsx` | out of scope |

## Global Constraints

- Surgical: one row, one test. No other report or field changes.
- Date format on the UIIC report is `DD.MM.YYYY` through the file's existing `fd()`.
- Prime ↔ Scan coupling: none. Driver fields are not a coupling point, and `SpotPrintReport.tsx` is untouched.

## Review Focus

- A claim with no DOB → the row still prints, with an empty value cell (matches the other UIIC rows, which use `fd`/`g` and print blank).
- DOB is stored as `YYYY-MM-DD`. The row must show `22.07.1985`, not the ISO string.
- The row sits directly under "Name of Driving Licence Holder", the place a reader checks age against the licence.

---

### Task 1: Date of Birth row on the UIIC Final report

**Files:**
- Modify: `src/lib/reports/uiic-final-builder.ts:276` (the Driving Licence inner table)
- Test: `src/lib/reports/__tests__/uiic-workshop-and-dl-validity.test.ts`

**Interfaces:**
- Consumes: `buildUIICFinalHTML(claim: ClaimData, profile: SurveyorProfile | null): string`; `fd(v)` in the same file; `makeBaseClaim(overrides)` in the test file.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test** in the existing `describe('UIIC Final Report - Workshop and DL Validity integrity')` block:

```ts
it('prints the driver Date of Birth under the licence holder name', () => {
  const claim = makeBaseClaim({
    driver: { name: 'AJAY RODGE', licenceNumber: 'MH19 19980017274', dateOfBirth: '1985-07-22' } as any,
  });
  const html = buildUIICFinalHTML(claim, null);
  expect(html).toContain('Date of Birth');
  expect(html).toContain('22.07.1985');
  expect(html.indexOf('Date of Birth')).toBeGreaterThan(html.indexOf('Name of Driving Licence Holder'));
  expect(html.indexOf('Date of Birth')).toBeLessThan(html.indexOf('Driving Licence Number'));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/reports/__tests__/uiic-workshop-and-dl-validity.test.ts`
Expected: FAIL on `toContain('22.07.1985')`.

- [ ] **Step 3: Add the row** between the "Name of Driving Licence Holder" and "Driving Licence Number" rows. Copy the neighbouring row's markup exactly; label `Date of Birth`, value `${fd(d.dateOfBirth)}`.

- [ ] **Step 4: Run the file, the report tests and the type check**

Run: `npx vitest run src/lib/reports && npx tsc --noEmit -p .`
Expected: all pass, no type errors (`word-page-break-drift.test.ts` included: the Word download uses this HTML).

- [ ] **Step 5: Changelog and commit**

Add a 2026-11-11 entry to `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md` with "Prime ↔ Scan coupling: none".

```bash
git add src/lib/reports/uiic-final-builder.ts src/lib/reports/__tests__/uiic-workshop-and-dl-validity.test.ts SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md
git commit -m "feat(uiic-report): print driver Date of Birth in the DL block"
```
