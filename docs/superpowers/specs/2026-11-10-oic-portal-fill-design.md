# OIC Portal Fill: design (2026-11-10)

Evidence, bug list and the OIC page facts are in `2026-11-10-oic-portal-fill-debug.md`.
Read it first; this document doesn't repeat it.

## Why

A surveyor re-types into Oriental Insurance's "Motor OD Surveyor Assessment" form the same
claim data that Prime already holds. The SurveyOS Portal Fill extension was built to do that typing,
but on OIC it fills nothing (B1 + B2). The goal is admin removal: the surveyor opens the
OIC form, presses Fill, checks the highlighted boxes and presses Next themself.

## Goals

- Fill OIC **step 2 (Basic Details)**, **step 3 (Interim Report)** and **step 4 (Assessment of Loss:
  attach Prime's OIC Excel, plus excess and salvage)** from the claim in Prime.
- Fill **by typing into the page's own boxes** (owner's call), so OIC's own checks run on every
  value and nothing reaches OIC until the surveyor presses Next.
- Every box the extension filled is visibly marked, and the panel shows a short result
  ("N filled, M need you"). The surveyor can change anything.

## Non-goals

- Step 1 (Search: claim number + cashless/reimbursement) and step 5 (Document Upload) stay
  manual (owner's call). For photos, the owner uploads one raw JPG and puts the photo sheet under "Others".
- Saving a draft straight to OIC's server (`survey/surveyor-assessment-form`). It was considered and rejected:
  data would reach OIC before the surveyor saw it.
- Other insurers. NIA and UIIC fills must keep working unchanged.

## Anti-goals (a failure even if it "works")

- The extension presses Next, Save, Submit, Preview or any OIC button.
- A wrong value that looks right. When Prime has no value, or no safe default, the box stays **empty**.
- Overwriting a value OIC pre-filled from its own records, without saying so. Today's rule stays:
  a box that already holds a different value is reported as "differs", not overwritten. (Fix B3: ₹0 counts as empty.)
- The AI's policy reading being used as an answer. Nil dep comes from the surveyor's `policyCheck.nilDep` only.

## Constraints

- OIC is a React app: PrimeReact InputText, InputNumber, Dropdown, RadioButton and Calendar,
  with MUI date pickers. Plain `el.value = …` doesn't reach React state for Dropdown and
  probably not for InputNumber or date pickers either. Each widget type needs a write
  that OIC's own `onChange` accepts, and each must be **checked on the live page** (see "Live checks").
- All 5 steps share one URL; the step is in-page state. The panel must notice step changes
  (React Router uses `pushState`, B8) and work out which step is showing from the page itself.
- Step 3 has no claim number on the page (B9). The claim-match safety gate needs another
  anchor there (for example the claim number read on step 2 and remembered for that tab, or
  OIC's `sessionStorage.surveyAssessmentId`). Builder's choice, but the gate must not simply be dropped.
- The saved OIC pages and any live captures hold real PII. Test fixtures use fake values only.
- Nothing is deployed (extension or hosting) without the owner's approval.
- Prime ↔ Scan: no Scan coupling points are touched. Restate this when reporting.

## What fills, and from where

### Fixes the owner approved (debug B1–B5)
Read the claim number from the input's value, not the dropdown's text (B1). Map `from` keys
to the packet's real keys (B2). ₹0 counts as empty (B3). Send the reg number with OIC's spacing,
`MH 19 DV 9776` (B4). Split the DL as **state code / everything up to the last 4 / last 4**:
`MH1820100012611` → `MH` (Box 1, a state dropdown) / `182010001` / `2611` (B5, `splitIndianDl`).

### From Prime data that already exists (add to `buildOicPacket`)
| OIC box | Prime source |
|---|---|
| Driver date of birth | `driver.dateOfBirth` |
| DL valid up to | `driver.validityNonTransport`, or `validityTransport` for a transport licence |
| DL valid from | `driver.dateOfIssue` (my assumption: confirm on a live claim) |
| License type | `driver.licenceType` |
| Badge no. | `driver.badgeNumber` |
| DL verified yes/no | Always **Yes** (owner, 2026-11-10). Remarks ← `driver.invalidRemarks` when filled |
| Nil dep cover | `policyCheck.nilDep` (surveyor's answer only) |
| Cause of accident | `accident.causeOfAccident` |
| Surveyor appointed date | `accident.appointmentDate` |
| Claimant mobile | `policy.insuredMobile` |
| Workshop estimate amount (step 2) | **Bill total**, `billCheck.billTotal`, as now (owner confirmed 2026-11-10) |
| Initial loss amount (step 3) | **Net liability** (owner, 2026-11-10): the assessed amount over only the items that are billed and allowed, after depreciation, GST, salvage and excess. Must agree with the rows the OIC Excel keeps (`inOicExcel`). Check: `calculateBillCheckSummary().netLiability` sums `assessedNet` over every allowed row, so make sure `not-in-bill` / `not-allowed` rows don't count; otherwise compute it from the kept rows. A test pins this. |
| Excess, salvage (step 4) | the assessment's compulsory + voluntary excess and salvage |
| Spot survey done | Yes if the claim has spot details (my guess) |
| Third party involved | Yes if `accident.thirdPartyDetails` is filled (my guess) |
| Excel (step 4 `#fileInput`) | the OIC Excel Prime already builds, through the packet's `files` slot `assessmentExcel` and the existing `attachFile` |

### Fixed defaults (owner approved; the surveyor edits on the page)
Close proximity **No** · Sec 64VB confirmed **Yes** · Owner-driver **Yes** when the driver
name matches the insured name, else **No** · Relationship **Self** when owner-driver, else blank ·
Charges filed **No** · Vehicle inspected **Yes** · Survey completed **Yes** · DL applicable **Yes** ·
Final documents date **today** · Surveyor observation
**Surveyor Remarks** (`accident.remarks`).
Left **blank**: badge issue date, claimant email, particulars of loss.

Defaults are marked differently from real Prime values in the panel (for example "default"),
so the surveyor knows which ones to look at.

## Live checks (needs the owner, on a claim they're working on anyway)

Done in the side browser with the owner logged in. Claude only reads the page and the network
log, and never clicks Next, Save or Submit. Each check is done once, before the matching build work is called finished:
1. Each widget type accepts the extension's write and keeps it after Next/Back (Dropdown,
   InputNumber, RadioButton, Calendar, MUI date).
2. The dropdown option lists: license type, state, relationship, qualification.
3. Which step-2 boxes OIC pre-fills itself after Search, so they're left alone.
4. Attaching the Excel through `#fileInput` triggers OIC's own upload.

## Calls made after the builder check (Claude's calls, not the owner's)

- **Salvage:** use `resolveBillSalvage`, the same as NIA and UIIC. **Excess:** whether OIC has
  one box or separate compulsory/voluntary boxes, and whether they appear only after the Excel
  is parsed, is added as live check 5. Fill them after the upload has been parsed.
- **Guessed sources** (DL valid from = `dateOfIssue`, spot survey done, third party involved)
  are filled and marked **"default"**, not "Prime value". "Spot survey done" needs a real
  test (for example `spotDetails.surveyType` set, or a non-empty spot field), because every claim
  has a default `spotDetails` object.
- **Licence type:** `licenceType` can list several classes ("MCWG, LMV-TR"). Pick the class that fits this
  vehicle. A licence counts as transport when the vehicle is commercial (`isCommercial`), and then
  DL valid up to comes from `validityTransport`. If no class matches an OIC option, leave the box blank.

Live check 5: the step-4 boxes after the Excel upload (excess, salvage), and when they appear.

## Left to the builder

How each widget write is done; how the step is detected; the step-3 claim anchor; how
"default" vs "Prime value" shows in the panel; the test layout (fake-value fixtures built from the
saved pages' structure); the order of the work.
