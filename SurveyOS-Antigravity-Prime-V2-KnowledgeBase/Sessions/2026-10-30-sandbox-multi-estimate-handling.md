# Session Log: 2026-10-30 — Multi-Estimate Mode, Start Gap Detection & Auto-Split Fallback (Sandbox)

## Context & Objectives
- Target: Allow testing multi-estimate quotations (such as Pawar's 13-page estimate `media_1793160002878_ed525e61.pdf`) on an isolated sandbox without affecting live production users.
- User feedback confirmed:
  1. No over-engineering (no dot-matrix checks).
  2. Implement Step 2 recommendations using the Full Live Assessment UI on an isolated Sandbox channel.
  3. Keep `src/lib/ai/prompts.ts` strictly untouched in battle-tested state.

## Implementation Details

### 1. "Another Estimate (Estimate 2, 3...)" Mode
- **Files Modified:**
  - `src/components/dialogs/EstimateModeDialog.tsx`: Added "Another estimate (Estimate 2, 3...)" button alongside "More pages", "A supplementary estimate", and "The same estimate again — read it fresh".
  - `src/stores/slices/aiDataSlice.ts`:
    - Updated `EstimateApplyMode` union to include `'another'`.
    - In `applyEstimate()`:
      - Does not drop existing assessment rows (`kept = claim.assessmentRows`).
      - Preserves original printed serial numbers (`srNo` 1..N) rather than forcing continuation renumbering (`sheetMax + 1`).
      - Derives next estimate tag (e.g. `Quote 2` or `Pawar Automobiles-Quote 2`).
      - If existing rows on the sheet were untagged, backfills them to `Quote 1` so `EstimateViewSwitcher` immediately provides independent filter lenses ("All", "Estimate 1", "Estimate 2") with per-estimate totals and color tags.
  - `src/stores/slices/__tests__/aiDataSlice.test.ts`: Added unit tests verifying `mode === 'another'`.

### 2. Start-of-Document Gap Detection
- **Files Modified:**
  - `src/lib/ai/row-check.ts`:
    - In `gapsIn(list)`: Added check `if (present.length > 0 && present[0].sr > 1)`.
    - If extracted rows begin at `sr > 1`, serials `1..present[0].sr - 1` are flagged as missing with candidate pages `0..minPage`.
    - Smart Fix `fillGaps` is triggered to re-read early pages, and findings alert the surveyor instead of silently ignoring missing opening rows.
  - `src/lib/ai/__tests__/row-check.test.ts`: Added unit test verifying start gap detection.

### 3. In-Flight Auto-Split Fallback on JSON Parse Failures
- **Files Modified:**
  - `src/lib/ai/processor.ts`:
    - Made `mergeResponse` async.
    - When a multi-page chunk (2 pages) fails `JSON.parse` (frequent on dense 70+ item pages where model generation output tokens truncate before closing brackets), the system automatically splits the chunk and invokes 1-page-at-a-time re-reads for each page.
    - Successfully recovers all rows without dropping chunks or stopping extraction.

## Verification & Deployment
- `npm test`: 227 test files passed, 1,999 tests passed (0 failures).
- `npx tsc --noEmit`: 0 errors.
- `npm run build`: Static export successful.
- **Preview Channel Deployment:**
  - `npx firebase hosting:channel:deploy sandbox`
  - Sandbox Preview URL: `https://motorsurveyos-in--sandbox-izvlcn5z.web.app` (expires 2026-11-06).
  - Production URL: `https://motorsurveyos-in.web.app` remains 100% untouched.
