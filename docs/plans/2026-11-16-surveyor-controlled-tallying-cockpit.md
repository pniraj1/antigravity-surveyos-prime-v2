# Surveyor-Controlled Progressive Tallying Cockpit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a surveyor-driven 4-stage progressive tallying cockpit in the Bill Check tab where the surveyor inspects and confirms matches at each stage (Part Numbers $\rightarrow$ Name & Cost $\rightarrow$ Surveyor-Triggered AI $\rightarrow$ Disallowed & Tally), with zero-friction error recovery and full visibility.

**Architecture:** A sequenced matching engine decomposed into pure functional modules (`src/lib/tally/`), managed via Zustand (`tallySlice`), and rendered through an interactive stage-stepper UI (`BillCheckStepper` and `StageReviewTable`) embedded in the Bill Check tab. Matching logic is strictly separated from financial capping.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand, Vitest, Lucide React.

---

### Task 1: Stage 1 Pure Logic — Part Number Matcher

**Files:**
- Create: `src/lib/tally/stage1-part-number.ts`
- Test: `src/lib/tally/__tests__/stage1-part-number.test.ts`

**Interfaces:**
```typescript
export interface PartNumberMatch {
  rowId: string;
  lineId: string;
  partNumber: string;
  matchType: 'exact' | 'normalized';
  billItem: BillItem;
  priceDelta: number;
}

export interface Stage1Result {
  matches: PartNumberMatch[];
  unmatchedRows: AssessmentRow[];
  unmatchedLines: BillItem[];
}

export function matchStage1PartNumbers(
  rows: AssessmentRow[],
  billLines: BillItem[]
): Stage1Result;
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tally/__tests__/stage1-part-number.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { matchStage1PartNumbers } from '../stage1-part-number';
import type { AssessmentRow, BillItem } from '@/types';

const makeRow = (id: string, pn: string, particulars: string, assessed = 1000): AssessmentRow => ({
  id, particulars, partNumber: pn, estimated: assessed, assessed,
  partType: 'plastic', gst: 18, section: 'parts', allowed: true,
});

const makeLine = (idx: number, srNo: number, pn: string, desc: string, taxable = 1000): BillItem => ({
  idx, srNo, description: desc, partNumber: pn, taxableAmount: taxable,
  totalAmount: Math.round(taxable * 1.18), gstPercent: 18, section: 'parts', raw: {},
});

describe('matchStage1PartNumbers', () => {
  it('pairs exact part numbers and computes price difference', () => {
    const rows = [makeRow('r1', '52119-0K930', 'FRONT BUMPER', 4200)];
    const lines = [makeLine(0, 11, '52119-0K930', 'BUMPER FRONT', 4193)];

    const result = matchStage1PartNumbers(rows, lines);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].rowId).toBe('r1');
    expect(result.matches[0].lineId).toBe('0');
    expect(result.matches[0].matchType).toBe('exact');
    expect(result.matches[0].priceDelta).toBe(-7);
    expect(result.unmatchedRows).toHaveLength(0);
    expect(result.unmatchedLines).toHaveLength(0);
  });

  it('pairs normalized part numbers ignoring hyphens and spaces', () => {
    const rows = [makeRow('r1', '81110-0K450', 'HEADLAMP RH')];
    const lines = [makeLine(0, 15, '81110 0K450', 'HEAD LIGHT RH')];

    const result = matchStage1PartNumbers(rows, lines);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchType).toBe('normalized');
  });

  it('keeps rows and lines without part numbers in unmatched pools', () => {
    const rows = [makeRow('r1', '', 'FRONT BUMPER')];
    const lines = [makeLine(0, 11, '', 'FRONT BUMPER')];

    const result = matchStage1PartNumbers(rows, lines);
    expect(result.matches).toHaveLength(0);
    expect(result.unmatchedRows).toHaveLength(1);
    expect(result.unmatchedLines).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tally/__tests__/stage1-part-number.test.ts`  
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/tally/stage1-part-number.ts`**

```typescript
import type { AssessmentRow } from '@/types/assessment';
import type { BillItem } from '@/stores/slices/aiDataSlice';
import { normPart } from '@/lib/reports/bill-match-score';

export interface PartNumberMatch {
  rowId: string;
  lineId: string;
  partNumber: string;
  matchType: 'exact' | 'normalized';
  billItem: BillItem;
  priceDelta: number;
}

