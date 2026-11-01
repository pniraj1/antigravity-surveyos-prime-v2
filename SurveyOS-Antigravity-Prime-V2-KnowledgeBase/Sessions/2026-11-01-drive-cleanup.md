# 2026-11-01 Drive cleanup (Claude Code)
Plan 4 Task 4. Completed claims' Prime and Scan Drive folders go to the Drive trash after two confirmations.
- New: `src/lib/drive/cleanup.ts`, `src/lib/drive/__tests__/cleanup.test.ts`, `src/components/profile/DriveCleanupSection.tsx`; `ProfileTab` renders it above the storage cleaner; `ClaimData.driveTrashedAt`.
- Scan folder looked up per claim with `findScanFolder` (read-only). A claim open in the editor is stamped via the store (`updateClaim`), others via `saveClaim`.
- A claim with no folders on Drive is still stamped (nothing to trash).
- Not done: tried against real Drive; push/deploy.
