# Folder Naming and Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claim folders are named the way a surveyor searches — `MH12AB1234 - NIA` — and a **Scan folder** button pulls whatever is already in that folder into the claim's document list, so existing claims, Word exports and PDFs saved by hand stop being invisible.

**Architecture:** `folderNameFor` becomes vehicle + insurer short form, with an
insurer normaliser mapping free-text policy names to the short forms surveyors
use; collisions between two claims that produce the same name are resolved once,
at first write, by suffixing. `scanClaimFolder` walks the claim's folder, derives
a `DocType` from each file's own name, skips what the index already has on this
device, and adopts files that another device's entry already describes — which is
also how a folder copied to a second PC turns its "on Office PC" rows into
"here". Finally the printed-PDF picker opens *inside* the claim folder.

**Tech Stack:** TypeScript, React 19, Vitest 4 (node env), File System Access
API, `getAllClaims()` from `src/lib/storage/indexeddb.ts`, sonner.

**Spec:** `docs/superpowers/specs/2026-09-20-claim-documents-design.md` (this
plan amends D2 and adds the scan; Task 5 writes it down).

## Global Constraints

- Folder name = `<registration> - <INSURER SHORT>`, e.g. `MH12AB1234 - NIA`. Missing registration → the insurer alone; missing both → the claim number; nothing at all → `claim`.
- **`documentsFolder` stays sticky.** Claims that already have one keep it — this change only affects folders created from now on. Never rename an existing folder.
- Insurer short forms are the ones surveyors use: New India → `NIA`, National → `NIC`, United India → `UIIC`, Oriental → `OIC`, and the private insurers by their common short name. An unrecognised insurer falls back to its first meaningful word, uppercased.
- Two claims that generate the same folder name must not share a folder: the second gets ` - 2`, the third ` - 3`. Resolved once, at first write, against `getAllClaims()`.
- Scan never writes, moves, renames or deletes anything on disk. It only adds index entries.
- Scanned files are recorded `source: 'upload'` — they are files found on disk, not ones this app generated, so the print-placeholder deletion rule (`isDiscardablePlaceholder`) can never apply to them.
- Scan skips: `.part` files, `_surveyos-sync.json`, anything matching ` (old)` / ` (old N)`, and any path already indexed on this device.
- Git: `git add` explicit paths only — never `git add -A` / `git add .` (untracked `design/` must not be committed). Trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Gates: `npx vitest run src/lib/documents` and `npx tsc --noEmit -p tsconfig.json` clean before each commit.

---

## File map

| Path | Responsibility |
|---|---|
| `src/lib/documents/insurers.ts` | `insurerShortForm(name)` — free-text insurer → `NIA`/`UIIC`/… |
| `src/lib/documents/naming.ts` | `folderNameFor` rewritten; + `docTypeFromRelPath`, `isScanSkippable` |
| `src/lib/documents/index-ops.ts` | + `addDeviceTo(claim, id, label)` |
| `src/lib/documents/folder.ts` | + `resolveFolderName`, `scanClaimFolder`, `getClaimDirHandle` |
| `src/lib/documents/useClaimDocuments.ts` | + `scan()` |
| `src/components/documents/ClaimDocumentsList.tsx` | + **Scan folder** button |
| `src/lib/documents/print-followup.ts` | picker opens in the claim folder |
| `src/lib/local-sync/fs-access.d.ts` | + `startIn` on the picker options |
| tests | `insurers.test.ts`, additions to `naming.test.ts`, `index-ops.test.ts` |

---

### Task 1: Insurer short forms and the new folder name

**Files:**
- Create: `src/lib/documents/insurers.ts`, `src/lib/documents/__tests__/insurers.test.ts`
- Modify: `src/lib/documents/naming.ts` (`folderNameFor`)
- Modify: `src/lib/documents/__tests__/naming.test.ts` (the `folderNameFor` describe block)

