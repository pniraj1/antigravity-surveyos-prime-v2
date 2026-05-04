# Insured-Facing Claim Explanation Report — Design Spec

**Date:** 2026-04-29  
**Status:** Approved for implementation planning  
**Feature tier:** Premium (admin-gated)

---

## Context

Insurance claimants (insured) are laymen. When their vehicle is repaired and the garage bill arrives, the insured often pays a "difference amount" — the gap between what the garage bills and what the insurer pays. This gap is caused by a combination of:

- **Depreciation** — applied per IRDAI rules based on part type and vehicle age
- **Compulsory/voluntary excess** — policy clauses the insured agreed to
- **Consumables** — items like engine oil, coolant, AC gas, not covered in most policies
- **Negotiated labour/painting** — surveyor negotiates the garage rate down; if the garage bills the original estimate, the insured pays the difference
- **Previous damage / safe components** — not covered under the current claim
- **Salvage/disposal** — value of old replaced parts that go to the insurer

Currently, the surveyor submits a technical report to the insurer. The insured has no formal document explaining their liability. This feature introduces an **Insured Report** — a plain-language, consumer-facing PDF that explains every deduction clearly.

---

## Goals

1. Give the insured a clear breakdown of why they owe the difference amount
2. Map each deduction to the actual policy clause (or IRDAI standard rule as fallback)
3. Explain each surveyor decision (negotiation, disallowance, previous damage) in plain language
4. Reduce confusion, disputes, and insurer complaints from uninformed insureds
5. Keep surveyor workflow friction minimal — AI does the translation from technical remarks

---

## Feature Flag & Admin Control

This is a **premium feature**, fully controlled by the admin panel.

Admin can configure per-account (`InsuredReportSettings`):

```typescript
interface InsuredReportSettings {
  enabled: boolean;                                    // master toggle
  allowedLanguages: ('english' | 'hindi' | 'marathi')[];
  defaultLanguage: 'english' | 'hindi' | 'marathi';
  enabledStages: ('preliminary' | 'final')[];          // which versions are available
}
```

When `enabled: false`, the entire "Insured Reports" section is hidden from the Report tab — no UI indication, no prompts.

---

## Data Model

### New File: `src/types/insured-report.ts`

```typescript
export type InsuredReportStage = 'preliminary' | 'final';
export type InsuredReportLanguage = 'english' | 'hindi' | 'marathi';

export type DeductionCategory =
  | 'depreciation'
  | 'consumable'
  | 'negotiated'          // surveyor negotiated amount down with garage
  | 'not-covered'         // excluded by policy or IRDAI
  | 'previous-damage'
  | 'safe'                // part was safe, not replaced
  | 'salvage';            // disposal — old part goes to insurer

export type PolicyClauseType =
  | 'excess'
  | 'depreciation'
  | 'consumables-exclusion'
  | 'specific-exclusion'
  | 'ncb'
  | 'salvage';

export interface InsuredReportPolicyClause {
  clauseType: PolicyClauseType;
  clauseTitle: string;          // e.g. "Compulsory Excess"
  policyText: string;           // verbatim from policy PDF, or IRDAI standard text
  plainLanguage: string;        // AI-generated, surveyor-editable
  source: 'policy-pdf' | 'irdai-standard';
}

export interface InsuredReportLineExplanation {
  assessmentRowId: string;
  partDescription: string;
  surveyorRemarks: string;      // original remarks, read-only (source: Final Survey)
  aiExplanation: string;        // AI-generated, surveyor-editable
  deductionCategory: DeductionCategory;
  surveyorAmount: number;
  billedAmount: number;
  isFlagged: boolean;           // true if AI lacked context — shown as yellow warning
}

export interface InsuredReportFinancialSummary {
  garageEstimate: number;
  negotiatedSavings: number;    // garage billed - surveyor assessed for labour/paint
  depreciationTotal: number;
  excessTotal: number;          // compulsory + voluntary
  consumablesTotal: number;
  notCoveredTotal: number;      // previous damage, safe items, specific exclusions
  salvageTotal: number;
  insurerPays: number;          // final net assessed loss
  insuredPays: number;          // garageEstimate - insurerPays
}

export interface InsuredReportDraft {
  generatedAt: string;          // ISO timestamp
  stage: InsuredReportStage;
  language: InsuredReportLanguage;
  isSurveyorApproved: boolean;
  financialSummary: InsuredReportFinancialSummary;
  policyMappings: InsuredReportPolicyClause[];
  lineExplanations: InsuredReportLineExplanation[];
}
```

