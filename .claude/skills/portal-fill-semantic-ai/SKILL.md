---
name: portal-fill-semantic-ai
description: "Use when mapping insurer portal dropdown options to canonical claim values, generating sanitized surveyor observations, or predicting unmapped portal form fields."
metadata:
  category: technique
  triggers: dropdown-normalization, portal-observations, zero-shot-mapping, portal-fill-ai, insurer-remarks
---

# Portal Fill Semantic AI

A specialized intelligence engine for SurveyOS Portal Fill. It bridges canonical motor survey claims with legacy Indian insurer web portals (New India Assurance, United India, Oriental Insurance, National Insurance, and private carriers) without compromising surveyor safety, privacy, or portal stability.

---

## ⚡ Quick Decision Tree

### What portal filling challenge are you solving?

1. **Portal Dropdown has coded or non-standard options?**
   - E.g., SurveyOS has `fuel: "Petrol"`, but portal dropdown contains `"01 - MOTOR SPIRIT (PETROL)"` or `"MS"`.
   - ➔ **Use Dropdown Option Normalization (`normalizeDropdownOption`)**. Strip leading numerical codes, check token containment, and match against the Indian Motor Insurance Synonym Matrix.

2. **Surveyor Remarks or Loss Observations cause portal crashes?**
   - E.g., United India (UIIC) throws `ERR_INVALID_CHARACTER` or ASP.NET crashes on quotes, commas, ampersands, or semicolons; or portal truncates remarks beyond 500 characters.
   - ➔ **Use Observations & Narrative Auto-Drafter (`draftPortalObservations`)**. Format a concise, structured survey summary, enforce insurer character limits (UIIC 500 chars, NIA 1000 chars), and apply strict punctuation sanitization (`[a-zA-Z0-9. \n]`).

3. **Encountering a new portal layout or unmapped input field?**
   - E.g., A private insurer portal or new bancassurance screen has unfamiliar field labels (`"Regn. No."`, `"Vech Chassis"`, `"D/L Number"`).
   - ➔ **Use Zero-Shot DOM Semantic Matcher (`predictFieldMapping`)**. Extract label text, placeholder, DOM ID, and name attributes, and compute weighted similarity scores against canonical claim fields.

---

## 🛑 Anti-Rationalization Guardrails

Agents and developers MUST NOT bypass these core rules under any circumstance:

### 1. No PII Exfiltration
- **Rule**: Never transmit claim values, registration numbers, driver details, or surveyor remarks to external cloud LLM APIs from the extension.
- **Why**: SurveyOS guarantees zero customer PII leakage.
- **Enforcement**: Dropdown normalization, observation sanitization, and zero-shot matching MUST run completely offline and locally in the browser runtime (`semantic-ai.js`) using fast token heuristics and built-in synonym dictionaries.