**Interfaces:**
- Produces: `insurerShortForm(name: string | undefined): string` (`''` when nothing usable); `folderNameFor(claim)` keeps its signature and stickiness.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/documents/__tests__/insurers.test.ts
import { describe, it, expect } from 'vitest';
import { insurerShortForm } from '../insurers';

describe('insurerShortForm', () => {
  it('maps the four public insurers however the policy spells them', () => {
    expect(insurerShortForm('THE NEW INDIA ASSURANCE COMPANY LIMITED')).toBe('NIA');
    expect(insurerShortForm('New India Assurance Co. Ltd.')).toBe('NIA');
    expect(insurerShortForm('National Insurance Company Limited')).toBe('NIC');
    expect(insurerShortForm('United India Insurance Co. Ltd.')).toBe('UIIC');
    expect(insurerShortForm('The Oriental Insurance Company Ltd')).toBe('OIC');
  });
  it('maps the common private insurers', () => {
    expect(insurerShortForm('ICICI Lombard General Insurance Co. Ltd.')).toBe('ICICI');
    expect(insurerShortForm('Bajaj Allianz General Insurance')).toBe('BAJAJ');
    expect(insurerShortForm('HDFC ERGO General Insurance Co Ltd')).toBe('HDFC');
    expect(insurerShortForm('TATA AIG General Insurance')).toBe('TATA');
    expect(insurerShortForm('Go Digit General Insurance Ltd')).toBe('DIGIT');
    expect(insurerShortForm('Cholamandalam MS General Insurance')).toBe('CHOLA');
    expect(insurerShortForm('Shriram General Insurance Co. Ltd.')).toBe('SHRIRAM');
  });
  it('falls back to the first meaningful word for an unknown insurer', () => {
    expect(insurerShortForm('Sunrise General Insurance Co. Ltd.')).toBe('SUNRISE');
    expect(insurerShortForm('The Ajanta Assurance Company Limited')).toBe('AJANTA');
  });
  it('returns empty for nothing usable', () => {
    expect(insurerShortForm(undefined)).toBe('');
    expect(insurerShortForm('   ')).toBe('');
    expect(insurerShortForm('Insurance Co. Ltd.')).toBe('');
  });
});
```

Replace the `folderNameFor` describe block in
`src/lib/documents/__tests__/naming.test.ts` with:

```ts
describe('folderNameFor', () => {
  it('is sticky once set', () => {
    const c = createBlankClaim(); c.documentsFolder = 'KEEP-ME';
    c.vehicle.registrationNumber = 'MH12AB1234'; c.policy.insurerName = 'New India Assurance';
    expect(folderNameFor(c)).toBe('KEEP-ME');
  });
  it('is registration + insurer short form', () => {
    const c = createBlankClaim();
    c.vehicle.registrationNumber = 'MH12AB1234';
    c.policy.insurerName = 'The New India Assurance Company Limited';
    expect(folderNameFor(c)).toBe('MH12AB1234 - NIA');
  });
  it('drops the part it does not have', () => {
    const c = createBlankClaim();
    c.vehicle.registrationNumber = 'MH12AB1234';
    expect(folderNameFor(c)).toBe('MH12AB1234');
    c.vehicle.registrationNumber = ''; c.policy.insurerName = 'United India Insurance Co. Ltd.';
    expect(folderNameFor(c)).toBe('UIIC');
  });
  it('falls back to the claim number, then to claim', () => {
    const c = createBlankClaim();
    c.policy.claimNumber = '3101/00312/24-C';
    expect(folderNameFor(c)).toBe('3101 00312 24-C');
    c.policy.claimNumber = '';
    expect(folderNameFor(c)).toBe('claim');
  });
  it('sanitises a registration with stray characters', () => {
    const c = createBlankClaim();
    c.vehicle.registrationNumber = 'MH/12 AB*1234'; c.policy.insurerName = 'National Insurance';
    expect(folderNameFor(c)).toBe('MH 12 AB 1234 - NIC');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/documents/__tests__/insurers.test.ts src/lib/documents/__tests__/naming.test.ts`
Expected: FAIL — `../insurers` not found, and `folderNameFor` still returns the claim number first.

- [ ] **Step 3: Implement the normaliser**

```ts
// src/lib/documents/insurers.ts
/**
 * Insurer name → the short form surveyors actually write on a folder.
 * Policy documents spell the same company a dozen ways ("THE NEW INDIA
 * ASSURANCE COMPANY LIMITED", "New India Assurance Co. Ltd."), and the AI
 * extraction copies whatever the paper says, so match on the distinctive
 * words rather than the whole string.
 */

/** Ordered: the first pattern that matches wins, so put the specific ones first. */
const SHORT_FORMS: Array<[RegExp, string]> = [
  [/\bnew\s*india\b/, 'NIA'],
  [/\bunited\s*india\b/, 'UIIC'],
  [/\bnational\s+insurance\b/, 'NIC'],
  [/\boriental\b/, 'OIC'],
  [/\bicici\b/, 'ICICI'],
  [/\bbajaj\b/, 'BAJAJ'],
  [/\bhdfc\b/, 'HDFC'],
  [/\btata\b/, 'TATA'],
  [/\breliance\b/, 'RELIANCE'],
  [/\bsbi\b/, 'SBI'],
  [/\biffco\b/, 'IFFCO'],
  [/\bchola/, 'CHOLA'],
  [/\bshriram\b/, 'SHRIRAM'],
  [/\broyal\s*sundaram\b/, 'ROYAL'],
  [/\bfuture\s*generali\b/, 'FUTURE'],
  [/\buniversal\s*sompo\b|\bsompo\b/, 'SOMPO'],
  [/\bmagma\b/, 'MAGMA'],
  [/\bliberty\b/, 'LIBERTY'],
  [/\bkotak\b/, 'KOTAK'],
  [/\bdigit\b/, 'DIGIT'],
  [/\backo\b/, 'ACKO'],
  [/\bnavi\b/, 'NAVI'],
  [/\bzuno\b|\bedelweiss\b/, 'ZUNO'],
  [/\braheja\b/, 'RAHEJA'],
];

/** Words that appear in every insurer's registered name and identify none of them. */
const NOISE = /^(the|insurance|assurance|general|company|co|ltd|limited|india|indian|pvt|private)$/;

export function insurerShortForm(name: string | undefined): string {
  const clean = (name ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  for (const [re, short] of SHORT_FORMS) if (re.test(clean)) return short;
  const word = clean.split(' ').find((w) => !NOISE.test(w));
  return word ? word.toUpperCase().slice(0, 12) : '';
}
```

- [ ] **Step 4: Rewrite `folderNameFor`**

In `src/lib/documents/naming.ts`, replace the whole `folderNameFor` function
with:

```ts
/**
 * Spec D2: fixed at the first write. A surveyor looks for a claim by the
 * vehicle it was on and who insured it — `MH12AB1234 - NIA` — which is also
 * how SurveyOS Sync names its own folders.
 */
export function folderNameFor(claim: ClaimData): string {
  if (claim.documentsFolder) return claim.documentsFolder;
  const reg = sanitizeSegment(claim.vehicle?.registrationNumber?.trim() ?? '', '');
  const insurer = insurerShortForm(claim.policy?.insurerName);
  const name = [reg, insurer].filter(Boolean).join(' - ');
  if (name) return name;
  const claimNo = claim.policy?.claimNumber?.trim();
  return claimNo ? sanitizeSegment(claimNo, 'claim') : 'claim';
}
```

Add `import { insurerShortForm } from './insurers';` at the top.
`sanitizeSegment(raw, '')` with an empty fallback returns `''` for an empty
registration, which is what `filter(Boolean)` needs — confirm that behaviour
in `src/lib/local-sync/nomenclature.ts` and, if its fallback cannot be empty,
guard with `reg ? sanitizeSegment(reg, '') : ''`.

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/lib/documents && npx tsc --noEmit -p tsconfig.json`
Expected: all pass; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documents/insurers.ts src/lib/documents/__tests__/insurers.test.ts src/lib/documents/naming.ts src/lib/documents/__tests__/naming.test.ts
git commit -m "feat(documents): name claim folders by vehicle and insurer short form

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Two claims never share a folder

**Files:**
- Modify: `src/lib/documents/folder.ts` (add `resolveFolderName`, use it in `writeDocuments`)

**Interfaces:**
- Consumes: `folderNameFor` (Task 1), `getAllClaims` from `@/lib/storage/indexeddb`.
- Produces: `resolveFolderName(claim: ClaimData): Promise<string>`.

- [ ] **Step 1: Implement**

Add to `src/lib/documents/folder.ts`, above `writeDocuments`:

```ts
/**
 * The folder name a claim should use, with collisions resolved. Two accidents
 * on the same truck with the same insurer produce the same base name; the
 * second claim gets ` - 2` so their files never mix. Runs once per claim —
 * `documentsFolder` is sticky after the first write.
 */
export async function resolveFolderName(claim: ClaimData): Promise<string> {
  if (claim.documentsFolder) return claim.documentsFolder;
  const base = folderNameFor(claim);
  let taken = new Set<string>();
  try {
    const all = await getAllClaims();
    taken = new Set(all.filter((c) => c.id !== claim.id && c.documentsFolder).map((c) => c.documentsFolder as string));
  } catch {
    return base; // no claim store available — the base name is still better than nothing
  }
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base} - ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base} - ${claim.id.slice(-6)}`;
}
```

with `import { getAllClaims } from '@/lib/storage/indexeddb';`.

In `writeDocuments`, replace `const folder = folderNameFor(claim);` with:

```ts
  const folder = await resolveFolderName(claim);
```

`readDocument` and `claimFolderPath` keep using `folderNameFor(claim)` —
by the time either runs, `documentsFolder` is set and `folderNameFor`
returns it unchanged.

- [ ] **Step 2: Verify**

Run: `npx vitest run src/lib/documents && npx tsc --noEmit -p tsconfig.json`
Expected: all pass; tsc clean. (`resolveFolderName` touches IndexedDB, so it
is covered by the manual check in Task 5, not a unit test.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/documents/folder.ts
git commit -m "fix(documents): two claims on one vehicle and insurer get separate folders

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Scan the folder

**Files:**
- Modify: `src/lib/documents/naming.ts` (+ `docTypeFromRelPath`, `isScanSkippable`)
- Modify: `src/lib/documents/__tests__/naming.test.ts` (+ two describe blocks)
- Modify: `src/lib/documents/index-ops.ts` (+ `addDeviceTo`)
- Modify: `src/lib/documents/__tests__/index-ops.test.ts` (+ one describe block)
- Modify: `src/lib/documents/folder.ts` (+ `getClaimDirHandle`, `scanClaimFolder`)

**Interfaces:**
- Produces:
```ts
// naming.ts
export function docTypeFromRelPath(relPath: string): DocType;   // by subfolder, else by file stem, else 'other'
export function isScanSkippable(relPath: string): boolean;      // .part, the sync manifest, "(old)" copies
// index-ops.ts
export function addDeviceTo(claim: ClaimData, id: string, label: string): ClaimData;
// folder.ts
export async function getClaimDirHandle(claim: ClaimData, create?: boolean): Promise<FileSystemDirectoryHandle | null>;
export async function scanClaimFolder(claim: ClaimData): Promise<{ claim: ClaimData; added: number; adopted: number }>;
```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/documents/__tests__/naming.test.ts`:

```ts
describe('docTypeFromRelPath', () => {
  it('reads a top-level file from its own name', () => {
    expect(docTypeFromRelPath('RC Book.pdf')).toBe('rc');
    expect(docTypeFromRelPath('Final Survey Report.pdf')).toBe('surveyReport');
    expect(docTypeFromRelPath('Primary Assessment Template.xlsx')).toBe('niaAssessmentExcel');
  });
  it('ignores case and a numbered suffix', () => {
    expect(docTypeFromRelPath('rc book 2.jpg')).toBe('rc');
    expect(docTypeFromRelPath('Driving Licence 10.jpg')).toBe('dl');
  });
  it('reads a file in a subfolder from the subfolder', () => {
    expect(docTypeFromRelPath('Damage Photos/Damage Photos 3.jpg')).toBe('damagePhotos');
    expect(docTypeFromRelPath('Spot Photos/whatever the camera called it.jpg')).toBe('spotPhotos');
  });
  it('falls back to other', () => {
    expect(docTypeFromRelPath('scan0001.pdf')).toBe('other');
    expect(docTypeFromRelPath('Random Folder/thing.pdf')).toBe('other');
  });
});

describe('isScanSkippable', () => {
  it('skips our own working files and superseded copies', () => {
    expect(isScanSkippable('RC Book.pdf.part')).toBe(true);
    expect(isScanSkippable('_surveyos-sync.json')).toBe(true);
    expect(isScanSkippable('RC Book (old).pdf')).toBe(true);
    expect(isScanSkippable('Final Survey Report (old 3).html')).toBe(true);
  });
  it('keeps ordinary files', () => {
    expect(isScanSkippable('RC Book.pdf')).toBe(false);
    expect(isScanSkippable('Damage Photos/Damage Photos 1.jpg')).toBe(false);
  });
});
```

Append to `src/lib/documents/__tests__/index-ops.test.ts`:

```ts
describe('addDeviceTo', () => {
  it('adds this device to an entry written elsewhere', () => {
    const c = addDocuments(createBlankClaim(), [doc({ id: 'a', devices: ['Office PC'] })]);
    const next = addDeviceTo(c, 'a', 'Laptop');
    expect(next.documents!.a.devices).toEqual(['Office PC', 'Laptop']);
  });
  it('is a no-op when the device is already listed or the id is unknown', () => {
    const c = addDocuments(createBlankClaim(), [doc({ id: 'a', devices: ['Office PC'] })]);
    expect(addDeviceTo(c, 'a', 'Office PC').documents!.a.devices).toEqual(['Office PC']);
    expect(addDeviceTo(c, 'nope', 'Laptop')).toEqual(c);
  });
});
```

Add `docTypeFromRelPath`, `isScanSkippable` to the `../naming` import and
`addDeviceTo` to the `../index-ops` import in those files.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/documents`
Expected: FAIL — the three functions are not exported.

- [ ] **Step 3: Implement the pure helpers**

Append to `src/lib/documents/naming.ts`:

```ts
/** Label → type, built once. Labels are unique by construction. */
const TYPE_BY_LABEL = new Map<string, DocType>(
  (Object.entries(DOC_TYPE_LABEL) as Array<[DocType, string]>).map(([type, label]) => [label.toLowerCase(), type]),
);

/**
 * What a file found on disk is, judged only by its own name: a file inside a
 * subfolder takes the subfolder's type, a top-level file takes its stem with
 * any trailing number dropped. Anything we cannot place is `other` — the
 * surveyor can retype it in the list.
 */
export function docTypeFromRelPath(relPath: string): DocType {
  const parts = relPath.split('/');
  if (parts.length > 1) return TYPE_BY_LABEL.get(parts[0].toLowerCase().trim()) ?? 'other';
  const stem = parts[0].replace(/\.[^.]+$/, '').replace(/\s+\d+$/, '').toLowerCase().trim();
  return TYPE_BY_LABEL.get(stem) ?? 'other';
}

/** Our own working files and superseded copies are not documents. */
export function isScanSkippable(relPath: string): boolean {
  const name = relPath.split('/').pop() ?? '';
  return name.endsWith('.part')
    || name.startsWith('_')
    || / \(old(?: \d+)?\)\.[^.]+$/.test(name);
}
```

with `DocType` and `DOC_TYPE_LABEL` already imported in that file.

Append to `src/lib/documents/index-ops.ts`:

```ts
/** Record that this device also holds an entry's bytes (after a folder scan). */
export function addDeviceTo(claim: ClaimData, id: string, label: string): ClaimData {
  const doc = claim.documents?.[id];
  if (!doc || doc.devices.includes(label)) return claim;
  return {
    ...claim,
    documents: { ...claim.documents, [id]: { ...doc, devices: [...doc.devices, label] } },
  };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/documents`
Expected: all pass (6 new naming cases, 2 new index-ops cases).

- [ ] **Step 5: Implement the walk**

Append to `src/lib/documents/folder.ts`:

```ts
/** The claim's directory handle, or null when there is no folder or it was never created. */
export async function getClaimDirHandle(
  claim: ClaimData,
  create = false,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const rootHandle = await root();
    return await rootHandle.getDirectoryHandle(folderNameFor(claim), { create });
  } catch {
    return null;
  }
}

/** Every file in the claim folder, one level of subfolders deep, as relative paths. */
async function listFiles(dir: FileSystemDirectoryHandle, prefix = ''): Promise<Array<{ relPath: string; file: File }>> {
  const out: Array<{ relPath: string; file: File }> = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file') {
      out.push({ relPath: `${prefix}${name}`, file: await handle.getFile() });
    } else if (!prefix) {
      out.push(...(await listFiles(handle, `${name}/`)));
    }
  }
  return out;
}

/**
 * Adopt whatever is already in the claim folder: files put there by hand, a
 * PDF saved straight from Chrome, a Word export, or — on a second PC whose
 * root folder was copied or cloud-synced — the files an entry already
 * describes, which stop reading "on Office PC" and start reading "here".
 *
 * Reads only. Nothing on disk is written, renamed or deleted.
 */
export async function scanClaimFolder(
  claim: ClaimData,
): Promise<{ claim: ClaimData; added: number; adopted: number }> {
  const dir = await getClaimDirHandle(claim);
  if (!dir) throw new NoFolderError();
  const device = await getDeviceLabel();
  const found = await listFiles(dir);

  const byPath = new Map(claimDocuments(claim).map((d) => [d.relPath, d]));
  let next: ClaimData = { ...claim, documentsFolder: folderNameFor(claim) };
  const fresh: ClaimDocument[] = [];
  let adopted = 0;

  for (const { relPath, file } of found) {
    if (isScanSkippable(relPath)) continue;
    const known = byPath.get(relPath);
    if (known) {
      if (!onThisDevice(known, device)) { next = addDeviceTo(next, known.id, device); adopted++; }
      continue;
    }
    fresh.push({
      id: newDocId(),
      type: docTypeFromRelPath(relPath),
      relPath,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      addedAt: new Date(file.lastModified).toISOString(),
      source: 'upload', // found on disk — never treated as a placeholder we may delete
      devices: [device],
    });
  }

  return { claim: addDocuments(next, fresh), added: fresh.length, adopted };
}
```

Extend the existing imports: `addDeviceTo` from `./index-ops`;
`docTypeFromRelPath`, `isScanSkippable` from `./naming`; `ClaimDocument`
type if not already imported.

`dir.entries()` is an async iterator on `FileSystemDirectoryHandle`. If tsc
reports it missing, add to `src/lib/local-sync/fs-access.d.ts` inside
`interface FileSystemDirectoryHandle`:

```ts
  entries?(): AsyncIterableIterator<[string, FileSystemHandle]>
```

and call it as `(dir.entries as () => AsyncIterableIterator<[string, FileSystemHandle]>)()`.

- [ ] **Step 6: Verify**

Run: `npx vitest run src/lib/documents && npx tsc --noEmit -p tsconfig.json`
Expected: all pass; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/documents/naming.ts src/lib/documents/index-ops.ts src/lib/documents/folder.ts src/lib/documents/__tests__/naming.test.ts src/lib/documents/__tests__/index-ops.test.ts
git commit -m "feat(documents): scan a claim folder and adopt what is already in it

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Scan button, and the PDF picker opens in the claim folder

**Files:**
- Modify: `src/lib/documents/useClaimDocuments.ts` (+ `scan`)
- Modify: `src/components/documents/ClaimDocumentsList.tsx` (+ the button)
- Modify: `src/lib/documents/print-followup.ts` (`startIn`, wording)
- Modify: `src/lib/local-sync/fs-access.d.ts` (`startIn` on the picker options)

**Interfaces:**
- Consumes: `scanClaimFolder`, `getClaimDirHandle` (Task 3).
- Produces: `scan: () => Promise<void>` on the hook's return object.

- [ ] **Step 1: Hook**

In `src/lib/documents/useClaimDocuments.ts`, add alongside `addFiles`:

```ts
  const scan = useCallback(async () => {
    if (!claim) return;
    try {
      const handle = await getStoredRootHandle();
      if (handle && !(await ensureReadWrite(handle))) { toast.error('Folder access was not granted.'); return; }
      const { claim: next, added, adopted } = await scanClaimFolder(claim);
      if (added === 0 && adopted === 0) { toast.info('Nothing new in the claim folder.'); return; }
      updateClaim({ documents: next.documents, documentsFolder: next.documentsFolder });
      const parts = [added ? `${added} file${added === 1 ? '' : 's'} added` : '', adopted ? `${adopted} now on this PC` : '']
        .filter(Boolean).join(', ');
      toast.success(`Scanned the claim folder — ${parts}.`);
    } catch (err) {
      toast.error(err instanceof NoFolderError
        ? 'This claim has no folder on this PC yet.'
        : `Could not scan the folder (${err instanceof Error ? err.message : String(err)})`);
    }
  }, [claim, updateClaim]);
```

Import `scanClaimFolder` and `NoFolderError` from `./folder`, and add `scan`
to the returned object. `ensureReadWrite` is already imported for `reconnect`.

- [ ] **Step 2: Button**

In `src/components/documents/ClaimDocumentsList.tsx`: add `onScan: () => void`
to `Props`, import `RefreshCw` from `lucide-react`, and put this immediately
before the **Add file** button inside the `{connected && (…)}` toolbar:

```tsx
            <button
              onClick={onScan}
              title="Look in the claim folder and add anything that is there but not listed"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-border"
            >
              <RefreshCw size={12} /> Scan folder
            </button>
```

Update the empty state so it points at the new button:

```tsx
          {connected ? 'Nothing yet. Uploads, photos and printed reports appear here — or press Scan folder to pull in files already in the folder.' : 'Connect a claim folder to keep files here.'}
```

In `src/components/tabs/DocumentsTab.tsx`, pass `onScan={docs.scan}`.

- [ ] **Step 3: Picker opens in the claim folder**

In `src/lib/local-sync/fs-access.d.ts`, add `startIn` to the
`showOpenFilePicker` options type:

```ts
    startIn?: FileSystemDirectoryHandle | 'desktop' | 'documents' | 'downloads'
```

In `src/lib/documents/print-followup.ts`, give `pickPdf` the directory and
use it:

```ts
async function pickPdf(label: string, startIn: FileSystemDirectoryHandle | null): Promise<File | null> {
  if (typeof window === 'undefined' || !window.showOpenFilePicker) return null;
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    excludeAcceptAllOption: true,
    ...(startIn ? { startIn } : {}),
    types: [{ description: `${label} (PDF)`, accept: { 'application/pdf': ['.pdf'] } }],
  });
  return handle ? handle.getFile() : null;
}
```

In the action's `onClick`, resolve the directory first so the picker lands
there:

```ts
        void getClaimDirHandle(useClaimStore.getState().currentClaim!)
          .then((dir) => pickPdf(label, dir))
          .then((file) => (file && file.type === 'application/pdf'
            ? saveDocuments(type, [{ blob: file, name: file.name }], 'generated')
            : null))
          .then((saved) => { if (saved) toast.dismiss(id); })
          .catch((e: unknown) => { … unchanged … });
