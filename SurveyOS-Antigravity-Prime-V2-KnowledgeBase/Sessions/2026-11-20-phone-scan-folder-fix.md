# 2026-11-20 — Phone scan folder fix (Claude Code)

Input: `HANDOVER_2026_11_20_TO_CLAUDE.md` (Antigravity). Each claim was checked against the code first.

## Findings
- **Confirmed, root cause:** `import.ts` checked `getStoredRootHandle()` only. Per-claim folders live in `claim-handles`, so the import returned `needs-folder` before any write. The sink (`sink.ts` → `getClaimDirHandle`) already supported per-claim folders, so only the gate was wrong.
- **Confirmed:** `pickClaimFolder` stored the picked folder as is; picking `D:\Claims` would put every claim's files loose in it.
- **Rejected (owner agreed):** synthesizing a manifest when `_surveyos-scan.json` is missing. Scan uploads the manifest last (`../SurveyOS Scan/docs/handover/scan-drive-status.md`), so its absence means files may be half-sent. Prime now says "still sending" and waits.
- **Not needed:** a new RC source dialog. The RC card's "From phone — click to read" and Details' "Use phone files" were hidden only because imports never succeeded.

## Changes
- `src/lib/scan-import/import.ts`: claim folder first, root folder second.
- `src/lib/storage/claim-folder-store.ts`: `vehicleFolderIn` creates `folderNameFor(claim)` inside a pick without the vehicle number.
- `src/lib/scan-import/drive-source.ts`: "phone still sending" error when export files exist without the manifest.
- Tests: `import.test.ts`, `claim-folder-store.test.ts`, `drive-source.test.ts`.

## Next
- Owner: on a real claim, From Phone → pick `D:\Claims` → check the `MH.. - NIA` folder appears with RC/photos, RC card shows "From phone".
- Scan side (separate task): show what is still waiting to upload and a "Send now" button.