### 2. UIIC Strict Punctuation Sanitization
- **Rule**: Never send un-sanitized strings containing `,`, `;`, `'`, `"`, `/`, `\`, `&`, or special symbols into United India (UIIC) text inputs.
- **Why**: UIIC's legacy ASP.NET validation rejects non-alphanumeric characters with unrecoverable session crashes.
- **Enforcement**: Apply `transforms.uiicText` or `draftPortalObservations({ portal: 'uiic' })` which guarantees only `[a-zA-Z0-9. ]` with single spaces.

### 3. Never Auto-Submit
- **Rule**: Never click "Save", "Submit", "Calculate", or "Validate" on an insurer portal.
- **Why**: Rule E1 of the SurveyOS Safety Charter. The surveyor alone inspects and presses submit.

---

## 1. Coded Dropdown Option Normalization

Indian insurer portals prefix dropdown options with proprietary accounting codes, acronyms, or legacy classifications.

### Indian Motor Insurance Synonym & Taxonomy Matrix

| Domain Category | Canonical Value | Typical Portal Dropdown Text & Codes |
|-----------------|-----------------|--------------------------------------|
| **Fuel Type** | `Petrol` | `01 - MOTOR SPIRIT (PETROL)`, `MS`, `PETROL`, `GASOLINE` |
| | `Diesel` | `02 - HIGH SPEED DIESEL (HSD)`, `HSD`, `DIESEL` |
| | `CNG` | `03 - COMPRESSED NATURAL GAS`, `CNG`, `NATURAL GAS` |
| | `Electric` | `04 - BATTERY OPERATED / ELECTRIC`, `EV`, `ELECTRIC` |
| | `LPG` | `05 - LIQUEFIED PETROLEUM GAS`, `LPG` |
| **Policy Type** | `Comprehensive` | `PKG - PACKAGE POLICY`, `COMPREHENSIVE`, `STANDARD MOTOR` |
| | `Third Party` | `LIAB - LIABILITY ONLY`, `TP`, `ACT ONLY`, `STATUTORY` |
| **Vehicle Class** | `Private Car` | `PVT - PRIVATE CAR`, `4 WHEELER`, `LMV - PRIVATE`, `MOTOR CAR` |
| | `Two Wheeler` | `2W - TWO WHEELER`, `MOTORCYCLE`, `SCOOTER`, `MOPED` |
| | `Goods Vehicle` | `GCV - GOODS CARRYING VEHICLE`, `COMMERCIAL GOODS`, `TRUCK` |
| | `Passenger Vehicle`| `PCV - PASSENGER CARRYING VEHICLE`, `TAXI`, `BUS`, `MAXI` |
| **Loss Cause** | `Collision` | `COL - COLLISION / IMPACT`, `ACCIDENTAL DAMAGE`, `IMPACT` |
| | `Overturning` | `TOV - OVERTURNING / TURN TURTLE`, `ROLLOVER` |
| | `Fire` | `FIR - FIRE / SPONTANEOUS COMBUSTION`, `BURNING` |
| | `Theft` | `THE - THEFT / TOTAL LOSS`, `BURGLARY` |
| **Settlement** | `Repair` | `REP - REPAIR BASIS`, `STANDARD REPAIR`, `REIMBURSEMENT` |
| | `Total Loss` | `TL - TOTAL LOSS`, `CONSTRUCTIVE TOTAL LOSS (CTL)` |

### Normalization Algorithm:
1. **Direct Value/Text Match**: Check if `canonicalValue === option.value` or `canonicalValue === option.text` (case-insensitive).
2. **Code Prefix Stripping**: Remove patterns like `^[A-Z0-9_]+[\s\-:]+` (e.g. `"01 - "` or `"PKG - "`) and test exact match.
3. **Substring Containment**: Check if normalized canonical tokens are contained in option text.
4. **Synonym Lookup**: Query the Indian insurance domain dictionary.
5. **Jaccard Token Similarity**: If no exact match, compute token overlap score. Return match if `score >= 0.6`.

---

## 2. Surveyor Observations & Narrative Auto-Drafter

Generates concise, legally compliant surveyor loss observations tailored for each insurer's technical constraints.

### Template Architecture:
```text
ACCIDENT CAUSE: <Sanitized Cause>
INSPECTION: <Parts Summary>
ASSESSMENT: RS <PartsTotal> (PARTS) + RS <LabourTotal> (LABOUR) - LESS EXCESS RS <Deductible>
NET ESTIMATE: RS <NetAssessment>
SURVEYOR OPINION: LOSS REASONABLE AND CONSISTENT WITH ACCIDENT DESCRIPTION.
```

### Insurer Character & Encoding Constraints:
- **United India (UIIC)**:
  - Max Length: `500` characters.
  - Allowed Characters: Strictly `[a-zA-Z0-9. \n]` (strip `,`, `;`, `'`, `"`, `-`, `/`, `&`).
  - Collapse multiple spaces into single space.
- **New India Assurance (NIA)**:
  - Max Length: `1000` characters.
  - Allowed Characters: Alphanumeric and standard sentence punctuation (`.`, `,`, `-`, `(`, `)`). No HTML/XML tags.
- **Oriental Insurance (OIC)**:
  - Max Length: `2000` characters.
- **National Insurance (NIC)**:
  - Max Length: `1000` characters.

---

## 3. Zero-Shot DOM Semantic Matcher

When an input field on a portal page does not match an existing static mapping:
1. **Extract DOM Context**:
   - Explicit `<label>` element (`for` attribute or enclosing label).
   - `placeholder` attribute.
   - `name` attribute.
   - `id` attribute.
   - Nearby `<td>` or `<th>` preceding the input.
2. **Normalize DOM Text**:
   - Lowercase, strip punctuation (`_`, `-`, `.`), replace abbreviations (e.g., `regn` $\rightarrow$ `registration`, `veh` $\rightarrow$ `vehicle`, `dl` $\rightarrow$ `driver license`, `chass` $\rightarrow$ `chassis`).
3. **Canonical Field Weighting**:
   - Match against known packet fields (`regNumber`, `chassisNumber`, `engineNumber`, `policyNumber`, `driverLicenceNo`, `accidentDate`, `netAssessment`, `surveyRemarks`, etc.).
   - Return highest confidence match when score $\ge 0.75$.

---

## 4. Verification & Testing Playbook

When adding or updating semantic AI features:
1. Run Unit Tests:
   ```bash
   npx vitest run extension/__tests__/semantic-ai.test.js
   ```
2. Verify all UIIC punctuation edge cases pass:
   - Ensure input with commas, apostrophes, and ampersands is stripped cleanly.
   - Ensure character capping strictly preserves sentence boundaries without slicing mid-word when possible.
3. Verify Option Normalizer handles:
   - `"Petrol"` $\rightarrow$ `"01 - MOTOR SPIRIT (PETROL)"` (Value: `"01"`).
   - `"Comprehensive"` $\rightarrow$ `"PKG - PACKAGE POLICY"` (Value: `"PKG"`).
   - Unrecognized inputs gracefully return `null` instead of throwing.
4. Run Full Verification:
   ```bash
   npx vitest run
   npx tsc --noEmit
   npm run build
   ```
