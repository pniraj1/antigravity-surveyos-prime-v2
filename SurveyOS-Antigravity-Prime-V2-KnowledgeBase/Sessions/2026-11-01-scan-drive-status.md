# Session: 2026-11-01 (Claude Code) — Scan Drive status sync

## What I Did
- Plan 3 Task 5 (Scan repo plan `docs/superpowers/plans/2026-11-01-drive-text-sync.md`): Prime reads and writes Scan's Drive status file.
- `src/lib/drive/scan-status.ts` (pure): `parseStatus`, `statusToJson`, `mergeStatus` ported from Scan `chase/StatusFile.kt`; `withReceived` (Prime's upload write); `statusToChase` (file to `claim.scanChase`).
- `src/lib/drive/scan-status-sync.ts`: `syncScanStatus(claim)` on claim open, `markReceivedInScan(claim, type)` on upload.
- Hooks: `AuthSyncWrapper.tsx` (effect on open claim id), `documents/sink.ts` (after a successful `upload` save).

## What's Unfinished
- [ ] Not tried against real Drive in a browser.
- [ ] Plan 4: `status: "completed"` from Prime.

## Decisions Made
- Pure codec and Drive I/O in two files so the ported tests need no mocks.
- Never creates `SurveyOS` or `Phone Scans`; a missing folder means do nothing. Creates `_surveyos-status.json` only when the claim folder exists without one (vehicle/insurer left blank; Scan fills them on its next write).
- Photo DocTypes (`DOC_TYPE_TO_TAG`) are not written as slots. Only `source: 'upload'` writes (not generated, photo or scan-import saves).
- `scanChase.importedAt` = the file's `updatedAt` (UTC ISO), so the Ask dialog's "received since import" check still works; a fresher manifest import is kept.
- On page reload the Drive token may be restored only after the claim opens; that open then skips (next open syncs).

## Files Changed
- src/lib/drive/scan-status.ts (new)
- src/lib/drive/scan-status-sync.ts (new)
- src/lib/drive/__tests__/scan-status.test.ts (new)
- src/lib/drive/index.ts (export driveRequest, findFolder)
- src/lib/documents/sink.ts (modified)
- src/components/AuthSyncWrapper.tsx (modified)
