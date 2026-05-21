# Insured Report Pass 2.5 AI Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pass 2.5 AI enrichment step that translates surveyor shorthand tags ("Rates as per local market") into plain-English ₹-specific explanations for vehicle owners, replacing the current verbatim echo.

**Architecture:** Split `buildPreClassifiedExplanations()` to separate auto-explained rows (safe/depreciation/salvage) from surveyor-tagged rows that need enrichment. Add `buildTaggedRowEnrichmentPrompt()` to `prompts.ts` and `enrichTaggedRows()` to `insured-report.ts`. Call Pass 2.5 inside `runAssessmentAnalysis()` after Pass 2. Legacy `generateInsuredReport()` call site is updated to handle the new return shape but does NOT run Pass 2.5.

**Tech Stack:** TypeScript, Gemini/Groq via `callAIGateway()`, existing `InsuredReportLineExplanation` type

---

## File Map

| File | Change |
|------|--------|
| `src/lib/ai/prompts.ts` | Add `TaggedRowInput` type + `buildTaggedRowEnrichmentPrompt()` |
| `src/lib/ai/insured-report.ts` | Split `buildPreClassifiedExplanations()`, add `enrichTaggedRows()`, update `runAssessmentAnalysis()`, fix legacy call site |

No new files. No type file changes. No UI changes.

---

## Task 1: Add prompt builder to `prompts.ts`

**Files:**
- Modify: `src/lib/ai/prompts.ts` (append after last export)

- [ ] **Step 1: Add `TaggedRowInput` type and `buildTaggedRowEnrichmentPrompt()` at the end of the file**

Open `src/lib/ai/prompts.ts`. Append after the last export:

```typescript
// ─── Pass 2.5: Tagged Row Enrichment ─────────────────────────────────────────

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
  language: string,
  rows: TaggedRowInput[],
): string {
  const langNote =
    language === 'hindi'
      ? '\nWrite all explanations in Hindi.'
      : language === 'marathi'
        ? '\nWrite all explanations in Marathi.'
        : '';

  return `You write plain-language insurance claim explanations addressed directly to the vehicle owner. For each row below, write 1–2 sentences that:
1. State what happened to the amount (reduced / excluded / adjusted)
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
  - Never echo the surveyorRemark verbatim
  - Always include ₹ figures — never say "adjusted" without stating the amount
  - Do NOT mention the surveyor's note in the explanation${langNote}

Rows (JSON):
${JSON.stringify(rows, null, 2)}

Return a JSON array only — no prose, no markdown fences:
[{"assessmentRowId":"...","aiExplanation":"..."}]`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```

Expected: `✓ Compiled successfully` with no `error TS` lines.

- [ ] **Step 3: Commit**

```
git add src/lib/ai/prompts.ts
git commit -m "feat: add buildTaggedRowEnrichmentPrompt for Pass 2.5 enrichment"
```

---

## Task 2: Split `buildPreClassifiedExplanations()` return type

**Files:**
- Modify: `src/lib/ai/insured-report.ts` lines 55–137

This is the most critical change. The function currently returns a flat `InsuredReportLineExplanation[]`. We change it to return `{ autoClassified, taggedRows }`. Auto-classified = rows already fully explained (safe, depreciation by data, disposal). Tagged rows = rows where surveyor set a non-trivial `deductionCategory` — these get empty `aiExplanation` for Pass 2.5 to fill.

Categories that go to `autoClassified` when set by surveyor: `safe`, `depreciation`, `salvage` — these already have adequate canned explanations.

Categories that go to `taggedRows` when set by surveyor: `negotiated`, `overpricing`, `partial-repair`, `wear-and-tear`, `not-covered`, `previous-damage`, `consumable` — these need enrichment.

- [ ] **Step 1: Replace `buildPreClassifiedExplanations()` with the split version**

Find and replace the entire function (lines 55–137) with:

