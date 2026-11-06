# Feature: Volkswagen Group DMS Estimate & Invoice Parser

> Added: 2026-11-06 by Antigravity  
> Source Spec: Volkswagen Estimate `SOA2600192` & Tax Invoice `PIA2600176` (Volkswagen Dhule / Aakash Wheels Pvt. Ltd)

---

## 1. Context & Architecture

SurveyOS utilizes a two-tier extraction pipeline:
1. **Tier 1 (`src/lib/ai/row-parser.ts`):** Zero-token, deterministic code parser for digital PDFs. Anchors on column headers and enforces a strict mathematical tie-out against printed totals before accepting rows.
2. **Tier 2 (`src/lib/ai/processor.ts` + `prompts.ts`):** Multimodal AI Vision & text layer extraction (Gemini 2.5 Flash / Flash-Lite / NVIDIA) as a reliable, context-aware engine and universal fallback.

Volkswagen Group (VW, Skoda, Audi) dealer management software prints estimates without a serial number column (`Srl` / `S.No`), using:
`Type | Description | HSN\SAC | Category | Qty | Unit Price | Amount`

---

## 2. Technical Specification

### A. Header & Column Detection
* Recognizes the unnumbered Volkswagen schema: `Type`, `Description`, `Qty`, `Amount` (with optional `HSN\SAC`, `Category`, `Unit Price`).
* Registers column fields:
  - `Type` $\rightarrow$ `'type'`
  - `Description` $\rightarrow$ `'description'`
  - `HSN\SAC` $\rightarrow$ `'hsn_sac'`
  - `Qty` $\rightarrow$ `'quantity'`
  - `Unit Price` $\rightarrow$ `'unit_price'`
  - `Amount` $\rightarrow$ `'taxable_amount'`

### B. Row Anchoring & Synthetic Serials
* Anchors each row on the `Type` column values (`Item` or `Labor`).
* Assigns 1-based sequential `sr_no` per category:
  - `spare_parts`: `1..N` (all `Type === 'Item'`)
  - `labour_items`: `1..N` (`Type === 'Labor'` without painting keyword)
  - `painting_items`: `1..N` (`Type === 'Labor'` matching `/paint|colour/i`)

### C. Multi-Point Mathematical Tie-Out
Row acceptance requires passing 3 distinct checks against printed `Summary Details`:
1. $\sum(\text{spare\_parts.taxable}) \equiv \text{Parts Amount}$ ($\pm ₹0.05$).
2. $\sum(\text{labour.taxable}) + \sum(\text{painting.taxable}) \equiv \text{Labor Amount}$ ($\pm ₹0.05$).
3. $\text{Parts Total} + \text{Labour Total} \equiv \text{Grand Total}$ ($\pm ₹0.05$).

If any condition fails, `safeParse()` returns `{ ok: false, reason: ... }`, instantly delegating the document to Tier 2 AI Vision.
