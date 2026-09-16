# Smart Fix: Missed-Row Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the subtotal-based math check with serial-number gap detection, fill gaps with one single-page re-read, run a full second opinion only when nothing cheaper can help, and move Smart Fix into the review dialog.

**Architecture:** A pure module `row-check.ts` finds gaps/duplicates/gross mismatch from `sr_no` and per-row `_page` tags; `gap-fill.ts` re-reads only the gap pages and merges rows by serial; `processor.ts` tags rows at merge time, runs the check + gap fill + (rare) second opinion, and returns structured `findings`; the store carries findings on the review result; the hook's `smartFix` reuses the same engine on the pending result; `AIReviewDialog` renders one amber "Check before applying" card with the button.

**Tech Stack:** Next.js 16 / TypeScript, Zustand, vitest (node env, `renderToStaticMarkup` for components), existing `callAIGateway` fallback loop.

**Spec:** `docs/superpowers/specs/2026-09-16-smart-fix-missed-rows-design.md`

## Global Constraints

- Work on `main`, commit per task, no branches. Attribution line: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Zero extra AI calls on a clean read; one single-page call per gap page; at most 6 gap pages auto-filled.
- Section subtotals are never checked. Gross is checked only against `total_amount` row sums, and in text mode only when its digits appear in a page text.
- `serialsUsable` requires ≥ 80 % of rows with an integer `sr_no > 0`; one-run mode when ≤ 10 % of serials are duplicated; per-section mode when ≥ 2 non-empty sections each start at serial 1.
- `_page` / `_pageEnd` tags are 0-based, live on the review result only, and are stripped before anything reaches `claim.extractedData`.
- Second opinion (whole re-read on the next model) runs **only** when `grossMismatch` remains and `gaps` is empty.
- Toast on completion has no action button. Smart Fix button lives only in the review dialog card.
- Dev-only `?ai-drop=<sr_no>` removes that serial from the first-pass result once per page load; inert in production.
- Run `npx vitest run src/lib/ai` after every task (baseline 302 tests green) and `npx tsc --noEmit` before the final commit.

---

## File map

| File | Responsibility |
|---|---|
| Create `src/lib/ai/row-check.ts` | Pure: `rowCheck`, `tagRows`, `dropDuplicates`, `mergeBySerial`, `stripPageTags`, `toFindings`, `describeFinding`, `countRows`, types |
| Create `src/lib/ai/gap-fill.ts` | `fillGaps` — one vision call per gap page through `callAIGateway`, merge by serial |
| Modify `src/lib/ai/fault.ts` | add `takeDrop()` for `?ai-drop=` |
| Modify `src/lib/ai/processor.ts` | tag rows at merge, replace `validateMath`, auto gap fill, new second-opinion rule, return `findings`; add `smartFixRescan`; delete `rescanTargetPages`, `applyTargetedUpdate`, `validateMath` |
| Modify `src/stores/extraction-store.ts` | `ExtractionResult.findings`, `smartFixed`; delete `DiscrepancyContext` and `discrepancies` slice |
| Modify `src/hooks/useAIExtraction.ts` | `smartFix(key)` on the pending result, one-line toast, strip tags on write |
| Modify `src/components/dialogs/AIReviewDialog.tsx` | amber/green "Check before applying" card, delete red box |
| Modify `src/components/tabs/AssessmentTab.tsx`, `BillCheckTab.tsx` | pass `findings`, `onSmartFix`, `smartFixProgress`, `smartFixed` |
| Tests | `src/lib/ai/__tests__/row-check.test.ts`, `gap-fill.test.ts`, `fault.test.ts`, `second-opinion.test.ts`, `src/components/dialogs/__tests__/ai-review-findings.test.tsx` |

---

### Task 1: `row-check.ts` — pure serial/gross checks

**Files:**
- Create: `src/lib/ai/row-check.ts`
- Test: `src/lib/ai/__tests__/row-check.test.ts`