```typescript
const AUTO_EXPLAINED_CATEGORIES = new Set<DeductionCategory>([
  'safe',
  'depreciation',
  'salvage',
]);

export function buildPreClassifiedExplanations(
  claim: ClaimData,
  zeroDep: boolean,
): {
  autoClassified: InsuredReportLineExplanation[];
  taggedRows: InsuredReportLineExplanation[];
} {
  const autoClassified: InsuredReportLineExplanation[] = [];
  const taggedRows: InsuredReportLineExplanation[] = [];

  for (const row of claim.assessmentRows ?? []) {
    const billed = row.billedTaxable ?? row.estimated;
    const delta = Math.abs(billed - row.assessed);

    // Surveyor-tagged row — split by whether it needs enrichment
    if (row.deductionCategory) {
      const explanation: InsuredReportLineExplanation = {
        assessmentRowId: row.id,
        partDescription: row.particulars,
        surveyorRemarks: row.remarks ?? '',
        aiExplanation: '',
        deductionCategory: row.deductionCategory,
        surveyorAmount: row.assessed,
        billedAmount: billed,
        isFlagged: false,
      };

      if (AUTO_EXPLAINED_CATEGORIES.has(row.deductionCategory)) {
        // Safe / depreciation / salvage — use canned explanations
        if (row.deductionCategory === 'safe') {
          explanation.aiExplanation =
            'This item was inspected and found safe — no replacement or adjustment was required.';
        } else if (row.deductionCategory === 'salvage') {
          explanation.aiExplanation =
            `${row.particulars} was replaced. The salvage / scrap value of the old part ` +
            `(₹${row.assessed.toLocaleString('en-IN')}) has been deducted from the payable amount.`;
        }
        // depreciation: aiExplanation stays blank — financial tab handles it
        autoClassified.push(explanation);
      } else {
        // Needs Pass 2.5 AI enrichment — aiExplanation left blank intentionally
        taggedRows.push(explanation);
      }
      continue;
    }

    // Standard depreciation: allowed parts with a reduction, no manual override, not disposal
    if (
      row.section === 'parts' &&
      row.allowed &&
      row.action !== 'disallow' &&
      !row.depOverride &&
      !row.isDisposal &&
      delta > 0
    ) {
      autoClassified.push({
        assessmentRowId: row.id,
        partDescription: row.particulars,
        surveyorRemarks: row.remarks ?? '',
        aiExplanation: '',
        deductionCategory: 'depreciation' as DeductionCategory,
        surveyorAmount: row.assessed,
        billedAmount: billed,
        isFlagged: false,
      });
      continue;
    }

    // Safe: allowed, no meaningful adjustment
    if (row.allowed && delta < 1) {
      autoClassified.push({
        assessmentRowId: row.id,
        partDescription: row.particulars,
        surveyorRemarks: row.remarks ?? '',
        aiExplanation:
          'This item was inspected and found safe — no replacement or adjustment was required.',
        deductionCategory: 'safe' as DeductionCategory,
        surveyorAmount: row.assessed,
        billedAmount: billed,
        isFlagged: false,
      });
      continue;
    }

    // Disposal / salvage: marked explicitly
    if (row.isDisposal) {
      autoClassified.push({
        assessmentRowId: row.id,
        partDescription: row.particulars,
        surveyorRemarks: row.remarks ?? '',
        aiExplanation:
          `${row.particulars} was replaced. The salvage / scrap value of the old part ` +
          `(₹${row.assessed.toLocaleString('en-IN')}) has been deducted from the payable amount.`,
        deductionCategory: 'salvage' as DeductionCategory,
        surveyorAmount: row.assessed,
        billedAmount: billed,
        isFlagged: false,
      });
      continue;
    }
  }

  return { autoClassified, taggedRows };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```

Expected: TypeScript will error on the two call sites that now receive `{ autoClassified, taggedRows }` instead of a flat array. That is expected — we fix those in Tasks 3 and 4.

- [ ] **Step 3: Commit the function change before fixing call sites**

```
git add src/lib/ai/insured-report.ts
git commit -m "refactor: split buildPreClassifiedExplanations into autoClassified + taggedRows"
```

---

## Task 3: Fix legacy `generateInsuredReport()` call site

**Files:**
- Modify: `src/lib/ai/insured-report.ts` — the `generateInsuredReport()` function (around line 543)

The legacy path does NOT run Pass 2.5 — per spec. We just flatten both lists back into one `preClassified` array and proceed as before.

- [ ] **Step 1: Find and replace the call site in `generateInsuredReport()`**

Find this line (around line 543 in the original file):
```typescript
const preClassified = buildPreClassifiedExplanations(claim, policyContext.zeroDep);
const preClassifiedIds = new Set(preClassified.map(e => e.assessmentRowId));
```

Replace with:
```typescript
const { autoClassified, taggedRows } = buildPreClassifiedExplanations(claim, policyContext.zeroDep);
const preClassified = [...autoClassified, ...taggedRows];
const preClassifiedIds = new Set(preClassified.map(e => e.assessmentRowId));
```

