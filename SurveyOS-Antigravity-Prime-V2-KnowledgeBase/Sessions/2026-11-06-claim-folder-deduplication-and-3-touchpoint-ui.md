# Session: 2026-11-06 (Antigravity) — Claim Folder Deduplication, Silent Auto-Replace & 3-Touchpoint Allocation

## What I Did
1. **Brainstorming & User Alignment:**
   - Identified and resolved surveyor concerns regarding duplicate files outside the claim folder (e.g. in `Downloads`) and duplicate clutter inside the claim folder (`(old)` files).
   - Agreed on:
     * Canonical Claim Folder as single source of truth for all inputs and outputs.
     * Silent auto-replace: cleaner uploads replace existing slot files in place with standardized canonical names (`RC Book.pdf`), eliminating `(old)` file generation.
     * In-folder deduplication: skip redundant re-writes if the exact file already exists on disk.
     * 3-Touchpoint Allocation strategy: Touchpoint 1 in `NewClaimDialog`, Touchpoint 2 in `ClaimHeader`, Touchpoint 3 just-in-time gate dialog.
     * Option A for `DocumentsTab`: removal of duplicate legacy `FolderLine` (`No claim folder · Connect`).

2. **Phase 1: Storage & Folder Engine (`folder.ts`):**
   - Removed `oldNameFor` renaming for single-file slots (`rc`, `dl`, `policy`, `permit`, `fitness`, `surveyReport`, `reinspectionReport`, etc.).
   - Added silent atomic replacement via `.part` file promotion directly to target path.
   - Added safe cleanup of discarded old extension files (e.g. `.html` -> `.pdf`).
   - Added in-folder deduplication checking target file size on disk to skip redundant writes.
   - Preserved numbering and multi-file preservation for photo slots (`damagePhotos`, `spotPhotos`).
   - Unit tests: `src/lib/documents/__tests__/folder-silent-replace.test.ts` (8/8 passed). Commit `b15909c7`.

3. **Phase 2: UI Integration & Touchpoints:**
   - Created `ClaimFolderPromptDialog.tsx` adhering to `/ui-ux-pro-max` guidelines (non-blocking, clear value proposition, synchronous user click gesture, skip option).
   - Integrated Touchpoint 1 in `NewClaimDialog.tsx` with optional folder picker and immediate handle persistence on create.
   - Streamlined `DocumentsTab.tsx` (Option A): removed legacy `FolderLine` (`No claim folder · Connect`), cleanly hosted `AskForDocumentsButton` and `BringPhoneScans`, and wired prompt dialog.
   - Unit tests: `src/components/layout/__tests__/ClaimFolderPromptDialog.test.tsx` (8/8 passed). Commit `7b9a0b41`.

4. **Verification:**
   - Full Vitest suite: 280 test files passed, 2,507 tests passed (100% green).
   - TypeScript compiler (`npx tsc --noEmit`): 0 errors.
   - Sibling Android app `SurveyOS Scan`: `./gradlew :app:testDebugUnitTest` (BUILD SUCCESSFUL in 20s, 0 drift).
   - Updated `Tasks.md` and `Changelog.md`.

## Test Results
- **SurveyOS Prime V2 Vitest:** 280 test files passed, 2,507 tests passed, 0 failures.
- **SurveyOS Prime V2 TypeScript:** 0 errors.
- **SurveyOS Scan Gradle Tests:** 28 tasks passed, BUILD SUCCESSFUL, 0 drift.
