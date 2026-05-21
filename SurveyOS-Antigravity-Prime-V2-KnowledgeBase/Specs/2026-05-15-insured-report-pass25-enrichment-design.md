# Spec: Insured Report — Pass 2.5 AI Enrichment of Surveyor-Tagged Rows

**Date:** 2026-05-15
**Status:** Approved for implementation
**Scope:** `src/lib/ai/insured-report.ts`, `src/lib/ai/prompts.ts`

---

## Problem

When a surveyor tags a row in SmartRemarksCell (sets `deductionCategory` + picks a preset remark like "Rates as per local market"), the insured report pipeline currently short-circuits: it copies the surveyor's shorthand verbatim as the `aiExplanation` field, or produces a canned fallback string like `"Surveyor classified this item as: negotiated."` Neither is readable for a vehicle owner.

The insured PDF then shows this shorthand directly — the insured reads "Rates as per local market" and has no idea what that means in rupees.

---

## Goal

For every surveyor-tagged row, produce a 1–2 sentence plain-English explanation that:
1. States what happened to the amount (increased / reduced / excluded)
2. Gives the real reason in language a non-expert understands
3. Includes the actual ₹ figures

The surveyor reads and edits these in Gap Review before approving — so accuracy is verified before the PDF is generated.

---

## What Is NOT in Scope

- Option B (RAG / learning from past explanations) — deferred, not a revenue driver yet
- Option C (policy clause citations per row) — separate spec
- Any UI changes — Gap Review already supports editing all line explanations
- Changes to `generateInsuredReport()` legacy function behaviour — however, its call to `buildPreClassifiedExplanations()` must be updated to destructure the new return shape: `const { autoClassified, taggedRows } = buildPreClassifiedExplanations(...)` and combine them. Pass 2.5 enrichment is NOT run in the legacy path.

---

## Architecture

### Current Flow (inside `runAssessmentAnalysis`)

```
buildPreClassifiedExplanations()
  → handles: safe, depreciation, disposal, AND surveyor-tagged rows
  → surveyor-tagged: aiExplanation = row.remarks || canned string   ← PROBLEM

Pass 2 AI call
  → untagged anomalous rows only

Combine → lineExplanations
```

### New Flow

```
buildPreClassifiedExplanations()  [MODIFIED]
  → handles: safe, depreciation, disposal only
  → surveyor-tagged rows: returned as separate list (taggedRows)

Pass 2 AI call  [UNCHANGED]
  → untagged anomalous rows only

Pass 2.5 AI call  [NEW]
  → taggedRows → single batch call → aiExplanation per row

Combine all three → lineExplanations
```

---

## Files to Modify

### 1. `src/lib/ai/prompts.ts` — Add `buildTaggedRowEnrichmentPrompt()`

New exported function:

```typescript
export interface TaggedRowInput {
  assessmentRowId: string;
  partDescription: string;
  deductionCategory: string;
  surveyorRemark: string;
  billedAmount: number;
  surveyorAmount: number;
  deductionAmount: number;
}

export function buildTaggedRowEnrichmentPrompt(
  language: InsuredReportLanguage,
  rows: TaggedRowInput[],
): string
```

**System prompt content:**

```
You write plain-language insurance claim explanations addressed directly
to the vehicle owner. For each row, write 1–2 sentences that:
  1. State what happened to the amount
  2. Give the real reason in language a non-expert understands
  3. Include the actual ₹ figures

Category guide:
  negotiated      → Workshop rate was above local market price. Surveyor adjusted to fair rate.
  overpricing     → OEM price quoted but OES/equivalent-quality part is standard for this claim.
  partial-repair  → Full replacement unnecessary — repair restores pre-accident condition.
  wear-and-tear   → Damage existed before accident due to normal usage and ageing.
  not-covered     → Excluded under policy terms.
  previous-damage → Damage was present before this accident.
  consumable      → Consumables (oil, coolant, nuts, bolts) not covered under standard motor insurance.
  salvage         → Second-hand part used — valued at used-part price, GST not applicable.

Rules:
  - Never say "as per policy" without explaining what that means
  - Never echo the surveyor remark verbatim
  - Always include ₹ figures — never say "adjusted" without saying by how much
  - Do NOT mention the surveyor's note

Return JSON array: [{"assessmentRowId":"...","aiExplanation":"..."}]
```

Language handling: if `language !== 'english'`, append instruction to write in the target language.

---

