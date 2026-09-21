# Claim Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every claim gets a typed document index on its record and a real
folder on the surveyor's PC holding the bytes — uploads, photos and
generated reports land there by type, and the Documents tab lists them.

**Architecture:** `claim.documents` (a `Record<id, ClaimDocument>`) is the
index and syncs with the claim like any field. Bytes go through one module,
`src/lib/documents/folder.ts`, into `<root>/<documentsFolder>/…` using the
File System Access API handle that `src/lib/local-sync/` already stores. A
single sink, `saveDocuments()`, is called from the six places files are
born: the Documents tab uploads (which the Sync picker also uses), the
estimate upload, the photo add, the five print triggers (which collapse
into one `openPrintWindow`), the NIA Excel and the insured-summary PDF.
The Documents tab gets a folder card and a typed list.

**Tech Stack:** TypeScript, React 19, Next.js 16, zustand, Vitest 4 (node
env — pure modules tested, browser modules manual), `idb`, File System
Access API (desktop Chromium), sonner toasts, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-20-claim-documents-design.md`
**Reuses:** `src/lib/local-sync/directory-handle.ts` (`getStoredRootHandle`, `pickRootFolder`, `ensureReadWrite`, `isLocalSyncSupported`), `src/lib/local-sync/nomenclature.ts` (`sanitizeSegment`, `extFor`).

## Global Constraints

- D1 — `claim.documents` holds metadata only; bytes never enter the claim record or IndexedDB.
- D2 — one root folder (local-sync's handle). The claim folder name is decided at the **first write and stored on the claim** (`documentsFolder`): sanitised claim number when present, else `<registration> - <insurer>`. Never recomputed once set.
- D3 — every entry has a `DocType` from the closed vocabulary; untyped → `other`.
- D5 — an entry records the device labels holding the bytes; other machines show "on <label>".
- D6 — generated outputs that exist as a `Blob`/string save themselves when a folder is connected; the browser download / print window still happens, unchanged.
- D7 — nothing existing is removed: photos stay as data URLs in the record; Drive uploads stay; the Sync picker stays.
- D8 — removing an index entry never deletes bytes; the toast names the path left on disk.
- D9 — `ensureReadWrite` is called **first** in every click-driven flow that ends in a write, before async work; a write without permission fails with a toast, never silently.
- D10 — index is `Record<string, ClaimDocument>`, read through `claimDocuments(claim)`.
- Folder layout: single-file types → `<Label>.<ext>` (a batch of N>1 → `<Label> 1.<ext>`…); multi-file types (`damagePhotos`, `spotPhotos`, `other`) → `<Label>/<Label> <n>.<ext>` numbered after the highest existing n. A new single-file batch **replaces** that type's entries; the old files are renamed `<Label> (old).<ext>` (`(old 2)`, … if taken).
- Print-based reports save their **HTML** (`text/html`) at print time; a PDF added later with the same type replaces it.
- Deviations from the spec, decided here: (a) Drive `copies.driveFileId` is **not** recorded — `uploadFileToDrive` returns no id; the tab's existing Drive list is the cross-machine fallback. (b) `copies.syncRef` is not recorded — Sync-picked files reach `processFiles` like uploads and are saved with `source: 'upload'`. (c) Word export (6 untyped callers) is not hooked. (d) `insuredSummary` is added to the vocabulary (spec named the PDF but not a type). Task 8 writes these into the spec.
- Git: `git add` explicit paths only — never `git add -A` / `git add .` (untracked `design/` must not be committed). Trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Tests: `npx vitest run <path>`; `npx tsc --noEmit -p tsconfig.json` clean before each commit that touches `.ts/.tsx`.

---

## File map

| Path | Responsibility |
|---|---|
| `src/types/documents.ts` | `DocType`, `ClaimDocument`, `PhotoTag`, `DOC_TYPE_LABEL`, `MULTI_FILE_TYPES`, `FIELD_KEY_TO_DOC_TYPE`, `tagToDocType` |
| `src/types/claim.ts` | + `documents?`, `documentsFolder?` |
| `src/types/assessment.ts` | + `PhotoItem.tag?` |
| `src/lib/documents/index-ops.ts` | pure: `claimDocuments`, `addDocuments`, `replaceByType`, `removeDocument`, `onThisDevice`, `newDocId` |
| `src/lib/documents/naming.ts` | pure: `folderNameFor`, `relPathsFor`, `oldNameFor` |
| `src/lib/documents/folder.ts` | browser: device label, `writeDocuments`, `readDocument`, `openDocument`, typed errors |
| `src/lib/documents/sink.ts` | browser: `saveDocuments(type, files, source)` — folder + store in one call; silent no-op when no folder |
| `src/lib/documents/useClaimDocuments.ts` | hook for the UI |
| `src/lib/reports/print-shell.ts` | + `openPrintWindow(html)` |
| five `trigger*Print` functions | call `openPrintWindow` + `saveDocuments` |
| `src/lib/reports/nia-assessment-excel.ts`, `src/components/tabs/InsuredReportTab.tsx` | + `saveDocuments` |
| `src/components/tabs/DocumentsTab.tsx`, `AssessmentTab.tsx`, `PhotosTab.tsx` | + `saveDocuments`; photo tag select |
| `src/components/documents/ClaimFolderCard.tsx`, `ClaimDocumentsList.tsx` | the new UI |
| tests | `src/lib/documents/__tests__/index-ops.test.ts`, `naming.test.ts`, `src/types/__tests__/documents.test.ts` |

---

### Task 1: Vocabulary and types

**Files:**
- Create: `src/types/documents.ts`
- Modify: `src/types/claim.ts` (interface `ClaimData`, after the `gDriveFolderId` line ~181; nothing in `createBlankClaim`)
- Modify: `src/types/assessment.ts:313-326` (`PhotoItem`)
- Test: `src/types/__tests__/documents.test.ts`

**Interfaces:**
- Produces:

```ts
export type DocType = 'rc'|'dl'|'policy'|'claimForm'|'estimate'|'supplementaryEstimate'|'invoice'|'fir'|'puc'|'permit'|'fitness'|'cancelledCheque'|'chassisPhoto'|'odometerPhoto'|'photoFront'|'photoRear'|'photoLeft'|'photoRight'|'spotPhotos'|'damagePhotos'|'surveyReport'|'billCheckReport'|'feeBill'|'reinspectionReport'|'niaAssessmentExcel'|'insuredSummary'|'workApproval'|'deliveryOrder'|'other';
export type PhotoTag = 'front'|'rear'|'left'|'right'|'chassis'|'odometer'|'spot'|'damage';
export interface ClaimDocument { id: string; type: DocType; relPath: string; mime: string; size: number; addedAt: string; source: 'upload'|'generated'|'photo'; devices: string[] }
export const DOC_TYPE_LABEL: Record<DocType, string>;
export const MULTI_FILE_TYPES: ReadonlySet<DocType>;            // damagePhotos, spotPhotos, other
export const FIELD_KEY_TO_DOC_TYPE: Record<string, DocType>;    // DocumentsTab keys
export function tagToDocType(tag: PhotoTag | undefined): DocType;
```
- `ClaimData` gains `documents?: Record<string, ClaimDocument>; documentsFolder?: string;`
- `PhotoItem` gains `tag?: PhotoTag;`

- [ ] **Step 1: Write the failing test**

```ts
// src/types/__tests__/documents.test.ts
import { describe, it, expect } from 'vitest';
import { DOC_TYPE_LABEL, MULTI_FILE_TYPES, FIELD_KEY_TO_DOC_TYPE, tagToDocType } from '../documents';

