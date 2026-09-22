# Printed Report PDF Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After printing a report, the surveyor is offered one click to file
the PDF they just saved into the claim folder — and the auto-saved HTML
placeholder disappears when it does.

**Architecture:** The five print triggers already save the report HTML via
`saveDocuments(type, …, 'generated')` before opening the print window. Two
additions: (1) a pure predicate decides that a replaced entry is a
placeholder *we* wrote (`source: 'generated'` + `text/html`) being replaced
by a real document, so `writeDocuments` deletes its file instead of renaming
it `(old)`; (2) a persistent sonner toast with a "File the PDF" action calls
`showOpenFilePicker` and feeds the chosen PDF straight back into
`saveDocuments` under the same `DocType`, which triggers that replacement.

**Tech Stack:** TypeScript, Vitest 4 (node env), sonner 2, File System
Access API (`showOpenFilePicker`), existing `src/lib/documents/` engine.

**Spec:** `docs/superpowers/specs/2026-09-20-claim-documents-design.md`
(this plan amends rule D8 — see Task 3).

## Global Constraints

- The placeholder rule is narrow: a file may be deleted only when it was written by us (`source === 'generated'`), is `text/html`, and the incoming file of the same type is **not** `text/html`. Everything else still renames to `(old)` (D8).
- The prompt appears only when a claim folder is connected — otherwise printing behaves exactly as before.
- The prompt never blocks printing: it is shown after `openPrintWindow`, and dismissing it does nothing destructive.
- No new dependency. `showOpenFilePicker` is Chromium-only, same gate as the rest of the feature; when it is absent the prompt is not shown.
- Git: `git add` explicit paths only — never `git add -A` / `git add .` (untracked `design/` must not be committed). Trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Gates: `npx vitest run src/lib/documents` and `npx tsc --noEmit -p tsconfig.json` clean before each commit.

---

## File map

| Path | Responsibility |
|---|---|
| `src/lib/documents/index-ops.ts` | + `isDiscardablePlaceholder(old, incomingMime)` — pure |
| `src/lib/documents/__tests__/index-ops.test.ts` | + its tests |
| `src/lib/documents/folder.ts` | step 2 deletes instead of renaming when the predicate says so |
| `src/lib/documents/print-followup.ts` | `promptForPrintedPdf(type)` — the toast + file picker |
| `src/lib/local-sync/fs-access.d.ts` | + `Window.showOpenFilePicker` |
| the five `trigger*Print` functions | + `void promptForPrintedPdf(type)` after `openPrintWindow` |
| `docs/superpowers/specs/2026-09-20-claim-documents-design.md` | D8 exception, §3.4 note |

---

### Task 1: The placeholder rule

**Files:**
- Modify: `src/lib/documents/index-ops.ts` (append)
- Modify: `src/lib/documents/__tests__/index-ops.test.ts` (append a describe block)
- Modify: `src/lib/documents/folder.ts` (step 2 of `writeDocuments`, the `if (!MULTI_FILE_TYPES.has(type))` block)