**Interfaces:**
- Produces (used by Tasks 3, 4, 6, 7):
  ```ts
  export type Finding =
    | { kind: 'gap'; srNos: number[]; pages: number[] }
    | { kind: 'gross'; rows: number; printed: number };
  export interface Gap { srNo: number; pages: number[] }
  export interface RowCheck { gaps: Gap[]; duplicates: number[]; grossMismatch?: { rows: number; printed: number }; serialsUsable: boolean }
  export const SECTIONS: readonly ['spare_parts', 'labour_items', 'painting_items'];
  export function rowCheck(data: unknown, pageTexts?: string[]): RowCheck;
  export function tagRows<T>(fragment: T, first: number, last: number): T;       // 0-based pages
  export function dropDuplicates<T>(data: T): T;
  export function mergeBySerial<T>(data: T, fragment: unknown): T;
  export function stripPageTags<T>(data: T): T;
  export function toFindings(check: RowCheck): Finding[];
  export function describeFinding(f: Finding): string;
  export function countRows(data: unknown): number;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/__tests__/row-check.test.ts
import { describe, it, expect } from 'vitest';
import {
  rowCheck, tagRows, dropDuplicates, mergeBySerial, stripPageTags, toFindings, describeFinding, countRows,
} from '../row-check';

const row = (sr_no: number, total_amount: number, _page?: number, extra: object = {}) => ({ sr_no, total_amount, _page, ...extra });

/** DTC shape: one serial run across sections, 5 pages, rows reconcile to the gross. */
function dtc() {
  const spare_parts = Array.from({ length: 60 }, (_, i) => row(i + 1, 100, Math.floor(i / 20)));      // pages 0-2
  const labour_items = Array.from({ length: 15 }, (_, i) => row(61 + i, 50, 3));
  const painting_items = Array.from({ length: 5 }, (_, i) => row(76 + i, 20, 4));
  return { spare_parts, labour_items, painting_items, gross_amount: 60 * 100 + 15 * 50 + 5 * 20 };
}

describe('rowCheck — one serial run (DTC)', () => {
  it('clean 80-row read has no findings', () => {
    const c = rowCheck(dtc());
    expect(c).toEqual({ gaps: [], duplicates: [], serialsUsable: true });
  });
  it('a missing serial is a gap pinned to its page when neighbours agree', () => {
    const d = dtc();
    d.spare_parts = d.spare_parts.filter(r => r.sr_no !== 38);          // 37 and 39 both on page 1
    d.gross_amount -= 100;
    expect(rowCheck(d).gaps).toEqual([{ srNo: 38, pages: [1] }]);
  });
  it('a gap between pages names both pages', () => {
    const d = dtc();
    d.spare_parts = d.spare_parts.filter(r => r.sr_no !== 40);          // 39 on page 1, 41 on page 2
    d.gross_amount -= 100;
    expect(rowCheck(d).gaps).toEqual([{ srNo: 40, pages: [1, 2] }]);
  });
  it('a multi-page vision chunk widens the candidates', () => {
    const d = dtc();
    d.spare_parts = d.spare_parts.filter(r => r.sr_no !== 38);
    d.spare_parts = d.spare_parts.map(r => (r.sr_no === 37 || r.sr_no === 39) ? { ...r, _page: 1, _pageEnd: 2 } : r);
    d.gross_amount -= 100;
    expect(rowCheck(d).gaps).toEqual([{ srNo: 38, pages: [1, 2] }]);
  });
  it('a repeated serial is a duplicate', () => {
    const d = dtc();
    d.spare_parts.push(row(12, 100, 0));
    d.gross_amount += 0;   // sum now off by 100 — that is a real mismatch, but duplicates are reported regardless
    expect(rowCheck(d).duplicates).toEqual([12]);
  });
});

describe('rowCheck — per-section serials', () => {
  it('detects gaps inside each section when sections restart at 1', () => {
    const d = {
      spare_parts: [row(1, 10, 0), row(2, 10, 0), row(4, 10, 0)],
      labour_items: [row(1, 5, 1), row(2, 5, 1)],
      painting_items: [],
      gross_amount: 40,
    };
    expect(rowCheck(d).gaps).toEqual([{ srNo: 3, pages: [0] }]);
    expect(rowCheck(d).duplicates).toEqual([]);     // 1 and 2 repeating across sections is not a duplicate here
  });
});

describe('rowCheck — serials unusable', () => {
  it('skips the gap check when fewer than 80 % of rows have a serial', () => {
    const d = { spare_parts: [row(1, 10), { total_amount: 10 }, { total_amount: 10 }], labour_items: [], painting_items: [], gross_amount: 30 };
    expect(rowCheck(d)).toEqual({ gaps: [], duplicates: [], serialsUsable: false });
  });
});

describe('rowCheck — gross', () => {
  it('rows not adding up to the gross is a mismatch in vision mode (no page texts)', () => {
    const d = dtc(); d.gross_amount += 500;
    expect(rowCheck(d).grossMismatch).toEqual({ rows: 6850, printed: 7350 });
  });
  it('in text mode a gross whose digits are not printed anywhere is ignored', () => {
    const d = dtc(); d.gross_amount += 500;
    expect(rowCheck(d, ['no money here', 'nor here']).grossMismatch).toBeUndefined();
  });
  it('in text mode a printed gross (Indian comma format) is trusted', () => {
    const d = dtc(); d.gross_amount = 2_26_860.85;
    expect(rowCheck(d, ['GRAND TOTAL 2,26,860.85']).grossMismatch).toEqual({ rows: 6850, printed: 226860.85 });
  });
  it('falls back to total_amount when gross_amount is absent', () => {
    const d = { ...dtc(), gross_amount: undefined, total_amount: 6850 };
    expect(rowCheck(d).grossMismatch).toBeUndefined();
  });
  it('tolerates 0.1 % rounding', () => {
    const d = dtc(); d.gross_amount = 6855;
    expect(rowCheck(d).grossMismatch).toBeUndefined();
  });
});

describe('helpers', () => {
  it('tagRows tags every row in every section; _pageEnd only for multi-page chunks', () => {
    const f = { spare_parts: [{ sr_no: 1 }], labour_items: [{ sr_no: 2 }], painting_items: [], gross_amount: 1 };
    expect(tagRows(f, 2, 2).spare_parts[0]).toEqual({ sr_no: 1, _page: 2 });
    expect(tagRows(f, 2, 3).labour_items[0]).toEqual({ sr_no: 2, _page: 2, _pageEnd: 3 });
    expect(f.spare_parts[0]).toEqual({ sr_no: 1 });   // immutable
  });
  it('dropDuplicates keeps the first copy per section', () => {
    const d = { spare_parts: [row(1, 10), row(2, 10), row(1, 99)], labour_items: [], painting_items: [] };
    expect(dropDuplicates(d).spare_parts.map(r => r.total_amount)).toEqual([10, 10]);
  });
  it('mergeBySerial inserts only serials still missing, never replaces', () => {
    const d = { spare_parts: [row(1, 10), row(3, 10)], labour_items: [row(2, 5)], painting_items: [] };
    const frag = { spare_parts: [row(2, 99), row(4, 10)], labour_items: [row(1, 99)] };
    const m = mergeBySerial(d, frag);
    expect(m.spare_parts.map(r => r.sr_no)).toEqual([1, 3, 4]);   // 2 exists in labour → not inserted
    expect(m.labour_items.map(r => r.sr_no)).toEqual([2]);
    expect(d.spare_parts).toHaveLength(2);                         // immutable
  });
  it('stripPageTags removes _page/_pageEnd from every row', () => {
    const d = { spare_parts: [row(1, 10, 0, { _pageEnd: 1 })], labour_items: [], painting_items: [], gross_amount: 10 };
    expect(stripPageTags(d)).toEqual({ spare_parts: [{ sr_no: 1, total_amount: 10 }], labour_items: [], painting_items: [], gross_amount: 10 });
  });
  it('toFindings groups all gaps into one finding and adds gross', () => {
    const f = toFindings({ gaps: [{ srNo: 38, pages: [2] }, { srNo: 52, pages: [2, 3] }], duplicates: [], serialsUsable: true, grossMismatch: { rows: 1, printed: 2 } });
    expect(f).toEqual([{ kind: 'gap', srNos: [38, 52], pages: [2, 3] }, { kind: 'gross', rows: 1, printed: 2 }]);
  });
  it('describeFinding speaks plain surveyor language with 1-based pages', () => {
    expect(describeFinding({ kind: 'gap', srNos: [38], pages: [2] })).toBe('Row 38 looks missing (page 3)');
    expect(describeFinding({ kind: 'gap', srNos: [38, 52], pages: [2, 3] })).toBe('Rows 38 and 52 look missing (pages 3, 4)');
    expect(describeFinding({ kind: 'gross', rows: 225100, printed: 226860 })).toBe('Rows add up to ₹2,25,100 but the bill says ₹2,26,860');
  });
  it('countRows sums the three sections', () => { expect(countRows(dtc())).toBe(80); });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/row-check.test.ts`
Expected: FAIL — `Cannot find module '../row-check'`

- [ ] **Step 3: Implement `row-check.ts`**

