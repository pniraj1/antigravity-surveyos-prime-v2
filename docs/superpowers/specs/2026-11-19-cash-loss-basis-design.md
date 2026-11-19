# Cash Loss Basis — Design

Date: 2026-11-19 · Status: awaiting owner approval
Reference sample: `C:\Users\Manasi\Downloads\cashloss sample.pdf`, section V (Vikram Patil, MOTOR-910/2026).

## Why
Sometimes the insured will not repair the vehicle, for example because they cannot afford to. The insurer then pays a one-time settlement, the "cash loss basis" (settlement without production of repair bills). It asks for no repair bills and does no reinspection. Two consequences:
- **No GST.** No tax invoice exists, so every figure is taken before tax.
- **Notional deduction.** The surveyor deducts a percentage, chosen by the surveyor, for the bills not being submitted. The sample uses 30%.

Any Final claim can be settled this way, not only total-loss claims (owner).

## Goals
- A Cash Loss switch on any Final claim, with a notional % that the surveyor enters.
- A **8A. CASH LOSS BASIS** table in the Final report, shown *beside* the repair-basis Assessment Summary, not replacing it (owner chose layout A).
- The cash loss net becomes the amount payable wherever the report states what the insurer pays.

## Non-goals / anti-goals
- **No default %.** The percentage is always typed by the surveyor. The assessment is the surveyor's own ([[assessment-surveyor-made-only]]).
- **Portal fills and exports are unchanged** (UIIC, NIA, OIC). The surveyor handles cash-loss amounts on portals by hand (owner).
- **The survey fee is unchanged.** It stays on the repair-basis net assessed loss (owner).
- **No K.O. on cash loss.** Every part is allowed or not allowed (owner).
- **Row data is never altered**, for example by stripping GST from rows. Cash loss is computed on top of the assessment.

## Approaches considered
- **A. A settlement setting on the claim plus one pure calculation (chosen).** It reuses figures the report already computes. Every report reads the same function.
- B. A separate cash-loss report type. It would duplicate the whole report, and the owner wants cash loss beside the repair basis. Rejected.
- C. Zeroing GST on rows. It would corrupt the real assessment, and switching cash loss off could not undo it cleanly. Rejected.

## Data
`ClaimData.cashLoss?: { enabled: boolean; notionalPercent: number | null }`. It is undefined on old claims, which means off. `notionalPercent` must be between 0 and 100. `null` means not entered yet.

## Calculation (one pure function, tested against the sample)
`cashLossBasis(...)`. The inputs are the before-GST, after-depreciation figures that section 8 already prints in its "Assessed (after Dep.)" column. Those figures already have the IMT-23 share taken out.

| Line | Value |
|---|---|
| Labour assessed (before tax) | labour + painting after paint-material depreciation (section 8 Labour + Painting, assessed column) |
| Add: Towing charges | feeBill towing |
| Metal / Plastic-Rubber / Glass / Fibre Glass parts after depreciation (before tax) | section 8 assessed column per material. A row prints only if its value is above 0. |
| Less: Salvage | feeBill salvage |
| **GROSS ASSESSED LOSS** | sum of the lines above |
| Less: Notional deduction for non-submission of bills @ N% | Gross × N / 100 |
| Less: Policy Excess (Compulsory / Voluntary) | same excess as section 8 |
| **NET LIABILITY ON CASH LOSS BASIS** | max(0, Gross − notional − excess) |

Test: labour 36,750 + metal 68,960.50 + plastic 4,775 + glass 1,600 − salvage 7,085 = **Gross 1,05,000.50**. Then 30% = 31,500.15, less excess 1,000, gives **Net 72,500.35**. Disposal parts count in the material figures they already fall under in section 8.

## Where cash loss shows