**Interfaces:**
- Consumes: `ClaimDocument` from `@/types/documents`.
- Produces: `isDiscardablePlaceholder(old: ClaimDocument, incomingMime: string): boolean`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/documents/__tests__/index-ops.test.ts` (the file already
has a `doc()` helper — reuse it; import `isDiscardablePlaceholder` by adding
it to the existing import from `../index-ops`):

```ts
describe('isDiscardablePlaceholder', () => {
  const html = (over: Partial<ClaimDocument> = {}) =>
    doc({ type: 'surveyReport', relPath: 'Final Survey Report.html', mime: 'text/html', source: 'generated', ...over });

  it('a generated HTML report replaced by a PDF is discardable', () => {
    expect(isDiscardablePlaceholder(html(), 'application/pdf')).toBe(true);
  });
  it('a re-print (HTML replaced by HTML) is not discardable', () => {
    expect(isDiscardablePlaceholder(html(), 'text/html')).toBe(false);
  });
  it('an uploaded HTML file is never discardable', () => {
    expect(isDiscardablePlaceholder(html({ source: 'upload' }), 'application/pdf')).toBe(false);
  });
  it('a generated non-HTML file (the NIA Excel) is never discardable', () => {
    const xlsx = html({ type: 'niaAssessmentExcel', relPath: 'Primary Assessment Template.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(isDiscardablePlaceholder(xlsx, 'application/pdf')).toBe(false);
  });
  it('an empty incoming mime does not discard anything', () => {
    expect(isDiscardablePlaceholder(html(), '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/documents/__tests__/index-ops.test.ts`
Expected: FAIL — `isDiscardablePlaceholder` is not exported.

- [ ] **Step 3: Implement the predicate**

Append to `src/lib/documents/index-ops.ts`:

```ts
/**
 * True when `old` is a stand-in this app wrote unprompted — the report HTML
 * saved at print time — and a real document of the same type is replacing it.
 * Only then may its file be deleted rather than kept as `(old)` (spec D8).
 * A surveyor's own file, and our own non-HTML outputs, are never discardable.
 */
export function isDiscardablePlaceholder(old: ClaimDocument, incomingMime: string): boolean {
  return old.source === 'generated'
    && old.mime === 'text/html'
    && incomingMime !== ''
    && !incomingMime.includes('text/html');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/documents/__tests__/index-ops.test.ts`
Expected: 11 passed (6 existing + 5 new).

- [ ] **Step 5: Wire it into `folder.ts`**

In `writeDocuments`, step 2 currently reads:

```ts
  if (!MULTI_FILE_TYPES.has(type)) {
    const replaced = existing.filter((d) => d.type === type && onThisDevice(d, device));
    next = replaced.reduce((c, d) => removeDocument(c, d.id), next);
    for (const old of replaced) {
      const to = oldNameFor(old.relPath, taken);
      taken.add(to);
      try { await renameFile(claimDir, old.relPath, to); } catch { /* already gone — nothing to keep */ }
    }
  }
```

Replace the loop body so a placeholder is deleted instead:

```ts
  if (!MULTI_FILE_TYPES.has(type)) {
    const incomingMime = files[0]?.blob.type ?? '';
    const replaced = existing.filter((d) => d.type === type && onThisDevice(d, device));
    next = replaced.reduce((c, d) => removeDocument(c, d.id), next);
    for (const old of replaced) {
      if (isDiscardablePlaceholder(old, incomingMime)) {
        await removeQuiet(claimDir, old.relPath); // our own print-time HTML; the real document replaces it
        continue;
      }
      const to = oldNameFor(old.relPath, taken);
      taken.add(to);
      try { await renameFile(claimDir, old.relPath, to); } catch { /* already gone — nothing to keep */ }
    }
  }
```

Add `isDiscardablePlaceholder` to the existing import from `./index-ops`.
`removeQuiet(dir, relPath)` already exists in the file.

- [ ] **Step 6: Verify**

Run: `npx vitest run src/lib/documents && npx tsc --noEmit -p tsconfig.json`
Expected: all pass; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/documents/index-ops.ts src/lib/documents/__tests__/index-ops.test.ts src/lib/documents/folder.ts
git commit -m "feat(documents): a real document replacing our print-time HTML deletes it

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The "File the PDF" prompt

**Files:**
- Create: `src/lib/documents/print-followup.ts`
- Modify: `src/lib/local-sync/fs-access.d.ts` (append `showOpenFilePicker`)
- Modify: `src/lib/reports/standard-report-builder.ts` (`triggerStandardPrint`), `src/lib/reports/uiic-final-builder.ts` (`triggerUIICFinalPrint`, `triggerUIICBillCheckPrint`), `src/lib/reports/spot-fee-bill-builder.ts` (`triggerSpotFeeBillPrint`), `src/lib/reports/reinspection-report-builder.ts` (`triggerReinspectionPrint`)

**Interfaces:**
- Consumes: `saveDocuments` (`./sink`), `getStoredRootHandle` (`@/lib/local-sync/directory-handle`), `DOC_TYPE_LABEL`, `DocType`, `toast` from `sonner`.
- Produces: `promptForPrintedPdf(type: DocType): Promise<void>`.

- [ ] **Step 1: Type augmentation**

Append to `src/lib/local-sync/fs-access.d.ts`, inside the existing
`interface Window` block (which currently declares `showDirectoryPicker`):

```ts
  showOpenFilePicker?(opts?: {
    multiple?: boolean
    excludeAcceptAllOption?: boolean
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }): Promise<FileSystemFileHandle[]>
```

- [ ] **Step 2: The module**

```ts
// src/lib/documents/print-followup.ts
/**
 * A printed report leaves the browser through Chrome's print dialog, so the
 * PDF never passes through this app — only the HTML we saved at print time
 * does. This offers the surveyor one click to hand the PDF back, which then
 * replaces that HTML in the claim folder (see isDiscardablePlaceholder).
 */
import { toast } from 'sonner';
import type { DocType } from '@/types/documents';
import { DOC_TYPE_LABEL } from '@/types/documents';
import { getStoredRootHandle } from '@/lib/local-sync/directory-handle';
import { saveDocuments } from './sink';

async function pickPdf(label: string): Promise<File | null> {
  if (typeof window === 'undefined' || !window.showOpenFilePicker) return null;
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [{ description: `${label} (PDF)`, accept: { 'application/pdf': ['.pdf'] } }],
  });
  return handle ? handle.getFile() : null;
}

/**
 * Shown after the print window opens. Silent when no claim folder is
 * connected or the browser has no file picker — printing is unchanged there.
 */
export async function promptForPrintedPdf(type: DocType): Promise<void> {
  if (typeof window === 'undefined' || !window.showOpenFilePicker) return;
  if (!(await getStoredRootHandle())) return;

  const label = DOC_TYPE_LABEL[type];
  toast(`Saved the ${label} as a PDF?`, {
    description: 'File it into the claim folder so the list holds the copy you sent.',
    duration: Infinity,
    action: {
      label: 'File the PDF',
      onClick: () => {
        // The click is the user gesture the picker needs; failures are the
        // surveyor cancelling, which is not an error worth a toast.
        void pickPdf(label)
          .then((file) => {
            if (file) return saveDocuments(type, [{ blob: file, name: file.name }], 'generated');
          })
          .catch(() => undefined);
      },
    },
  });
}
```

- [ ] **Step 3: Call it from the five triggers**

In each trigger, add `void promptForPrintedPdf(<type>);` as the **last**
statement, after `openPrintWindow(...)`, with
`import { promptForPrintedPdf } from '@/lib/documents/print-followup';`:

- `standard-report-builder.ts` → `triggerStandardPrint`: uses the `type`
  const it already computes (`mode === 'bill-check' ? 'billCheckReport' : 'surveyReport'`) → `void promptForPrintedPdf(type);`
- `uiic-final-builder.ts` → `triggerUIICFinalPrint`: `void promptForPrintedPdf('surveyReport');`
- `uiic-final-builder.ts` → `triggerUIICBillCheckPrint`: `void promptForPrintedPdf('billCheckReport');`
- `spot-fee-bill-builder.ts` → `triggerSpotFeeBillPrint`: `void promptForPrintedPdf('feeBill');`
- `reinspection-report-builder.ts` → `triggerReinspectionPrint`: `void promptForPrintedPdf('reinspectionReport');`

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run src/lib/reports src/lib/documents`
Expected: clean; all pass.

Run: `npx eslint src/lib/documents/print-followup.ts`
Expected: 0 errors.

The browser check (print → toast → pick a PDF → one row, HTML gone) needs a
dev server and a connected folder — it is the controller's, marked NOT RUN
in the report.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/print-followup.ts src/lib/local-sync/fs-access.d.ts src/lib/reports/standard-report-builder.ts src/lib/reports/uiic-final-builder.ts src/lib/reports/spot-fee-bill-builder.ts src/lib/reports/reinspection-report-builder.ts
git commit -m "feat(documents): offer to file the printed PDF after every report print

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Spec amendment

**Files:**
- Modify: `docs/superpowers/specs/2026-09-20-claim-documents-design.md`

- [ ] **Step 1: Amend D8**

Replace rule D8's text with:

```markdown
| D8 | Deleting an index entry never deletes bytes silently — the file is left on disk and the surveyor is told the path. **One exception:** the report HTML this app writes at print time is a placeholder, not the surveyor's file; when the real PDF of the same type is filed, that HTML is deleted so the folder holds one file per report. Nothing a surveyor put in the folder is ever deleted. |
```

- [ ] **Step 2: Describe the flow**

In §3.4, replace the paragraph that begins "**Survey report, bill check, fee
bill, reinspection report** are HTML opened with `window.print()`" with:

```markdown
**Survey report, bill check, fee bill, reinspection report** are HTML opened
with `window.print()`; the PDF is produced by Chrome's own print dialog and
never passes through the app. Two things happen on print:

1. The report **HTML** is saved immediately (`Final Survey Report.html`,
   `source: 'generated'`) — so the folder records that the report was issued
   even if the surveyor goes no further.
2. A prompt offers **File the PDF**. One click opens a file picker; the
   chosen PDF is saved under the same type, and the HTML placeholder is
   deleted (D8's exception). The folder ends with one file per report — the
   PDF that was actually sent.

Re-printing later regenerates from the claim as it stands then, which is why
the filed PDF matters: it is the snapshot of what the insurer received.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-20-claim-documents-design.md
git commit -m "docs: printed-PDF follow-up and the placeholder exception to D8

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** The user's decision (ask after print; delete the HTML
when the PDF arrives) is Task 2 and Task 1 respectively; D8's exception is
written down in Task 3 rather than left implicit. The narrow predicate keeps
every other replacement on the existing `(old)` path — the NIA Excel, a
re-uploaded RC and a re-print all behave exactly as before.

**Placeholders.** None — every step carries its code.

**Type consistency.** `isDiscardablePlaceholder(old, incomingMime)` is used
in `folder.ts` with `files[0]?.blob.type ?? ''`, and its `''` case is tested.
`promptForPrintedPdf(type: DocType)` matches the `DocType` values the five
triggers already pass to `saveDocuments`.