```ts
// src/lib/ai/row-check.ts
//
// Missed-row detection for estimates and final bills. Dealer software prints a
// serial number on every row and a gross at the end; section subtotals vary by
// format and are often not printed at all, so they are never checked here.
// Rows carry 0-based `_page` (and `_pageEnd` for a multi-page vision chunk) so a
// gap can be pinned to the page that needs a re-read.

export type Finding =
  | { kind: 'gap'; srNos: number[]; pages: number[] }
  | { kind: 'gross'; rows: number; printed: number };

export interface Gap { srNo: number; pages: number[] }

export interface RowCheck {
  gaps: Gap[];
  duplicates: number[];
  grossMismatch?: { rows: number; printed: number };
  /** ≥ 80 % of rows carry an integer sr_no — otherwise the gap check is skipped. */
  serialsUsable: boolean;
}

export const SECTIONS = ['spare_parts', 'labour_items', 'painting_items'] as const;
type Section = typeof SECTIONS[number];

interface Row { sr_no?: unknown; total_amount?: unknown; _page?: number; _pageEnd?: number; [k: string]: unknown }

const SERIAL_COVERAGE = 0.8;
const ONE_RUN_MAX_DUP_RATIO = 0.1;
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function rowsOf(data: unknown, s: Section): Row[] {
  const v = (data as Record<string, unknown> | null)?.[s];
  return Array.isArray(v) ? (v as Row[]) : [];
}

function serial(r: Row): number | null {
  const n = Number(r.sr_no);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function pagesOf(r: Row): number[] {
  if (typeof r._page !== 'number') return [];
  const end = typeof r._pageEnd === 'number' ? r._pageEnd : r._page;
  return Array.from({ length: end - r._page + 1 }, (_, i) => r._page! + i);
}

/** Same tolerance as the old math check: ₹5 floor, 0.1 % above ₹5,000. */
function tolerance(expected: number): number { return Math.max(5, expected * 0.001); }

function gapsIn(list: Row[]): Gap[] {
  const present = list.map(r => ({ sr: serial(r), r })).filter((x): x is { sr: number; r: Row } => x.sr !== null)
    .sort((a, b) => a.sr - b.sr);
  const gaps: Gap[] = [];
  for (let i = 1; i < present.length; i++) {
    const a = present[i - 1], b = present[i];
    if (b.sr <= a.sr + 1) continue;
    const pages = [...new Set([...pagesOf(a.r), ...pagesOf(b.r)])].sort((x, y) => x - y);
    for (let n = a.sr + 1; n < b.sr; n++) gaps.push({ srNo: n, pages });
  }
  return gaps;
}

function duplicatesIn(list: Row[]): number[] {
  const seen = new Set<number>(), dup = new Set<number>();
  for (const r of list) { const s = serial(r); if (s === null) continue; if (seen.has(s)) dup.add(s); seen.add(s); }
  return [...dup].sort((a, b) => a - b);
}

function perSectionMode(data: unknown): boolean {
  const startingAtOne = SECTIONS.filter(s => {
    const serials = rowsOf(data, s).map(serial).filter((n): n is number => n !== null);
    return serials.length > 0 && Math.min(...serials) === 1;
  });
  return startingAtOne.length >= 2;
}

/** Digits of `n` (commas removed, integer part) appear in some page text. */
function grossPrinted(n: number, pageTexts?: string[]): boolean {
  if (!pageTexts) return true;                              // vision: nothing to verify against
  const needle = String(Math.trunc(n));                     // "226860" — integer part, so 2,26,860.85 matches
  return pageTexts.some(t => t.replace(/,/g, '').includes(needle));
}

export function countRows(data: unknown): number {
  return SECTIONS.reduce((n, s) => n + rowsOf(data, s).length, 0);
}

export function rowCheck(data: unknown, pageTexts?: string[]): RowCheck {
  const all = SECTIONS.flatMap(s => rowsOf(data, s));
  const numbered = all.filter(r => serial(r) !== null).length;
  const serialsUsable = all.length > 0 && numbered / all.length >= SERIAL_COVERAGE;

  let gaps: Gap[] = [], duplicates: number[] = [];
  if (serialsUsable) {
    if (perSectionMode(data)) {
      gaps = SECTIONS.flatMap(s => gapsIn(rowsOf(data, s)));
      duplicates = [...new Set(SECTIONS.flatMap(s => duplicatesIn(rowsOf(data, s))))].sort((a, b) => a - b);
    } else {
      duplicates = duplicatesIn(all);
      // ponytail: a heavily duplicated union that does not start at 1 per section
      // is an unknown numbering scheme — report duplicates, skip gaps.
      gaps = duplicates.length / Math.max(1, numbered) <= ONE_RUN_MAX_DUP_RATIO ? gapsIn(all) : [];
    }
  }

  const d = data as Record<string, unknown> | null;
  const printed = Number(d?.gross_amount) || Number(d?.total_amount) || 0;
  const rows = all.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const check: RowCheck = { gaps, duplicates, serialsUsable };
  if (printed > 0 && rows > 0 && Math.abs(rows - printed) > tolerance(printed) && grossPrinted(printed, pageTexts)) {
    check.grossMismatch = { rows, printed };
  }
  return check;
}

function mapSections<T>(data: T, fn: (rows: Row[], s: Section) => Row[]): T {
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const s of SECTIONS) if (Array.isArray(out[s])) out[s] = fn(out[s] as Row[], s);
  return out as T;
}

/** Tag every row of a chunk's fragment with the 0-based page range it came from. */
export function tagRows<T>(fragment: T, first: number, last: number): T {
  return mapSections(fragment, rows => rows.map(r => last > first ? { ...r, _page: first, _pageEnd: last } : { ...r, _page: first }));
}

export function stripPageTags<T>(data: T): T {
  return mapSections(data, rows => rows.map(({ _page, _pageEnd, ...rest }) => rest));
}

/** Keep the first row per serial within each section. */
export function dropDuplicates<T>(data: T): T {
  return mapSections(data, rows => {
    const seen = new Set<number>();
    return rows.filter(r => { const s = serial(r); if (s === null) return true; if (seen.has(s)) return false; seen.add(s); return true; });
  });
}

/** Insert rows from `fragment` whose serial is absent from every section of `data`. Never replaces. */
export function mergeBySerial<T>(data: T, fragment: unknown): T {
  const have = new Set(SECTIONS.flatMap(s => rowsOf(data, s).map(serial)).filter((n): n is number => n !== null));
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const s of SECTIONS) {
    const fresh = rowsOf(fragment, s).filter(r => { const n = serial(r); if (n === null || have.has(n)) return false; have.add(n); return true; });
    if (fresh.length) out[s] = [...rowsOf(data, s), ...fresh];
  }
  return out as T;
}

export function toFindings(check: RowCheck): Finding[] {
  const out: Finding[] = [];
  if (check.gaps.length) {
    out.push({
      kind: 'gap',
      srNos: check.gaps.map(g => g.srNo),
      pages: [...new Set(check.gaps.flatMap(g => g.pages))].sort((a, b) => a - b),
    });
  }
  if (check.grossMismatch) out.push({ kind: 'gross', ...check.grossMismatch });
  return out;
}

function list(ns: number[]): string {
  return ns.length <= 1 ? String(ns[0] ?? '') : `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
}

