# Insurer Surveyor Portals — Integration Research

**Last updated:** 2026-09-18
**Status:** UIIC assessment section mapped, UIIC Excel halted; NIA non-tieup fully mapped from controller source, tie-ups partially

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

## 5. New India Assurance (NIA)

Portal: `web.newindia.co.in/NIABancsPortal/Surveyor.html`. Same TCS BaNCS
AngularJS stack as UIIC — same extractor works. Unlike UIIC, the controller
source was captured (`surveyorHome.js`, 2 MB, unminified, via "Webpage,
Complete"), so the behaviour below is read from code, not inferred.

Captured 2026-09-18 — maps in `scripts/portal-map/nia-*.json`:

| Route | Flow | Controls |
|---|---|---|
| `#/Worklist` | worklist | 5 |
| `#/WorklistSurveyNew` | **non-tieup** claim survey | 165 |
| `#/WorklistSurvey` | Maruti tie-up | 202 |
| `#/WorklistSurveyKIA` | KIA tie-up | 693 |

### 5.1 How NIA differs from UIIC

| | UIIC | NIA |
|---|---|---|
| Assessment entry | type 4 bucket totals + GST slabs | **upload Excel line items**; portal computes |
| Paste | blocked on 45 fields | **not blocked anywhere** |
| Invoices | one | up to 3, each with own Excel, bill, painting |
| Fee bill | typed into assessment + PDF as "Other" | **dedicated section** with its own fields and file |
| Garage bill | attachment | **OCR** — "Upload the Bill → Populate Data" fills rows |
| Tie-ups | — | dealer feeds lines; surveyor approves per row |

### 5.2 Non-tieup — page structure

Five tabs: Quick Update → Additional Details → Claim Assessment → Document
Upload → Connect with Claim Office. Payload root `surveyorData.worklist.*`.

**Per invoice** (`multiInvoice[$index]`): in-name-of-NIA, GST applicable,
vendor invoice no/date; `Upload XLS or XLSX Template` → **Validate**
(`checkFields('PrimaryAssessment')`); or `Upload the Bill` → **Populate Data**
(OCR); or `Number of Rows To be Added` → manual grid; supplementary estimate
Y/N with its own upload (`readExcelSup`); the painting block.

**Grid row** (`obj`): category, partName (100), estimatedAmount (10),
billedAmount (8), assessedAmount (8), depreciationPercentage (3),
depreciationAmount, hsnCode, gstPercentage (3), amountAllowed,
amountAllowedIncluded. The last three are computed.

**Claim Assessment totals** (`claimAssessment`): noOfInvoices, netSalvage,
lessCompulsoryExcess, lessVoluntaryExpress, lessOtherDeductions,
imposedExcess, towingCharges, additionalTowingCharges,
whetherReinspectionRequired, nilDepreciationCover, engineProtectCover,
consumableItemsCover, keyProtectCover, returnToInvoiceCover.

**Quick Update**: survey date (radio of last 3 days + Others), time `HH:MM`,
place, survey completed, DL applicable, RC verified, DL and RC verified via
Parivahan, close-proximity/break-in, `surveyorAccessedAmount` (Provision),
remarks (240), claimant mobile/email, expected repair date.

**Survey Fee Bill** (`surveyFeeBill`): isInvoiceInNameOfNIA, invoice no (20)
and date, professionalFee, photosAmount, conveyanceAmount, others,
isGSTApplicable, hsnCode, gstPercent, totalGSTAmount, total, plus a file.

**Declarations**: 12 checkboxes (a–l) — engine/chassis, damage relevance,
supplementary, repairs relevance, reinspected, NCB via IIB, DL/RC original,
DL/RC/permit/fitness via Parivahan. Also work-approval and delivery-order
documents with date + time.

**Documents**: mandatory list — Driving License, Registration Certificate,
Claim Form, Claim Related Documents, Chassis Number Photograph, Odometer
Reading Photograph. Non-mandatory — Estimate, PUC, Spot Photograph and Spot
Survey Report, Others, Permit-Fitness, FIR and Police Records, Cancelled Cheque,
Front/Rear/Side Photograph, Re-inspection, Invoice.

Validation patterns are ordinary: money `^[0-9]+(\.[0-9]{1,2})?$`, percent
0–100 to 2 dp, mobile `^[56789]\d{9}$`, time `HH:MM`, free text bans only
`< > ^ & \ |`.

### 5.3 The Excel import — read from `surveyorHome.js`

Parsing is **client-side** with SheetJS (`readExcel`, line ~6609).

- `.xls` and `.xlsx` both accepted; sheet must be named
  `Primary_Assessment_Template`; first row is headers
- **Exactly 11 keys on row 1** or it rejects with *"Template Format is
  incorrect. Please fill all the columns to proceed"*. SheetJS drops blank
  cells, so every cell must be non-empty
- Columns: `SlNo, category, description, partName, serviceType,
  estimatedAmount, billedAmount, assessedAmount, depreciationPercentage,
  hsnCode, gstPercentage`
- After import each row runs `getDepreciationPercent`, `getDepreciationAmount`,
  `validateHsnCode`
- `assessedAmount` is read with `.includes('.')` — a string method. Numeric
  cells are a risk; write amounts as text

**`getDepreciationPercent`** — `description` sets and locks the rate:

| description | dep% |
|---|---|
| `Parts at 50% Depreciation` | 50, locked |
| `Parts at 30% Depreciation` | 30, locked |
| `Parts at Cost` | 0, locked |
| `Labor charges for Removing and Refitting` | 0, locked |
| `Labor charges for Repairing and Alignment` | 0, locked |
| `Other Labor Charges` | 0, locked |
| `Parts at Agewise Depreciation` | from the file, editable |

**`getDepreciationAmount`**:

```
depreciationAmount   = assessedAmount × depreciationPercentage / 100
amountAllowed        = assessedAmount − depreciationAmount
amountAllowedIncl    = amountAllowed × (1 + gstPercentage/100)
```

So `assessedAmount` is **pre-depreciation**.

**`validateHsnCode`** — each code is checked against a per-claim list from
`getHSNCode(claimNumber)`. Unknown → the cell is blanked, and Validate then
flags it as mandatory. Known → **`gstPercentage` is overwritten** from that
code's rate. The file's GST column is advisory.

Codes confirmed on the list (surveyor, via SWAR): `8512` → 18%, `8708` → 28%,
`72041000` → 0%. Disposal parts carry `72041000`.

**`serviceType`** — zero comparisons in the controller. Stored, sent, never
read client-side. SWAR's `REPLACE | ALLOW | NOT ALLOWED` are known to pass.

### 5.4 Painting

Not in the Excel. Typed per invoice. `paintingWorkDetails`:

- **Consolidated** — surveyor types estimate + assessed. Portal locks
  labour 75% / material 25% and computes (`getLabourAmountNew`):
  ```
  labour   = assessed × 75%
  material = assessed × 25%
  dep      = material × 50%
  total    = labour + (material − dep)     GST on each
  ```
- **Break-up** — percentages unlock, amounts typed per line.

### 5.5 Tie-ups

No Excel. Lines come from the dealer; the surveyor sets per row an allowed
service type, approval amount and depreciation.

- **Maruti** (`item4`): vItem, vAllowedServiceType, vApprovalAmount,
  vDepriciation, vHsnCode, vGstPercent
- **KIA**: separate parts (`primPPD*`: MRP, list price, dep%, dep price,
  qty, type…) and labour (`primPLD*`: rate, qty, SAC…) grids, plus advance
  payment (`advPay`), final inspection scheduling (`finalInsp`), dealer
  remarks, `clmAsmtKIA.salvageSurveyorAmt`

`getDepreciationAmount` switches on `sessionStorage.claimTypeNM` in
`['Kia','Maruti']`, and `Hero MotoCorp` appears as a further type. Not yet
mapped in detail.

### 5.6 Not captured

Worklist search, ClaimSearch, SurveyorFee, the post-Validate grid with values,
a submitted claim's locked state, upload size limits, a Hero MotoCorp claim.

### 5.7 SWAR's NIA output, for reference

`NIC_Up_Load_Excel.xls` — the file SWAR hands surveyors, named for National
Insurance but used on NIA (shared stack). One sheet, the 11 columns above,
parts + labour only. `72041000` on every NOT ALLOWED row is a habit, not a
requirement, but the code is on the portal's list at 0%.

---

## 6. Progress

**Done**

- Field map of the claim survey form, 114 controls, with validation and
  visibility — `scripts/portal-map/uiic-claim-survey.json`
- Worklist map — `scripts/portal-map/uiic-worklist.json`
- Reusable extractor — `scripts/portal-map/extract-fields.py`
- Assessment Excel template obtained and analysed
- Behavioural rules for the assessment section confirmed with a practising
  surveyor
- Design approved for the summary panel — see the spec

- **UIIC summary panel built and deployed** (2026-08-31), spec
  `2026-08-31-uiic-portal-summary-design.md`
- NIA non-tieup fully mapped from controller source; Maruti and KIA captured
- NIA Excel generator designed — spec `2026-09-18-nia-assessment-excel-design.md`

- **NIA Excel generator shipped** (2026-09-18), spec
  `2026-09-18-nia-assessment-excel-design.md`
- Extension v1 designed — spec `2026-09-20-portal-fill-extension-design.md`
- Claim Documents designed — spec `2026-09-20-claim-documents-design.md`

**Next**

- Review both 2026-09-20 specs, then plan and build (extension first)
- One real NIA upload on a closed claim: Validate → save page
- NIA read-off panel for the typed fields (superseded by the extension if it lands first)
- Map tie-ups (Maruti, KIA) from `surveyorHome.js`
- Capture the UIIC screens in §3 when portal access allows
- Revisit the UIIC Excel import once §4.3 is answered

**Not started**

- OIC. Closed portal, no public API, not captured.
- National Insurance — same TCS "Maruti" stack as NIA, so NIA work should
  port. Not captured.