| Place | Behaviour when Cash Loss is on |
|---|---|
| **Assessment tab, footer** | The "Total Loss Settlement" panel becomes **"Settlement basis"** with two independent switches: Total Loss comparison (unchanged) and **Cash Loss**. Cash Loss has a "Notional deduction %" box that starts empty, plus a live preview of the Gross and Net figures. |
| Assessment grid | The K.O. button is disabled, with the hint "Not available on cash loss claims". |
| **Standard Final** | **8A. CASH LOSS BASIS (without production of repair bills; all figures before GST)** prints directly under section 8. It is a two-column Head / Amount table with an amount-in-words line, as sketched in the conversation. Section 8 itself is unchanged. |
| Standard Final preamble | One added sentence: the claim is recommended for settlement on cash loss basis at the insured's request, with a notional deduction of N% for non-submission of bills. It is added only when the preamble is auto-composed. A surveyor-typed preamble is left alone. |
| **Comparison of Insurer's Liability** (when Total Loss is also on) | A **5th column, "Cash Loss"**. It shows the Gross, the notional deduction and the excess rows, and its NET equals the 8A net. The other columns are unchanged. |
| **UIIC Final** | The same 8A table, placed after DETAILS OF ASSESSMENT and before the GST Summary page (owner). The **"Amount Payable by Insurer"** box shows the cash-loss net. The other UIIC boxes are unchanged. |
| **Bill Check** | Switched off for the claim. The Bill Check tab shows "This claim is settled on cash loss basis — no bill check", and Bill Check printing and Word export are held. |
| **Insured Report** (vehicle owner) | One line: "Settled on cash loss basis at your request; a notional deduction of N% (₹X) applies as repair bills are not submitted." (owner) |
| **Document checklist** | A new document type, **"Cash Loss Consent of Insured"**, which shows as required only while Cash Loss is on (owner). |
| Fee bill, IRDAI summary, portals, NIA/OIC/UIIC exports | **Unchanged.** |

## Print holds (all reports)
While Cash Loss is on, Final printing is held, with a message naming the reason, when:
- `notionalPercent` is null, or outside 0–100;
- any row is K.O. The message lists those parts: "Decide these as allowed or not allowed".

## SurveyOS Scan impact (coupling point)
The new doc type changes `src/types/documents.ts` (`DocType`, `DOC_TYPE_LABEL`) and the checklist. Scan's drift tests read these files. So, in the same piece of work:
- add the matching doc type to Scan;
- run `./gradlew :app:testDebugUnitTest`;
- note the change in `../SurveyOS Scan/docs/handover/`.

Nothing else in this design touches Scan.

## Rulings (designer's calls after the builder check; the owner asked to proceed)
1. **Source figures.** `cashLossBasis` derives everything itself from rows: allowed rows only (not-allowed and K.O. rows are excluded), `computeRowNet(row, rowDepRate(...)).netBeforeGst`, summed by section and part material. This figure is before GST (`assessed` is stored taxable) and already has the IMT-23 share and paint-material depreciation taken out, so it equals section 8's assessed `pb + labBase`. Both builders call this one function, so the standard and UIIC Finals print the same Gross. Tests: the sample figures; a claim with one IMT-23 row, where Gross equals section 8's assessed grand total + towing − salvage; and standard and UIIC Gross equal on the same claim.
2. **Payable on cash loss.**
   - Standard Final: section 8 NET ASSESSED LOSS stays the repair basis (layout A); 8A NET is the payable.
   - UIIC Final: "Amount Payable by Insurer" and the "claim is recommended for Rs." line both show the cash-loss net. The "I/We hereby authorize repairs for Rs." line is omitted, because no repair takes place.
   - Insured Report: only the one explanatory line.
3. **Comparison 5th column ("Cash Loss").**
   - The new rows "Cash loss gross (before GST, after salvage & towing)" and "Less: Notional deduction @ N%" carry values in this column only.
   - The existing excess row carries the excess in this column.
   - All other rows show "—".
   - NET equals the 8A net.
   - If both Total Loss and Cash Loss are on, every column prints and the surveyor's remarks recommend one.
4. **Print hold** covers Final print and Final Word export, for both the standard and UIIC reports. The Insured Report is not held.
5. **Consent document** is a checklist marker only. It never blocks printing. Scan needs the same doc type and label (plus any aliases its drift test requires).

## Left to the builder
The switch styling, the exact wording of the hold messages, the function and file names, and where the preview sits in the panel.