```

(the claim-id guard above it already returned if the claim changed, so the
non-null assertion is safe — keep the guard first). Import
`getClaimDirHandle` from `./folder`.

Change the toast's description to tell them where to save it:

```ts
    description: 'Save it into the claim folder, then file it here so the list holds the copy you sent.',
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run src/lib/documents src/lib/reports`
Expected: clean; all pass.
Run: `npx eslint src/lib/documents src/components/documents`
Expected: 0 errors.

The browser check is the controller's — mark NOT RUN.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/useClaimDocuments.ts src/components/documents/ClaimDocumentsList.tsx src/components/tabs/DocumentsTab.tsx src/lib/documents/print-followup.ts src/lib/local-sync/fs-access.d.ts
git commit -m "feat(documents): Scan folder button, and the PDF picker opens in the claim folder

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-20-claim-documents-design.md`

- [ ] **Step 1: D2**

Replace rule D2's text with:

```markdown
| D2 | **One root folder, picked once**, via the File System Access API (desktop Chrome/Edge). Same root and handle store as local-sync. A claim's folder is named `<registration> - <INSURER SHORT>` (`MH12AB1234 - NIA`) — how a surveyor searches, and consistent with Sync's own folders — falling back to whichever part exists, then the claim number. It is decided at the **first write and stored on the claim** (`documentsFolder`), so later edits to the vehicle or insurer never move it. Two claims that would produce the same name get ` - 2`, ` - 3`. |
```

