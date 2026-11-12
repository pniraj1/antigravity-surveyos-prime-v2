# Scan notes → Prime: why fields don't arrive (2026-11-12)

**Status:** fixes 1–3 below were made in Prime on 2026-11-12 (`normalizer.ts` plus its test). Not deployed yet. Fix 4 was not needed (see "Not a gap").

## Bottom line

The field list is fine. Prime's allow-list (`src/lib/scan-import/notes.ts`) has all 65 Scan note fields, using the same paths as Scan's `SpotFields.kt`, `ValuationFields.kt` and `FeeBillFields.kt`. Every path is also shown somewhere in Prime's UI.

Notes are lost **before** they reach that list. It depends on how the notes come in:

| How notes come in | Spot fields | Damage rows | Valuation fields | Part rows | Fee bill |
|---|---|---|---|---|---|
| Full export zip (`_surveyos-scan.json` inside) | ✅ | ✅ | ✅ | ✅ | ✅ |
| "Text only" zip (only `_surveyos-backup.json`) | ✅ | ❌ lost | ✅ | ❌ lost | ❌ lost |
| Drive folder picker, backup file | ✅ | ❌ lost | ✅ | ❌ lost | ❌ lost |
| Drive folder picker, manifest file | ❌ lost | ❌ lost | ❌ lost | ❌ lost | ❌ lost |
| Drive "phone scans" import with no manifest (`drive-source.ts`) | ✅ | ❌ lost | ✅ | ❌ lost | ❌ lost |

I reproduced each ❌ by feeding the exact JSON shapes Scan writes into Prime's real `normalizeScanNotes`:

```
BACKUP        feeBill keys: 0 | damage rows: 0 | part rows: 0
MANIFEST-FILE spot keys: 0  | damage rows: 0
```

## Root causes

### 1. Fee bill notes are under a different section name (backup path)
- Scan saves fee notes in the section `"fee_bill"`. See `Repository.kt:54` and `FeeBillNotes.kt:34`. The backup copies section names exactly as stored (`BackupBuilder.kt`).
- Prime reads `notes.feeBill` (`normalizer.ts:61`). That key never exists in a backup, so **all 16 fee bill fields** are dropped.

### 2. Damage rows and part rows are tagged differently (backup path)
- Scan tags each row with its notes section: `"spot"` or `"valuation"` (`NotesStore.addRow`, `NotesViewModel`).
- Prime keeps only rows tagged `'spotDamageRows'` / `'valuationPartRows'` (`normalizer.ts:65`, `:73`). Scan never writes those names, so **every damage row and every part row** is dropped.

### 3. Drive picker hands the whole manifest to the wrong parser branch
- `drive-notes.ts:113` prefers `_surveyos-scan.json` and passes the **whole file** to `normalizeScanNotes`.
- The backup check (`normalizer.ts:57`) wants `app === 'surveyos-scan-backup'` or a `vehicleNo` key. A manifest has `app: 'surveyos-scan'` and `vehicle`, so it falls through to the "notes object" branch. That branch reads `data.spot` and `data.spotDamageRows` at the top level, but in the manifest they sit under `data.notes`. Result: **every note** is dropped, and the surveyor sees "nothing new to import".

### Why the tests didn't catch it
`__tests__/normalizer.test.ts` builds its backup fixture with a made-up shape (`feeBill` section, rows tagged `spotDamageRows`) instead of what Scan's `backupJson()` writes. The tests pass against a format Scan never produces. Both files came in with `96fbf5ac` (Drive notes import).

## Not a gap (corrected 2026-11-12)

An earlier draft said the Fee Bill tab's own survey date and place never reach Prime. That was wrong. Typing them on the Fee tab also writes them into the Spot and Valuation fields (`NotesViewModel.save` → `SHARED_SYNC_MAP`), and those fields are exported.

## Things checked and found OK
- Manifest zip path (`import.ts` → `planNotes`): the raw `notes` object matches the handover contract exactly.
- Document verification: the backup's flat `documentVerification.<id>.status/.detail` keys are packed correctly by `packDocs`.
- Allow-list paths and value lists (MDL, severity, airbags, drivable, yes/no, GST, fee paid) match Scan's options.
- Fields that look "not pulled" on purpose: Prime only fills **empty** fields. A value that differs from Prime's goes to "Phone notes differ" and is kept as Prime's unless the surveyor picks **Use phone**. Once decided, it is not raised again while the phone value stays the same (`scanImport.decided`). Vehicle Insurable? is never auto-filled. Clearing a field in Scan never clears it in Prime.

## Suggested fix (Prime only, small)
1. `normalizer.ts`: read `notesObj.feeBill ?? notesObj.fee_bill`. Match rows on `'spot'` / `'valuation'` (keep the old names as a fallback).
2. `normalizer.ts`: when given a full manifest (`app === 'surveyos-scan'`), unwrap `data.notes` and keep `data.vehicle` / `data.claimId`.
3. Rebuild the normalizer test fixture from Scan's real `backupJson()` output, and add a whole-manifest case.

**Impact on Scan:** fixes 1–3 need no change to Scan. Scan's output is already correct, and Prime was reading it wrong.
