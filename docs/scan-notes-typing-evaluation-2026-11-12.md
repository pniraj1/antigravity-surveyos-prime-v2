# Scan notes: how much does the surveyor really have to type? (2026-11-12)

Evaluation of all 65 Scan notes fields, plus damage rows and part rows.

**Status (2026-11-12):** changes 1–5 are built in Scan (see "What was built" at the end). Change 6 turned out not to be needed. Change 7 (Prime) is not started.

## The rule we should hold to

**Type a fact once, in one place, and only when no machine already knows it.**

Today the surveyor can end up entering the same fact two or three times:
1. on more than one Scan tab,
2. on the phone, when Prime reads the same fact from a document the surveyor scanned, and
3. on every claim, when the answer is nearly always the same.

## What Scan already does well (keep it)

| Shortcut | Fields it saves |
|---|---|
| Same value copied across Spot / Valuation / Fee tabs (`SHARED_SYNC_MAP`) | Survey date & time ↔ Inspection date ↔ Fee survey date; Place of survey ↔ Inspection place; Odometer ↔ Kilometerage; ENCL ↔ Enclosures |
| One-tap suggestion from the first stamped photo (time + GPS address) | Survey / inspection date & time, place |
| One-tap list of scanned documents | ENCL / Enclosures |
| Bill date from the survey date | Bill Date |
| "N photos in claim" chip | No. of Photos |
| Remembered across claims (`FeeRatesStore`) | Rate per KM, Rate per Photo, GST |
| Pick lists | Damage components, condition words, document remarks, valuation part names |

So the cross-tab problem is mostly solved already. The big remaining waste is in **(2)** and **(3)**.

## Field-by-field verdict

**A. Already automatic or one tap: 12 fields.** Leave them alone.
Survey date/time, place of survey, inspection date/place, odometer/kilometerage, both enclosures, bill date, no. of photos, rate per km, rate per photo, GST.

**B. Prime already reads these from documents: 9 fields. Typing them on the phone is wasted, and it later creates "Phone notes differ".**

| Field | Prime fills it from |
|---|---|
| Accident date & time, Place of accident, Cause of accident, Third party | Claim Form (`applyClaim`) |
| Goods carried, Origin, Destination, Actual load | Load Challan / E-way bill (`applyLoadChallan`), but only when the challan is uploaded to Prime's Load Challan card. Scan has no Load Challan type, so a phone-scanned challan arrives as "Other" and is not read. |
| Document verification → Load Challan | Load Challan (same caveat) |

Note: Prime's document reading *overwrites* these fields. A surveyor who types them on the phone and imports first can have their own words replaced later by the claim form's.

**C. Scan already knows the answer but doesn't offer it: 18 fields.**