The rest of the `generateInsuredReport()` function is unchanged — `preClassified` variable is still used the same way below.

- [ ] **Step 2: Verify TypeScript compiles**

```
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```

Expected: One call site fixed. The other (in `runAssessmentAnalysis`) still errors. That's fine — we fix it next.

- [ ] **Step 3: Commit**

```
git add src/lib/ai/insured-report.ts
git commit -m "fix: update generateInsuredReport call site for split buildPreClassifiedExplanations"
```

---

## Task 4: Add `enrichTaggedRows()` to `insured-report.ts`

**Files:**
- Modify: `src/lib/ai/insured-report.ts` — add function before `runAssessmentAnalysis()`

Also needs an import of `TaggedRowInput` from `prompts.ts`.

- [ ] **Step 1: Add `TaggedRowInput` to the import from `./prompts`**

Find the existing import line:
```typescript
import {
  buildPolicyAnalysisPrompt,
  buildLineExplanationPrompt,
  buildCoveringNarrativePrompt,
  type PolicyContextSummary,
} from './prompts';
```

Replace with:
```typescript
import {
  buildPolicyAnalysisPrompt,
  buildLineExplanationPrompt,
  buildCoveringNarrativePrompt,
  buildTaggedRowEnrichmentPrompt,
  type PolicyContextSummary,
  type TaggedRowInput,
} from './prompts';
```

- [ ] **Step 2: Add `enrichTaggedRows()` function directly before `runAssessmentAnalysis()`**

Insert this function before the `// ─── Stage 2: Assessment Analysis` comment:

```typescript
// ─── Pass 2.5: Enrich surveyor-tagged rows ────────────────────────────────────
// Takes rows where surveyor set deductionCategory via SmartRemarksCell.
// Translates shorthand remarks ("Rates as per local market") into plain English
// for the vehicle owner. Single batch API call. Falls back to buildHonestFallback.
async function enrichTaggedRows(
  tagged: InsuredReportLineExplanation[],
  language: InsuredReportLanguage,
  onProgress?: (msg: string) => void,
): Promise<InsuredReportLineExplanation[]> {
  if (tagged.length === 0) return tagged;

  const inputs: TaggedRowInput[] = tagged.map(row => ({
    assessmentRowId: row.assessmentRowId,
    partDescription: row.partDescription,
    deductionCategory: row.deductionCategory,
    surveyorRemark: row.surveyorRemarks,
    billedAmount: row.billedAmount,
    surveyorAmount: row.surveyorAmount,
    deductionAmount: Math.max(0, row.billedAmount - row.surveyorAmount),
  }));

  try {
    const prompt = buildTaggedRowEnrichmentPrompt(language, inputs);
    const raw = await callAIGateway(prompt, []);
    let parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) && Array.isArray(parsed?.items)) parsed = parsed.items;
    if (!Array.isArray(parsed)) throw new Error(`Unexpected format: ${typeof parsed}`);

    const enrichmentMap = new Map<string, string>(
      (parsed as Array<{ assessmentRowId: string; aiExplanation: string }>).map(item => [
        item.assessmentRowId,
        item.aiExplanation ?? '',
      ]),
    );

    return tagged.map(row => ({
      ...row,
      aiExplanation: enrichmentMap.get(row.assessmentRowId) || buildHonestFallback(row),
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    onProgress?.(`⚠ Pass 2.5 enrichment failed: ${msg} — using fallback explanations.`);
    return tagged.map(row => ({ ...row, aiExplanation: buildHonestFallback(row) }));
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```

