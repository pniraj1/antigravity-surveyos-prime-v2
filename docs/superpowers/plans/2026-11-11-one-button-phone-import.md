# One-Button Phone Import (Prime) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One "From Phone" button on the Documents, Spot, Valuation and Fees tabs: pick the Scan zip once, and notes, documents and photos all come in.

**Architecture:** `FromPhoneButton` loses its Notes/Scans menu and opens the source dialog directly. Every zip goes through `importScanFiles`, whose no-folder results now carry the manifest notes, so the notes review still runs. A zip with only `_surveyos-backup.json` falls back to notes-only. `UsePhoneNotesButton` and the unused `BringPhoneScans` are deleted.

**Tech Stack:** Next.js 16, React, TypeScript, Zustand, Vitest, sonner.

**Spec:** `docs/superpowers/specs/2026-11-11-phone-import-and-gallery-duplicates-design.md` (Part A)

## Global Constraints

- Work on `main` (owner rule); no branches.
- Notes are never written without the existing review: `PhoneNotesDialog` (import rules 1–11 in `../SurveyOS Scan/docs/handover/prime-notes-import.md`).
- Vehicle-mismatch and other-claim confirmations stay exactly as they are.
- Button label "From Phone" everywhere. The file picker stays `accept=".zip"`; dialog text: "Choose the zip SurveyOS Scan shared".
- No-folder message (exact): "Notes brought in. Documents and photos were not saved: link the claim folder on the Documents tab (desktop Chrome)."
- Drive sources keep today's behaviour (pick zip from Drive; Sync from Drive folder via `importFromDrive`; notes-only `PhoneFolderPickerDialog` → `fetchNotesFromScanFolder` with its folder linking).
- Don't refactor `FromPhoneButton.tsx` beyond removing the menu and the duplicated notes path.
- Prime ↔ Scan: no change to the zip or manifest contract.

## Review Focus

1. Zip picked while no claim folder is linked → notes review still opens, one-line message shows, nothing else written. (Task 1 test `needs-folder carries notes`, Task 2 test)
2. Zip with only `_surveyos-backup.json` (no manifest) → notes review via `normalizeScanNotes`, no "not a SurveyOS Scan zip" error. (Task 1 test `backupOnlyNotes`)
3. Browser without local-folder support (not desktop Chrome/Edge/Brave) → button still opens, zip still yields notes. (Task 2 test)
4. Surveyor cancels the vehicle-mismatch question → nothing written, no notes review. (existing `import.test.ts` cancel test stays green)
5. Notes in the zip identical to the claim → "Phone notes: nothing new", no empty review. (existing `showNotesFromScanZip` behaviour; Task 2 keeps it)

---

### Task 1: Import core returns notes even without a folder, and backup-only zips work

**Files:**
- Modify: `src/lib/scan-import/import.ts` (`ImportResult` type; `importScanFiles` early returns)
- Create: `src/lib/scan-import/backup-notes.ts`
- Test: `src/lib/scan-import/__tests__/import.test.ts`, `src/lib/scan-import/__tests__/backup-notes.test.ts`

**Interfaces:**
- Produces: `ImportResult` variants `{ status: 'needs-folder'; notes: unknown }` and `{ status: 'needs-permission'; notes: unknown }` (notes = `manifest.notes ?? null`).
- Produces: `backupOnlyNotes(zipFiles: Map<string, Blob>): Promise<NormalizedNotesPayload | null>` — returns `normalizeScanNotes(text)` of the first entry ending `_surveyos-backup.json` **only when no entry ends `_surveyos-scan.json`**; otherwise null.

- [ ] **Step 1: Write the failing tests**

In `import.test.ts`, change the existing needs-folder assertion and add one:

```ts
expect(r).toEqual({ status: 'needs-folder', notes: null });

it('needs-folder carries the manifest notes', async () => {
  // zip whose manifest has notes: { spot: { 'vehicle.odometer': '45210' }, spotDamageRows: [], updatedAt: '2026-11-11T10:00:00+05:30' }
  const r = await importScanFiles(zipWithNotes, asks); // no stored root handle
  expect(r.status).toBe('needs-folder');
  expect((r as { notes: any }).notes.spot['vehicle.odometer']).toBe('45210');
});
```

In `backup-notes.test.ts` (use `zip-helper.ts` to build maps):

```ts
it('reads notes from a backup-only zip', async () => {
  const n = await backupOnlyNotes(mapOf({ 'MH02/_surveyos-backup.json': backupJsonWithOdometer('45210') }));
  expect(n).not.toBeNull();
});
it('returns null when the zip has a manifest', async () => {
  expect(await backupOnlyNotes(mapOf({ '_surveyos-scan.json': '{}', '_surveyos-backup.json': '{}' }))).toBeNull();
});
it('returns null when neither file is there', async () => {
  expect(await backupOnlyNotes(mapOf({ 'a.jpg': 'x' }))).toBeNull();
});
```

