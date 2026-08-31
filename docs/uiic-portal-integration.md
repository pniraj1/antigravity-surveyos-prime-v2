# UIIC Surveyor Portal — Integration Research

**Last updated:** 2026-08-31
**Status:** research complete for the assessment section; Excel import halted

Reference notes behind
`docs/superpowers/specs/2026-08-31-uiic-portal-summary-design.md`. Everything
here was derived from saved DOM of the live portal, not from documentation —
United India publishes none.

---

## 1. Access

The portal is unreachable from outside India. It is not a DNS or TLS problem:
the connection completes in ~230 ms and the edge then returns a bare 403 with an
empty body.

```
server: volt-adc
x-volterra-location: mb2-mum
```

That is F5 Distributed Cloud, Mumbai edge, with a geo/IP policy. Commercial VPNs
do not get through — F5 XC classifies hosting and datacentre ASNs, which is
every VPN exit. A residential or mobile Indian IP would be needed.

**This does not block the work.** The portal's DOM was captured in India and
carried out as saved HTML.

### 1.1 Capture method

On a machine that can reach the portal, in Chrome:
**⋮ → Cast, Save and Share → Save page as → Webpage, Complete**.

Then locally:

```bash
python scripts/portal-map/extract-fields.py <saved.html> <out.json>
```

`extract-fields.py` strips commented-out markup, walks the DOM, and emits every
input/select/textarea with its name, id, `ng-model`, validation attributes,
dropdown options, and a `hidden` flag for anything Angular rendered under
`ng-hide`.

Captured maps live in `scripts/portal-map/`.

### 1.2 Handling captures safely

A saved page carries the **rendered values** of whatever claim was open — claim
number, policy number, insured name. Capture on a closed or test claim, and
strip `label_hint` from any JSON before committing it: that field carries the
field captions, and with them whatever text sat beside them.

---

## 2. Portal anatomy

AngularJS 1.x single-page app at `portal.uiic.in/surveyor/data/Surveyor.html`.
The claim survey lives on one route, `#/SurveyorClaimSurvey`, with every tab in
a single DOM — interim and final submission are the same form in different
states, so one field map covers both.

`data-ng-model` paths expose the server payload shape:

```
surveyorClaimSurvey.ClaimEntry.quickUpdate        17 fields
surveyorClaimSurvey.ClaimEntry.documentVerified   18 (9 Y/N radio pairs)
surveyorClaimSurvey.ClaimEntry.claimAssessment    65 (money)
surveyorClaimSurvey.basicDetails.BasicDetails      1 (PAYD flag)
impDoc / input                                    upload slots
```

114 live controls, of which 15 are `ng-hide` on an ordinary claim — the add-on
cover fields (EV, key protect, tyre and rim, IMT 23, medical, road tax, VAT,
registration, consumables, EMI protect). They render when the policy carries the
cover.

Left nav: `Worklist`, `ClaimSearch`, `SurveyorFee`, `MarutiAssessment`,
`MarutiReinspection`, `spaform`, `upload`, `SurveyorChatView`,
`BulkProvisionUploadDownload`. Only the worklist and claim survey have been
captured.

Worklist search is by Claim No / Vehicle No / Insured Name; claim type is
Maruti / Non Maruti. Survey categories seen in the markup: `Spot Survey`,
`Re-Inspection`, `Investigation`.

Submission: **Final Submit** → `completeSurvey_New()`, **Interim Report
Submit** → `temporarySurvey_New()`.

### 2.1 Constraints that shape anything we build

**Paste is blocked on 45 inputs** — `onpaste="return false;"` — covering every
money field, the observation textarea, odometer, claimant mobile and invoice
number. Copy and right-click are not blocked; only paste. Anything we produce is
typed by hand.

**The observations field rejects most punctuation:**

```
SurveyorRemarksOffice   ng-pattern="/^[a-zA-Z0-9. ]{1,500}$/"   maxlength 500
```

Letters, digits, full stop, space. **No comma, no hyphen, no `&`, `/`, `(`.**
Generated prose will be rejected as written; it needs sanitising and squeezing
to 500 characters. `recommendation` carries the same 500 cap.

Other caps: `reportNo` 10, `claimantMobileNo` 10, `WorkshopInvoiceNo` 16. Money
fields validate against `/^[0-9]+(\.[0-9]{1,2})?$/`.

