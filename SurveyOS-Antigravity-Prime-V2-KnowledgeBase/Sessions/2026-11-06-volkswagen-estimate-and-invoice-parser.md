# Session Log: Volkswagen Group DMS Estimate & Invoice Parser Support

> Date: 2026-11-06  
> Agent: Antigravity  
> Focus: Volkswagen Estimate (SOA2600192) & Invoice (PIA2600176) Zero-Token Parser Support

---

## 1. Context & User Request
The user provided a 2-page digital repair estimate from Volkswagen Dhule (`SOA2600192` for Ameo 1.5 TDI `MH19CV6974`) and a 3-page Tax Invoice (`PIA2600176`).
The user requested:
1. Understanding how current AI extracts these documents.
2. Checking if they can be parsed successfully.
3. Adding deterministic zero-token parsing in `row-parser.ts` while explicitly ensuring extraction accuracy and field fidelity are not compromised.

---

## 2. Technical Implementation

1. **Header Recognition (`findHeader` in `src/lib/ai/row-parser.ts`):**
   - Extended header detection line filter to accept `Type` + `Description` + `Qty` + `Amount` tables when serial number headers (`Srl` / `S.No`) are absent.
   - Added column synonyms: `'type': 'type'`, `'unit price': 'unit_price'`, `'hsn\\sac': 'hsn_sac'`, `'hsn sac': 'hsn_sac'`, `'gst base amount': 'taxable_amount'`, `'base amount': 'taxable_amount'`, `'amount incl. tax': 'total_amount'`, `'amount incl tax': 'total_amount'`, `'total gst': 'tax'`, `'final amount': 'total_amount'`.

2. **Anchor-by-Type (`anchorsOf` in `src/lib/ai/row-parser.ts`):**
   - When table has a `type` column and no explicit serial column, anchors each row on `Item` / `Labor` tokens.
   - Generates 1-based sequential synthetic serials (`1..N`) for downstream SurveyOS components.

3. **Pre-Tax Settlement (`toItem` & `footerTax`):**
   - Generalized `asTaxable` to handle documents printing pre-tax `Amount` without a row-level `Tax%` column.
   - Tested through `footerTax` against printed `Summary Details` and `Grand Total`, resolving 18% GST rate and computing exact line totals.

4. **Category Routing (`parseWith`):**
   - `Type === 'Item'` $\rightarrow$ `spare_parts`.
   - `Type === 'Labor'` + `/paint|colour/i` $\rightarrow$ `painting_items`.
   - `Type === 'Labor'` other $\rightarrow$ `labour_items`.

5. **Unit Tests (`src/lib/ai/__tests__/row-parser.test.ts`):**
   - Added test fixture verifying Type-anchored unnumbered parsing.
   - Added complete 33-row 2-page test fixture for Volkswagen Dhule estimate `SOA2600192` verifying exact parts taxable (₹68,745.79), labour taxable (₹10,335.30), painting taxable (₹21,191.03), and grand total (₹118,321.06) in <40ms.

---

## 3. Verification
- **Full Vitest Suite:** 281 test files passed, 2,515 tests passed (100% green).
- **TypeScript:** `npx tsc --noEmit` clean (0 errors).
- **Prime ↔ SurveyOS Scan Impact:** None.