describe('document vocabulary', () => {
  it('labels every type and labels are Windows-safe file stems', () => {
    for (const [type, label] of Object.entries(DOC_TYPE_LABEL)) {
      expect(label, type).toMatch(/^[A-Za-z0-9 ()-]+$/);
    }
    expect(DOC_TYPE_LABEL.rc).toBe('RC Book');
    expect(DOC_TYPE_LABEL.surveyReport).toBe('Final Survey Report');
    expect(DOC_TYPE_LABEL.niaAssessmentExcel).toBe('Primary Assessment Template');
  });
  it('multi-file types are exactly the three', () => {
    expect([...MULTI_FILE_TYPES].sort()).toEqual(['damagePhotos', 'other', 'spotPhotos']);
  });
  it('maps every Documents-tab field key', () => {
    const keys = ['rc', 'dl', 'policy', 'claim', 'fir', 'final-bill', 'permit', 'auth', 'fitness', 'load-challan'];
    for (const k of keys) expect(FIELD_KEY_TO_DOC_TYPE[k], k).toBeDefined();
    expect(FIELD_KEY_TO_DOC_TYPE['claim']).toBe('claimForm');
    expect(FIELD_KEY_TO_DOC_TYPE['final-bill']).toBe('invoice');
    expect(FIELD_KEY_TO_DOC_TYPE['auth']).toBe('other');
  });
  it('maps photo tags, defaulting to damage', () => {
    expect(tagToDocType('odometer')).toBe('odometerPhoto');
    expect(tagToDocType('front')).toBe('photoFront');
    expect(tagToDocType('spot')).toBe('spotPhotos');
    expect(tagToDocType(undefined)).toBe('damagePhotos');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/types/__tests__/documents.test.ts`
Expected: FAIL — cannot resolve `../documents`.

- [ ] **Step 3: Implement**

```ts
// src/types/documents.ts
/**
 * Claim Documents — the typed index that lives on the claim record.
 * Bytes live in the surveyor's folder (src/lib/documents/folder.ts); this
 * file is metadata only (spec D1).
 */

export type DocType =
  | 'rc' | 'dl' | 'policy' | 'claimForm' | 'estimate' | 'supplementaryEstimate'
  | 'invoice' | 'fir' | 'puc' | 'permit' | 'fitness' | 'cancelledCheque'
  | 'chassisPhoto' | 'odometerPhoto' | 'photoFront' | 'photoRear' | 'photoLeft' | 'photoRight'
  | 'spotPhotos' | 'damagePhotos'
  | 'surveyReport' | 'billCheckReport' | 'feeBill' | 'reinspectionReport'
  | 'niaAssessmentExcel' | 'insuredSummary'
  | 'workApproval' | 'deliveryOrder' | 'other';

export type PhotoTag = 'front' | 'rear' | 'left' | 'right' | 'chassis' | 'odometer' | 'spot' | 'damage';

export interface ClaimDocument {
  id: string;
  type: DocType;
  /** Relative to the claim folder, e.g. "RC Book.pdf" or "Damage Photos/Damage Photos 3.jpg". */
  relPath: string;
  mime: string;
  size: number;
  addedAt: string;
  source: 'upload' | 'generated' | 'photo';
  /** Labels of the devices whose folder holds the bytes (spec D5). */
  devices: string[];
}

/** Human label; doubles as the file stem, so keep it Windows-safe. */
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  rc: 'RC Book',
  dl: 'Driving Licence',
  policy: 'Policy Schedule',
  claimForm: 'Claim Form',
  estimate: 'Estimate',
  supplementaryEstimate: 'Supplementary Estimate',
  invoice: 'Invoice',
  fir: 'FIR',
  puc: 'PUC',
  permit: 'Permit',
  fitness: 'Fitness Certificate',
  cancelledCheque: 'Cancelled Cheque',
  chassisPhoto: 'Chassis Number Photo',
  odometerPhoto: 'Odometer Photo',
  photoFront: 'Front Photo',
  photoRear: 'Rear Photo',
  photoLeft: 'Left Side Photo',
  photoRight: 'Right Side Photo',
  spotPhotos: 'Spot Photos',
  damagePhotos: 'Damage Photos',
  surveyReport: 'Final Survey Report',
  billCheckReport: 'Bill Check Report',
  feeBill: 'Fee Bill',
  reinspectionReport: 'Reinspection Report',
  niaAssessmentExcel: 'Primary Assessment Template',
  insuredSummary: 'Insured Summary',
  workApproval: 'Work Approval',
  deliveryOrder: 'Delivery Order',
  other: 'Other',
};

/** Types that hold many files in a subfolder; everything else is one file per claim. */
export const MULTI_FILE_TYPES: ReadonlySet<DocType> = new Set<DocType>(['damagePhotos', 'spotPhotos', 'other']);

/** DocumentsTab slot id → document type. Slots with no portal meaning go to `other`. */
export const FIELD_KEY_TO_DOC_TYPE: Record<string, DocType> = {
  rc: 'rc',
  dl: 'dl',
  policy: 'policy',
  claim: 'claimForm',
  fir: 'fir',
  'final-bill': 'invoice',
  permit: 'permit',
  auth: 'other',
  fitness: 'fitness',
  'load-challan': 'other',
};

const TAG_TO_DOC_TYPE: Record<PhotoTag, DocType> = {
  front: 'photoFront',
  rear: 'photoRear',
  left: 'photoLeft',
  right: 'photoRight',
  chassis: 'chassisPhoto',
  odometer: 'odometerPhoto',
  spot: 'spotPhotos',
  damage: 'damagePhotos',
};

export function tagToDocType(tag: PhotoTag | undefined): DocType {
  return TAG_TO_DOC_TYPE[tag ?? 'damage'];
}
```

In `src/types/claim.ts`, add the import `import type { ClaimDocument } from './documents';` next to the other type imports, and inside `ClaimData` after the `gDriveFolderId: string | null;` line:

```ts
  // ─── Claim Documents ───────────────────────────────────
  /** Typed index of this claim's files; bytes live in the surveyor's folder. Undefined on old claims. */
  documents?: Record<string, ClaimDocument>;
  /** Folder name under the surveyor's root, fixed at the first write (spec D2). */
  documentsFolder?: string;
```

In `src/types/assessment.ts`, add `import type { PhotoTag } from './documents';` at the top and inside `PhotoItem` after `kind?`:

```ts
  /** Which portal slot the shot is for. Undefined = an ordinary damage photo. */
  tag?: PhotoTag;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/types/__tests__/documents.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: 4 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/types/documents.ts src/types/claim.ts src/types/assessment.ts src/types/__tests__/documents.test.ts
git commit -m "feat(documents): typed document vocabulary and index fields on the claim

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure index operations and naming

**Files:**
- Create: `src/lib/documents/index-ops.ts`, `src/lib/documents/naming.ts`
- Test: `src/lib/documents/__tests__/index-ops.test.ts`, `src/lib/documents/__tests__/naming.test.ts`

**Interfaces:**
- Consumes: Task 1 types; `sanitizeSegment`, `extFor` from `@/lib/local-sync/nomenclature`.
- Produces:

```ts
// index-ops.ts — every function returns a new claim, never mutates
export function newDocId(): string;                                             // `doc-<ts>-<rand6>`
export function claimDocuments(claim: Pick<ClaimData,'documents'>): ClaimDocument[];   // sorted by addedAt asc
export function addDocuments(claim: ClaimData, docs: ClaimDocument[]): ClaimData;
export function replaceByType(claim: ClaimData, type: DocType, docs: ClaimDocument[]): { claim: ClaimData; replaced: ClaimDocument[] };
export function removeDocument(claim: ClaimData, id: string): ClaimData;
export function onThisDevice(doc: ClaimDocument, label: string): boolean;

// naming.ts
export function folderNameFor(claim: ClaimData): string;                        // sticky: documentsFolder ?? claimNo ?? "<reg> - <insurer>"
export function extForFile(mime: string, fileName?: string): string;            // pdf|png|jpg|xlsx|html|doc|… from mime, else file name, else 'bin'
export function relPathsFor(type: DocType, files: { mime: string; name?: string }[], existing: ClaimDocument[]): string[];
export function oldNameFor(relPath: string, taken: ReadonlySet<string>): string; // "RC Book (old).pdf", "(old 2)" …
```

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/documents/__tests__/index-ops.test.ts
import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimDocument } from '@/types/documents';
import { claimDocuments, addDocuments, replaceByType, removeDocument, onThisDevice, newDocId } from '../index-ops';

const doc = (p: Partial<ClaimDocument>): ClaimDocument => ({
  id: p.id ?? newDocId(), type: 'rc', relPath: 'RC Book.pdf', mime: 'application/pdf', size: 10,
  addedAt: '2026-09-21T10:00:00Z', source: 'upload', devices: ['Office PC'], ...p,
});

describe('index-ops', () => {
  it('claimDocuments is [] on old claims and sorted by addedAt', () => {
    const c = createBlankClaim();
    expect(claimDocuments(c)).toEqual([]);
    const c2 = addDocuments(c, [doc({ id: 'b', addedAt: '2026-09-21T11:00:00Z' }), doc({ id: 'a', addedAt: '2026-09-21T09:00:00Z' })]);
    expect(claimDocuments(c2).map((d) => d.id)).toEqual(['a', 'b']);
  });
  it('addDocuments does not mutate and keys by id', () => {
    const c = createBlankClaim();
    const c2 = addDocuments(c, [doc({ id: 'x' })]);
    expect(c.documents).toBeUndefined();
    expect(c2.documents?.x.type).toBe('rc');
  });
  it('replaceByType swaps all entries of that type and reports the replaced ones', () => {
    const c = addDocuments(createBlankClaim(), [doc({ id: 'old1' }), doc({ id: 'old2', relPath: 'RC Book 2.pdf' }), doc({ id: 'dl', type: 'dl', relPath: 'Driving Licence.jpg' })]);
    const { claim, replaced } = replaceByType(c, 'rc', [doc({ id: 'new' })]);
    expect(Object.keys(claim.documents!).sort()).toEqual(['dl', 'new']);
    expect(replaced.map((d) => d.id).sort()).toEqual(['old1', 'old2']);
  });
  it('removeDocument drops one id', () => {
    const c = addDocuments(createBlankClaim(), [doc({ id: 'a' }), doc({ id: 'b' })]);
    expect(Object.keys(removeDocument(c, 'a').documents!)).toEqual(['b']);
  });
  it('onThisDevice', () => {
    expect(onThisDevice(doc({}), 'Office PC')).toBe(true);
    expect(onThisDevice(doc({}), 'Laptop')).toBe(false);
  });
  it('newDocId is unique-ish and prefixed', () => {
    expect(newDocId()).toMatch(/^doc-\d+-[a-z0-9]{6}$/);
    expect(newDocId()).not.toBe(newDocId());
  });
});
```

```ts
// src/lib/documents/__tests__/naming.test.ts
import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimDocument } from '@/types/documents';
import { folderNameFor, extForFile, relPathsFor, oldNameFor } from '../naming';

const existing = (relPaths: string[], type: ClaimDocument['type'] = 'damagePhotos'): ClaimDocument[] =>
  relPaths.map((relPath, i) => ({ id: `d${i}`, type, relPath, mime: 'image/jpeg', size: 1, addedAt: '', source: 'photo', devices: [] }));

describe('folderNameFor', () => {
  it('is sticky once set', () => {
    const c = createBlankClaim(); c.documentsFolder = 'KEEP-ME'; c.policy.claimNumber = '3101/1';
    expect(folderNameFor(c)).toBe('KEEP-ME');
  });
  it('uses the sanitised claim number, else registration - insurer, else claim', () => {
    const c = createBlankClaim(); c.policy.claimNumber = '3101/00312/24-C';
    expect(folderNameFor(c)).toBe('3101 00312 24-C');
    c.policy.claimNumber = ''; c.vehicle.registrationNumber = 'MH12AB1234'; c.policy.insurerName = 'New India';
    expect(folderNameFor(c)).toBe('MH12AB1234 - New India');
    c.vehicle.registrationNumber = ''; c.policy.insurerName = '';
    expect(folderNameFor(c)).toBe('claim');
  });
});

describe('extForFile', () => {
  it('prefers mime, falls back to the file name, then bin', () => {
    expect(extForFile('application/pdf')).toBe('pdf');
    expect(extForFile('image/png')).toBe('png');
    expect(extForFile('image/jpeg')).toBe('jpg');
    expect(extForFile('text/html')).toBe('html');
    expect(extForFile('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('xlsx');
    expect(extForFile('application/msword')).toBe('doc');
    expect(extForFile('', 'scan.HEIC')).toBe('heic');
    expect(extForFile('', 'noext')).toBe('bin');
  });
});

describe('relPathsFor', () => {
  it('single-file type, one file → flat label', () => {
    expect(relPathsFor('rc', [{ mime: 'application/pdf' }], [])).toEqual(['RC Book.pdf']);
  });
  it('single-file type, batch → numbered flat files', () => {
    expect(relPathsFor('rc', [{ mime: 'image/jpeg' }, { mime: 'image/jpeg' }], [])).toEqual(['RC Book 1.jpg', 'RC Book 2.jpg']);
  });
  it('multi-file type → subfolder, numbering continues after the highest existing', () => {
    const ex = existing(['Damage Photos/Damage Photos 1.jpg', 'Damage Photos/Damage Photos 7.jpg']);
    expect(relPathsFor('damagePhotos', [{ mime: 'image/jpeg' }, { mime: 'image/png' }], ex))
      .toEqual(['Damage Photos/Damage Photos 8.jpg', 'Damage Photos/Damage Photos 9.png']);
  });
  it('multi-file numbering ignores other types', () => {
    const ex = existing(['Spot Photos/Spot Photos 3.jpg'], 'spotPhotos');
    expect(relPathsFor('damagePhotos', [{ mime: 'image/jpeg' }], ex)).toEqual(['Damage Photos/Damage Photos 1.jpg']);
  });
});

describe('oldNameFor', () => {
  it('inserts (old) before the extension and counts up when taken', () => {
    expect(oldNameFor('RC Book.pdf', new Set())).toBe('RC Book (old).pdf');
    expect(oldNameFor('RC Book.pdf', new Set(['RC Book (old).pdf']))).toBe('RC Book (old 2).pdf');
    expect(oldNameFor('Final Survey Report.html', new Set(['Final Survey Report (old).html', 'Final Survey Report (old 2).html']))).toBe('Final Survey Report (old 3).html');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/documents`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/documents/index-ops.ts
/** Pure operations on the claim's document index. Every function returns a new claim. */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';

export function newDocId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function claimDocuments(claim: Pick<ClaimData, 'documents'>): ClaimDocument[] {
  return Object.values(claim.documents ?? {}).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export function addDocuments(claim: ClaimData, docs: ClaimDocument[]): ClaimData {
  const documents = { ...(claim.documents ?? {}) };
  for (const d of docs) documents[d.id] = d;
  return { ...claim, documents };
}

/** Swap every entry of `type` for `docs`; the caller renames the replaced files on disk. */
export function replaceByType(
  claim: ClaimData,
  type: DocType,
  docs: ClaimDocument[],
): { claim: ClaimData; replaced: ClaimDocument[] } {
  const replaced = claimDocuments(claim).filter((d) => d.type === type);
  const documents: Record<string, ClaimDocument> = {};
  for (const [id, d] of Object.entries(claim.documents ?? {})) if (d.type !== type) documents[id] = d;
  for (const d of docs) documents[d.id] = d;
  return { claim: { ...claim, documents }, replaced };
}

export function removeDocument(claim: ClaimData, id: string): ClaimData {
  const documents = { ...(claim.documents ?? {}) };
  delete documents[id];
  return { ...claim, documents };
}

export function onThisDevice(doc: ClaimDocument, label: string): boolean {
  return doc.devices.includes(label);
}
```

```ts
// src/lib/documents/naming.ts
/** Pure naming: which folder a claim lives in and where each file goes inside it. */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { DOC_TYPE_LABEL, MULTI_FILE_TYPES } from '@/types/documents';
import { sanitizeSegment } from '@/lib/local-sync/nomenclature';

/** Spec D2: fixed at the first write. Claim number first; vehicle − insurer as the fallback. */
export function folderNameFor(claim: ClaimData): string {
  if (claim.documentsFolder) return claim.documentsFolder;
  const claimNo = claim.policy?.claimNumber?.trim();
  if (claimNo) return sanitizeSegment(claimNo, 'claim');
  const reg = claim.vehicle?.registrationNumber?.trim() ?? '';
  const insurer = claim.policy?.insurerName?.trim() ?? '';
  return reg || insurer ? sanitizeSegment(`${reg} - ${insurer}`.replace(/^ - | - $/g, ''), 'claim') : 'claim';
}

const MIME_EXT: Array<[RegExp, string]> = [
  [/pdf/, 'pdf'], [/png/, 'png'], [/jpe?g/, 'jpg'], [/gif/, 'gif'], [/webp/, 'webp'], [/heic|heif/, 'heic'],
  [/text\/html/, 'html'], [/spreadsheetml|xlsx/, 'xlsx'], [/ms-excel/, 'xls'],
  [/wordprocessingml/, 'docx'], [/msword/, 'doc'], [/text\/plain/, 'txt'],
];

export function extForFile(mime: string, fileName?: string): string {
  for (const [re, ext] of MIME_EXT) if (re.test(mime)) return ext;
  const m = fileName?.match(/\.([A-Za-z0-9]{1,5})$/);
  return m ? m[1].toLowerCase() : 'bin';
}

function highestNumber(existing: ClaimDocument[], type: DocType, label: string): number {
  const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)\\.`);
  let max = 0;
  for (const d of existing) {
    if (d.type !== type) continue;
    const m = d.relPath.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** Relative paths for a batch of files of one type. Multi-file types number on from what exists. */
export function relPathsFor(
  type: DocType,
  files: { mime: string; name?: string }[],
  existing: ClaimDocument[],
): string[] {
  const label = DOC_TYPE_LABEL[type];
  if (MULTI_FILE_TYPES.has(type)) {
    const start = highestNumber(existing, type, label);
    return files.map((f, i) => `${label}/${label} ${start + i + 1}.${extForFile(f.mime, f.name)}`);
  }
  if (files.length === 1) return [`${label}.${extForFile(files[0].mime, files[0].name)}`];
  return files.map((f, i) => `${label} ${i + 1}.${extForFile(f.mime, f.name)}`);
}

/** "RC Book.pdf" → "RC Book (old).pdf", then "(old 2)" … until a free name. */
export function oldNameFor(relPath: string, taken: ReadonlySet<string>): string {
  const dot = relPath.lastIndexOf('.');
  const stem = dot > 0 ? relPath.slice(0, dot) : relPath;
  const ext = dot > 0 ? relPath.slice(dot) : '';
  let n = 1;
  for (;;) {
    const candidate = n === 1 ? `${stem} (old)${ext}` : `${stem} (old ${n})${ext}`;
    if (!taken.has(candidate)) return candidate;
    n += 1;
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/documents && npx tsc --noEmit -p tsconfig.json`
Expected: 15 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/index-ops.ts src/lib/documents/naming.ts src/lib/documents/__tests__/index-ops.test.ts src/lib/documents/__tests__/naming.test.ts
git commit -m "feat(documents): pure index operations and folder/file naming

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Folder engine and the sink

**Files:**
- Modify: `src/lib/local-sync/directory-handle.ts` (add device label)
- Create: `src/lib/documents/folder.ts`, `src/lib/documents/sink.ts`

**Interfaces:**
- Consumes: Task 2; `getStoredRootHandle`, `pickRootFolder`, `ensureReadWrite` from `@/lib/local-sync/directory-handle`; `useClaimStore` (`getState().currentClaim`, `getState().updateClaim(partial)`); `toast` from `sonner`.
- Produces:

```ts
// directory-handle.ts additions
export async function getDeviceLabel(): Promise<string>;                 // stored label or 'This PC'
export async function setDeviceLabel(label: string): Promise<void>;

// folder.ts
export class NoFolderError extends Error {}
export class PermissionDeniedError extends Error {}
export class NotOnThisDeviceError extends Error {}
export interface FolderInput { blob: Blob; name?: string }
export async function writeDocuments(claim: ClaimData, type: DocType, files: FolderInput[], source: ClaimDocument['source']): Promise<{ claim: ClaimData; written: ClaimDocument[] }>;
export async function readDocument(claim: ClaimData, doc: ClaimDocument): Promise<File>;   // throws the typed errors
export async function openDocument(claim: ClaimData, doc: ClaimDocument): Promise<void>;   // object URL in a new tab
export async function claimFolderPath(claim: ClaimData): Promise<string | null>;         // "<root name>\<folder>" for display

// sink.ts
export async function saveDocuments(type: DocType, files: FolderInput[], source: ClaimDocument['source']): Promise<ClaimDocument[]>;
// - no folder connected → returns [] silently (generated outputs still download; uploads still go to Drive)
// - permission refused → toast.error, returns []
// - success → writes bytes, updates the store's current claim (documents + documentsFolder), toast.success naming the folder
```

- [ ] **Step 1: Device label in `directory-handle.ts`**

Append after `ensureReadWrite`:

```ts
const DEVICE_KEY = 'device'

/** The name the surveyor gave this machine when connecting the folder (spec D5). */
export async function getDeviceLabel(): Promise<string> {
  const database = await db()
  const label = (await database.get(STORE, DEVICE_KEY)) as string | undefined
  return label?.trim() || 'This PC'
}

export async function setDeviceLabel(label: string): Promise<void> {
  const database = await db()
  await database.put(STORE, label.trim().slice(0, 40) || 'This PC', DEVICE_KEY)
}
```

(Same object store, different key — no schema bump.)

- [ ] **Step 2: `folder.ts`**

```ts
// src/lib/documents/folder.ts
/**
 * Bytes on disk. Wraps the File System Access API around the naming rules.
 * Browser-only; no unit tests (needs a real handle) — exercised manually.
 */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { MULTI_FILE_TYPES } from '@/types/documents';
import { getStoredRootHandle, ensureReadWrite, getDeviceLabel } from '@/lib/local-sync/directory-handle';
import { addDocuments, claimDocuments, newDocId, replaceByType, onThisDevice } from './index-ops';
import { folderNameFor, oldNameFor, relPathsFor } from './naming';

export class NoFolderError extends Error { constructor() { super('No claim folder is connected.'); } }
export class PermissionDeniedError extends Error { constructor() { super('Folder access was not granted.'); } }
export class NotOnThisDeviceError extends Error { constructor(where: string[]) { super(`This file is on ${where.join(', ') || 'another device'}.`); } }

export interface FolderInput { blob: Blob; name?: string }

async function root(): Promise<FileSystemDirectoryHandle> {
  const handle = await getStoredRootHandle();
  if (!handle) throw new NoFolderError();
  if (!(await ensureReadWrite(handle))) throw new PermissionDeniedError();
  return handle;
}

async function dirFor(rootHandle: FileSystemDirectoryHandle, segments: string[], create: boolean) {
  let dir = rootHandle;
  for (const seg of segments) dir = await dir.getDirectoryHandle(seg, { create });
  return dir;
}

async function writeFile(claimDir: FileSystemDirectoryHandle, relPath: string, blob: Blob) {
  const parts = relPath.split('/');
  const dir = await dirFor(claimDir, parts.slice(0, -1), true);
  const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

/** Rename by copy+delete — FileSystemFileHandle.move() is not everywhere yet. */
async function renameFile(claimDir: FileSystemDirectoryHandle, from: string, to: string) {
  const fromParts = from.split('/');
  const dir = await dirFor(claimDir, fromParts.slice(0, -1), false);
  const file = await (await dir.getFileHandle(fromParts[fromParts.length - 1])).getFile();
  await writeFile(claimDir, to, file);
  await dir.removeEntry(fromParts[fromParts.length - 1]);
}

export async function writeDocuments(
  claim: ClaimData,
  type: DocType,
  files: FolderInput[],
  source: ClaimDocument['source'],
): Promise<{ claim: ClaimData; written: ClaimDocument[] }> {
  if (files.length === 0) return { claim, written: [] };
  const rootHandle = await root();
  const folder = folderNameFor(claim);
  const claimDir = await rootHandle.getDirectoryHandle(folder, { create: true });
  const device = await getDeviceLabel();
  const existing = claimDocuments(claim);

  // Single-file types: the new batch replaces; old files step aside as "(old)".
  let next: ClaimData = { ...claim, documentsFolder: folder };
  let replaced: ClaimDocument[] = [];
  if (!MULTI_FILE_TYPES.has(type)) {
    const r = replaceByType(next, type, []);
    next = r.claim; replaced = r.replaced;
    const taken = new Set(claimDocuments(claim).map((d) => d.relPath));
    for (const old of replaced) {
      if (!onThisDevice(old, device)) continue;
      const to = oldNameFor(old.relPath, taken);
      taken.add(to);
      try { await renameFile(claimDir, old.relPath, to); } catch { /* already gone — nothing to keep */ }
    }
  }

  const relPaths = relPathsFor(type, files.map((f) => ({ mime: f.blob.type, name: f.name })), existing);
  const written: ClaimDocument[] = [];
  for (let i = 0; i < files.length; i++) {
    await writeFile(claimDir, relPaths[i], files[i].blob);
    written.push({
      id: newDocId(), type, relPath: relPaths[i], mime: files[i].blob.type || 'application/octet-stream',
      size: files[i].blob.size, addedAt: new Date().toISOString(), source, devices: [device],
    });
  }
  return { claim: addDocuments(next, written), written };
}

export async function readDocument(claim: ClaimData, doc: ClaimDocument): Promise<File> {
  const device = await getDeviceLabel();
  if (!onThisDevice(doc, device)) throw new NotOnThisDeviceError(doc.devices);
  const rootHandle = await root();
  const claimDir = await rootHandle.getDirectoryHandle(folderNameFor(claim));
  const parts = doc.relPath.split('/');
  const dir = await dirFor(claimDir, parts.slice(0, -1), false);
  return (await dir.getFileHandle(parts[parts.length - 1])).getFile();
}

export async function openDocument(claim: ClaimData, doc: ClaimDocument): Promise<void> {
  const file = await readDocument(claim, doc);
  const url = URL.createObjectURL(file);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function claimFolderPath(claim: ClaimData): Promise<string | null> {
  const handle = await getStoredRootHandle();
  return handle ? `${handle.name}\\${folderNameFor(claim)}` : null;
}
```

- [ ] **Step 3: `sink.ts`**

```ts
// src/lib/documents/sink.ts
/**
 * The one call every "a file was born" site makes. Folder + store in one go.
 * No folder connected → quiet no-op: the browser download / Drive upload the
 * caller already does is unchanged (spec D6, D7).
 */
import { toast } from 'sonner';
import type { ClaimDocument, DocType } from '@/types/documents';
import { useClaimStore } from '@/stores/claim-store';
import { getStoredRootHandle } from '@/lib/local-sync/directory-handle';
import { writeDocuments, PermissionDeniedError, type FolderInput } from './folder';
import { DOC_TYPE_LABEL } from '@/types/documents';

export async function saveDocuments(
  type: DocType,
  files: FolderInput[],
  source: ClaimDocument['source'],
): Promise<ClaimDocument[]> {
  const claim = useClaimStore.getState().currentClaim;
  if (!claim || files.length === 0) return [];
  if (!(await getStoredRootHandle())) return [];
  try {
    const { claim: next, written } = await writeDocuments(claim, type, files, source);
    useClaimStore.getState().updateClaim({ documents: next.documents, documentsFolder: next.documentsFolder });
    toast.success(`${DOC_TYPE_LABEL[type]} saved to the claim folder`, { duration: 2500 });
    return written;
  } catch (err) {
    const msg = err instanceof PermissionDeniedError
      ? 'Claim folder: access not granted — reconnect it on the Documents tab.'
      : `Claim folder: could not save ${DOC_TYPE_LABEL[type]} (${err instanceof Error ? err.message : String(err)})`;
    toast.error(msg, { duration: 5000 });
    return [];
  }
}

/** Spec D9: call this first thing in a click handler that will end in a write. */
export { ensureReadWrite } from '@/lib/local-sync/directory-handle';
```

`updateClaim` on `claimSlice` spreads partials over the current claim
(`src/stores/slices/claimSlice.ts:128`) and marks dirty, so auto-save and
sync pick the index up like any other field.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: clean. (`FileSystemDirectoryHandle.getDirectoryHandle/getFileHandle/removeEntry`, `createWritable` come from `src/lib/local-sync/fs-access.d.ts` + lib.dom — if `createWritable` is missing from the ambient types, add `createWritable(): Promise<FileSystemWritableFileStream>` to the `FileSystemFileHandle` interface in `fs-access.d.ts`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-sync/directory-handle.ts src/lib/documents/folder.ts src/lib/documents/sink.ts
git commit -m "feat(documents): folder engine on the local-sync handle and the save sink

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(Add `src/lib/local-sync/fs-access.d.ts` to the `git add` if it was touched.)

---

### Task 4: Print triggers save their HTML

**Files:**
- Modify: `src/lib/reports/print-shell.ts` (append `openPrintWindow`)
- Modify: `src/lib/reports/standard-report-builder.ts:999-1014` (`triggerStandardPrint`)
- Modify: `src/lib/reports/uiic-final-builder.ts:515-527` (`triggerUIICFinalPrint`), `:1145-1157` (`triggerUIICBillCheckPrint`)
- Modify: `src/lib/reports/spot-fee-bill-builder.ts:220-235` (`triggerSpotFeeBillPrint`)
- Modify: `src/lib/reports/reinspection-report-builder.ts:186-196` (`triggerReinspectionPrint`)

**Interfaces:**
- Consumes: `saveDocuments` (Task 3).
- Produces: `openPrintWindow(html: string, opts?: { features?: string; closeAfter?: boolean }): void` in `print-shell.ts`.

- [ ] **Step 1: `openPrintWindow`** — append to `print-shell.ts`:

```ts
/**
 * Open the report in a new window and print it. One body for every report —
 * before this each trigger pasted the same twelve lines.
 * `closeAfter` closes the window once the print dialog has been dismissed
 * (the reinspection report's old behaviour).
 */
export function openPrintWindow(html: string, opts: { features?: string; closeAfter?: boolean } = {}): void {
  const w = window.open('', '_blank', opts.features);
  if (!w) {
    alert('Popup blocked — please allow popups for this site and try again.');
    return;
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
    if (opts.closeAfter) setTimeout(() => w.close(), 1500);
  }, 600);
}
```

- [ ] **Step 2: Rewrite the five triggers**

`standard-report-builder.ts` — replace the body of `triggerStandardPrint`:

```ts
export function triggerStandardPrint(
  claim: ClaimData,
  profile: SurveyorProfile,
  mode: ReportMode = 'final'
): void {
  const html = buildStandardPrintDocument(claim, profile, mode);
  const type = mode === 'bill-check' ? 'billCheckReport' : 'surveyReport';
  const name = mode === 'bill-check' ? 'Bill Check Report.html' : 'Final Survey Report.html';
  void saveDocuments(type, [{ blob: new Blob([html], { type: 'text/html' }), name }], 'generated');
  openPrintWindow(html);
}
```

with imports `import { openPrintWindow } from './print-shell';` (there is already an import from `./print-shell` — extend it) and `import { saveDocuments } from '@/lib/documents/sink';`.

`uiic-final-builder.ts` — both triggers:

```ts
export function triggerUIICFinalPrint(claim: ClaimData, profile: SurveyorProfile | null): void {
  const html = buildUIICFinalPrintDocument(claim, profile);
  void saveDocuments('surveyReport', [{ blob: new Blob([html], { type: 'text/html' }), name: 'Final Survey Report.html' }], 'generated');
  openPrintWindow(html);
}
```

```ts
export function triggerUIICBillCheckPrint(claim: ClaimData, profile: SurveyorProfile | null): void {
  const html = buildUIICBillCheckPrintDocument(claim, profile);
  void saveDocuments('billCheckReport', [{ blob: new Blob([html], { type: 'text/html' }), name: 'Bill Check Report.html' }], 'generated');
  openPrintWindow(html);
}
```

`spot-fee-bill-builder.ts`:

```ts
export function triggerSpotFeeBillPrint(claim: ClaimData, profile: SurveyorProfile): void {
  const html = buildSpotFeeBillDocument(claim, profile);
  void saveDocuments('feeBill', [{ blob: new Blob([html], { type: 'text/html' }), name: 'Fee Bill.html' }], 'generated');
  openPrintWindow(html);
}
```

`reinspection-report-builder.ts`:

```ts
export function triggerReinspectionPrint(claim: ClaimData, profile: SurveyorProfile | null): void {
  const html = buildReinspectionPrintDocument(claim, profile);
  void saveDocuments('reinspectionReport', [{ blob: new Blob([html], { type: 'text/html' }), name: 'Reinspection Report.html' }], 'generated');
  openPrintWindow(html, { features: 'width=900,height=1200', closeAfter: true });
}
```

The `void saveDocuments(...)` runs before `openPrintWindow` on purpose: the
click's transient activation covers the permission prompt (D9) and the
print window opens regardless of the save's outcome. Remove the now-unused
`triggerUIICPrint` alias only if nothing imports it (`grep -rn triggerUIICPrint src` — keep it if anything does).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run src/lib/reports`
Expected: clean; all report tests pass (the builders' pure functions are untouched).

Manual: on `npm run dev`, open a claim → Report tab → Print. Without a
folder connected: print window opens, no toast. (Folder-connected path is
verified in Task 7 once the card exists.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/print-shell.ts src/lib/reports/standard-report-builder.ts src/lib/reports/uiic-final-builder.ts src/lib/reports/spot-fee-bill-builder.ts src/lib/reports/reinspection-report-builder.ts
git commit -m "feat(documents): one print window for every report, and each print saves its HTML

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Blob outputs save themselves — NIA Excel and insured summary

**Files:**
- Modify: `src/lib/reports/nia-assessment-excel.ts:208-218` (`exportNiaAssessmentExcel`)
- Modify: `src/components/tabs/InsuredReportTab.tsx:321-335` (the `pdf(...).toBlob()` block)

**Interfaces:** consumes `saveDocuments` (Task 3). Signatures unchanged.

- [ ] **Step 1: NIA Excel**

```ts
export async function exportNiaAssessmentExcel(
  claimNo: string,
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
): Promise<void> {
  const wb = buildNiaWorkbook(niaAssessmentRows(rows, ageMonths, depType));
  const buffer = await wb.xlsx.writeBuffer();
  const safe = (claimNo || 'claim').replace(/[^A-Za-z0-9_-]+/g, '_');
  const name = `${safe}_Primary_Assessment_Template.xlsx`;
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await saveDocuments('niaAssessmentExcel', [{ blob, name }], 'generated');
  saveAs(blob, name);
}
```

Import `saveDocuments` from `@/lib/documents/sink`. The existing test
`src/lib/reports/__tests__/nia-assessment-excel.test.ts` does not call the
exporter (browser-only), so nothing changes there — but the module now
imports the sink, which imports the store; run the test file to confirm it
still loads under Vitest (the store module is importable in node — the
sync tests already do it).

- [ ] **Step 2: Insured summary PDF** — in `InsuredReportTab.tsx`, after `const blob = await pdf(...).toBlob();` and before the object-URL download, add:

```ts
      await saveDocuments('insuredSummary', [{ blob, name: 'Insured Summary.pdf' }], 'generated');
```

with `import { saveDocuments } from '@/lib/documents/sink';`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run src/lib/reports/__tests__/nia-assessment-excel.test.ts`
Expected: clean; 25 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/nia-assessment-excel.ts src/components/tabs/InsuredReportTab.tsx
git commit -m "feat(documents): NIA Excel and insured summary save into the claim folder

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Uploads and photos land in the folder; photo tags

**Files:**
- Modify: `src/components/tabs/DocumentsTab.tsx:135-175` (`processFiles`)
- Modify: `src/components/tabs/AssessmentTab.tsx:50-62` (estimate upload)
- Modify: `src/components/tabs/PhotosTab.tsx:95-120` (add photos) and the thumbnail markup (tag select)
- Modify: `src/stores/slices/claimSlice.ts` (`addPhoto` gets an optional `tag`; new `setPhotoTag`)

**Interfaces:**
- Consumes: `saveDocuments`, `ensureReadWrite` (Task 3 sink), `FIELD_KEY_TO_DOC_TYPE`, `tagToDocType`, `PhotoTag` (Task 1).
- Produces: `addPhoto(dataUrl, name, w, h, kind?, tag?)`; `setPhotoTag(index: number, tag: PhotoTag | undefined)`.

- [ ] **Step 1: DocumentsTab** — at the top of `processFiles`, before `storeFiles`:

```ts
    const docType = FIELD_KEY_TO_DOC_TYPE[key] ?? 'other';
    void saveDocuments(docType, files.map((f) => ({ blob: f, name: f.name })), 'upload');
```

`processFiles` is called from the review sheet's confirm click, so the
permission prompt is inside the gesture (D9). Imports:
`import { saveDocuments } from '@/lib/documents/sink';` and
`import { FIELD_KEY_TO_DOC_TYPE } from '@/types/documents';`.

- [ ] **Step 2: AssessmentTab** — in the estimate handler, right after `triggerExtraction('estimate', file, …)`:

```ts
    void saveDocuments(mode === 'supplementary' ? 'supplementaryEstimate' : 'estimate', [{ blob: file, name: file.name }], 'upload');
```

Check what `mode` is in that function (`grep -n "mode" src/components/tabs/AssessmentTab.tsx | head`); if it is not a supplementary/primary discriminator, use `'estimate'` unconditionally and say so in the report.

- [ ] **Step 3: claimSlice** — extend `addPhoto`:

Signature in the interface (line ~52): add a sixth parameter `tag?: PhotoTag`. Implementation (line ~270): `addPhoto: (dataUrl, name, w, h, kind = 'damage', tag) => { … photos: [...photos, { dataUrl, name, w, h, kind, ...(tag ? { tag } : {}) }] … }` — follow the exact shape the existing implementation pushes; only add `tag`.

Add next to it:

```ts
  setPhotoTag: (index, tag) => {
    set((state: ClaimSlice) => {
      if (!state.currentClaim) return {};
      const photos = state.currentClaim.photos.map((p, i) => (i === index ? { ...p, tag } : p));
      return { currentClaim: { ...state.currentClaim, photos, updatedAt: new Date().toISOString() }, isDirty: true };
    });
  },
```

and `setPhotoTag: (index: number, tag: PhotoTag | undefined) => void;` in the interface. Import `PhotoTag` from `@/types/documents`.

- [ ] **Step 4: PhotosTab** — in the add-photos loop (line ~108), after `addPhoto(dataUrl, name, w, h);`:

```ts
          void saveDocuments('damagePhotos', [{ blob: file, name: file.name }], 'photo');
```

(New photos are untagged = damage. Re-tagging later changes the index type
only — see Step 5 — the file stays where it was written; a tag is a label,
not a move.)

Tag select on each thumbnail: find the thumbnail render (the element that
shows `photo.name`) and add beneath the name:

```tsx
<select
  value={photo.tag ?? ''}
  onChange={(e) => setPhotoTag(index, (e.target.value || undefined) as PhotoTag | undefined)}
  className="mt-1 w-full text-[10px] rounded border border-border bg-background px-1 py-0.5"
  title="Which portal slot this shot is for"
>
  <option value="">Damage</option>
  <option value="front">Front</option>
  <option value="rear">Rear</option>
  <option value="left">Left side</option>
  <option value="right">Right side</option>
  <option value="chassis">Chassis number</option>
  <option value="odometer">Odometer</option>
  <option value="spot">Spot</option>
</select>
```

`setPhotoTag` comes from `useClaimStore`. If the thumbnail list is a
memoised child component, pass `index` and `setPhotoTag` down; do not
restructure it.

- [ ] **Step 5: Re-tag updates the index type** — in `PhotosTab`'s `onChange` above, after `setPhotoTag(...)`, nothing else: the index entry for a photo is not linked to the photo item (photos are data URLs in the record, files are written once). Leave a one-line comment on the select: `// ponytail: tag is a label on the photo; the folder entry keeps its original type. Link them when the photos move out of the record.`

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run src/stores`
Expected: clean; store tests pass.

Manual (`npm run dev`, no folder connected): upload an RC → no toast, Drive flow unchanged; add a photo → tag select shows "Damage", changing it persists after reload (auto-save).

- [ ] **Step 7: Commit**

```bash
git add src/components/tabs/DocumentsTab.tsx src/components/tabs/AssessmentTab.tsx src/components/tabs/PhotosTab.tsx src/stores/slices/claimSlice.ts
git commit -m "feat(documents): uploads, estimate and photos save into the claim folder; photo tags

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Documents tab UI — folder card and typed list

**Files:**
- Create: `src/lib/documents/useClaimDocuments.ts`
- Create: `src/components/documents/ClaimFolderCard.tsx`, `src/components/documents/ClaimDocumentsList.tsx`
- Modify: `src/components/tabs/DocumentsTab.tsx` (render both under the header, above the AI scanner groups)

**Interfaces:**
- Consumes: Tasks 1–3 (`claimDocuments`, `removeDocument`, `onThisDevice`, `openDocument`, `claimFolderPath`, `saveDocuments`, `ensureReadWrite`, `isLocalSyncSupported`, `getStoredRootHandle`, `pickRootFolder`, `getDeviceLabel`, `setDeviceLabel`, `DOC_TYPE_LABEL`).
- Produces:

```ts
export function useClaimDocuments(): {
  supported: boolean;
  folder: { rootName: string; device: string; claimPath: string | null } | null;   // null = not connected
  documents: Array<ClaimDocument & { here: boolean }>;
  connect: (deviceLabel: string) => Promise<void>;
  addFiles: (type: DocType, files: File[]) => Promise<void>;
  open: (doc: ClaimDocument) => Promise<void>;
  remove: (doc: ClaimDocument) => void;
};
```

- [ ] **Step 1: Hook**

```ts
// src/lib/documents/useClaimDocuments.ts
'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import type { ClaimDocument, DocType } from '@/types/documents';
import {
  isLocalSyncSupported, getStoredRootHandle, pickRootFolder, ensureReadWrite, getDeviceLabel, setDeviceLabel,
} from '@/lib/local-sync/directory-handle';
import { claimDocuments, removeDocument, onThisDevice } from './index-ops';
import { openDocument, claimFolderPath, NotOnThisDeviceError, PermissionDeniedError } from './folder';
import { saveDocuments } from './sink';

export function useClaimDocuments() {
  const claim = useClaimStore((s) => s.currentClaim);
  const updateClaim = useClaimStore((s) => s.updateClaim);
  const supported = isLocalSyncSupported();
  const [folder, setFolder] = useState<{ rootName: string; device: string; claimPath: string | null } | null>(null);
  const [device, setDevice] = useState('This PC');

  const refreshFolder = useCallback(async () => {
    const handle = await getStoredRootHandle().catch(() => null);
    const label = await getDeviceLabel();
    setDevice(label);
    if (!handle || !claim) { setFolder(null); return; }
    setFolder({ rootName: handle.name, device: label, claimPath: await claimFolderPath(claim) });
  }, [claim?.id, claim?.documentsFolder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (supported) void refreshFolder(); }, [supported, refreshFolder]);

  const connect = useCallback(async (deviceLabel: string) => {
    try {
      const handle = await pickRootFolder();            // user gesture: inside the button click
      if (!(await ensureReadWrite(handle))) { toast.error('Folder access was not granted.'); return; }
      await setDeviceLabel(deviceLabel);
      await refreshFolder();
      toast.success(`Claim folder connected: ${handle.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open a folder.');
    }
  }, [refreshFolder]);

  const addFiles = useCallback(async (type: DocType, files: File[]) => {
    await saveDocuments(type, files.map((f) => ({ blob: f, name: f.name })), 'upload');
  }, []);

  const open = useCallback(async (doc: ClaimDocument) => {
    if (!claim) return;
    try { await openDocument(claim, doc); }
    catch (err) {
      if (err instanceof NotOnThisDeviceError) toast.info(err.message);
      else if (err instanceof PermissionDeniedError) toast.error(err.message);
      else toast.error(`Missing here: ${doc.relPath}. It may have been moved or renamed in Explorer.`);
    }
  }, [claim]);

  const remove = useCallback((doc: ClaimDocument) => {
    if (!claim) return;
    updateClaim({ documents: removeDocument(claim, doc.id).documents });
    toast.info(`Removed from the list. The file is still on disk: ${doc.relPath}`, { duration: 5000 }); // spec D8
  }, [claim, updateClaim]);

  const documents = claim ? claimDocuments(claim).map((d) => ({ ...d, here: onThisDevice(d, device) })) : [];
  return { supported, folder, documents, connect, addFiles, open, remove };
}
```

- [ ] **Step 2: Folder card**

```tsx
// src/components/documents/ClaimFolderCard.tsx
'use client';
import React, { useState } from 'react';
import { FolderOpen, Laptop } from 'lucide-react';

interface Props {
  supported: boolean;
  folder: { rootName: string; device: string; claimPath: string | null } | null;
  onConnect: (deviceLabel: string) => void;
}

export function ClaimFolderCard({ supported, folder, onConnect }: Props) {
  const [label, setLabel] = useState('');
  if (!supported) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        Use desktop Chrome or Edge to keep claim files in a folder on this PC.
      </div>
    );
  }
  if (!folder) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3">
        <FolderOpen size={16} className="text-primary" />
        <div className="text-sm flex-1 min-w-[200px]">
          <div className="font-medium">Claim folder</div>
          <div className="text-xs text-muted-foreground">Pick a folder once; every claim gets its own subfolder with typed files.</div>
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name this PC (e.g. Office PC)"
          className="text-xs rounded border border-border bg-background px-2 py-1 w-44"
          maxLength={40}
        />
        <button
          onClick={() => onConnect(label.trim() || 'This PC')}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground"
        >
          Connect folder
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
      <FolderOpen size={16} className="text-primary" />
      <span className="font-mono text-xs">{folder.claimPath ?? folder.rootName}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Laptop size={12} /> {folder.device}</span>
      <button onClick={() => onConnect(folder.device)} className="ml-auto text-xs text-muted-foreground underline">Change</button>
    </div>
  );
}
```

- [ ] **Step 3: Documents list**

```tsx
// src/components/documents/ClaimDocumentsList.tsx
'use client';
import React, { useRef, useState } from 'react';
import { ExternalLink, Trash2, Plus, HardDrive } from 'lucide-react';
import type { ClaimDocument, DocType } from '@/types/documents';
import { DOC_TYPE_LABEL } from '@/types/documents';

interface Props {
  documents: Array<ClaimDocument & { here: boolean }>;
  connected: boolean;
  onAdd: (type: DocType, files: File[]) => void;
  onOpen: (doc: ClaimDocument) => void;
  onRemove: (doc: ClaimDocument) => void;
}

const kb = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const SOURCE_ICON: Record<ClaimDocument['source'], string> = { upload: '⬆', generated: '⚙', photo: '📷' };

export function ClaimDocumentsList({ documents, connected, onAdd, onOpen, onRemove }: Props) {
  const [type, setType] = useState<DocType>('other');
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents · {documents.length}</div>
        {connected && (
          <div className="flex items-center gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as DocType)} className="text-xs rounded border border-border bg-background px-2 py-1">
              {(Object.keys(DOC_TYPE_LABEL) as DocType[]).map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
            </select>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground">
              <Plus size={12} /> Add file
            </button>
            <input
              ref={fileRef} type="file" multiple className="hidden"
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) onAdd(type, fs); }}
            />
          </div>
        )}
      </div>
      {documents.length === 0 ? (
        <div className="px-4 py-6 text-xs text-muted-foreground text-center">
          {connected ? 'Nothing yet. Uploads, photos and printed reports will appear here.' : 'Connect a claim folder to keep files here.'}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-2 text-xs">
              <span title={d.source}>{SOURCE_ICON[d.source]}</span>
              <span className="font-medium w-44 shrink-0 truncate">{DOC_TYPE_LABEL[d.type]}</span>
              <span className="font-mono truncate flex-1 text-muted-foreground">{d.relPath}</span>
              <span className="text-muted-foreground w-16 text-right">{kb(d.size)}</span>
              <span className={`inline-flex items-center gap-1 w-28 ${d.here ? 'text-emerald-700' : 'text-amber-700'}`}>
                <HardDrive size={12} /> {d.here ? 'here' : `on ${d.devices.join(', ') || '?'}`}
              </span>
              <button onClick={() => onOpen(d)} disabled={!d.here} title="Open" className="p-1 rounded hover:bg-muted disabled:opacity-40"><ExternalLink size={14} /></button>
              <button onClick={() => onRemove(d)} title="Remove from list (file stays on disk)" className="p-1 rounded hover:bg-muted text-destructive"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount in `DocumentsTab`** — inside the `max-w-5xl` content area, directly below the header block and above the first document group:

```tsx
      <div className="max-w-5xl mx-auto px-8 lg:px-12 pt-6 space-y-3">
        <ClaimFolderCard supported={docs.supported} folder={docs.folder} onConnect={docs.connect} />
        <ClaimDocumentsList documents={docs.documents} connected={!!docs.folder} onAdd={docs.addFiles} onOpen={docs.open} onRemove={docs.remove} />
      </div>
```

with `const docs = useClaimDocuments();` declared **with the other hooks at
the top of the component, before the `if (!currentClaim) return null;`
guard** (hooks must not run conditionally), and imports for the hook and the
two components.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run src/lib/documents src/types`
Expected: clean; all pass.

Manual, `npm run dev`, desktop Chrome:
1. Documents tab → card says "Claim folder" → type "Office PC" → Connect → pick an empty folder → card shows `<folder>\<claimNo>` · Office PC.
2. Upload an RC → toast "RC Book saved to the claim folder" → row `RC Book · RC Book.pdf · here` → Explorer shows the file.
3. Upload another RC → old one renamed `RC Book (old).pdf`, list shows one RC row.
4. Report tab → Print → `Final Survey Report.html` row appears; opens in a new tab from the list.
5. Assessment → NIA Excel → Download → `Primary Assessment Template.xlsx` row.
6. Photos → add two → `Damage Photos/Damage Photos 1.jpg`, `… 2.jpg`.
7. Remove a row → toast names the path; file still on disk.
8. Rename a file in Explorer → Open → "Missing here" toast.
9. Revoke permission (chrome://settings/content/filesystem) → Print → toast "access not granted", print window still opens.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documents/useClaimDocuments.ts src/components/documents/ClaimFolderCard.tsx src/components/documents/ClaimDocumentsList.tsx src/components/tabs/DocumentsTab.tsx
git commit -m "feat(documents): claim folder card and typed document list on the Documents tab

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-20-claim-documents-design.md`
- Modify: `docs/portal-integration.md` §6 Progress

- [ ] **Step 1: Spec** — set **Status:** `Implemented 2026-09-21`. Under §2 rules add a short "Decided at implementation" list: (a) no `copies` field — Drive returns no file id; the tab's Drive list is the cross-machine fallback; Sync-picked files are saved as uploads; (b) multidevice sync is whole-claim version-guarded, so the map index is for lookup, not merge; (c) Word export not hooked (six untyped callers); (d) `insuredSummary` added to the vocabulary; (e) single-file types accept a batch as `Label 1`, `Label 2`; (f) a photo's tag is a label on the photo item, the folder entry keeps its original type. Remove `copies?` from the `ClaimDocument` block in §3.1 and `source: 'sync' | 'drive'`. In §3.4 change the Sync row to "via `processFiles`, source upload" and drop the Drive-copy row. In §6 keep "Photos out of the record" and add "link photo tag to its folder entry" to it.

- [ ] **Step 2: portal-integration.md §6** — under the shipped list add `- Claim Documents shipped (2026-09-21) — typed index + disk folder; extension v2 can attach by type`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-20-claim-documents-design.md docs/portal-integration.md
git commit -m "docs: claim documents spec reflects what shipped

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** D1 index-only on record (Task 1 types; bytes only in
`folder.ts`) · D2 sticky folder name from claim number (Task 2
`folderNameFor`, set in `writeDocuments`) · D3 closed vocabulary (Task 1) ·
D5 devices per entry, "on <label>" in the list (Tasks 3, 7) · D6 generated
outputs save themselves, download/print unchanged (Tasks 4, 5) · D7 nothing
removed (every hook is additive; photos untouched) · D8 remove keeps bytes,
toast names path (Task 7) · D9 permission inside the click — connect is in
the button; print/upload/photo/export saves start in the click's activation
window before the async work that follows; `sink` toasts on refusal (Tasks
3–7) · D10 Record index (Task 1) · layout rules and `(old)` renames (Tasks
2, 3) · §3.5 UI card + list (Task 7) · §3.6 photo tags (Task 6) · §4
cross-machine (list shows "on Office PC", Open disabled) · §5 tests: pure
modules under Vitest, manual list in Task 7 · §6 out of scope stays out.
Deviations are listed in Global Constraints and written into the spec by
Task 8.

**Placeholders.** None. Task 6 Step 2 names a grep to run for `mode`
rather than asserting a field it hasn't seen.

**Type consistency.** `FolderInput { blob, name? }` used by `writeDocuments`,
`saveDocuments`, and every caller. `saveDocuments(type, files, source)`
order is the same in Tasks 4–7. `ClaimDocument.source` is
`'upload'|'generated'|'photo'` in Task 1 and every producer. `folder` shape
`{ rootName, device, claimPath }` is identical in the hook and the card.
