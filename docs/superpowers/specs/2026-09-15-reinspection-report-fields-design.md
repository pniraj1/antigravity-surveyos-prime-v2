# Reinspection Report — Field Completeness

**Date:** 2026-09-15
**Status:** Approved (brainstorm with Niraj)

## Problem

The Re-inspection report prints fields that have no input anywhere (`ri.refNo`,
`ri.surveyRef`, `ri.surveyDate` → always blank), prints a field that is not
wanted (`claim.reportDate`), and omits fields a reinspection report needs
(Date of Accident, Date of Survey, Insurance Company, Policy Issuing Office,
Claim Appointing Office, Place of Re-inspection). Three RI fields
(`riAppointmentDate`, `repairAuthDate`, `estCompletionDate`) are stored and
printed on the UIIC final report but have no input at all.

The surveyor should be able to fill everything the RI report needs from the
Reinspection tab without jumping to Vehicle/Policy tabs.

The photo sheet header hard-codes `claim.reportNo`; an RI photo sheet needs
to carry the RI Ref Number instead.

## Decisions

- Fields that live on other tabs are **two-way editable** in the RI tab:
  the RI inputs bind to the same store slices (`updateClaim`, `updatePolicy`,
  `updateAccident`). No copies, no sync code.
- Both office fields are printed under their own names:
  "Policy Issuing Office" (`policy.policyIssuingOffice`) and
  "Claim Appointing Office" (`policy.appointingOffice`).
- Place of Re-inspection is a **new** `ri.placeOfSurvey`, displayed as
  `ri.placeOfSurvey || accident.placeOfSurvey`. Typing stores to
  `ri.placeOfSurvey`; clearing falls back to the original survey place.
- "Date of Survey" = original survey date = `accident.dateOfSurvey`.
- Photo sheet: header text only. No RI photo bucket/tag.

## Changes

### 1. Types — `src/types/assessment.ts`
- `ReinspectionDetails` gains `placeOfSurvey?: string`.
- `surveyRef` / `surveyDate` stay on the type (old claims may hold them) but
  are no longer printed. Default in `claim.ts` gets `placeOfSurvey: ''`.

### 2. Reinspection tab — `src/components/tabs/ReinspectionTab.tsx`
New **Claim Reference** card above Inspection Details. Every input carries a
small hint "shared with Policy tab" / "shared with Vehicle tab":

| Label | Binding |
|---|---|
| Report Number | `claim.reportNo` → `updateClaim` |
| Insurance Company | `policy.insurerName` → `updatePolicy` |
| Policy Issuing Office | `policy.policyIssuingOffice` → `updatePolicy` |
| Claim Appointing Office | `policy.appointingOffice` → `updatePolicy` |
| Date of Accident | `accident.dateAndTime` (datetime-local) → `updateAccident` |
| Date of Survey | `accident.dateOfSurvey` (date) → `updateAccident` |

**Inspection Details** card gains:

| Label | Binding |
|---|---|
| RI Ref Number | `ri.refNo` |
| Place of Re-inspection | `ri.placeOfSurvey` (fallback display as above) |
| RI Appointment Date | `ri.riAppointmentDate` |
| Repair Authorisation Date | `ri.repairAuthDate` |
| Est. Completion Date | `ri.estCompletionDate` |

Existing inputs (Date of RI, Actual Completion, Repairs as Assessed,
findings, observations) unchanged.

### 3. Report builder — `src/lib/reports/reinspection-report-builder.ts`
REPORT DETAILS + ORIGINAL SURVEY DETAILS sections replaced by:

```
REPORT DETAILS
  Report Number        | RI Ref Number
  Date of Accident     | Date of Survey
  RI Appointment Date  | Date of RI
  Place of Re-inspection (colspan 3)
  Repair Auth. Date    | Est. Completion Date
  Actual Completion Date (colspan 3)
POLICY & CLAIM DETAILS (existing rows +)
  Insurance Company    | Policy Issuing Office
  Claim Appointing Office (colspan 3)
```
Dropped: Date of Report, Survey Ref No, Survey Date.
Vehicle / Findings / Conclusion sections unchanged.

### 4. Photo sheet — `PhotoSheetDocument.tsx`, `PhotosTab.tsx`
- `PhotoSheetOptions` gains `reportNo?: string` (session-local, not saved
  on the claim).
- Options panel: text input "Report No on sheet", pre-filled with
  `claim.reportNo`; a "Use RI Ref" chip appears when `ri.refNo` is non-empty
  and sets the option to it.
- `PhotoSheetDocument` prints `opts.reportNo ?? claim.reportNo`.

### 5. Test
One test file `src/lib/reports/__tests__/reinspection-report.test.ts`:
- new labels + values appear (RI Ref, Date of Accident, Insurance Company,
  both offices, three RI dates);
- "Date of Report", "Survey Ref No" do not appear;
- Place of Re-inspection falls back to `accident.placeOfSurvey` when
  `ri.placeOfSurvey` is empty, and uses `ri.placeOfSurvey` when set.

## Out of scope
- RI-specific photo tagging/filtering.
- Any change to UIIC/Standard final reports beyond them now receiving the
  three RI dates that finally have inputs.