**`name` attributes do not match the `ng-model` leaf.** `paymentOption` is
`name="paymentoption"`, `workshopInvoiceNo` is `name="WorkshopInvoiceNo"`,
`imt23Cover` is `name="imt23"`. Anything selector-based must target the real
`name`/`id`, which the JSON map records alongside the model path.

### 2.2 Depreciation buckets

The portal's four parts boxes are the IRDAI depreciation classes, and map 1:1
onto our `PartType`:

| Portal field | Portal label | Our `partType` | Rate |
|---|---|---|---|
| `ageBasedDep` | Vehicle Age Based Depreciation | `metal` | age scale |
| `dep50` | Parts at 50% (rubber, nylon, plastic, tyres, batteries, airbags) | `plastic` | 50% |
| `dep30` | Parts at 30% (fibreglass) | `fiberglass` | 30% |
| `nilDep` | Parts at Nil (glass) | `glass` | 0% |

Each has a readonly twin — `ageBasedAfterDep`, `dep50AfterDep`, `dep30AfterDep`
— labelled "Depreciated Amount (Rs.)", which the portal computes. A `chkNilDep`
checkbox hides `nilDep` on a Nil Depreciation policy.

GST is split parts (`gst28AmountP` … `gst0AmountP`) from labour (`*L`), each
with a readonly tax twin. On the labour side only 18% and 0% are editable; 28,
12 and 5 are readonly.

The behavioural rules — what actually goes in each box — are in the design spec,
§2.

### 2.3 Documents

Two repeats. **Mandatory**, over `claimAssessment.manDoc`, names
`fileToUpload0..4`:

```
Survey Report*   Assessment Details*   Estimate*   Invoice*   Re-Inspection Report*
```

"Assessment Details / Upload Assessment Report" is where the **bill check
report** goes. "Survey Report" is the final survey report.

**Non-mandatory**, a `docType0` select with 21 options: driving licence, RC
book, five vehicle photographs, road permit, fitness certificate, FIR, CSR, PAN,
Aadhaar, cancelled cheque, claim form, discharge voucher, CKYC, investigation
report, and **Other 1 / Other 2 / Other 3**.

There is no "Survey Fee Bill" option — **the fee bill is uploaded as Other**.
Its amounts are typed separately into `claimAssessment`: `profFeeAmount`,
`travelExpense`, `dailyAllowance`, `photoCharge`, `invoiceNo`, `invoiceDate`.

All file inputs accept:

```
.jpg .jpeg .png .gif .bmp .pdf .doc .docx .xls .xlsx .txt
```

Size limits are enforced in JS (`docValidationPerform`,
`manDocValidationPerform`), not in the DOM — unknown until someone triggers a
rejection. Uploads use a `base-sixty-four-input` directive, so files travel
base64-encoded inside the JSON payload rather than as multipart.

---

## 3. What is not captured

- `SurveyorFee`, `upload`, `ClaimSearch`, `MarutiAssessment`,
  `MarutiReinspection`, `BulkProvisionUploadDownload`, `spaform`
- a Spot Survey claim (many fields switch required/hidden on `surveyCategory`)
- a claim already Final Submitted (the form locks when `status === '0'`)
- a claim carrying add-on covers, to confirm the 15 hidden fields render
- upload size limit and its error text
- the validation list produced by Final Submit on an incomplete form

---

## 4. Assessment Excel import — halted

The portal offers a first-party Excel round trip, on every survey category
except Spot Survey and Investigation:

```
"Click here to Download Assessment Template"   downloadAssessmentTemplate()
"Click here to Upload Assessment Report"       uploadSurveyorAssessmentExcel()
```

This is easy to miss: the link "Click here to Upload Assessment Report" sits
beside a mandatory *document* slot labelled "Upload Assessment Report\*". Same
words, different things — one is a hyperlink, one is a file box.

It is a real import, not an attachment. ~40 of the assessment money fields carry

```
data-ng-disabled="... || (excelUploadedDisableFlag && disableSurveyFields)"
```

— the portal greys out manual entry once an Excel has been uploaded.

### 4.1 The template

Downloaded as `<claimNo>_Assessment_Excel_Form.xls` — legacy BIFF8, two sheets.