### Changes to `src/types/claim.ts`

Add two optional fields to `ClaimData`:

```typescript
insuredReportPreliminary?: InsuredReportDraft;
insuredReportFinal?: InsuredReportDraft;
```

---

## AI Pipeline

### Location: `src/lib/ai/insured-report.ts` (new file)

### Two-pass approach using existing `src/lib/ai/service.ts`

**Pass 1 — Policy Analysis**

- **If** the policy PDF is uploaded in document verification:
  - Send policy PDF bytes + claim metadata to AI
  - Extract: excess clauses, depreciation table, consumables exclusion list, specific exclusions
  - AI returns: `InsuredReportPolicyClause[]` with `source: 'policy-pdf'`
- **Else** (no policy uploaded):
  - Use IRDAI standard rules (extending `src/lib/calculations/depreciation.ts`)
  - Return: `InsuredReportPolicyClause[]` with `source: 'irdai-standard'`
  - Add notice in report: "Policy document not available — IRDAI standard rules applied"

**Pass 2 — Line Item Explanation**

- Input: All `assessmentRows` + `billRemarks` + `remarks` (from Final Survey, carried forward naturally via `ClaimData`)
- For each row that has a deduction, negotiation, or disallowance:
  - If `remarks` is present → AI translates to plain language in selected language
  - If no `remarks` → AI flags item as `isFlagged: true` with a generic note
  - For negotiated rows (`billedAmount > surveyorAmount`): explicitly state the negotiation gap
  - For salvage/disposal rows: explain that the old part goes to insurer, reducing settlement

**Prompts:** Two new prompt templates added to `src/lib/ai/prompts.ts`

**Language:** Prompts include language instruction ("Respond in simple Hindi" / "Respond in simple Marathi"). Financial numbers remain as ₹ figures regardless of language.

---

## UI Flow

### Report Tab — `src/components/tabs/ReportTab.tsx`

When `insuredReportSettings.enabled === true`, show a new **"Insured Reports (Premium)"** subsection:

- "Generate Insured Report (Preliminary)" — visible only if `'preliminary'` is in `enabledStages`; enabled after final survey data exists
- "Generate Insured Report (Final)" — visible only if `'final'` is in `enabledStages`; enabled after `billCheck.billTotal > 0`

If a previously approved draft exists, show a **"Download PDF"** button instead. A **"Regenerate"** button appears (with stale-data warning) if claim data was modified after the draft was approved.

### Insured Report Review Dialog — `src/components/dialogs/InsuredReportReviewDialog.tsx` (new)

**Opened when surveyor clicks "Generate":**

1. Loading state with progress messages:
   - "Analyzing policy document..." (Pass 1)
   - "Processing line items..." (Pass 2)

2. **Three-tab review panel:**

| Tab | Content |
|-----|---------|
| **Financial Summary** | Read-only table: Garage estimate → each deduction → Insurer pays → **Insured pays** |
| **Policy Clauses** | List of clauses. AI-generated plain-language text is editable. Source badge (policy-pdf / irdai-standard) shown. |
| **Line Items** | Each flagged assessment row. AI explanation is editable. `isFlagged` rows shown with yellow highlight and tooltip: "AI had insufficient context — you may want to add a reason before sharing." Non-blocking — surveyor can approve without filling these in. |

3. **Language selector** (top of dialog) — dropdown from `allowedLanguages`. Changing language re-runs AI for text fields only (financial summary stays the same).

4. **"Approve & Generate PDF"** button — saves `InsuredReportDraft` to `ClaimData`, triggers PDF render, downloads.

---

## PDF Report Structure

### New file: `src/components/pdf/InsuredSummaryDocument.tsx`

**PDF-only** — no HTML or Word format (deliberate exception to the 3-format parity rule for professional reports; this is a consumer document).

### Sections:

**Cover Page**
- Surveyor firm name / SurveyOS branding
- Title: "Claim Summary for [Insured Name]" (localized)
- Claim No., Vehicle (Make/Model/Reg No.), Date
- Surveyor name, IRDAI licence number, contact
- Watermark: "PRELIMINARY ESTIMATE" or "FINAL SETTLEMENT"

