# Reachable Scene Fields — Design

**Date:** 2026-08-22
**Status:** Awaiting review
**Scope:** `SpotTab`, `AccidentForm`, `VehicleForm`, `standard-report-builder`, `uiic-final-builder`, `SpotPrintReport`

Follows on from commit `5c833310`, which added third-party, panchanama and load
challan sections to the final reports. Those sections read fields that a final
survey cannot edit. This spec fixes that, and drops the third-party dropdown in
favour of free text.

---

## 1. The problem

### 1.1 The inputs are unreachable on a final survey

[DetailsTab.tsx:276](../../../src/components/tabs/DetailsTab.tsx):

```tsx
{currentClaim.surveyType === 'spot' && <SpotTab />}
```

`SpotTab` renders only for spot claims. There is no `spot` entry in `NAV_ITEMS`
at all — it is a section inside Claim Details, gated on survey type.

Every field stored on `spotDetails` is therefore uneditable on a final-survey
claim. Commit `5c833310` put several of them on the Standard Final report:

| Field | Printed by | Editable on a final claim |
|---|---|---|
| `tpInvolved` | Standard Final, UIIC Final | No |
| `policeReported`, `panchanama` | Standard Final, Spot | No |
| `challanNo`, `challanDate` | Standard Final §5, UIIC, Spot | No |
| `loadDesc`, `loadOrigin`, `loadDest` | Standard Final §5, Spot | No |
| `actualLoad`, `flagOverload` | Standard Final §5, UIIC, Spot | No |
| `permitNo`, `permitType`, `permitTo`, `authNo`, `authValid`, `areaOfOperation`, `natureOfPermit` | UIIC Final, Spot | No |

A final survey raised without a prior spot survey — the common case, since the
spot is often done by a different surveyor — prints these blank with no way to
fill them.

The fields added to `AccidentForm`, `DriverForm` and `VehicleForm` in the same
commit are unaffected. Those forms render for every survey type.

### 1.2 The report prints GVW twice

Introduced by the same commit. [standard-report-builder.ts:607](../../../src/lib/reports/standard-report-builder.ts)
prints `GVW` from `vehicle.registeredLoadWeight` in §2. Line 469 prints
`G.V.W. (KG)` from `spotDetails.gvw` in §5. Two fields, two inputs, one label.
On a final claim the §5 row is always blank.

### 1.3 The third-party classification is too small for the information

`tpInvolved` is a four-option dropdown (`no | tppd | tppi | both`) with a
single-line `thirdPartyDetails` beside it. Third-party information is
extensive — property damage, injuries, deaths, TP vehicle, hospital — and does
not fit a fixed enum plus one line.

---

## 2. Decisions taken during brainstorming

| # | Decision |
|---|---|
| D1 | Third party becomes **one free-text field**. The `tpInvolved` dropdown is removed and the TPPD/TPPI classification is dropped. |
| D2 | `spotDetails.tpInvolved` is **not deleted** from the type or from saved claims. It stops being read and written. |
| D3 | Inputs **move screen, not storage**. Same keys, so AI extraction, saved claims and the Spot report are untouched. |
| D4 | Scene fields go to `AccidentForm`; document- and load-derived fields go to `VehicleForm`'s commercial group. Both render for every survey type. |
| D5 | Each field ends with **exactly one input**. `SpotTab` drops its copies rather than duplicating them. |
| D6 | The GVW duplication is fixed by **deleting the §5 rows**, not by repointing fields. `spotDetails.gvw`/`ulw` keep their inputs in `SpotTab` and stay out of the move. |
| D7 | Payload Capacity stays a `SpotTab`-only computed box. It does not appear on the final report. |
| D8 | `policeReported` and `panchanama` stay **Yes/No selects**. They are genuinely binary; only third party becomes free text. |

---

## 3. Third party as free text

`accident.thirdPartyDetails` — the field already exists — becomes a multi-line
textarea in `AccidentForm`, beside the FIR fields it belongs with. The surveyor
writes as much as the claim needs.