### 2. `src/lib/ai/insured-report.ts` — Three changes

#### Change A: Split `buildPreClassifiedExplanations()`

Modify return type to separate auto-rows from surveyor-tagged rows:

```typescript
export function buildPreClassifiedExplanations(
  claim: ClaimData,
  zeroDep: boolean,
): {
  autoClassified: InsuredReportLineExplanation[];  // safe, depreciation, disposal
  taggedRows: InsuredReportLineExplanation[];       // have deductionCategory, need enrichment
}
```

`taggedRows` are rows where `row.deductionCategory` is set AND the category is not one of `safe | depreciation | salvage` (those are already explained well by existing canned strings). Specifically: `negotiated | overpricing | partial-repair | wear-and-tear | not-covered | previous-damage | consumable`.

`taggedRows` get a placeholder `aiExplanation` (empty string) — Pass 2.5 will fill it.

#### Change B: Add `enrichTaggedRows()` function

```typescript
async function enrichTaggedRows(
  tagged: InsuredReportLineExplanation[],
  language: InsuredReportLanguage,
  onProgress?: (msg: string) => void,
): Promise<InsuredReportLineExplanation[]>
```

- If `tagged.length === 0`: return immediately (no API call)
- Builds `TaggedRowInput[]` from tagged rows
- Calls `buildTaggedRowEnrichmentPrompt()` + `callAIGateway()`
- Merges returned `aiExplanation` strings back into the rows by `assessmentRowId`
- On failure: falls back to `buildHonestFallback()` per row (never leaves explanation blank)

#### Change C: Call Pass 2.5 inside `runAssessmentAnalysis()`

```typescript
const { autoClassified, taggedRows } = buildPreClassifiedExplanations(claim, zeroDep);

// Pass 2 — unchanged, untagged anomalous rows
const aiExplanations = await runPass2(...);

// Pass 2.5 — enrich surveyor-tagged rows
onProgress?.('Translating surveyor notes…');
const enrichedTagged = await enrichTaggedRows(taggedRows, language, onProgress);

lineExplanations = [...autoClassified, ...aiExplanations, ...enrichedTagged];
```

---

## Gap Review Behaviour

Pass 2.5 rows are returned with `isFlagged: false` — the category is certain (surveyor decided it). They appear in Gap Review alongside Pass 2 rows. The surveyor reads every explanation, edits any that misrepresent their decision, and approves. No UI changes required.

---

## Fallback Behaviour

| Scenario | Behaviour |
|---|---|
| Pass 2.5 API call fails | `buildHonestFallback()` per row — shows ₹ figures, asks insured to contact surveyor |
| AI returns empty explanation for a row | `buildHonestFallback()` for that row |
| AI returns malformed JSON | Entire batch falls back to `buildHonestFallback()` per row |
| `tagged.length === 0` | No API call made — zero cost |

---

## Example Output

| Category | Surveyor wrote | AI writes |
|---|---|---|
| `negotiated` | "Rates as per local market" | "The workshop charged ₹2,400 for this bumper. After verifying current prices with local suppliers, the surveyor found ₹1,800 to be the fair market rate — ₹600 has been adjusted." |
| `wear-and-tear` | "Pre-existing wear" | "This part showed damage consistent with normal usage over time, not caused by the accident. ₹1,200 for this item has been excluded from the claim." |
| `partial-repair` | "Paint area adjusted" | "The surveyor found that this panel requires re-painting in the affected area only, not a full repaint. The workshop's charge of ₹3,600 has been adjusted to ₹2,400 accordingly." |
| `not-covered` | "Not related to accident" | "This damage was not caused by the accident reported. The workshop's charge of ₹800 has been excluded from the claim." |

---

## Cost Impact

- 1 additional API call per report, only when tagged rows exist
- Typical tagged row count: 5–15 rows per claim
- Estimated tokens: ~400 input + ~300 output = ~700 tokens
- At Gemini Flash pricing: < ₹0.10 per report

---

## Verification Checklist

1. Open a claim → set `deductionCategory` tags on several rows via SmartRemarksCell
2. Generate Insured Report
3. In Gap Review, every tagged row shows a proper plain-English explanation (not the preset text, not a canned string)
4. Edit one explanation → verify the edited version appears in the PDF
5. Rows with `deductionCategory` = `safe | depreciation | salvage` are unaffected
6. Untagged rows still go through Pass 2 unchanged
7. If Pass 2.5 fails, report still generates with honest fallback text