**Section A — Your Claim at a Glance**
Single financial table:

| Line | Amount |
|------|--------|
| Garage repair estimate | ₹X |
| Amount negotiated with garage | −₹X |
| Depreciation on parts (as per policy) | −₹X |
| Compulsory excess | −₹X |
| Voluntary excess | −₹X |
| Consumables / non-covered items | −₹X |
| Salvage / disposal value | −₹X |
| **Insurance company will pay** | **₹X** |
| **Your share (payable to garage)** | **₹X** |

**Section B — What Your Policy Covers**
- 3–5 bullet points from `policyMappings`
- Each: clause title + 2-sentence plain-language explanation
- "Policy document not uploaded — IRDAI standard rules applied" notice if relevant

**Section C — Why Certain Items Were Adjusted**
- Table: Item | Garage Billed | Assessed | Reason
- `isFlagged` rows show: "Reviewed under applicable policy terms"

**Section D — About Salvage / Disposal**
- Short paragraph: "When a damaged part is replaced, the old part belongs to the insurance company. Its estimated value (₹X) has been deducted from your claim settlement."

**Footer**
- Surveyor name, Reg. No., date
- Contact: mobile / email
- "This report is prepared for informational purposes. For disputes, contact [insurer contact]."

---

## Integration Points

| Area | File | Change |
|------|------|--------|
| Report type enum | `src/types/report.ts` | Add `'insured-preliminary'` and `'insured-final'` |
| New types | `src/types/insured-report.ts` | New file (types above) |
| Claim data | `src/types/claim.ts` | Add `insuredReportPreliminary?` and `insuredReportFinal?` |
| AI prompts | `src/lib/ai/prompts.ts` | Two new prompt templates |
| AI pipeline | `src/lib/ai/insured-report.ts` | New file — two-pass orchestration |
| IRDAI fallback | `src/lib/calculations/depreciation.ts` | Export standard clause descriptions |
| Report tab | `src/components/tabs/ReportTab.tsx` | Add Insured Reports section (feature-gated) |
| Review dialog | `src/components/dialogs/InsuredReportReviewDialog.tsx` | New file |
| PDF document | `src/components/pdf/InsuredSummaryDocument.tsx` | New file |
| Admin settings | Admin panel (file TBD — discover during impl) | `InsuredReportSettings` toggle per account |
| User/account type | Account/user type file (TBD — discover during impl) | Add `insuredReportSettings?: InsuredReportSettings` |

---

## Remarks Carry-Forward

`assessmentRow.remarks` and `assessmentRow.billRemarks` are stored directly on `ClaimData.assessmentRows`. Since both the Final Survey and Bill Check stages read from the same `assessmentRows`, Final Survey remarks are naturally available at Bill Check stage. No data migration or additional carry-forward logic needed.

---

## Multilingual Support

- AI generates all plain-language text in the selected language (English / Hindi / Marathi)
- Static labels (column headers, section titles, footer text) use a simple lookup table per language
- Language is selected per-generation in the Review Dialog (constrained by `allowedLanguages` in admin settings)
- Changing language re-runs AI text generation only; financial figures are unchanged

---

## Out of Scope (for this version)

- WhatsApp / email delivery (delivery is manual — surveyor downloads and shares)
- In-app insured portal (no insured login)
- Word / HTML format (PDF only)
- Automatic background generation (surveyor-triggered only)
- Bulk generation across multiple claims

---

## Verification

1. Create a test claim with a final survey, bill check data, and per-row remarks
2. Upload a policy PDF (any insurer)
3. Enable the feature in admin settings for the test account
4. Click "Generate Insured Report (Preliminary)" → verify loading states, review dialog opens
5. Verify: financial summary matches calculated values from depreciation engine
6. Verify: flagged items (rows without remarks) are highlighted yellow
7. Edit one AI explanation, approve
8. Download PDF — verify all 4 sections render correctly
9. Modify claim data → verify "Regenerate" warning appears on re-open
10. Run with no policy PDF uploaded → verify IRDAI fallback notice appears in Section B
11. Switch language to Hindi → verify AI re-generates in Hindi, labels switch
12. Disable feature in admin → verify Report tab shows no Insured Reports section