Removed: the `tpInvolved` `<select>` in `SpotTab`, and `tpInvolvementLabel()`
in `report-utils.ts` along with its three call sites.

Report changes:

| Report | Before | After |
|---|---|---|
| Spot | `Third Party` = enum label, `TP Details` = one line | `Third Party` = free text, spanning the row |
| Standard Final | `Third Party Involvement` = enum label, `Third Party Details` = free text | Single `Third Party Details` row, free text |
| UIIC Final | `Third Party Involved` = free text, then `Type of TP Liability` = enum label | Single row labelled **`TPPI / TPPD`** = free text |

The UIIC change merges two rows. Keeping both would print the same text twice.

---

## 4. Moving the inputs

### Into `AccidentForm`

Placed after the existing FIR block, which describes the same scene.

- Third Party Details — textarea
- Police Reported — Yes/No select
- Panchanama — Yes/No select

### Into `VehicleForm`, commercial group

This group already holds Passengers at Accident, Passenger Type, Goods Weight at
Accident and Nature of Goods, so the load and permit fields sit with their peers.
Gated on the same commercial check the group already uses.

- Load Challan No., Load Challan Date
- Goods Description, Route From, Route To
- Load at Accident, and the overload opt-in checkbox
- Permit No., Permit Type, Permit Valid Upto, Nature of Permit
- Auth No., Auth Valid Upto, Area of Operation

### Removed from `SpotTab`

Every field listed above. `SpotTab` retains the scene assessment that only a
spot surveyor records: damage matrix, damage severity, airbags, drivable,
comments, enclosures, repair workshop, survey and report dates, GVW/ULW/Payload
Capacity, and Log Book / Tax Paid.

Storage keys are unchanged throughout. `spotDetails.challanNo` remains what the
Lok Challan extraction writes; only the screen holding the input changes.

---

## 5. The duplicate GVW

Delete the `G.V.W. (KG)` and `U.L.W. (KG)` rows from §5 of
`standard-report-builder.ts`. §2 already prints both from the vehicle record.

§5 keeps: Load Challan No., Load Challan Date, Load at Accident (with the
overload flag), Description of Goods, Route. These are load-specific and have no
equivalent in §2.

No fallback chain, no migration, no change to `vehicle.registeredLoadWeight` or
`vehicle.unladenWeight`.

---

## 6. Testing

Extend `src/lib/reports/__tests__/tp-and-load-challan.test.ts`.

Replace the TPPD/TPPI label tests, which no longer describe the behaviour:

- Third party free text reaches the Standard Final
- Third party free text reaches the UIIC Final under the `TPPI / TPPD` label
- UIIC Final prints the third-party text once, not twice
- Empty third party prints `NIL` rather than an empty cell

Keep and extend the load challan tests:

- §5 prints challan, load, goods and route on a claim built with **no spot
  survey** — the case that motivated this spec
- §5 contains no `G.V.W.` or `U.L.W.` row
- §2 still prints GVW from the vehicle record
- Overload flag, private-vehicle omission and bill-check omission all still hold

Keep the panchanama tests unchanged, including the case where an unanswered
question prints an em dash rather than `No`.

**Not covered by tests:** that the moved inputs render correctly on a real
claim. The forms are behind login, so this stays a manual check.

---

## 7. Out of scope

- **`fitnessType`.** `vehicle.fitnessType` and `spotDetails.fitnessType` are
  separate fields read in opposite priority by the Spot and UIIC reports, and
  `SpotTab` labels its copy "Log Book / Tax Paid" while both reports print it as
  a fitness certificate type. A real defect, but a separate decision about what
  the field means. Not addressed here.
- **`vehicle.actualPayload`.** Extracted by AI, printed by no report.
- **Deleting unused fields.** `tpInvolved`, `vehicle.loadChallanNumber`,
  `vehicle.loadChallanDate`, `vehicle.isCommercial`, `accident.locationCode`,
  `spotDetails.repairs`, `spotDetails.verificationFlags` all stay in place.