`backupJsonWithOdometer` builds the smallest backup JSON that `normalizeScanNotes` Case A accepts (copy the shape from `normalizer.ts` / `drive-notes.test.ts`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/scan-import/__tests__/import.test.ts src/lib/scan-import/__tests__/backup-notes.test.ts`
Expected: FAIL (`notes` missing on needs-folder; `backupOnlyNotes` not found).

- [ ] **Step 3: Implement**

In `importScanFiles`, return `{ status: 'needs-folder', notes: manifest.notes ?? null }` and the same for `needs-permission`. Update any caller type narrowing that breaks (`reportScans` in `FromPhoneButton.tsx`, `drive-source.ts`). Write `backupOnlyNotes` in `backup-notes.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/scan-import && npx tsc --noEmit -p .`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scan-import
git commit -m "feat(scan-import): keep notes when no claim folder; read backup-only zips"
```

### Task 2: From Phone opens one dialog and brings notes in every case

**Files:**
- Modify: `src/components/documents/FromPhoneButton.tsx`
- Test: `src/components/documents/__tests__/FromPhoneButton.test.tsx`

**Interfaces:**
- Consumes: Task 1 `ImportResult` notes on `needs-folder` / `needs-permission`; `backupOnlyNotes`.
- Produces: `FromPhoneButton` props unchanged except `initialOpen` now opens the source dialog, and `getAction` exposes `{ open: () => void; close: () => void }` (replaces `toggleMenu/openNotes/openScans/closeMenu`).

- [ ] **Step 1: Rewrite the component tests (failing)**

Replace the menu tests with:

```ts
it('renders "From Phone" with no Notes/Scans menu', () => {
  const html = renderToStaticMarkup(<FromPhoneButton />);
  expect(html).toContain('From Phone');
  expect(html).not.toContain('Phone Notes');
  expect(html).not.toContain('Phone Scans &amp; Photos');
});
it('initialOpen shows the source dialog with the computer zip option', () => {
  const html = renderToStaticMarkup(<FromPhoneButton initialOpen />);
  expect(html).toContain('From this Computer (.zip)');
  expect(html).toContain('Choose the zip SurveyOS Scan shared');
});
it('still offers the computer zip when local folders are unsupported', () => {
  vi.mocked(claimFolderStore.isLocalFolderSupported).mockReturnValue(false);
  const html = renderToStaticMarkup(<FromPhoneButton initialOpen />);
  expect(html).toContain('From this Computer (.zip)');
});
```

Keep the two disabled-state tests. Replace the `getAction` test with one calling `open()` without throwing.

Add a logic test for the result handler. Extract it as an exported pure function in the same file so it can be tested without rendering:

```ts
// exported from FromPhoneButton.tsx
export function scanResultMessage(r: ImportResult): { kind: 'error' | 'info' | 'success'; text: string } | null

it('needs-folder with notes says notes came in', () => {
  expect(scanResultMessage({ status: 'needs-folder', notes: { spot: {} } })).toEqual({
    kind: 'info',
    text: 'Notes brought in. Documents and photos were not saved: link the claim folder on the Documents tab (desktop Chrome).',
  });
});
it('needs-folder without notes keeps the old error', () => {
  expect(scanResultMessage({ status: 'needs-folder', notes: null })?.kind).toBe('error');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/documents/__tests__/FromPhoneButton.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Button click opens the existing "Import Phone Scans & Photos" dialog directly (retitle "From Phone"; description "Choose the zip SurveyOS Scan shared"). Remove the `menuOpen` dropdown, its click-outside effect, `handleOpenNotes`, `handleOpenScans`, `aria-haspopup="menu"`.
- Dialog options: *From this Computer (.zip)* always. When Drive is linked: *Pick .zip from Google Drive* always; *Sync from Google Drive Folder* when `localFolderSupported`, otherwise *Notes from a Google Drive folder* opening `PhoneFolderPickerDialog` (existing `handleSelectDriveFolder` path).
- Zip path (`runScansZipBlob`): `const files = await readZip(blob)`; if `backupOnlyNotes(files)` returns notes → `processNotesPayload(notes)` and stop; else `importScanFiles(files, scanAsks)` (keep `importScanZip` export for other callers).
- `reportScans`: use `scanResultMessage`; for `needs-folder` / `needs-permission` with notes, call `showNotesFromScanZip(r.notes, claimId)` too. Keep `onNeedsFolder` / `onAllowAccess` calls.
- Delete `handleNotesFileInput`, `notesFileRef` and its input (the zip path now covers it).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/documents src/lib/scan-import && npx tsc --noEmit -p .`
Expected: pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/documents/FromPhoneButton.tsx src/components/documents/__tests__/FromPhoneButton.test.tsx
git commit -m "feat(documents): From Phone opens one dialog; notes come in with or without a folder"
```

### Task 3: Same button on Spot, Valuation and Fees; delete the duplicates

**Files:**
- Modify: `src/components/tabs/SpotTab.tsx:46`, `src/components/tabs/ValuationTab.tsx:91`, `src/components/tabs/FeesTab.tsx:167`
- Delete: `src/components/documents/UsePhoneNotesButton.tsx`, `src/components/documents/BringPhoneScans.tsx`
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`; `../SurveyOS Scan/docs/handover/prime-notes-import.md` (the "Prime imports this" line names the From Phone button on Documents, Spot, Valuation and Fees)

**Interfaces:**
- Consumes: `FromPhoneButton` (no props needed on these tabs).

- [ ] **Step 1: Replace usages**

`<UsePhoneNotesButton label="Use Phone Notes" />` → `<FromPhoneButton />` in the three tabs; fix imports.

- [ ] **Step 2: Delete the two files and check nothing references them**

Run: `grep -rn "UsePhoneNotesButton\|BringPhoneScans" src`
Expected: no output.

- [ ] **Step 3: Full check**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: tsc clean; all tests pass.

- [ ] **Step 4: Update docs and commit**

Changelog entry (date, "not deployed", verification counts, "Prime ↔ Scan: none — contract unchanged; handover line updated"). Then:

```bash
git add -A src/components SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md
git commit -m "refactor(phone-import): one From Phone button on all tabs; remove duplicate buttons"
git -C "../SurveyOS Scan" add docs/handover/prime-notes-import.md
git -C "../SurveyOS Scan" commit -m "docs(handover): Prime imports via one From Phone button"
```

- [ ] **Step 5: Browser check note**

The tabs need a login with real claim data; per the owner's rule, don't run a dev server as pseudo-verification. Record in the changelog: "not browser-checked (needs login)".
