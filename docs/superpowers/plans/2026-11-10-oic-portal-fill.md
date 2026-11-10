# OIC Portal Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The SurveyOS Portal Fill extension types a Prime claim into Oriental Insurance's Surveyor Assessment form (steps 2, 3 and 4) and highlights every box it filled. It never presses a portal button.

**Architecture:** Prime's `buildOicPacket` gains the new values (DL dates, step 3 answers, net liability). The OIC map gains the new boxes, marks fixed defaults as map constants and becomes `framework: "react"`. A new MAIN-world helper `react-write.js` writes into PrimeReact and MUI widgets in a way their React `onChange` accepts. `filler.js` routes React maps through that helper. Angular maps (NIA, UIIC) run exactly as today.

**Tech Stack:** TypeScript and Vitest (Prime), plain JS classic scripts with `// @ts-check` (extension), Python map builder (`scripts/portal-map/build-ext-map.py`).

**Spec:** `docs/superpowers/specs/2026-11-10-oic-portal-fill-design.md` (read it with `2026-11-10-oic-portal-fill-debug.md`)

## Global Constraints

- The extension never clicks Next, Save, Submit, Preview or any other OIC button. The only clicks allowed are on a radio input and on a dropdown option inside the field being filled.
- When there's no value and no approved default, the box is left **empty**. A box OIC already filled with a different value is reported as "differs" (`kept`), never overwritten.
- Nil dep comes from the surveyor's `policyCheck.nilDep` only, never `aiRead`.
- NIA and UIIC maps, fills and tests stay unchanged and passing.
- Fixtures and tests use fake values only. The saved OIC pages in `C:\Users\Manasi\Downloads` hold real PII and are never committed, copied into the repo or quoted in tests.
- Nothing is deployed (extension zip, hosted map, hosting) without the owner's approval.
- OIC dates are typed as `DD-MM-YYYY` (the MUI placeholder). Prime sends ISO `YYYY-MM-DD`.
- Report "Prime ↔ Scan impact: none" when done (no Scan coupling point is touched).

## Review Focus

