
# Final fix report
1. reportScans: onNeedsFolder only when needs-folder result has no notes.
2. scanResultMessage texts updated (needs-folder / needs-permission with notes); tests updated + new needs-permission test.
3. Backup-only zip: toast.info('This zip has notes only — no documents or photos.').
4. backupOnlyNotes throws "Couldn't read the notes in this zip." when backup unreadable; test added.
5. Test: isLocalFolderSupported reset to true in beforeEach; unsupported test asserts "Notes from a Google Drive folder" (static render reads store initial state, so test sets it there and restores).
Commands: `npx vitest run src/components/documents src/lib/scan-import` -> 12 files, 105 tests passed; `npx tsc --noEmit -p .` -> no output (pass).