| Field | What Scan could offer |
|---|---|
| Document Verification status for RC, DL, Permit, Fitness, FIR (5 statuses + 5 remarks) | Those documents are scanned in this claim. Offer one tap: **"Mark scanned documents: YES — Original seen"**. Unscanned ones stay blank. |
| MDL Status | DL scanned → suggest "Original MDL verified" |
| Further Repairs, Place of Survey (when there's no stamped photo) | The garage on the claim's People tab |
| Date of Report | Today |
| Professional Fee, Re-inspection Fee, Travel Route Note, Toll Note | The value used on the last claim for **this insurer** |
| Distance (KM) | Last value used for the same garage |

**D. Same answer on most claims, one field at a time: 9 fields + parts list.**
Valuation condition boxes: Chassis, Engine & Transmission, Brakes & Suspension, Battery, Tyres, Glass, Seats, Electricals, plus each part row. On a healthy vehicle all say "Good".
→ One button: **"Set all empty conditions to Good"**, then change the few that differ. The same button can add the standard part rows (`VALUATION_PARTS`) as Good.

**E. Only the surveyor can know these: about 20 fields. Keep them as they are.**
Pre-accident condition, Police reported / station, Panchanama, Spot observations, Severity, Airbags, Drivable, damage rows, Vehicle insurable?, Valuation remarks, Tyre/Battery make, Tyre/Stepney count, Allotment date, Toll, Postal, Haltage, Advance receipt, Cash received, Fee paid.
These should stay surveyor-made: they're the surveyor's judgement at the spot (see the "assessment is surveyor-made" rule).

**Bottom line:** about **36 of 65** fields (B + C + D) need no typing, or at most one tap. Today the surveyor types or picks each of them by hand.

## Proposed changes, best value first

| # | Change | Where | Saves | Size |
|---|---|---|---|---|
| 1 | "Mark scanned documents as seen" chip on Document Verification; MDL suggestion when DL scanned | Scan | up to 11 boxes per claim | small |
| 2 | "Set all empty conditions to Good" + "Add standard parts as Good" | Scan, Valuation tab | 9+ boxes on every valuation | small |
| 3 | Fields Prime reads from a scanned Claim Form / Load Challan: fold them shut with the line "Prime reads this from the Claim Form you scanned". They stay open when that document isn't scanned. | Scan | 9 boxes; ends most "differ" prompts | small |
| 4 | Garage from People tab → suggestion on Further Repairs / Place of Survey | Scan | 2 boxes | tiny |
| 5 | Remember last Professional fee, RI fee and notes per insurer, as suggestions (not auto-filled) | Scan | 4 boxes | small |
| 6 | ~~Export Fee-tab survey date/place~~: not needed. The Fee tab already mirrors them into Spot and Valuation (`SHARED_SYNC_MAP`), and those are exported. | — | — | — |
| 7 | Prime: when a document is read, don't overwrite a value the surveyor imported from the phone; list it as "differ" instead | Prime (`aiDataSlice.ts` apply steps) | protects the surveyor's own words | medium; touches extraction |

Changes 1–6 are Scan-only. They change no manifest field and add no AI calls. Cost: free (no API, no storage). Effort: about a day for 1–5 together, a few minutes for 6.
Change 7 touches Prime's extraction apply step, which many flows share, so it needs its own careful pass.

**What I'd skip:** auto-filling anything in group E, or turning suggestions into silent auto-fills. One tap keeps the surveyor in charge, and a silent auto-fill would make "did I check this?" impossible to tell at review time.

## Impact on the other app
- 1–5: Scan only; the manifest and its paths are unchanged, so Prime needs no change.
- 6: Scan export change. The handover doc must say Prime receives `spotDetails.surveyDatetime` / `accident.placeOfSurvey` from the Fee tab when Spot is empty. Prime needs no code change.
- 7: Prime only; Scan needs no change.

## What was built (2026-11-12, Scan, not committed or installed)

| # | On the phone |
|---|---|
| 1 | Spot → Document Verification: **"Mark N scanned documents: YES — Original seen"**. It covers RC, DL, Permit, Fitness and FIR when they're scanned with at least one page. Filled boxes are left alone; a remark already typed is kept. MDL Status offers "Original MDL verified (DL scanned)". |
| 2 | Valuation → Condition of Vehicle: **"Set N empty to Good"**. It covers the 8 condition boxes and any listed part with no condition. It doesn't add parts for you, because trailer and load-body presets would be wrong on a car; the part chips are still one tap each. |
| 3 | Spot: when a Claim Form is scanned, Accident date & time, Place of accident, Cause and Third party fold to one line, "Prime reads this from the Claim Form you scanned", with a **Type** button. A field that already has a value shows as usual. The load fields are not folded (see the caveat above). |
| 4 | Spot: the People tab's garage is offered for Further Repairs. It is not offered for Place of Survey, which mirrors into Valuation and Fees, so a wrong pick would spread. |
| 5 | Fees: the last Professional fee and RI fee **for this insurer** are offered as "Last for NIA: 2500 — Use". They are remembered when the Fee screen closes, and only if they changed there, so half-typed values and old claims never count. Route and toll notes are claim-specific, so they are not remembered. |

Code: `notes/QuickFills.kt` and `notes/FeeMemoryStore.kt`, with changes to `NotesTab.kt`, `ValuationNotes.kt` and `FeeBillNotes.kt`. Test: `QuickFillsTest.kt` (11). An independent review found no critical issues; its fee-memory bug and the Place of Survey point are fixed. The manifest and export are unchanged.