export interface Stage1Result {
  matches: PartNumberMatch[];
  unmatchedRows: AssessmentRow[];
  unmatchedLines: BillItem[];
}

export function matchStage1PartNumbers(
  rows: AssessmentRow[],
  billLines: BillItem[]
): Stage1Result {
  const matches: PartNumberMatch[] = [];
  const matchedRowIds = new Set<string>();
  const matchedLineIdxs = new Set<number>();

  const lineByNormPn = new Map<string, BillItem[]>();
  for (const line of billLines) {
    const np = normPart(line.partNumber);
    if (!np) continue;
    lineByNormPn.set(np, [...(lineByNormPn.get(np) || []), line]);
  }

  for (const row of rows) {
    const rawRowPn = (row.partNumber || '').trim();
    const np = normPart(rawRowPn);
    if (!np) continue;

    const candidateLines = (lineByNormPn.get(np) || []).filter((l) => !matchedLineIdxs.has(l.idx));
    if (candidateLines.length === 0) continue;

    const bestLine = candidateLines[0];
    const isExact = rawRowPn.toLowerCase() === (bestLine.partNumber || '').trim().toLowerCase();
    const priceDelta = bestLine.taxableAmount - (row.assessed || row.estimated || 0);

    matches.push({
      rowId: row.id,
      lineId: String(bestLine.idx),
      partNumber: rawRowPn,
      matchType: isExact ? 'exact' : 'normalized',
      billItem: bestLine,
      priceDelta,
    });

    matchedRowIds.add(row.id);
    matchedLineIdxs.add(bestLine.idx);
  }

  return {
    matches,
    unmatchedRows: rows.filter((r) => !matchedRowIds.has(r.id)),
    unmatchedLines: billLines.filter((l) => !matchedLineIdxs.has(l.idx)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tally/__tests__/stage1-part-number.test.ts`  
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tally/stage1-part-number.ts src/lib/tally/__tests__/stage1-part-number.test.ts
git commit -m "feat(tally): add Stage 1 pure part number matching engine"
```

---

### Task 2: Stage 2 Pure Logic — Automotive Name & Cost Semantic Matcher

**Files:**
- Create: `src/lib/tally/stage2-name-cost.ts`
- Test: `src/lib/tally/__tests__/stage2-name-cost.test.ts`

**Interfaces:**
```typescript
export interface NameCostMatch {
  rowId: string;
  lineId: string;
  reasons: string[];
  billItem: BillItem;
  priceDelta: number;
  confidence: number;
}

export interface Stage2Result {
  matches: NameCostMatch[];
  unmatchedRows: AssessmentRow[];
  unmatchedLines: BillItem[];
}

export function matchStage2NameAndCost(
  rows: AssessmentRow[],
  billLines: BillItem[]
): Stage2Result;
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tally/__tests__/stage2-name-cost.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { matchStage2NameAndCost } from '../stage2-name-cost';
import type { AssessmentRow, BillItem } from '@/types';

const row = (id: string, text: string, assessed = 1000): AssessmentRow => ({
  id, particulars: text, estimated: assessed, assessed,
  partType: 'plastic', gst: 18, section: 'parts', allowed: true,
});

const line = (idx: number, srNo: number, desc: string, taxable = 1000): BillItem => ({
  idx, srNo, description: desc, taxableAmount: taxable,
  totalAmount: Math.round(taxable * 1.18), gstPercent: 18, section: 'parts', raw: {},
});

describe('matchStage2NameAndCost', () => {
  it('matches automotive synonyms like ORVM to Rear View Mirror', () => {
    const rows = [row('r1', 'ORVM ASSY RH', 3800)];
    const lines = [line(0, 12, 'REAR VIEW MIRROR RH', 3850)];

    const res = matchStage2NameAndCost(rows, lines);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].rowId).toBe('r1');
    expect(res.matches[0].reasons).toContain('Synonym match');
    expect(res.matches[0].priceDelta).toBe(50);
  });

  it('strictly forbids matching opposite sides (LH vs RH)', () => {
    const rows = [row('r1', 'FOG LAMP BEZEL LH', 400)];
    const lines = [line(0, 15, 'FOG LAMP BEZEL RH', 400)];

    const res = matchStage2NameAndCost(rows, lines);
    expect(res.matches).toHaveLength(0);
    expect(res.unmatchedRows).toHaveLength(1);
  });

  it('rejects pairs with large price divergences over 40%', () => {
    const rows = [row('r1', 'BUMPER BRACKET', 500)];
    const lines = [line(0, 20, 'BUMPER BRACKET', 2500)]; // 400% divergence

    const res = matchStage2NameAndCost(rows, lines);
    expect(res.matches).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tally/__tests__/stage2-name-cost.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/tally/stage2-name-cost.ts`**

```typescript
import type { AssessmentRow } from '@/types/assessment';
import type { BillItem } from '@/stores/slices/aiDataSlice';
import { sideConflicts } from '@/lib/reports/bill-match-score';

const SYNONYMS: Record<string, string> = {
  orvm: 'mirror',
  rv: 'mirror',
  ws: 'windshield',
  windscreen: 'windshield',
  bonnet: 'hood',
  dicky: 'boot',
  trunk: 'boot',
  fender: 'mudguard',
  strg: 'steering',
  susp: 'suspension',
  monogram: 'emblem',
  badge: 'emblem',
  lining: 'apron',
  fl: 'fog',
  hl: 'headlight',
  tl: 'taillight',
};

function normalizeTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => SYNONYMS[w] || w)
    .filter((w) => w.length > 1 && !['assy', 'assembly', 'set', 'complete'].includes(w));
}

export interface NameCostMatch {
  rowId: string;
  lineId: string;
  reasons: string[];
  billItem: BillItem;
  priceDelta: number;
  confidence: number;
}

export interface Stage2Result {
  matches: NameCostMatch[];
  unmatchedRows: AssessmentRow[];
  unmatchedLines: BillItem[];
}

export function matchStage2NameAndCost(
  rows: AssessmentRow[],
  billLines: BillItem[]
): Stage2Result {
  const matches: NameCostMatch[] = [];
  const matchedRowIds = new Set<string>();
  const matchedLineIdxs = new Set<number>();

  for (const r of rows) {
    const rTerms = new Set(normalizeTerms(r.particulars));
    const rCost = r.assessed || r.estimated || 0;

    let bestLine: BillItem | null = null;
    let bestScore = 0;
    let matchReasons: string[] = [];

    for (const l of billLines) {
      if (matchedLineIdxs.has(l.idx)) continue;
      if (r.section !== l.section) continue;

      // Strict directional clash rejection
      if (sideConflicts(r.particulars, l.description).size > 0) continue;

      const lTerms = new Set(normalizeTerms(l.description));
      let shared = 0;
      rTerms.forEach((t) => { if (lTerms.has(t)) shared += 1; });
      const termOverlap = (rTerms.size && lTerms.size) ? (2 * shared) / (rTerms.size + lTerms.size) : 0;
      if (termOverlap < 0.6) continue;

      const lCost = l.taxableAmount;
      if (rCost > 0 && lCost > 0) {
        const diffRatio = Math.abs(lCost - rCost) / Math.max(rCost, lCost);
        if (diffRatio > 0.40) continue; // Divergence over 40% rejected in Stage 2
      }

      const score = termOverlap * 100;
      if (score > bestScore) {
        bestScore = score;
        bestLine = l;
        matchReasons = ['Synonym match', `Term overlap ${Math.round(termOverlap * 100)}%`];
      }
    }

    if (bestLine && bestScore >= 65) {
      matches.push({
        rowId: r.id,
        lineId: String(bestLine.idx),
        reasons: matchReasons,
        billItem: bestLine,
        priceDelta: bestLine.taxableAmount - rCost,
        confidence: Math.round(bestScore),
      });
      matchedRowIds.add(r.id);
      matchedLineIdxs.add(bestLine.idx);
    }
  }

  return {
    matches,
    unmatchedRows: rows.filter((r) => !matchedRowIds.has(r.id)),
    unmatchedLines: billLines.filter((l) => !matchedLineIdxs.has(l.idx)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tally/__tests__/stage2-name-cost.test.ts`  
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tally/stage2-name-cost.ts src/lib/tally/__tests__/stage2-name-cost.test.ts
git commit -m "feat(tally): add Stage 2 automotive name and cost matcher"
```

---

### Task 3: Stage 3 Pure Logic — Targeted AI Prompt Builder & Parser

**Files:**
- Create: `src/lib/tally/stage3-ai-matcher.ts`
- Test: `src/lib/tally/__tests__/stage3-ai-matcher.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tally/__tests__/stage3-ai-matcher.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildStage3AIPrompt, parseStage3AIResponse } from '../stage3-ai-matcher';

describe('stage3-ai-matcher', () => {
  it('builds a concise prompt with only remaining rows and lines', () => {
    const prompt = buildStage3AIPrompt(
      [{ id: 'r1', particulars: 'ALTERNATOR BELT', amount: 850 }],
      [{ id: 'b1', description: 'DRIVE BELT V-RIBBED', amount: 900 }]
    );
    expect(prompt).toContain('ALTERNATOR BELT');
    expect(prompt).toContain('DRIVE BELT V-RIBBED');
    expect(prompt).toContain('Return ONLY a JSON array');
  });

  it('parses valid AI JSON proposals', () => {
    const rawJson = JSON.stringify([
      { rowId: 'r1', lineId: 'b1', confidence: 92, reason: 'Alternator belt is drive belt' }
    ]);
    const res = parseStage3AIResponse(rawJson);
    expect(res).toHaveLength(1);
    expect(res[0].rowId).toBe('r1');
    expect(res[0].confidence).toBe(92);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tally/__tests__/stage3-ai-matcher.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/tally/stage3-ai-matcher.ts`**

```typescript
export interface CandidateRow {
  id: string;
  particulars: string;
  amount: number;
}

export interface CandidateLine {
  id: string;
  description: string;
  amount: number;
}

export interface AIProposal {
  rowId: string;
  lineId: string;
  confidence: number;
  reason: string;
}

export function buildStage3AIPrompt(
  rows: CandidateRow[],
  lines: CandidateLine[]
): string {
  return `You are an expert Indian motor insurance surveyor. Compare these remaining unmatched assessment items against workshop invoice lines.
Identify if any pair refers to the same vehicle part or labour operation, considering Indian workshop vocabulary, abbreviations, and assembly terms.

ASSESSMENT ROWS:
${rows.map((r) => `- ID: ${r.id} | "${r.particulars}" | ₹${r.amount}`).join('\n')}

WORKSHOP INVOICE LINES:
${lines.map((l) => `- ID: ${l.id} | "${l.description}" | ₹${l.amount}`).join('\n')}

Return ONLY a JSON array of matching pairs:
[
  { "rowId": "string", "lineId": "string", "confidence": 0-100, "reason": "brief reason why these are the same" }
]
If an item has no valid match, do NOT include it.`;
}

export function parseStage3AIResponse(raw: string): AIProposal[] {
  try {
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) => typeof p.rowId === 'string' && typeof p.lineId === 'string' && typeof p.confidence === 'number'
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tally/__tests__/stage3-ai-matcher.test.ts`  
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tally/stage3-ai-matcher.ts src/lib/tally/__tests__/stage3-ai-matcher.test.ts
git commit -m "feat(tally): add Stage 3 targeted AI prompt builder and parser"
```

---

### Task 4: Stage 4 Pure Logic — Disallowed & Tally Segregation Engine

**Files:**
- Create: `src/lib/tally/stage4-tally-matrix.ts`
- Test: `src/lib/tally/__tests__/stage4-tally-matrix.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tally/__tests__/stage4-tally-matrix.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { segregateStage4Tally } from '../stage4-tally-matrix';
import type { AssessmentRow, BillItem } from '@/types';

const row = (id: string, text: string, allowed: boolean, billedTax?: number): AssessmentRow => ({
  id, particulars: text, estimated: 1000, assessed: allowed ? 1000 : 0,
  partType: 'plastic', gst: 18, section: 'parts', allowed, billedTaxable: billedTax,
});

describe('segregateStage4Tally', () => {
  it('flags disallowed items billed by workshop with 0 liability and audit remark', () => {
    const rows = [row('r1', 'SUSPENSION ARM', false, 800)];
    const out = segregateStage4Tally(rows, []);

    expect(out.disallowedBilled).toHaveLength(1);
    expect(out.disallowedBilled[0].liability).toBe(0);
    expect(out.disallowedBilled[0].remark).toContain('disallowed at survey');
  });

  it('identifies allowed items not in bill as insurer savings', () => {
    const rows = [row('r1', 'FOG LAMP BEZEL', true, undefined)];
    const out = segregateStage4Tally(rows, []);

    expect(out.savings).toHaveLength(1);
    expect(out.savings[0].savedAmount).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tally/__tests__/stage4-tally-matrix.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/tally/stage4-tally-matrix.ts`**

```typescript
import type { AssessmentRow } from '@/types/assessment';
import type { BillItem } from '@/stores/slices/aiDataSlice';

export interface DisallowedBilledRow {
  row: AssessmentRow;
  billedTaxable: number;
  liability: 0;
  remark: string;
}

export interface InsurerSavingRow {
  row: AssessmentRow;
  savedAmount: number;
}

export interface Stage4TallyMatrix {
  allowedBilled: AssessmentRow[];
  disallowedBilled: DisallowedBilledRow[];
  savings: InsurerSavingRow[];
  extraBillItems: BillItem[];
  totalSaved: number;
}

export function segregateStage4Tally(
  rows: AssessmentRow[],
  extraLines: BillItem[]
): Stage4TallyMatrix {
  const allowedBilled: AssessmentRow[] = [];
  const disallowedBilled: DisallowedBilledRow[] = [];
  const savings: InsurerSavingRow[] = [];

  for (const r of rows) {
    if (!r.allowed) {
      if ((r.billedTaxable ?? 0) > 0) {
        disallowedBilled.push({
          row: r,
          billedTaxable: r.billedTaxable ?? 0,
          liability: 0,
          remark: `Workshop claimed ₹${r.billedTaxable}; disallowed at survey.`,
        });
      }
    } else {
      if (r.billedTaxable !== undefined && r.billStatus !== 'not-in-bill') {
        allowedBilled.push(r);
      } else {
        savings.push({
          row: r,
          savedAmount: r.assessed,
        });
      }
    }
  }

  const totalSaved = savings.reduce((sum, s) => sum + s.savedAmount, 0);

  return {
    allowedBilled,
    disallowedBilled,
    savings,
    extraBillItems: extraLines,
    totalSaved,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tally/__tests__/stage4-tally-matrix.test.ts`  
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tally/stage4-tally-matrix.ts src/lib/tally/__tests__/stage4-tally-matrix.test.ts
git commit -m "feat(tally): add Stage 4 disallowed and savings tally segregation"
```

---

### Task 5: Store Integration — Progressive Tally State Slice

**Files:**
- Create: `src/stores/slices/tallySlice.ts`
- Test: `src/stores/slices/__tests__/tally-slice.test.ts`
- Modify: `src/stores/claim-store.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/stores/slices/__tests__/tally-slice.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useClaimStore } from '@/stores/claim-store';

describe('tallySlice', () => {
  beforeEach(() => {
    useClaimStore.setState({ currentClaim: { id: 'c1', assessmentRows: [], extraBillItems: [] } as any });
  });

  it('updates active tally stage', () => {
    expect(useClaimStore.getState().activeTallyStage).toBe(1);
    useClaimStore.getState().setTallyStage(2);
    expect(useClaimStore.getState().activeTallyStage).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/slices/__tests__/tally-slice.test.ts`  
Expected: FAIL (`activeTallyStage` undefined).

- [ ] **Step 3: Implement `tallySlice.ts` and merge into `claim-store.ts`**

```typescript
import type { StateCreator } from 'zustand';

export type TallyStage = 1 | 2 | 3 | 4 | 'grid';

export interface TallySlice {
  activeTallyStage: TallyStage;
  setTallyStage: (stage: TallyStage) => void;
}

export const createTallySlice: StateCreator<any, [], [], TallySlice> = (set) => ({
  activeTallyStage: 1,
  setTallyStage: (stage) => set({ activeTallyStage: stage }),
});
```
Merge into `src/stores/claim-store.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/slices/__tests__/tally-slice.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/slices/tallySlice.ts src/stores/slices/__tests__/tally-slice.test.ts src/stores/claim-store.ts
git commit -m "feat(store): add tallySlice for progressive stage navigation"
```

---

### Task 6: UI Component — The 4-Stage Stepper Header

**Files:**
- Create: `src/components/tabs/bill-check/BillCheckStepper.tsx`
- Modify: `src/components/tabs/BillCheckTab.tsx`

- [ ] **Step 1: Write component with accessible tabs and counts**

Create `src/components/tabs/bill-check/BillCheckStepper.tsx`:
- Render 4 stages: `1. Part Numbers`, `2. Name & Price`, `3. Ask AI`, `4. Disallowed & Tally`, plus `[ Show Standard Grid ]`.
- Support click navigation with aria-selected states.
- High visual contrast (Blue active stage, Emerald completed stages).

- [ ] **Step 2: Mount into `BillCheckTab.tsx` directly under header**

- [ ] **Step 3: Run build and type check**

Run: `npx tsc --noEmit`  
Expected: CLEAN (no TypeScript errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/bill-check/BillCheckStepper.tsx src/components/tabs/BillCheckTab.tsx
git commit -m "feat(ui): add 4-stage progressive tally stepper header"
```

---

### Task 7: UI Component — Stage 1 & Stage 2 Review Tables

**Files:**
- Create: `src/components/tabs/bill-check/StageReviewTable.tsx`
- Modify: `src/components/tabs/BillCheckTab.tsx`

- [ ] **Step 1: Implement `StageReviewTable`**
  - Renders matched pairs side by side: Estimate Item vs Bill Item.
  - Shows price delta (green if equal/cheaper, amber if higher).
  - Actions on each row:
    - `[✓ Keep]` (locks link)
    - `[✕ Unlink]` (calls `unlinkBillMatch(rowId)`)
    - `[⊘ Not Billed]` (marks row `not-in-bill`)
  - Bottom action bar:
    - `[ Confirm All Stage Matches ➔ Proceed to Next Stage ]`
    - `[ Push Remaining Unmatched Items to Next Stage ➔ ]`

- [ ] **Step 2: Run tests & tsc**

Run: `npx tsc --noEmit`  
Expected: CLEAN.

- [ ] **Step 3: Commit**

```bash
git add src/components/tabs/bill-check/StageReviewTable.tsx
git commit -m "feat(ui): add Stage 1 and Stage 2 review tables with unlink and push controls"
```

---

### Task 8: UI Component — Stage 3 Targeted AI Trigger & Review

**Files:**
- Create: `src/components/tabs/bill-check/StageAITrigger.tsx`

- [x] **Step 1: Implement `StageAITrigger`**
  - Hero action card: Shows count of remaining unmatched rows and lines.
  - Button: `[ 🤖 Ask AI to Match Remaining Items ]`.
  - When clicked: Calls `buildStage3AIPrompt` and calls existing `callAIGateway`.
  - Displays proposed matches with quoted AI reasons.
  - Two buttons per card: `[✓ Accept Proposal]` (links line) or `[✕ Discard]`.

- [x] **Step 2: Run tsc**

Run: `npx tsc --noEmit`  
Expected: CLEAN.

- [x] **Step 3: Commit**

```bash
git add src/components/tabs/bill-check/StageAITrigger.tsx
git commit -m "feat(ui): add Stage 3 targeted AI trigger and proposal review component"
```

---

### Task 9: UI Component — Stage 4 Disallowed & Tally Matrix View

**Files:**
- Create: `src/components/tabs/bill-check/StageAuditView.tsx`

- [x] **Step 1: Implement `StageAuditView`**
  - Section 1: Disallowed Items Billed by Workshop (Purple badge, ₹0 liability, report note).
  - Section 2: Insurer Savings (Mint highlight, total saved figure).
  - Section 3: Extra Bill Items (Option to add to assessment or discard).
  - Section 4: Final Reconciliation Seal (`Gap: ₹0.00`).
  - Action: `[ 🖨 Print Bill Check Report ]`.

- [x] **Step 2: Run tsc**

Run: `npx tsc --noEmit`  
Expected: CLEAN.

- [x] **Step 3: Commit**

```bash
git add src/components/tabs/bill-check/StageAuditView.tsx
git commit -m "feat(ui): add Stage 4 disallowed and savings audit matrix"
```

---

### Task 10: Full Integration & Vitest Verification

**Files:**
- Modify: `src/components/tabs/BillCheckTab.tsx`
- Test: `src/stores/slices/__tests__/apply-final-bill.test.ts`

- [x] **Step 1: Wire up state transitions in `BillCheckTab.tsx`**
  - When `activeTallyStage === 1`: shows Stage 1 view.
  - When `activeTallyStage === 2`: shows Stage 2 view.
  - When `activeTallyStage === 3`: shows Stage 3 view.
  - When `activeTallyStage === 4`: shows Stage 4 audit view.
  - When `activeTallyStage === 'grid'`: shows the standard grid view.

- [x] **Step 2: Run full test suite**

Run: `npx vitest run`  
Expected: ALL 2,000+ tests pass.

- [x] **Step 3: Run TypeScript compiler check**

Run: `npx tsc --noEmit`  
Expected: CLEAN.

- [x] **Step 4: Commit**

```bash
git add src/components/tabs/BillCheckTab.tsx
git commit -m "feat(bill-check): wire complete 4-stage surveyor-controlled tallying cockpit"
```
