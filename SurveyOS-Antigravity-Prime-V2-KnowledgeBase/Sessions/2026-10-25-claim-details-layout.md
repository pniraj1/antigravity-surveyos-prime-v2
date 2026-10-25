# Session: 2026-10-25 (Claude): Claim Details layout by document

Owner said the Claim Details fields looked vaguely placed and the eye kept jumping. I reviewed every field (what it means, what stores it, which report prints it), proposed fixes, and the owner picked: fix the bugs, clean up visual noise, regroup by document (Option B), dates in one column on the right of each section (not a separate section), and a way to change the vehicle type after the claim is created. Duplicate fields stay as they are, because the Reconciliation hub corrects them. Committed `ea2a9ed6` on `main`; deployed to motorsurveyos-in (release 2026-10-25 10:18).

## What I Did
- **Bug: tax saved as fitness type.** Spot "Log Book / Tax Paid" wrote `spotDetails.fitnessType`, so tax text printed as "Fitness Type" on the Spot report and as the UIIC fitness fallback. Now its own optional `spotDetails.taxPaid`. The form and Spot report read `taxPaid ?? fitnessType`, so old claims still show their text. UIIC prints `vehicle.fitnessType` only.
- **Bug: overload prompt on every load.** It compared against `spotDetails.loadCapacity`, which only the Spot tab and RC extraction fill, so on final claims capacity was 0. Capacity now falls back to RC GVW − ULW (commas stripped, a negative capacity is ignored). Unknown capacity means no prompt. A ticked box stays visible so it can be cleared.
- **Bug: rows breaking.** Wide fields used screen-width spans (`lg:`/`xl:`) inside grids sized by the form's own width (`@md`/`@2xl`), so opening the Evidence panel broke rows. All spans are container-based now.
- **Layout (Option B).** New shell `DocSection` in `src/components/claim/form-bits.tsx`: fields on the left, dates in a 256 px column on the right with a divider. When a section is narrower than about 670 px, the dates move under the fields. Section order:
  1. Assignment
  2. Policy & Insured
  3. RC
  4. Driving Licence
  5. Permit & Fitness (commercial only)
  6. Accident
  7. At the Time of Accident
  8. Survey & Workshop ("Inspection" for valuation)
  9. Documents Obtained
  10. Spot Findings (spot only)
- **Scan buttons.** "Scan RC / DL / Policy" moved from the three big tiles into their section headers. The processing banner is sticky.
- **Noise removed.** Removed the green "used in spot report" dots. Red borders now only on about 20 core fields when empty. Section titles use one neutral colour. Spot section restyled to match the rest. The "SPOT MODE ACTIVE" badge and the "Legal & Logistics Section Halted" placeholder are gone. The Word Report button is gone from this tab (the Report tab has it).
- **Vehicle type switch.** Private / Comm. Goods / Comm. Passenger, in the report-number strip at the top. `vehicleType` only decides which sections show here and in the reports, so switching keeps every stored value.
- Checked on a temporary mock page (`/screenshots/details`, since deleted): every date column lines up at the same x, nothing overflows at 700, 1000, 1366 or 1440 px, and the vehicle switch works both ways. An independent reviewer compared every field's store key and update function with HEAD: all match. Fixes from that review: comma-safe GVW, wider date column.

## What's Unfinished
- [ ] Owner live check while logged in: one spot, one final and one valuation claim; flip the vehicle switch once; scan an RC and confirm the fields fill.
- [ ] `main` not pushed to `origin`; that's the owner's call.
- [ ] Not done (owner said not needed): merging duplicate fields (HPA ×3, GVW/ULW ×2, goods weight, route, survey date/time, workshop, appointment/allotment, enclosures vs checklist). Reconciliation covers them.

## Decisions Made
- **Layout ≠ data model.** Fields moved between sections, but every value is stored where it was (e.g. passengers still on `vehicle`, permit on `spotDetails`). Reports untouched apart from the tax fix.
- **Hidden now that showed before.** None of these are printed by a report that needs them; stored values stay.
  - For private vehicles: fitness number/valid/type, route, goods weight, nature of goods. Permit and challan were already hidden for private.
  - For valuation: passengers, load and challan. The valuation report never printed them.
- **Overload prompt with unknown capacity.** It now does not appear (fail-safe: no false overload flag). The surveyor can still type the load.
- **Scan Policy fills fields in two sections.** Insurer Name and Claim No. live in Assignment (the appointment letter), even though Scan Policy fills them.
- **Where the vehicle switch sits.** In the report-number strip (the claim's identity bar), above all the sections it controls, so the reason for missing permit fields is at the top of the page.
- **Deploy command.** Builds need `.next/dev` cleared if a dev server ran a since-deleted route (stale `validator.ts` fails the type check). Deploy ran from Bash: `firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in`; the new strings were found in the live chunk.

## Files Changed
- src/components/claim/form-bits.tsx (new — DocSection, EvidenceDot, req, selectCls)
- src/components/claim/AssignmentForm.tsx (new)
- src/components/claim/PermitForm.tsx (new — replaces CommercialLoadForm)
- src/components/claim/AtAccidentForm.tsx (new — overload fix lives here)
- src/components/claim/SurveyForm.tsx (new)
- src/components/claim/DocumentChecklist.tsx (new — moved out of AccidentForm)
- src/components/claim/CommercialLoadForm.tsx (deleted)
- src/components/claim/VehicleForm.tsx, PolicyForm.tsx, DriverForm.tsx, AccidentForm.tsx (rewritten onto DocSection)
- src/components/tabs/DetailsTab.tsx (section order, scan buttons, vehicle switch, Word Report removed)
- src/components/tabs/SpotTab.tsx (slimmed and restyled)
- src/components/print/SpotPrintReport.tsx (Fitness Type + Tax Paid row)
- src/lib/reports/uiic-final-builder.ts (fitness type fallback removed)
- src/types/assessment.ts (`taxPaid?`)