**`Details`** — 136 blank line rows, 15 columns:

```
A Serial No.           F Surveyor Assessment    K Approved Amount
B Assessment category  G Depreciation(%)        L GST%
C Part name            H Reinspection Observn   M GST Amount
D Part code            I Revised amount         N Invoice Number
E Repairer's estimate  J Billed amount          O Invoice date (labour only)
```

Header block: policy no, claim no, settlement type, recommendation and its date,
date of receipt of last document, bill no, bill receipt date, vehicle age
(decimal years), Nil Dep policy Y/N, date of accident (Excel serial, 1900
datemode).

**`Summary`** — one column per settlement basis: Repair Basis, Salvage Loss,
Total Loss, Cash Loss. Rows run from Market Value IDV through parts, labour and
EV protect parts, then the ADD/LESS lines for towing, key protect, tyre and rim,
IMT 23, medical, spot repair, reimbursement, personal effects, service tax, VAT,
salvage, the four excesses, ex-showroom price, registration, road tax,
consumables, EMI protect, personal belongings, to Net Amount Payable.

### 4.2 Coverage against our model

Line items map well — 11 of 15 columns come straight off `AssessmentRow`:
`srNo`, `particulars`, `partNumber`, `estimated`, `assessed`, computed dep %,
`billedAmount`, `billAllowed`, `gst`, GST amount, `remarks`.

Gaps:

- **Invoice number and date are per row**; we hold them per bill (`billNo`,
  `billDate`). Fine for a single-invoice claim, wrong for several.
- **Revised amount** — the reinspection column. Not carried.
- **Assessment category (column B)** — allowed values unknown. No dropdown list
  in the file, no hidden sheet, no defined names.

Summary sheet is thinner. Missing: EV protect, key protect, tyre and rim, IMT
23, medical, reimbursement, personal effects, personal belongings and its
excess, VAT, nil-dep excess, engine gearbox excess, ex-showroom price,
registration, road tax, consumable loss, EMI protect with its workshop dates,
spot repair. Plus three header fields: settlement type, Nil Dep policy flag,
date of receipt of last document.

Nearly all of those are add-on covers — blank on an ordinary OD claim, and the
same set the portal itself hides. So the sheet is fillable today for a normal
claim; the gaps bite on add-ons, multi-invoice bills, and reinspection.

### 4.3 Why it is halted

Open questions, none yet answered:

1. **Assessment category values.** Every row needs one.
2. **Formulas.** `Total` (B8) and `Net Amount Payable` (B32) are numeric `0.0`
   while every other Summary cell is empty; columns G and M show the same
   pattern on blank rows. That reads as formulas with cached zeros. If so we
   must *fill the downloaded file*, not generate one — a generated sheet would
   drop the formulas.
3. **Output format.** The template is legacy `.xls`. Our stack has `exceljs`,
   which writes `.xlsx` only. Whether the uploader accepts `.xlsx` is unknown.
4. **Filename.** Probably must keep the `<claimNo>_Assessment_Excel_Form`
   pattern. Unconfirmed.
5. **Row capacity.** 136 rows; behaviour beyond that unknown.
6. **Sheet responsibility.** Whether the portal computes Summary from Details.

Questions 1, 2 and 5 can be settled offline by opening the template in Excel —
check column B for a dropdown, click B8 for a formula, try typing past row 151.

---

## 5. Progress

**Done**

- Field map of the claim survey form, 114 controls, with validation and
  visibility — `scripts/portal-map/uiic-claim-survey.json`
- Worklist map — `scripts/portal-map/uiic-worklist.json`
- Reusable extractor — `scripts/portal-map/extract-fields.py`
- Assessment Excel template obtained and analysed
- Behavioural rules for the assessment section confirmed with a practising
  surveyor
- Design approved for the summary panel — see the spec

**Next**

- Implement the summary panel per the spec
- Capture the screens in §3 when portal access allows
- Revisit the Excel import once §4.3 is answered

**Not started**

- OIC and NIA. Both are closed portals with no public API. NIA runs TCS BaNCS
  (`web.newindia.co.in/NIABancsPortal/Surveyor.html`) plus an Android app, and
  National Insurance uses the same "Maruti" stack — so NIA work would likely
  port to NIC. Neither has been captured.