export function describeFinding(f: Finding): string {
  if (f.kind === 'gross') return `Rows add up to ₹${INR.format(f.rows)} but the bill says ₹${INR.format(f.printed)}`;
  const one = f.srNos.length === 1;
  const pages = f.pages.map(p => p + 1);
  const where = pages.length === 0 ? '' : pages.length === 1 ? ` (page ${pages[0]})` : ` (pages ${pages.join(', ')})`;
  return `${one ? 'Row' : 'Rows'} ${list(f.srNos)} ${one ? 'looks' : 'look'} missing${where}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/ai/__tests__/row-check.test.ts`
Expected: PASS (all). If the "duplicate" DTC test fails on `grossMismatch` being present, that is expected — the assertion only reads `.duplicates`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/row-check.ts src/lib/ai/__tests__/row-check.test.ts
git commit -m "feat(ai): row-check — serial gaps, duplicates and printed-gross reconciliation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `?ai-drop=` dev fault

**Files:**
- Modify: `src/lib/ai/fault.ts`
- Test: `src/lib/ai/__tests__/fault.test.ts`

**Interfaces:**
- Produces: `export function takeDrop(): number | null` (once per page load, dev only); `export function _setDropForTests(v: string | null): void`.

- [ ] **Step 1: Add failing tests** (append to `fault.test.ts`)

```ts
import { takeDrop, _setDropForTests } from '../fault';

describe('takeDrop', () => {
  beforeEach(() => _setDropForTests(null));
  it('returns the serial once, then null', () => {
    _setDropForTests('38');
    expect(takeDrop()).toBe(38);
    expect(takeDrop()).toBeNull();
  });
  it('non-numeric → null', () => { _setDropForTests('x'); expect(takeDrop()).toBeNull(); });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/fault.test.ts` — Expected: FAIL, `takeDrop` not exported.

- [ ] **Step 3: Implement** (append to `fault.ts`)

```ts
// ── ?ai-drop=38 — remove serial 38 from the first-pass result once, so the gap
// fill can be watched on a real document. Dev only, like ?ai-fault.
let pendingDrop: string | null | undefined;

function readDropFromUrl(): string | null {
  if (process.env.NODE_ENV === 'production' || typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get('ai-drop');
}

/** The serial to drop from this page load's first extraction, once; null after. */
export function takeDrop(): number | null {
  if (pendingDrop === undefined) pendingDrop = readDropFromUrl();
  const n = Number(pendingDrop);
  pendingDrop = null;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Tests only. */
export function _setDropForTests(v: string | null): void { pendingDrop = v; }
```

- [ ] **Step 4: Run** the file again — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/fault.ts src/lib/ai/__tests__/fault.test.ts
git commit -m "chore(ai): dev-only ?ai-drop=<sr_no> to simulate a missed row

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `gap-fill.ts` — one vision call per gap page

**Files:**
- Create: `src/lib/ai/gap-fill.ts`
- Test: `src/lib/ai/__tests__/gap-fill.test.ts`

**Interfaces:**
- Consumes: `callAIGateway(prompt, images, 'json', 'heavy', session, signal)` from `./service`; `AllProvidersBusyError`, `OfflineError` from `./service`; `tagRows`, `mergeBySerial`, `SECTIONS` from `./row-check`.
- Produces:
  ```ts
  export interface GapFillInput {
    basePrompt: string;          // the document's extraction prompt
    apiImages: string[];         // one per page, 0-based
    data: unknown;               // current merged result (tagged rows)
    srNos: number[];             // serials to find; empty = "rows not yet listed"
    pages: number[];             // 0-based pages to re-read (deduplicated, ≤ MAX_GAP_PAGES)
    session?: ReturnType<typeof import('./service').newSession>;
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
  }
  export const MAX_GAP_PAGES = 6;
  export function gapPrompt(basePrompt: string, page1: number, srNos: number[], have: number[]): string;
  export async function fillGaps(input: GapFillInput): Promise<unknown>;   // new data; input.data untouched
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/__tests__/gap-fill.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../service', () => {
  class AllProvidersBusyError extends Error {}
  class OfflineError extends Error {}
  return { callAIGateway: vi.fn(), AllProvidersBusyError, OfflineError, newSession: () => ({}) };
});
import { callAIGateway, AllProvidersBusyError } from '../service';
import { fillGaps, gapPrompt, MAX_GAP_PAGES } from '../gap-fill';

const gw = callAIGateway as unknown as ReturnType<typeof vi.fn>;
const row = (sr_no: number, total_amount = 10, _page = 0) => ({ sr_no, total_amount, _page });
const base = { spare_parts: [row(1), row(3, 10, 1)], labour_items: [], painting_items: [], gross_amount: 30 };
const images = ['p0', 'p1', 'p2'];

beforeEach(() => gw.mockReset());

describe('fillGaps', () => {
  it('no pages → no calls, same data', async () => {
    const out = await fillGaps({ basePrompt: 'P', apiImages: images, data: base, srNos: [], pages: [] });
    expect(gw).not.toHaveBeenCalled();
    expect(out).toBe(base);
  });
  it('one call per page with only that page image; inserts the missing serial tagged with its page', async () => {
    gw.mockResolvedValueOnce(JSON.stringify({ spare_parts: [row(2, 10), row(1, 99)] }));
    const out: any = await fillGaps({ basePrompt: 'P', apiImages: images, data: base, srNos: [2], pages: [1] });
    expect(gw).toHaveBeenCalledTimes(1);
    expect(gw.mock.calls[0][1]).toEqual(['p1']);
    expect(gw.mock.calls[0][3]).toBe('heavy');
    expect(out.spare_parts.map((r: any) => r.sr_no)).toEqual([1, 3, 2]);
    expect(out.spare_parts[2]._page).toBe(1);
    expect(out.spare_parts[0].total_amount).toBe(10);        // existing row 1 not replaced
  });
  it('an unparseable page is skipped, the others still merge', async () => {
    gw.mockResolvedValueOnce('not json').mockResolvedValueOnce(JSON.stringify({ spare_parts: [row(2)] }));
    const out: any = await fillGaps({ basePrompt: 'P', apiImages: images, data: base, srNos: [2], pages: [0, 1] });
    expect(out.spare_parts).toHaveLength(3);
  });
  it('busy/offline/abort propagate', async () => {
    gw.mockRejectedValueOnce(new AllProvidersBusyError('busy'));
    await expect(fillGaps({ basePrompt: 'P', apiImages: images, data: base, srNos: [2], pages: [1] })).rejects.toBeInstanceOf(AllProvidersBusyError);
  });
  it('more than MAX_GAP_PAGES pages → no calls', async () => {
    const pages = Array.from({ length: MAX_GAP_PAGES + 1 }, (_, i) => i);
    const out = await fillGaps({ basePrompt: 'P', apiImages: Array(10).fill('x'), data: base, srNos: [2], pages });
    expect(gw).not.toHaveBeenCalled();
    expect(out).toBe(base);
  });
});

describe('gapPrompt', () => {
  it('names the serials when known', () => {
    expect(gapPrompt('P', 3, [38, 52], [1, 2])).toContain('serial numbers 38, 52');
    expect(gapPrompt('P', 3, [38, 52], [1, 2])).toContain('page 3');
  });
  it('asks for rows not yet listed when serials are unknown', () => {
    const p = gapPrompt('P', 5, [], [1, 2, 3]);
    expect(p).toContain('already captured: 1, 2, 3');
    expect(p).toContain('NOT in that list');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/gap-fill.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `gap-fill.ts`**

```ts
// src/lib/ai/gap-fill.ts
//
// Surgical re-read: one call per page that a serial gap points at, asking only
// for the missed rows, merged by serial so nothing already read is touched.
import { callAIGateway, AllProvidersBusyError, OfflineError, type newSession } from './service';
import { SECTIONS, mergeBySerial, tagRows } from './row-check';

export const MAX_GAP_PAGES = 6;

export interface GapFillInput {
  basePrompt: string;
  apiImages: string[];
  data: unknown;
  srNos: number[];
  pages: number[];
  session?: ReturnType<typeof newSession>;
  signal?: AbortSignal;
  onProgress?: (msg: string) => void;
}

function serialsIn(data: unknown): number[] {
  const d = data as Record<string, unknown> | null;
  return SECTIONS.flatMap(s => (Array.isArray(d?.[s]) ? (d![s] as { sr_no?: unknown }[]) : []))
    .map(r => Number(r.sr_no)).filter(n => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
}

export function gapPrompt(basePrompt: string, page1: number, srNos: number[], have: number[]): string {
  const what = srNos.length
    ? `Rows with serial numbers ${srNos.join(', ')} were missed on page ${page1}.`
    : `Rows already captured: ${have.join(', ')}. Return ONLY rows on page ${page1} that are NOT in that list.`;
  return `${basePrompt}\n\nTARGETED RE-READ of page ${page1} only.\n${what}\n` +
    `Return ONLY those rows, in the same JSON shape (spare_parts / labour_items / painting_items, each row with its sr_no). ` +
    `Leave every other field empty. Do not repeat rows that were already captured.`;
}

function shouldPropagate(e: unknown): boolean {
  return (e as { name?: string })?.name === 'AbortError' || e instanceof AllProvidersBusyError || e instanceof OfflineError;
}

export async function fillGaps(input: GapFillInput): Promise<unknown> {
  const pages = [...new Set(input.pages)].filter(p => p >= 0 && p < input.apiImages.length);
  // ponytail: > MAX_GAP_PAGES gap pages means the whole read is suspect, not a
  // few rows — let the caller's second-opinion rule handle it.
  if (pages.length === 0 || pages.length > MAX_GAP_PAGES) return input.data;

  let data = input.data;
  for (const p of pages) {
    if (input.signal?.aborted) { const e = new Error('Extraction cancelled'); e.name = 'AbortError'; throw e; }
    const label = input.srNos.length ? `Rows ${input.srNos.join(', ')} missing` : 'Some rows missing';
    input.onProgress?.(`${label} — re-reading page ${p + 1}…`);
    // ponytail: always vision for a gap page — a second look at the same text
    // layer tends to repeat the same miss.
    const prompt = gapPrompt(input.basePrompt, p + 1, input.srNos, serialsIn(data));
    let raw: string;
    try {
      raw = await callAIGateway(prompt, [input.apiImages[p]], 'json', 'heavy', input.session, input.signal);
    } catch (e) {
      if (shouldPropagate(e)) throw e;
      console.warn(`[Smart Fix] page ${p + 1} re-read failed — keeping first result`, e);
      continue;
    }
    try {
      data = mergeBySerial(data, tagRows(JSON.parse(raw), p, p));
    } catch {
      console.warn(`[Smart Fix] page ${p + 1} returned unparseable JSON — skipping.`);
    }
  }
  return data;
}
```

- [ ] **Step 4: Run** the test file — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/gap-fill.ts src/lib/ai/__tests__/gap-fill.test.ts
git commit -m "feat(ai): gap-fill — one vision call per gap page, merged by serial

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Processor — tag rows, new check, auto gap fill, new second-opinion rule, `smartFixRescan`

**Files:**
- Modify: `src/lib/ai/processor.ts` (regions: imports; `mergeAIResults` callers at `mergeResponse` ~line 662 and the 413 loop ~line 740; delete `applyTargetedUpdate` 349–371, `rescanTargetPages` 373–415, `validateMath` 419–484; rewrite `needsSecondOpinion` 486–489; rewrite the post-`runAllChunks` block 768–812; `ExtractionResult` interface 330–338)
- Test: `src/lib/ai/__tests__/second-opinion.test.ts` (rewrite), `src/lib/ai/__tests__/processor-job.test.ts` (unchanged, must still pass)

**Interfaces:**
- Consumes: Task 1 (`rowCheck`, `tagRows`, `dropDuplicates`, `mergeBySerial`, `stripPageTags`, `toFindings`, `Finding`), Task 2 (`takeDrop`), Task 3 (`fillGaps`).
- Produces:
  ```ts
  export interface ExtractionResult { data: any; images: string[]; findings: Finding[]; issues: string[] }
  export function needsSecondOpinion(docType: string, data: unknown, pageTexts?: string[]): boolean;
  export async function smartFixRescan(
    key: string, file: File, data: unknown, findings: Finding[],
    onProgress?: (msg: string) => void, signal?: AbortSignal,
  ): Promise<{ data: unknown; findings: Finding[] }>;
  ```
  `data` returned by `extractDocument` and `smartFixRescan` still carries `_page` tags (the hook strips them).

- [ ] **Step 1: Rewrite `second-opinion.test.ts` (failing)**

```ts
// src/lib/ai/__tests__/second-opinion.test.ts
import { describe, it, expect } from 'vitest';
import { needsSecondOpinion } from '../processor';

const row = (sr_no: number, total_amount: number) => ({ sr_no, total_amount, taxable_amount: total_amount });
const good = { gross_amount: 300, spare_parts: [row(1, 200)], labour_items: [row(2, 100)], painting_items: [] };

describe('needsSecondOpinion — only a gross mismatch with no serial gap', () => {
  it('false when rows add up', () => { expect(needsSecondOpinion('estimate', good)).toBe(false); });
  it('false when page-level section subtotals disagree (they are never checked)', () => {
    expect(needsSecondOpinion('estimate', { ...good, subtotal_parts_taxable: 53, subtotal_labour_taxable: 17 })).toBe(false);
  });
  it('true when the gross does not reconcile and no serial is missing (an unserialled row is gone)', () => {
    expect(needsSecondOpinion('estimate', { ...good, gross_amount: 999 })).toBe(true);
  });
  it('false when a serial gap explains the mismatch — the gap fill handles that, not a re-read', () => {
    expect(needsSecondOpinion('estimate', { ...good, labour_items: [row(3, 100)] })).toBe(false);   // serial 2 missing
  });
  it('false in text mode when the gross is not printed anywhere', () => {
    expect(needsSecondOpinion('estimate', { ...good, gross_amount: 999 }, ['no such number'])).toBe(false);
  });
  it('never for non-money documents', () => { expect(needsSecondOpinion('rc', { anything: 1 })).toBe(false); });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ai/__tests__/second-opinion.test.ts` — Expected: FAIL on the "serial gap" and "not printed" cases.

- [ ] **Step 3: Edit `processor.ts`**

3a. Imports — add after the `./service` import:
```ts
import { rowCheck, tagRows, dropDuplicates, mergeBySerial, stripPageTags, toFindings, countRows, type Finding } from './row-check';
import { fillGaps } from './gap-fill';
import { takeDrop } from './fault';
```
(`mergeBySerial` and `stripPageTags` are used in `smartFixRescan`/drop below; remove any that end up unused.)

3b. Replace the `ExtractionResult` interface (lines ~330–338):
```ts
export interface ExtractionResult {
  data: any;
  /** High-res PNG pages for Evidence Viewer display (stored in sessionStorage) */
  images: string[];
  /** Unresolved row/gross findings for the review dialog (empty on a clean read). */
  findings: Finding[];
  /** Pages the AI could not (fully) read. */
  issues: string[];
}
```

3c. Delete `applyTargetedUpdate`, `export { applyTargetedUpdate };`, `rescanTargetPages`, `tolerance`, `validateMath` and their doc comments (lines ~349–484).

3d. Replace `needsSecondOpinion`:
```ts
/**
 * A whole-document re-read on the next model is worth its cost only when the
 * gross does not reconcile AND no serial gap explains it — a row without a
 * serial is gone and no page can be pinned. Every other case is handled by
 * the cheaper gap fill or needs no call at all.
 */
export function needsSecondOpinion(docType: string, data: unknown, pageTexts?: string[]): boolean {
  if (docType !== 'estimate' && docType !== 'final-bill') return false;
  if (!data || typeof data !== 'object') return false;
  const c = rowCheck(data, pageTexts);
  return !!c.grossMismatch && c.gaps.length === 0;
}
```

3e. Tag rows at merge. In `mergeResponse` (inside `runAllChunks`) change
```ts
const fragment = JSON.parse(rawResponse);
result = mergeAIResults(result, fragment);
```
to
```ts
const fragment = JSON.parse(rawResponse);
result = mergeAIResults(result, tagRows(fragment, first - 1, last - 1));   // 1-based chunk → 0-based page tags
```
(The 413 one-page loop already calls `mergeResponse(r, page, page)`, so it is covered.)

3f. Replace the block from `let { result: finalResult, issues: pageIssues } = await runAllChunks();` down to (but not including) `// Log extraction summary` with:

```ts
    let { result: finalResult, issues: pageIssues } = await runAllChunks();

    const money = key === 'estimate' || key === 'final-bill';
    // Text-mode pages give us something to verify the printed gross against;
    // vision pages do not, so the model's figure is trusted there.
    const pageTexts = money && useTextMode && textLayers ? textLayers : undefined;

    if (money && finalResult) {
      const drop = takeDrop();                                   // dev-only ?ai-drop=38
      if (drop) {
        finalResult = Object.fromEntries(Object.entries(finalResult).map(([k, v]) =>
          [k, Array.isArray(v) ? v.filter((r: any) => Number(r?.sr_no) !== drop) : v]));
        console.info(`[ai-fault] dropped serial ${drop} from the first pass`);
      }

      finalResult = dropDuplicates(finalResult);
      let check = rowCheck(finalResult, pageTexts);
      if (check.duplicates.length) console.info('[Smart Fix] dropped duplicate serials', check.duplicates);

      if (check.gaps.length) {
        console.info('[Smart Fix] serial gaps after first pass:', check.gaps);
        finalResult = await fillGaps({
          basePrompt: enhancedPrompt, apiImages, data: finalResult,
          srNos: check.gaps.map(g => g.srNo),
          pages: [...new Set(check.gaps.flatMap(g => g.pages))],
          session, signal, onProgress: msg => onProgress?.(msg),
        });
        check = rowCheck(finalResult, pageTexts);
      }

      // ponytail: the second opinion re-runs the WHOLE document on the next
      // model. Only when the gross is off and no serial gap can be blamed —
      // an unserialled row is gone and no page can be pinned.
      if (check.grossMismatch && check.gaps.length === 0 && session.lastGood) {
        console.info('[ai-fallback] gross does not reconcile and no serial gap explains it:', check.grossMismatch);
        const firstModel = session.lastGood.model;
        onProgress?.('Totals don\'t add up — asking a second AI model to re-read the document…');
        session.avoid.add(firstModel);
        session.lastGood = undefined;
        try {
          const second = await runAllChunks(true);
          const secondData = dropDuplicates(second.result);
          if (!needsSecondOpinion(key, secondData, pageTexts)) {
            const secondModel = (session as typeof session).lastGood?.model;
            console.info(`[ai-fallback] second opinion from ${secondModel} reconciles; first (${firstModel}) did not.`);
            finalResult = secondData; pageIssues = second.issues;
          }
        } catch (e) {
          if (signal?.aborted || (e as { name?: string })?.name === 'AbortError') throw e;
          console.warn('[ai-fallback] second opinion unavailable — keeping first result', e);
        } finally {
          session.avoid.delete(firstModel);
        }
      }
    }

    const findings: Finding[] = money && finalResult ? toFindings(rowCheck(finalResult, pageTexts)) : [];
```

Then change the summary log block's `const total = finalResult.total_amount ?? 'N/A';` … keep as is, and change the return to:
```ts
    return { data: finalResult, images: viewImages, findings, issues: pageIssues };
```
Delete the old lines `const mathCheck = validateMath(finalResult, key);` and `const discrepancies: string[] = [...pageIssues, ...mathCheck.discrepancies];`.

3g. Add `smartFixRescan` after `extractDocument`:

```ts
/**
 * Smart Fix button: the same gap engine, run on the pending review result.
 * Gap findings re-read their pages for their serials; a gross-only finding
 * re-reads the last page (where the gross lives) for rows not yet listed.
 */
export async function smartFixRescan(
  key: string,
  file: File,
  data: unknown,
  findings: Finding[],
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
): Promise<{ data: unknown; findings: Finding[] }> {
  const basePrompt = getDocPrompt(key) ?? 'Extract all visible details from this document as JSON.';
  return aiQueue.add(async () => {
    onProgress?.('Smart Fix: loading document…');
    const { apiImages, textLayers } = await fileToImages(file);
    const pageTexts = textLayers && profilePages(textLayers).docMode === 'text' ? textLayers : undefined;
    const session = newSession(`${key}-fix-${Date.now()}`);

    const gap = findings.find((f): f is Extract<Finding, { kind: 'gap' }> => f.kind === 'gap');
    const srNos = gap?.srNos ?? [];
    const pages = gap ? gap.pages : [apiImages.length - 1];

    let next = await fillGaps({ basePrompt, apiImages, data, srNos, pages, session, signal, onProgress });
    next = dropDuplicates(next);
    return { data: next, findings: toFindings(rowCheck(next, pageTexts)) };
  });
}
```
Check `fileToImages` returns `textLayers` (it is what `filesToImages` builds on — read lines 131–204; if it does not expose `textLayers`, call `filesToImages([file])` instead, which does).

- [ ] **Step 4: Run** `npx vitest run src/lib/ai` — Expected: PASS, including `second-opinion.test.ts`; `npx tsc --noEmit` — Expected: errors only in `useAIExtraction.ts` (imports of deleted `rescanTargetPages`/`applyTargetedUpdate`, `discrepancies` field) — fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/processor.ts src/lib/ai/__tests__/second-opinion.test.ts
git commit -m "feat(ai): serial-gap check, automatic gap fill and gross-only second opinion replace the subtotal math check

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Store — findings on the review result

**Files:**
- Modify: `src/stores/extraction-store.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ExtractionResult { key: string; data: unknown; file: File; findings: Finding[]; smartFixed?: boolean }
  ```
  `DiscrepancyContext`, `discrepancies`, `setDiscrepancyContext` removed. `finishJob(key, result)` unchanged and is how Smart Fix updates the pending result.

- [ ] **Step 1: Edit**

Add `import type { Finding } from '@/lib/ai/row-check';` at the top. Replace the `ExtractionResult` interface:
```ts
export interface ExtractionResult {
  key: string;
  data: unknown;
  file: File;
  /** Unresolved row/gross findings shown in the review dialog. */
  findings: Finding[];
  /** Smart Fix has run at least once on this result. */
  smartFixed?: boolean;
}
```
Delete the `DiscrepancyContext` interface, the `discrepancies: Record<string, DiscrepancyContext>` state field and its doc comment, the `setDiscrepancyContext` action signature and implementation, `discrepancies: {}` in the initial state, and the `discrepancies: omit(state.discrepancies, key)` line in `cancelJob`.

- [ ] **Step 2: Verify** `npx vitest run src/stores` — Expected: PASS (existing store tests do not reference discrepancies; if one does, delete that assertion). `npx tsc --noEmit` — Expected: remaining errors only in `useAIExtraction.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/stores/extraction-store.ts
git commit -m "refactor(store): review result carries row findings; drop the toast discrepancy context

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Hook — `smartFix` on the pending result, one-line toast, strip tags

**Files:**
- Modify: `src/hooks/useAIExtraction.ts`

**Interfaces:**
- Consumes: `smartFixRescan` (Task 4), `stripPageTags`, `countRows` (Task 1), store shape (Task 5).
- Produces (hook return): `smartFix: (key: string) => Promise<void>`, `reviewProgress: string` (progress line of the job behind `reviewData`, non-empty while Smart Fix runs). `triggerTargetedRescan` removed (no tab used it).

- [ ] **Step 1: Edit**

Imports: replace `import { extractDocument, rescanTargetPages, applyTargetedUpdate } from '@/lib/ai/processor';` with
```ts
import { extractDocument, smartFixRescan } from '@/lib/ai/processor';
import { stripPageTags, countRows } from '@/lib/ai/row-check';
```
Delete `buildFocusHint` and `targetPageIndices`. Delete the `setDiscrepancyContext` selector and `targetedRescanRef` + its sync effect.

Add after `reviewData`:
```ts
  const reviewProgress = useExtractionStore(s => (reviewData ? s.jobs[reviewData.key]?.progress ?? '' : ''));
```

Replace the whole `triggerTargetedRescan` callback with:
```ts
  // ─── Smart Fix ───────────────────────────────────────────────────────────────
  // Runs the gap engine on the PENDING review result — the dialog stays open and
  // the rows update in place. Nothing touches the claim until Apply.
  const smartFix = useCallback(async (key: string) => {
    const job = useExtractionStore.getState().jobs[key];
    const result = job?.result;
    const file = useExtractionStore.getState().files[key];
    if (!result) return;
    if (!file) { toast.error('Please re-upload the document to use Smart Fix.'); return; }

    const controller = new AbortController();
    registerAbort(key, controller);
    setJobProgress(key, 'Smart Fix: loading document…');
    try {
      const fixed = await smartFixRescan(key, file, result.data, result.findings, msg => setJobProgress(key, msg), controller.signal);
      finishJob(key, { ...result, data: fixed.data, findings: fixed.findings, smartFixed: true });   // finishJob also clears progress
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setJobProgress(key, '');
      toast.error(`Smart Fix failed: ${err.message}`);
    } finally {
      clearAbort(key);
    }
  }, [setJobProgress, finishJob]);
```

In `triggerExtraction`: change the destructuring to `const { data, images, findings, issues } = await extractDocument(…)`, then replace from `setExtractedData(key, data);` through the end of the `else` toast with:
```ts
      setExtractedData(key, stripPageTags(data));
      finishJob(key, { key, data, file: primary, findings });

      for (const issue of issues) toast.warning(issue, { duration: 12000 });
      const label = key === 'estimate' ? 'Estimate' : key === 'final-bill' ? 'Final Bill' : key.toUpperCase();
      if (key === 'estimate' || key === 'final-bill') {
        const rows = countRows(data);
        const attention = findings.reduce((n, f) => n + (f.kind === 'gap' ? f.srNos.length : 1), 0);
        toast.success(attention ? `${label} read — ${rows} rows, ${attention} need a look` : `${label} read — ${rows} rows`);
      } else {
        toast.success(`${label} extracted successfully!`);
      }
```
Update the `useCallback` deps of `triggerExtraction`: remove `setDiscrepancyContext`.

In `confirmApply`: `applyExtractedData(reviewData.key, stripPageTags(reviewData.data), mode);`.
In `reScanWithFeedback`: pass `stripPageTags(data)` as `previousData`.

Return object: replace `triggerTargetedRescan,` with `smartFix,` and add `reviewProgress,`.

- [ ] **Step 2: Verify** `npx tsc --noEmit` — Expected: clean. `npx vitest run` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAIExtraction.ts
git commit -m "feat(ai): Smart Fix runs the gap engine on the pending review result; one-line completion toast

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Review dialog card + tab wiring

**Files:**
- Modify: `src/components/dialogs/AIReviewDialog.tsx`
- Modify: `src/components/tabs/AssessmentTab.tsx:191-199`, `src/components/tabs/BillCheckTab.tsx:322-330`
- Test: `src/components/dialogs/__tests__/ai-review-findings.test.tsx`

**Interfaces:**
- Consumes: `Finding`, `describeFinding`, `countRows` (Task 1); hook `smartFix`, `reviewProgress`, `reviewData.findings/smartFixed` (Task 6).
- Produces: `AIReviewDialogProps` gains `findings?: Finding[]; onSmartFix?: () => void; smartFixProgress?: string; smartFixed?: boolean;` and loses `discrepancies`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/dialogs/__tests__/ai-review-findings.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';

const data = { spare_parts: [{ sr_no: 1, total_amount: 10 }], labour_items: [], painting_items: [], gross_amount: 10 };
const base = { isOpen: true, onClose: () => {}, onConfirm: () => {}, title: 'estimate', data };

describe('AIReviewDialog — Check before applying card', () => {
  it('renders nothing extra on a clean read', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[]} />);
    expect(html).not.toContain('Check before applying');
    expect(html).not.toContain('Smart Fix');
  });
  it('shows plain-language findings and the Smart Fix button', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[{ kind: 'gap', srNos: [38, 52], pages: [2] }]} onSmartFix={() => {}} />);
    expect(html).toContain('Check before applying');
    expect(html).toContain('Rows 38 and 52 look missing (page 3)');
    expect(html).toContain('Smart Fix');
  });
  it('shows inline progress instead of the button while running', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[{ kind: 'gap', srNos: [38], pages: [2] }]} onSmartFix={() => {}} smartFixProgress="Re-reading page 3…" />);
    expect(html).toContain('Re-reading page 3…');
    expect(html).not.toContain('>Smart Fix<');
  });
  it('turns green when Smart Fix resolved everything', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[]} smartFixed />);
    expect(html).toContain('All 1 rows found, totals match');
  });
  it('keeps the manual hint when something remains after Smart Fix', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[{ kind: 'gross', rows: 1, printed: 2 }]} smartFixed onSmartFix={() => {}} />);
    expect(html).toContain('Evidence Viewer or describe the fix below');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/dialogs` — Expected: FAIL (`findings` prop unknown / text not found).

- [ ] **Step 3: Edit `AIReviewDialog.tsx`**

Imports: add `import { Zap, Loader2, CheckCircle2 } from 'lucide-react';` (merge into the existing lucide import) and `import { describeFinding, countRows, type Finding } from '@/lib/ai/row-check';`.

Props:
```ts
interface AIReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReScan?: (feedback: string) => void;
  title: string;
  data: any;
  evidenceImages?: string[];
  /** Unresolved row/gross findings — renders the "Check before applying" card. */
  findings?: Finding[];
  onSmartFix?: () => void;
  /** Non-empty while Smart Fix is running; shown inline in the card. */
  smartFixProgress?: string;
  smartFixed?: boolean;
}
```
Signature: `({ isOpen, onClose, onConfirm, onReScan, title, data, evidenceImages = [], findings = [], onSmartFix, smartFixProgress = '', smartFixed = false }: AIReviewDialogProps)`.

Add a small component above `AIReviewDialog`:
```tsx
function CheckCard({ findings, onSmartFix, progress, fixed, rows }: {
  findings: Finding[]; onSmartFix?: () => void; progress: string; fixed: boolean; rows: number;
}) {
  if (progress) {
    return (
      <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 flex items-center gap-2 text-sm font-medium">
        <Loader2 size={16} className="animate-spin shrink-0" /> {progress}
      </div>
    );
  }
  if (findings.length === 0) {
    if (!fixed) return null;
    return (
      <div className="mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 size={16} className="shrink-0" /> All {rows} rows found, totals match
      </div>
    );
  }
  return (
    <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50">
      <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2">Check before applying</div>
      <ul className="text-sm text-amber-950 font-medium space-y-1 list-disc pl-4">
        {findings.map((f, i) => <li key={i}>{describeFinding(f)}</li>)}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-amber-800">
          {fixed ? 'Check the page in the Evidence Viewer or describe the fix below' : 'Smart Fix re-reads only the pages above'}
        </span>
        {onSmartFix && (
          <button
            onClick={onSmartFix}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-all active:scale-95 shrink-0"
          >
            <Zap size={14} />Smart Fix
          </button>
        )}
      </div>
    </div>
  );
}
```
In the body, at the top of the right-hand field column (the first child of the scrollable `div` that renders `displayFields`), insert:
```tsx
<CheckCard findings={findings} onSmartFix={onSmartFix} progress={smartFixProgress} fixed={smartFixed} rows={countRows(data)} />
```
Delete the `{discrepancies.length > 0 && (… Math Validation Warnings …)}` block entirely.

- [ ] **Step 4: Wire the two money tabs**

`AssessmentTab.tsx`: destructure `smartFix, reviewProgress` from `useAIExtraction()` and add to the dialog:
```tsx
        findings={reviewData?.findings ?? []}
        onSmartFix={reviewData ? () => smartFix(reviewData.key) : undefined}
        smartFixProgress={reviewProgress}
        smartFixed={reviewData?.smartFixed}
```
`BillCheckTab.tsx`: same four props (destructure `smartFix, reviewProgress` at line 87).

- [ ] **Step 5: Run** `npx vitest run src/components/dialogs` — PASS; `npx tsc --noEmit` — clean; `npx vitest run` — PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/dialogs/AIReviewDialog.tsx src/components/dialogs/__tests__/ai-review-findings.test.tsx src/components/tabs/AssessmentTab.tsx src/components/tabs/BillCheckTab.tsx
git commit -m "feat(ui): 'Check before applying' card with Smart Fix inside the review dialog; no toast action

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Docs, full verification, deploy prep

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`, `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`, `docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md` (Task 14 live checks: add L9)
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-09-16-smart-fix-missed-rows.md`

- [ ] **Step 1: Full checks**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; vitest ≥ 1105 + new tests green; functions tests green.

- [ ] **Step 2: Session log** — write `Sessions/2026-09-16-smart-fix-missed-rows.md` with: what changed (files above), the rules (serial modes, gross-only, second-opinion trigger, MAX_GAP_PAGES = 6), the live check L9 procedure:
  ```
  L9: npm run dev → open with ?ai-drop=38 → upload DTC Proforma Invoice-1.PDF as estimate.
  Expect console: "[ai-fault] dropped serial 38", "[Smart Fix] serial gaps after first pass: [{srNo:38, pages:[N]}]",
  one extra callAIGateway on that page, toast "Estimate read — 80 rows", no card in the dialog.
  Then with no param: toast "Estimate read — 80 rows", zero extra calls, no second opinion.
  ```
  and the pending list (L2–L8 still open; three earlier fixes + this feature not yet deployed).

- [ ] **Step 3: Changelog + Tasks** — one entry each under 2026-09-16: "Smart Fix: serial-gap detection, single-page gap fill, gross-only second opinion, review-dialog card (spec/plan 2026-09-16-smart-fix-missed-rows)". In `Tasks.md` mark the brainstorm item done and add "L9 live check" + "deploy hosting (commits 50c2e994… + smart fix)" as open.

- [ ] **Step 4: Commit**

```bash
git add SurveyOS-Antigravity-Prime-V2-KnowledgeBase docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md
git commit -m "docs: session log, changelog and tasks — Smart Fix missed-row detection

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand back** — do NOT deploy. Report to the owner: build + `firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in` is the deploy (no functions changed), pending their go, and L9 needs `npm run dev`.

---

## Self-review

- **Spec coverage:** §1 → Task 1; §2 → Task 1 (`tagRows`) + Task 4 (3e, strip in Task 6); §3 → Task 4 (3f) + Task 3; §4 → Task 4 (`smartFixRescan`) + Task 6; §5 → Tasks 6, 7; §6 → Task 3 (propagate/skip/cap) + Task 4; §7 → tests in Tasks 1–4, 7, L9 in Tasks 2, 8; §8 out of scope. `?ai-drop` → Tasks 2, 4.
- **Placeholders:** none.
- **Type consistency:** `Finding`/`RowCheck` defined once in Task 1 and imported everywhere; `ExtractionResult` in the processor (`findings`, `issues`) vs the store (`findings`, `smartFixed`) are two different types with the same name as today — the hook maps between them in Task 6; `smartFix(key)` / `reviewProgress` names match between Task 6 and Task 7; `fillGaps` input fields match between Task 3 and Task 4.