Expected: No new errors (function is defined but not yet called — that's fine).

- [ ] **Step 4: Commit**

```
git add src/lib/ai/insured-report.ts
git commit -m "feat: add enrichTaggedRows Pass 2.5 function"
```

---

## Task 5: Wire Pass 2.5 into `runAssessmentAnalysis()`

**Files:**
- Modify: `src/lib/ai/insured-report.ts` — `runAssessmentAnalysis()` function

- [ ] **Step 1: Update the call site and wire Pass 2.5**

Find this block inside `runAssessmentAnalysis()` (around line 210):
```typescript
const { policyContext } = policyAnalysis;
const preClassified = buildPreClassifiedExplanations(claim, policyContext.zeroDep);
const preClassifiedIds = new Set(preClassified.map(e => e.assessmentRowId));
```

Replace with:
```typescript
const { policyContext } = policyAnalysis;
const { autoClassified, taggedRows } = buildPreClassifiedExplanations(claim, policyContext.zeroDep);
const preClassifiedIds = new Set([
  ...autoClassified.map(e => e.assessmentRowId),
  ...taggedRows.map(e => e.assessmentRowId),
]);
```

Then find where `lineExplanations` is initialised from `preClassified`:
```typescript
let lineExplanations: InsuredReportLineExplanation[] = [...preClassified];
```

Replace with:
```typescript
let lineExplanations: InsuredReportLineExplanation[] = [...autoClassified];
```

Then find the final combine after Pass 2 (where `lineExplanations = [...lineExplanations, ...aiExplanations]` or similar). After that line, add the Pass 2.5 call:

```typescript
    lineExplanations = [...lineExplanations, ...aiExplanations];

    // Pass 2.5 — enrich surveyor-tagged rows
    onProgress?.('Translating surveyor notes…');
    const enrichedTagged = await enrichTaggedRows(taggedRows, language, onProgress);
    lineExplanations = [...lineExplanations, ...enrichedTagged];
```

Note: the `enrichedTagged` line must be INSIDE the `if (rowInput.length > 0)` block's try/catch only if `relevantRows` is non-empty — but actually `enrichTaggedRows` is independent of Pass 2, so place it AFTER the `if (rowInput.length > 0)` block entirely:

```typescript
  // Pass 2 — only if there are untagged anomalous rows
  if (rowInput.length > 0) {
    try {
      // ... existing Pass 2 code unchanged ...
      lineExplanations = [...lineExplanations, ...aiExplanations];
    } catch (err: unknown) {
      // ... existing fallback unchanged ...
    }
  }

  // Pass 2.5 — enrich surveyor-tagged rows (runs regardless of Pass 2)
  onProgress?.('Translating surveyor notes…');
  const enrichedTagged = await enrichTaggedRows(taggedRows, language, onProgress);
  lineExplanations = [...lineExplanations, ...enrichedTagged];

  return {
    completedAt: new Date().toISOString(),
    lineExplanations,
    hasFlaggedRows: lineExplanations.some(e => e.isFlagged),
  };
```

- [ ] **Step 2: Verify clean build**

```
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` with zero `error TS` lines.

- [ ] **Step 3: Commit**

```
git add src/lib/ai/insured-report.ts
git commit -m "feat: wire Pass 2.5 enrichTaggedRows into runAssessmentAnalysis"
```

---

## Task 6: Deploy and Verify

- [ ] **Step 1: Build for production**

```
npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 2: Deploy to Firebase**

```
firebase deploy --only hosting 2>&1 | tail -8
```

Expected: `✓ Deploy complete!` and the live URL.

- [ ] **Step 3: Manual verification checklist**

Open a claim in https://motorsurveyos.web.app and do the following:

1. Go to Assessment tab → set `deductionCategory` tags on 3–4 rows using SmartRemarksCell:
   - One row: `negotiated` + remark "Rates as per local market"
   - One row: `wear-and-tear` + remark "Pre-existing wear"
   - One row: `not-covered` + remark "Not related to accident"
2. Navigate to Insured Report → Generate
3. Watch the progress indicator — you should see "Translating surveyor notes…" appear
4. In Gap Review, open each tagged row and verify:
   - The explanation is in full sentences, not the preset text
   - It includes ₹ figures
   - It does NOT contain the phrase "Rates as per local market" verbatim
5. Edit one explanation manually → Approve
6. Generate PDF → verify the edited explanation appears, not the original

- [ ] **Step 4: Push to GitHub**

```
git push origin master
```

- [ ] **Step 5: Update Obsidian Tasks.md**

Add Pass 2.5 enrichment to the completed section with commit hash.

---

## Self-Review Notes

- `AUTO_EXPLAINED_CATEGORIES` constant is defined at module level before `buildPreClassifiedExplanations()` — no forward reference issue
- Both call sites of `buildPreClassifiedExplanations()` are covered: `runAssessmentAnalysis()` (Task 5) and `generateInsuredReport()` (Task 3)
- `enrichTaggedRows()` returns `tagged` immediately if empty — no unnecessary API call
- Pass 2.5 runs AFTER Pass 2's try/catch, not inside it — so a Pass 2 failure does not skip Pass 2.5
- `TaggedRowInput` is exported from `prompts.ts` and imported in `insured-report.ts` — consistent naming throughout
- `buildHonestFallback()` is used in fallback path of `enrichTaggedRows()` — it is already defined earlier in the same file
