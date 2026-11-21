# 2026-11-21 — One folder window (Claude Code)

Owner report: picked "Final survey" in New Claim; From Phone saved files loose in it, no vehicle folder.

## Root cause
`NewClaimDialog` had its own `showDirectoryPicker` + `setClaimFolderHandle`, bypassing `pickClaimFolder` (which makes the vehicle folder). From Phone then saw a folder and never asked.

## Folder paths before → after
- New Claim picker (no vehicle folder) → removed; Create calls `askForClaimFolder`.
- From Phone fallback dialog, Documents tab dialog → removed; both call `askForClaimFolder`.
- Header folder button, Storage pop-up → unchanged (already `pickClaimFolder`).
- Sink with no folder: silent no-op → waits in memory, asks, writes on choose; Skip = loud red toast.

## IndexedDB
- `claim-handles`: one row per claim; now removed on local and remote claim deletion (`forgetClaimFolder` in `indexeddb.ts`). No startup sweep: claims DB is per user, folder DB per browser.
- Waiting saves never touch IndexedDB.

## Owner choices
Ask right after Create; pick by hand every time (no remembered main folder); ask boldly and save after choosing.
