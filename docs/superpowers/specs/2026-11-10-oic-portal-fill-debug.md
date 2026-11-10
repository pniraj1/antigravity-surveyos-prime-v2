# OIC Portal Fill — debug log (2026-11-10)

Systematic-debugging notes for the SurveyOS Portal Fill extension on the Oriental
Insurance Motor OD Surveyor Assessment. Evidence comes from pages the owner saved from
the live portal (kept in Downloads, NOT committed — they hold the insured's name,
the surveyor's PAN, email and mobile number).

## What the portal is

- A React single-page app (PrimeReact inputs and dropdowns, MUI date pickers). It is not AngularJS.
- There is no iframe. The form is in the top page; the only iframe is ONDC site verification.
- One URL serves all 5 steps: `https://orientalinsurance.org.in/surveyor-assessment-form`.
  The step is in-page state, so the URL never tells you which step you're on.
- Path from the dashboard: tile "Motor OD Surveyor Assessment" → `/surveyor-assessment`
  → the form. Also on the dashboard: "My Motor Claims (Surveyor)" → `/surveyor-dashboard`.
- Stepper: 1 Search · 2 Basic Details · 3 Interim Report · 4 Assessment of Loss · 5 Document Upload.

| Step | Saved? | Extension covers it? |
|---|---|---|
| Dashboard | yes (`Oriental Insurance Company Limited.html`) | no; the panel doesn't load here, correctly |
| 1 Search | **no** | no |
| 2 Basic Details | yes (`… Limited 1.html`) | 25 fields mapped, **0 fill** (B1 + B2) |
| 3 Interim Report | yes (`… Limited2.html`) | **nothing mapped**; there's no claim number on the page (B9) |
| 4 Assessment of Loss | **no** | no; Prime only builds the Excel, and the map has no `files` |
| 5 Document Upload | **no** | no |

## Confirmed bugs (reproduced: the real filler.js was run on the saved step-2 page)

**B1. The claim number is read doubled, so Fill is always refused.**
`filler.js` probe/check runs `querySelector('#claimNumber, …')`. That finds the PrimeReact
dropdown `<div id="claimNumber">`, and `.textContent` joins the hidden `<option>` text with
the visible label. Result: `…/00030043…/00030043` ≠ packet → "claim mismatch".
If the panel probes before React renders, it reads `''` instead ("claim number couldn't be read").

**B2. All 25 fields are skipped as "not in packet".**
The overlay's `from` keys are `vehicle.regNo`, `vehicle.make`, … but `buildOicPacket` sends
`regNumber`, `make`, …. None of the 23 `from` keys match.

## Found once B1+B2 are bypassed (simulated on the saved page)

- **B3.** The estimate amount shows `₹0` by default. `isEmptyValue` doesn't count it as empty, so the field is "kept" and never filled.
- **B4.** The reg number shows "differs": the page has `MH 19 DV 9776`, the packet `MH19DV9776` (Prime strips the spaces).
- **B5.** The DL is split 3 ways and the boxes don't line up. Box 1 (`driverLicenseNoOne`) is a PrimeReact dropdown whose options were empty in the save. Box 2 has maxlength 12, Box 3 maxlength 6. Prime's `splitIndianDl` sends 4 / middle / last 4, and the map has Box 2 only.
- **B6.** No source for the radios: `closeProximity`, `vbConfirmed`, plus the step-2 radios not in the map (`nillDepreciationCover`, `ownerDriver`, `thirdPartyInvolved`).
- **B7.** Not mapped: the MUI date pickers (Date of Birth, DL Valid From / Valid Up To, Badge Issue Date, Workshop Estimate Date are required), the `licenseType` and `state` dropdowns, and `chargesFiled`.
- **B8.** The panel only re-routes on `hashchange` / `popstate`. React Router's `pushState` fires neither, so if you click through from the dashboard, the panel doesn't appear until you reload.
- **B9.** Step 3 has no claim number on the page, but the claim-match gate needs one, so step 3 can never fill as designed.
- **Unverified (needs live):** whether writing to PrimeReact InputNumber / Calendar
  (CC, weights, year, amount) and to MUI date inputs actually updates React state.
  PrimeReact dropdowns certainly don't change by setting the hidden `<select>`.

## Step 3 — Interim Report fields (from the save)

Radios: `whetherVehicleInspected`, `isSurveyCompleted`, `isDrivingLicenseApplicable`,
`isDrivingLicenseVerified`, `spotSurveyDone`. Text: `isDrivingLicenseVerifiedRemarks`,
`initialLossAssessmentAmount` (InputNumber), `mobileNumberClaimant`, `claimantEmail`,
`surveyorObservation` (maxlength 2000), `causeNatureOfAccident`, `particularsOfLossDamage`.
Dates (MUI): Surveyor Appointed Date *, Submission Date of Final Document *.

## Step 4 — Assessment of Loss (saved as `… Limited3.html`)

- The surveyor uploads Prime's Excel (`fileInput`, .xlsx/.xls). The portal turns it into an
  Invoice block plus one accordion tab per item. A closed tab isn't in the DOM, so a save only
  holds the items that were open (10 of 37 here).
- OIC checks the Excel on its server (the upload goes to a pre-signed URL), so OIC's own rules can't be read.
- After the items come Excess, Salvage, Net Assessment and Gross Assessment (not mapped).

### OIC Excel — fixed 2026-11-10 (B10)

`oicAssessmentRows` (`src/lib/reports/oic-assessment-excel.ts`) wrote every row. A disallowed
row went in at amount 0, and a row Bill Check marked `not-in-bill` / `not-allowed` went in
at its full assessed amount. Painting lines went in when only their estimate was non-zero.
Owner rule: a not-billed, not-allowed or zero-assessed item is not part of the Excel.
Now a single `inOicExcel()` check drops those rows, estimate included, for parts, labour and painting.

### Seen in the uploaded Excel for claim …0043 (not yet fixed)

- ~~B11~~ Labour/painting at GST 0 with HSN `72041000`: the owner confirmed (2026-11-10) that this is what OIC expects. Not a bug.
- **DL split (owner, 2026-11-10):** `MH1820100012611` → Box 1 `MH` (state, dropdown),
  Box 2 `182010001`, Box 3 `2611`. Prime's `splitIndianDl` sends `MH18` / `20100012` / `2611`
  instead, so Box 1 must be the 2-letter state code and Box 2 everything up to the last 4 characters.
- Step 1 (Search) stays manual, by the owner's call.
- One estimate looks like a data-entry slip: "Bonnet removing refitting", estimate 15000 against assessed 300.

## How the OIC form saves (read from OIC's live code, 2026-11-10)

The form code is in lazily loaded files (`static/js/6985.744d2a57.chunk.js`, `1519…`, `8481…`),
which a saved page doesn't keep. It was read read-only in the browser after the owner logged in.

- Each step's **Next** gathers the whole step into one object and saves it as a draft:
  first `POST survey/surveyor-assessment-form` (`status: "draft"`), which returns an id that is
  kept in `sessionStorage.surveyAssessmentId`; later steps `PUT` the same address with that id and
  `surveyorFormStage`. The final **Submit** sends `status: "SUBMIT"`.
- **Back** / reload calls `GET bff/survey/get-surveyor-assessment-form/<id>` and fills the page from the saved draft.
- Basic Details keys include `vehicleRegistrationNumber`, `vehicleCubicCapacity`, `driverName`,
  `validFrom` / `validUpTo`, `driverDateOfBirth`, `nameOfWorkshop`, `workshopEstimateAmount` and
  `workshopEstimateDate`. Dates are sent as `YYYY-MM-DD`, and `driverLicenseNoOne` is the **state code**,
  which matches the owner's DL rule.
- The Excel is read as base64 in the browser and sent to `POST survey/excel`; OIC parses it on its server.
- Item, invoice, excess and surveyor-charge rows each have their own delete address under `survey/claim-assessment-*`.

## To-do: OIC box → where Prime has it (2026-11-10)

**Can do: fix the extension**
- [ ] B1 read the claim number properly
- [ ] B2 match the map's names to Prime's packet
- [ ] B3 count ₹0 as empty
- [ ] B4 put spaces in the reg number
- [ ] B5 DL split: state / middle / last 4 (`splitIndianDl`)

**Can do: Prime already has the data (add to the packet)**
- [ ] Driver date of birth ← `driver.dateOfBirth`
- [ ] DL valid up to ← `driver.validityNonTransport` (or `validityTransport` for transport)
- [ ] DL valid from ← `driver.dateOfIssue` (guess: confirm OIC means the issue date)
- [ ] License type ← `driver.licenceType`
- [ ] Badge no. ← `driver.badgeNumber`
- [ ] DL verified yes/no + remarks ← `driver.verificationStatus` / `invalidRemarks`
- [ ] Nil dep cover ← `policyCheck.nilDep` (the surveyor's answer, not the AI read)
- [ ] Cause of accident ← `accident.causeOfAccident`
- [ ] Surveyor appointed date ← `accident.appointmentDate`
- [ ] Claimant mobile ← `policy.insuredMobile`
- [ ] Excess (compulsory + voluntary), salvage ← assessment
- [ ] Spot survey done ← whether spot details exist (guess)
- [ ] Third party involved ← whether `thirdPartyDetails` is filled (guess)

**Can't yet: Prime doesn't store it**
- [ ] Close proximity, Sec 64VB confirmed, owner-driver
- [ ] Driver's relationship to the insured (Prime's `relationType` is S/o / D/o, not this)
- [ ] Badge issue date, charges filed, claimant email, final documents date
- [ ] Vehicle inspected?, survey completed?, DL applicable?
- [ ] Initial loss amount, surveyor observation, particulars of loss (which Prime text, if any?)
- [ ] Attaching the Excel file in step 4 (a browser limit; needs checking)

**Defaults for what Prime doesn't store (owner approved 2026-11-10; the surveyor edits them on the page):**
Close proximity No · Sec 64VB Yes · Owner-driver Yes when the driver name = insured name, else No ·
Relationship Self when owner-driver, else blank · Charges filed No · Vehicle inspected Yes ·
Survey completed Yes · DL applicable Yes · Final documents date = today ·
Initial loss amount = workshop estimate total · Surveyor observation = Surveyor Remarks.
Blank: badge issue date, claimant email, particulars of loss.

**Needs live check:** the dropdown choices (license type, state) and one real Next.

## Handover (Antigravity) diagnosis — rejected

`all_frames` (there's no iframe), relaxing the route (it already matches exactly) and the probe's
"not Angular" failure (it's already handled for OIC) aren't the cause. The cause is B1 + B2.

## Prime ↔ Scan impact

None. Nothing here touches Scan coupling points.