- [ ] **Step 2: Add the scan to §3.3 and §3.5**

In the §3.3 engine table add a row:

```markdown
| `insurers.ts` | **pure**: `insurerShortForm(name)` — the free-text insurer on a policy → `NIA`/`UIIC`/`ICICI`/… , first meaningful word when unknown | unit |
```

and extend the `folder.ts` row's description with
`; scanClaimFolder(claim) — read-only walk that indexes files already in the folder and adopts entries written on another device`.

In §3.5 (the UI section) add, after the toolbar description:

```markdown
**Scan folder** reads the claim folder and adds anything not already listed —
a PDF saved straight from Chrome, a Word export, files copied in by hand, or
a whole folder carried to a second PC, whose rows then change from
"on Office PC" to "here". It never writes, renames or deletes; a file it
cannot name is filed as *Other* and the surveyor can retype it.
```

- [ ] **Step 3: §6**

Under the out-of-scope list, strike the "Scan an existing folder" bullet
(it is now in) and leave the rest.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-20-claim-documents-design.md
git commit -m "docs: folder naming by vehicle and insurer, and the folder scan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review

**Coverage of what was asked.** Folder naming → Tasks 1 and 2 (the collision
suffix is the consequence of the chosen scheme, not scope creep). Scan folder
→ Task 3 and its button in Task 4; it covers the three gaps the review named:
existing claims, the unhooked Word export, and PDFs saved anywhere in the
folder. PDF friction → Task 4's `startIn` plus the reworded prompt. Docs →
Task 5.

**Placeholders.** None; every step carries its code. Two spots name a check
to run rather than assuming (`sanitizeSegment`'s empty fallback,
`dir.entries()` typing).

**Type consistency.** `docTypeFromRelPath(relPath): DocType` and
`isScanSkippable(relPath): boolean` take the same relative-path form
`writeDocuments` produces. `scanClaimFolder` returns
`{ claim, added, adopted }`, which is what the hook destructures.
`addDeviceTo(claim, id, label)` matches `onThisDevice(doc, label)`'s device
vocabulary. `getClaimDirHandle(claim, create?)` is used by both the scan and
the picker.

**Not in this plan** (from the same review, still open): making the photo tag
re-file a photo or removing the dropdown; "delete the file too"; the connect
card rewrite; a claim-list indicator; photos out of the record.
