# 2026-11-16 — Surveyor-Controlled Progressive Tallying Cockpit (Antigravity)

## Context & Owner Requirements
Owner (Niraj Patil) identified issues when tallying uploaded bill documents against the assessment grid:
- The system was previously trying to do matching in one monolithic pass, or swinging between two extremes: naive token overlap (causing false-positives) and exact-only part-number locking (dumping all items without OEM part numbers into unmatched).
- Owner requested an audit and redesign where:
  1. The surveyor is in 100% control of the workflow (no invisible black-box matching).
  2. Four distinct stages are preserved:
     - Stage 1: Part Numbers
     - Stage 2: Name & Price (Semantics & Cost Window)
     - Stage 3: Surveyor-Triggered AI (Remaining unmatched)
     - Stage 4: Disallowed & Savings Tally
  3. Approach A selected: Stepper at top that filters the existing grid/views without disrupting muscle memory.
  4. Both options preserved for leftovers (one-click "Mark All Remaining as Not in Bill (Saving)" plus individual marking).
  5. Unmatched bill lines flow cleanly into Stage 4 as "Workshop Items Not in Estimate" rather than screaming as an error at the bottom.

## Implementation Details
1. **Stage 1 Engine (`src/lib/tally/stage1-part-number.ts`):**
   - Exact and normalized part number matching (spaces/hyphens ignored).
   - Price delta calculation (`priceDelta = billed - assessed`).
2. **Stage 2 Engine (`src/lib/tally/stage2-name-cost.ts`):**
   - Automotive synonym dictionary (`ORVM` -> mirror, `W/S` -> windshield, `Bonnet` -> hood, `Dicky` -> boot).
   - Strict spatial guardrail: Left never matches Right (`sideConflicts`).
   - Rejection of >40% price divergences.
3. **Stage 3 AI Matcher (`src/lib/tally/stage3-ai-matcher.ts`, `StageAITrigger.tsx`):**
   - Prompt builder sending only remaining unmatched candidates to AI.
   - Robust JSON parsing extracting confidence and quoted explanation.
   - Individual Accept/Reject controls.
4. **Stage 4 Tally Segregation (`src/lib/tally/stage4-tally-matrix.ts`, `StageAuditView.tsx`):**
   - Disallowed parts billed by workshop: ₹0 liability, auto-remark `"Workshop claimed ₹...; disallowed at survey."`
   - Insurer savings list + `markRemainingAllowedAsNotInBill()` button.
   - Extra bill lines tray with Promote, Link, and Discard actions.
   - Final reconciliation audit seal.
5. **State & UI (`tallySlice.ts`, `BillCheckStepper.tsx`, `StageReviewTable.tsx`, `BillCheckTab.tsx`):**
   - Top 4-stage stepper bar with live counts and `Show Full Grid` toggle.
   - Seamless view switching.

## Verification
- TypeScript (`npx tsc --noEmit`): Clean (0 errors).
- Vitest (`npx vitest run`): 3,178 / 3,178 tests passed (including 45 new tally tests).
- Prime ↔ Scan coupling: None (Bill Check tab only).
