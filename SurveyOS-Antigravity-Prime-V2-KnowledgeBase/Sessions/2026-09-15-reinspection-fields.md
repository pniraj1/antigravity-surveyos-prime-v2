# Session: 2026-09-15 (Claude)

## What Changed

### Commits
- 41f294bc feat(ri): add placeOfSurvey to ReinspectionDetails
- 75102430 feat(ri): print accident/survey dates, insurer offices, RI dates; drop report date and survey ref
- f39103c2 feat(ri): claim-reference card and RI ref/place/date inputs in Reinspection tab
- aa8a94fc feat(photos): editable Report No on photo sheet header, one-click RI ref
- 84f17c24 fix(photos): clearing Report No on sheet reverts to claim report number

## Rules

### Place of Survey Fallback
`ri.placeOfSurvey || accident.placeOfSurvey` — if Reinspection tab does not specify, print uses Accident tab's location.

### Photo Sheet Report No
Session-local storage only — never persisted to claim document. Editable inline with "Use RI Ref" one-click fill.

## Dead Fields

`ri.surveyRef` and `ri.surveyDate` remain on the type for backward compatibility with old data but nothing reads them. RI report no longer prints these fields.