1. **A DL number not in the 15-character shape** (`DL-0420110012345`, `MH12 20050012345`, `GJ0119`): split by the rule after stripping non-alphanumerics. Under 8 characters → Box 2 only. Test in Task 1.
2. **A claim with no Bill Check:** the packet still builds. There's no workshop estimate amount or date, and the initial loss amount comes from the kept assessment rows. Test in Task 1.
3. **Step 3 opened in a fresh tab or a different claim** (no remembered claim, or OIC's `surveyAssessmentId` differs): Fill refuses with "Open step 2 of this claim first." and writes nothing. Test in Task 3.
4. **Fill pressed twice on the same step:** radios already on the right answer report `same`, and nothing is clicked again. Test in Task 2.
5. **A licence class OIC doesn't list:** the dropdown stays empty and the line reads `noOption`. Test in Task 3.

---

### Task 1: Prime packet carries the new OIC values

**Files:**
- Modify: `src/lib/portal/packet.ts` (`splitIndianDl` ~L75, `OIC_FIELDS` ~L86, `buildOicPacket` ~L265)
- Modify: `src/lib/reports/oic-assessment-excel.ts` (export `inOicExcel`)
- Test: `src/lib/portal/__tests__/packet.test.ts`

**Interfaces:**
- Produces: `splitIndianDl(dlRaw?: string): { one?: string; two?: string; three?: string }` (new rule); `oicRegNumber(raw?: string): string | undefined`; `oicNetLiability(claim: ClaimData, ageMonths: number): number`; `export function inOicExcel(r: AssessmentRow): boolean`.
- Produces packet keys (added to `OIC_FIELDS`; dates ISO, yes/no as `'yes' | 'no'`): `driverDob`, `dlValidFrom`, `dlValidUpTo`, `licenseType`, `nilDepCover`, `ownerDriver`, `thirdPartyInvolved`, `workshopEstimateDate`, `dlVerifiedRemarks`, `spotSurveyDone`, `initialLossAmount`, `claimantMobile`, `surveyorObservation`, `causeOfAccident`, `surveyorAppointedDate`, `finalDocumentDate`. Existing keys keep their names. `regNumber` now uses `oicRegNumber`.

- [ ] **Step 1: Write the failing tests** in `packet.test.ts`:
  - `splitIndianDl('MH1820100012611')` → `{ one: 'MH', two: '182010001', three: '2611' }`; `splitIndianDl('MH-18 2010 0012611')` → the same; `splitIndianDl('GJ0119')` → `{ two: 'GJ0119' }`.
  - `oicRegNumber('MH19DV9776')` → `'MH 19 DV 9776'`; `oicRegNumber('mh 19 dv 9776')` → `'MH 19 DV 9776'`; `oicRegNumber('MH12A5')` → `'MH 12 A 5'`; `oicRegNumber('22BH1234AA')` → `'22BH1234AA'` (no match → compact upper-case).
  - `oicNetLiability`: a claim with an in-bill part and a `not-in-bill` part equals `oicNetLiability` of the same claim with the not-in-bill row removed. A `not-allowed` row is the same.
  - `buildOicPacket(fakeClaim, { ageMonths: 100, includeExcel: false })` with fake data gives: `driverDob` = `driver.dateOfBirth`; `dlValidUpTo` = `validityNonTransport` (private vehicle) or `validityTransport` (`vehicle.isCommercial: true`); `dlValidFrom` = `driver.dateOfIssue`; `licenseType` `'LMV'` for `'MCWG, LMV'` private and `'LMV-TR'` for `'MCWG, LMV-TR'` commercial; `ownerDriver` `'yes'` when `driver.name` `'Mr. Ramesh  Patil'` vs insured `'RAMESH PATIL'`, else `'no'`, and absent when either name is empty; `thirdPartyInvolved` `'yes'`/`'no'` from `accident.thirdPartyDetails` trimmed; `nilDepCover` from `policyCheck.nilDep`, absent when unset even if `aiRead.nilDep` is `'yes'`; `finalDocumentDate` = today ISO; `initialLossAmount` = `oicNetLiability(claim, 100)`; `workshopEstimateAmount` = `billCheck.billTotal`, `workshopEstimateDate` = `billCheck.billDate`.
  - Review Focus 2: a claim with no `billCheck` builds, has no `workshopEstimateAmount` / `workshopEstimateDate`, and still has `initialLossAmount`.

- [ ] **Step 2: Run to see them fail**
  Run: `npx vitest run src/lib/portal/__tests__/packet.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement**
  - `splitIndianDl`: `clean` = alphanumerics upper-cased; under 8 → `{ two: dlRaw.trim() }`; else `one = clean.slice(0, 2)`, `two = clean.slice(2, -4)`, `three = clean.slice(-4)`. Grep for other callers first and keep them working.
  - `oicRegNumber`: compact upper-case, then `/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/`, joining the non-empty groups with single spaces.
  - `oicNetLiability`: call `calculateBillCheckSummary(rows.filter(inOicExcel), …)` with the same salvage (`resolveBillSalvage`), excess and towing arguments the NIA builder passes (packet.ts ~L170) and return `.netLiability`. `ponytail:` comment: one figure for the Excel and step 3.
  - `licenseType`: split `driver.licenceType` on `,`/`/`, trim, then take the first class containing `TR` when `isCommercial`, otherwise the first without it. If there's no pick, leave it absent.
  - `ownerDriver`: normalise both names (upper-case, letters and spaces only, drop `MR MRS MS SHRI SMT KUM DR`, collapse spaces) and compare.
  - `spotSurveyDone`: `'yes'` when `claim.spotDetails` holds at least one surveyor-entered non-empty value; a freshly created claim's default `spotDetails` must give `'no'`. Read `src/types/claim.ts` for the shape and add that case to the tests.
  - `surveyorObservation` = `accident.remarks` (max 2000); `causeOfAccident` = `accident.causeOfAccident` (max 500); `dlVerifiedRemarks` = `driver.invalidRemarks`; `claimantMobile` = `policy.insuredMobile`, digits only; `surveyorAppointedDate` = `accident.appointmentDate`.

- [ ] **Step 4: Run** `npx vitest run src/lib/portal src/lib/reports`. Expected: PASS. Run `npx tsc --noEmit`: clean.

- [ ] **Step 5: Commit**: `git add src/lib/portal src/lib/reports/oic-assessment-excel.ts && git commit -m "feat(oic): packet carries DL dates, step 3 answers and net liability"`

---

### Task 2: fill-core understands OIC's money, dates and radios

**Files:**
- Modify: `extension/src/lib/fill-core.js`
- Test: `extension/__tests__/fill-core.test.js`

**Interfaces:**
- Produces: `transforms.ddmmyyyyDash(v) → 'DD-MM-YYYY'` (from ISO or `dd/MM/yyyy`; unparseable → `''`). Map field kind `radioPick` with `choices: Record<string, string>` (answer → element selector). `planFill` emits `{ action, value, choice }`, where `choice` = `spec.choices[value]`. `read.current(path)` for a `radioPick` is called with the spec and returns the answer whose element is checked, or `''`.

- [ ] **Step 1: Write the failing tests**
  - `isEmptyValue('₹0', '')`, `isEmptyValue('₹ 0.00', '')` and `isEmptyValue('₹0.00', '')` → `true`; `isEmptyValue('₹1,200', '')` → `false` (B3).
  - `transforms.ddmmyyyyDash('2026-03-07')` → `'07-03-2026'`; `('07/03/2026')` → `'07-03-2026'`; `('')` → `''`.
  - `planFill` with spec `{ kind: 'radioPick', modelPath: '#x1', choices: { yes: '#x1', no: '#x2' }, constant: 'no' }` and `read.current` → `''` gives `{ action: 'fill', value: 'no', choice: '#x2' }`.
  - The same with `read.current` → `'no'` gives `action: 'same'` (Review Focus 4). A packet value `'maybe'` gives `action: 'skip', why: 'no such choice'`.

- [ ] **Step 2: Run** `npx vitest run extension/__tests__/fill-core.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement** the transform, the `₹`-stripping in `isEmptyValue` (only when `empty === ''`), and the `radioPick` branch in `planFill`. `read.current` receives the spec as a second argument; existing readers ignore it.

- [ ] **Step 4: Run** `npx vitest run extension/__tests__`. Expected: all PASS, NIA/UIIC included.

- [ ] **Step 5: Commit**: `git commit -am "feat(portal-fill): rupee-zero empty, DD-MM-YYYY dates, radioPick"`

---

### Task 3: React writes and the OIC claim gate in the filler

**Files:**
- Create: `extension/src/lib/react-write.js` (MAIN world, IIFE + UMD shim like `fill-core.js`, `globalThis.SxReact`)
- Modify: `extension/src/filler.js`, `extension/manifest.json` (add `src/lib/react-write.js` before `src/filler.js` in the MAIN-world list)
- Test: `extension/__tests__/react-write.test.js`, `extension/__tests__/filler-check.test.js`

**Interfaces:**
- Produces in `SxReact`:
  - `reactProps(el): object | null`: the props of the nearest React fiber at or above `el` (via the `__reactFiber$…` key, walking `.return`) that has an `onChange` function.
  - `matchOption(options: any[], optionLabel?: string, optionValue?: string, wanted: string): any | null`: exact on value, then case-insensitive on label/value. `null` when nothing matches.
  - `writeText(input, value): 'filled'`: native value setter + `_valueTracker` + `input` and `change` events.
  - `pickDropdown(root, value): 'filled' | 'noOption'`: reads `options`/`optionLabel`/`optionValue` from `reactProps(root)` and calls its `onChange({ originalEvent: null, value, stopPropagation(){}, preventDefault(){}, target: { name, id, value } })`.
  - `clickRadio(input): 'filled'`: `input.click()`.
  - `writeDate(input, ddmmyyyy): 'filled' | 'invalid:date'`: focus, then paste the text as a `ClipboardEvent('paste')` carrying a `DataTransfer` with `text/plain`. After that, if the input's value isn't the date, fall back to `writeText`. If it still isn't, return `'invalid:date'`. The live check (Task 6) decides whether this holds.
- Filler, for `map.framework === 'react'`:
  - `q('label=Text')` finds the `<label>` whose text minus a trailing ` *` equals `Text`, then `getElementById(label.htmlFor)`. Needed because MUI date ids like `:rg:` change.
  - kinds `text` / `money` / `textarea` → `writeText`; `dropdown` → `pickDropdown`; `radioPick` → `clickRadio(q(choice)[0])`; `date` → `writeDate`.
  - The claim number is read from `select[name='claimNumber']`'s `.value` (B1). Whenever it's read, save `sessionStorage['sx-oic-claim'] = JSON.stringify({ id: sessionStorage.surveyAssessmentId, claimNo })`. When the select is absent (step 3/4), use the saved claim number only if its `id` equals the current `surveyAssessmentId`. Otherwise `probe` returns `{ ok: false, reason: 'Open step 2 of this claim first.' }` (B9).

- [ ] **Step 1: Write the failing tests**
  - `react-write.test.js` with fake element objects (no DOM library):
    - `reactProps` finds `onChange` two fibers up.
    - `matchOption([{l:'LMV',v:'1'},{l:'MCWG',v:'2'}], 'l', 'v', 'lmv')` → the LMV option.
    - `matchOption(…, 'LMV-TR')` → `null` (Review Focus 5).
    - `pickDropdown` calls `onChange` with `value: '1'` and `target.name`, and returns `'noOption'` without calling it when there's no match.
  - `filler-check.test.js`, following that file's harness:
    - a React OIC map whose page has `select[name=claimNumber]` valued `C-1` probes `claimNo: 'C-1'`, not the doubled text.
    - with no select, a saved `{ id: 'A', claimNo: 'C-1' }` and `surveyAssessmentId` `'A'` → `C-1`.
    - with `surveyAssessmentId` `'B'` → `ok: false` with the step 2 message (Review Focus 3).

- [ ] **Step 2: Run** `npx vitest run extension/__tests__/react-write.test.js extension/__tests__/filler-check.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement** `react-write.js` and the filler branch. Keep the Angular path byte-for-byte unchanged. The existing `oic` special case in `probe`/`check` is replaced by the React branch.

- [ ] **Step 4: Run** `npx vitest run extension/__tests__`. Expected: PASS.

- [ ] **Step 5: Commit**: `git commit -am "feat(portal-fill): React widget writes and OIC claim gate"`

---

### Task 4: The OIC map (steps 2, 3 and 4)

**Files:**
- Modify: `scripts/portal-map/oic-assessment.overlay.json`, `scripts/portal-map/oic-assessment-survey.json` (structure only: model paths and kinds, no values)
- Regenerate (never hand-edit): `extension/maps/oic-assessment.json`, `public/portal-maps/oic-assessment.json`, `extension/fixture/oic-assessment.html` via `py scripts/portal-map/build-ext-map.py oic-assessment`
- Test: `extension/__tests__/map.test.js`

**Interfaces:**
- Consumes: packet keys (Task 1), kinds `radioPick`/`dropdown`/`date` and the `label=` locator (Tasks 2–3).
- Map header: `"version": 2`, `"framework": "react"`, `"claimNoSelector": "select[name='claimNumber']"`. Every field gets `"step": 2|3|4`; defaults get `"default": true`. The builder must pass `framework`, `step` and `default` through (add them to `entry()`'s copied keys and to the header copy).

| Field | modelPath | kind | from / constant | step | default |
|---|---|---|---|---|---|
| existing 23 text boxes | as today | text | **packet key of the same name** (B2: replace `vehicle.*` etc.) | 2 | |
| seatingCapacity | `#seatingLoadCarryingCapacity input` | text | `seatingCapacity` | 2 | |
| driverBadgeNo | `#badgeNo` | text | `driverBadgeNo` | 2 | |
| driverQualification | `#qualification` | text | `driverQualification` | 2 | |
| driverAddress | `#address` | textarea | `driverAddress` | 2 | |
| workshopEstimateAmount | `#workshopEstimateAmount input` | money | `workshopEstimateAmount` | 2 | |
| driverLicenseNoOne | `#driverLicenseNoOne` | dropdown | `driverLicenseNoOne` | 2 | |
| driverLicenseNoThree | `#driverLicenseNoThree` | text | `driverLicenseNoThree` | 2 | |
| licenseType | `#licenseType` | dropdown | `licenseType` | 2 | |
| driverDob | `label=Date of Birth` | date (`ddmmyyyyDash`) | `driverDob` | 2 | |
| dlValidFrom | `label=Valid From` | date | `dlValidFrom` | 2 | ✓ |
| dlValidUpTo | `label=Valid Up To` | date | `dlValidUpTo` | 2 | |
| workshopEstimateDate | `label=Workshop Estimate Date` | date | `workshopEstimateDate` | 2 | |
| closeProximity | `#closeProximity1` | radioPick `{yes:#closeProximity1,no:#closeProximity2}` | constant `no` | 2 | ✓ |
| vbConfirmed | `#vbConfirmed1` | radioPick | constant `yes` | 2 | ✓ |
| nilDepCover | `#nillDepreciationCover1` | radioPick | `nilDepCover` | 2 | |
| ownerDriver | `#ownerDriver1` | radioPick | `ownerDriver` | 2 | ✓ |
| thirdPartyInvolved | `#thirdPartyInvolved1` | radioPick | `thirdPartyInvolved` | 2 | ✓ |
| chargesFiled | `#chargesFiled` | textarea | constant `No` | 2 | ✓ |
| vehicleInspected | `#whetherVehicleInspected1` | radioPick | constant `yes` | 3 | ✓ |
| surveyCompleted | `#isSurveyCompleted1` | radioPick | constant `yes` | 3 | ✓ |
| dlApplicable | `#isDrivingLicenseApplicable1` | radioPick | constant `yes` | 3 | ✓ |
| dlVerified | `#isDrivingLicenseVerified1` | radioPick | constant `yes` | 3 | ✓ |
| dlVerifiedRemarks | `#isDrivingLicenseVerifiedRemarks` | textarea | `dlVerifiedRemarks` | 3 | |
| spotSurveyDone | `#spotSurveyDone1` | radioPick | `spotSurveyDone` | 3 | ✓ |
| initialLossAmount | `#initialLossAssessmentAmount input` | money | `initialLossAmount` | 3 | |
| claimantMobile | `#mobileNumberClaimant` | text | `claimantMobile` | 3 | |
| surveyorObservation | `#surveyorObservation` | textarea (maxLen 2000) | `surveyorObservation` | 3 | |
| causeOfAccident | `#causeNatureOfAccident` | text | `causeOfAccident` | 3 | |
| surveyorAppointedDate | `label=Surveyor Appointed Date` | date | `surveyorAppointedDate` | 3 | |
| finalDocumentDate | `label=Submission Date of Final Document` | date | `finalDocumentDate` | 3 | ✓ |
| files.assessmentExcel | `#fileInput` | file | slot `assessmentExcel` | 4 | |

Radio ids: `…1` is Yes and `…2` is No (read from the saved pages' label order; confirmed in Task 6). Left out by design: badge issue date, claimant email, particulars of loss, relationship (not on the page when the owner drives), driver state.

- [ ] **Step 1: Write the failing test** in `map.test.js`:
  - every OIC field's `from` is a key of `OIC_FIELDS` (import the list, or copy it as a fixture array with a comment pointing at packet.ts).
  - every `radioPick` has `yes` and `no` choices.
  - every field has a `step`.
  - `version` is 2.
- [ ] **Step 2: Run** `npx vitest run extension/__tests__/map.test.js`. Expected: FAIL.
- [ ] **Step 3: Edit** the overlay and capture, extend `build-ext-map.py` to pass `framework`/`step`/`default`/`choices`, and run `py scripts/portal-map/build-ext-map.py oic-assessment`. Expected: exit 0.
- [ ] **Step 4: Run** `npx vitest run extension/__tests__`. Expected: PASS.
- [ ] **Step 5: Commit**: `git add scripts/portal-map extension/maps extension/fixture public/portal-maps extension/__tests__/map.test.js && git commit -m "feat(oic): map for steps 2-4 with approved defaults"`

---

### Task 5: Panel and card for a multi-step page

**Files:**
- Modify: `extension/src/panel.js` (route watch ~L50–62), `extension/src/lib/card-view.js`
- Test: `extension/__tests__/card-view.test.js`, `extension/__tests__/panel-gate.test.js`

**Interfaces:**
- Consumes: the map's `step` and `default` keys (Task 4).
- Produces: card lines carry `isDefault: boolean`. For a map whose fields have `step`, `notFound` lines are left out of the lines and the counts ("on another step"), and after any fill the primary button stays `{ id: 'fill', label: 'Fill this step' }`.

- [ ] **Step 1: Write the failing tests** in `card-view.test.js`:
  - a fill result on a stepped map with 3 `filled` lines (one of them `default: true` in the map) and 5 `notFound` shows 3 lines. The default line has `isDefault: true`, and the primary button is `Fill this step`.
  - the same result on the NIA map is unchanged (snapshot of today's view).
- [ ] **Step 2: Run** `npx vitest run extension/__tests__/card-view.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the card changes and render `isDefault` as a small "default" tag in the panel line. In `panel.js`, also re-check the route every 1000 ms by comparing `location.href` (B8, since React Router's `pushState` fires no event): `ponytail: 1 s poll; use the Navigation API if it ever lags`.
- [ ] **Step 4: Run** `npx vitest run extension/__tests__`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "feat(portal-fill): stepped pages, default tags, pushState routes"`

---

### Task 6: Live checks with the owner, then step 4 excess and salvage

Needs the owner logged in to OIC in the side browser, on a claim they're working on anyway. Claude reads pages and the network log and runs `SxReact` writes through `javascript_tool` **only after the owner says go for that step**. Claude never clicks Next, Save or Submit; the owner does.

**Files:**
- Modify (only as the checks require): `extension/src/lib/react-write.js`, `scripts/portal-map/oic-assessment.overlay.json` (+ rebuild), `src/lib/portal/packet.ts`
- Record results in `docs/superpowers/specs/2026-11-10-oic-portal-fill-debug.md`, under a new "Live checks" section, with no PII.

- [ ] **Step 1:** On step 2, inject `react-write.js` and write one box of each kind: text, InputNumber (`#cubicCapacity input`), dropdown (`#licenseType`), radio (`#closeProximity2`) and date (`label=Date of Birth`). Read back each one's React value. The owner presses Next and then Back. Expected: all five survive. On failure, fix that writer, add a unit test for the fix, and repeat.
- [ ] **Step 2:** Read the option lists of `#licenseType` and `#driverLicenseNoOne`. Confirm `MH`-style codes and the licence class labels, and adjust `matchOption`/`licenseType` if the labels differ (with tests).
- [ ] **Step 3:** Right after Search, before any fill, list which mapped step-2 boxes already have values. They stay `kept`; confirm none is wrongly treated as empty.
- [ ] **Step 4:** Confirm `…1` = Yes for every radio pair.
- [ ] **Step 5:** On step 4, attach the Excel through `#fileInput` and watch the network log for OIC's own `survey/excel` call. Then capture the excess and salvage box selectors that appear. Add them to the map (`from: compulsoryExcess` / `voluntaryExcess` or a combined key, plus `salvage` = `resolveBillSalvage`) with packet keys and tests, filled after the upload has been parsed.
- [ ] **Step 6:** Run `npm test` and `npx tsc --noEmit`. Expected: all pass. Build with `npm run build:ext`. Expected: exit 0. Don't deploy; ask the owner.
- [ ] **Step 7: Commit**: `git commit -am "fix(oic): live-check adjustments and step 4 excess/salvage"`
