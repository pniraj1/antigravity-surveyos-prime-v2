# Claim Document Kit (Phases 1–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For each claim, SurveyOS knows which page of which file in the claim folder is which document. It shows a per-portal checklist (Ready / Check / Missing) with a copy-ready missing-documents message, checks each document belongs to this claim, and builds the portal's upload files (split and merge) for the surveyor to review.

**Architecture:**
- Every decision is a pure, tested function in `src/lib/documents/kit/`: recognisers, identity checks, recipes, checklist, box planning, review state.
- The browser-only parts are thin adapters: page text via `pdfjs-dist`, PDF assembly via `pdf-lib`, folder reads and writes via the existing File System Access code.
- The UI lives on the Documents tab and only renders the pure results.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Zustand, Vitest, `pdfjs-dist` (already installed), `pdf-lib` (new, owner-approved), the File System Access API (existing `src/lib/local-sync/` and `src/lib/documents/`).

**Spec:** `docs/superpowers/specs/2026-10-20-claim-document-kit-design.md`. Phases 1–2 are §4.1–§4.7a; the binding calls are §9 C1–C10; the defaults are §8 (a)–(f). Rules D1–D10 come from `docs/superpowers/specs/2026-09-20-claim-documents-design.md`.

## Global Constraints

- **D1:** file bytes never enter the claim record or IndexedDB. Only labels and metadata do.
- **Originals are read-only.** SurveyOS never modifies, moves or deletes a surveyor's file. It writes only under the claim folder's `Portal Upload/` subfolder (C9).
- **No AI anywhere in Phases 1–2.** All recognition here is local text and filenames. The AI button is Phase 4.
- **KYC numbers never appear in UI text.** Identity checks on `aadhaar`, `pan`, `ckyc` and `kycOther` compare **names only**, and messages show names, never ID numbers.
- **Only confirmed labels build files.** A box using any unconfirmed page is `check`, never `ready`.
- **Normalisation** for identity comparisons: `s.toUpperCase().replace(/[^A-Z0-9]/g, '')`.
- **New dependency:** `pdf-lib@^1.17.1`, and no others.
- **Encoding:** UTF-8 only. Strict-decode any edited file that contains non-ASCII text.
- **Commits:** on `main`, each ending with a `Co-Authored-By:` trailer naming the actual model.
- **Python:** use `py` if needed (it isn't expected to be).
- **Tests:** `npx vitest run src/lib/documents` while iterating; `npm test` and `npx tsc --noEmit -p .` before each task's last commit.
- **No dev server** for verification: the app is auth-gated. Logic is unit-tested, and the UI is checked by the owner.

## Review Focus

1. **Registration numbers in different formats** (`MH-18-AB-1234`, `MH 18 AB 1234`, `mh18ab1234`) must all **match** each other. Owner: Task 4 (`identity: registration formats match`).
2. **An empty claim field** (no chassis number entered yet) gives `cantCheck`, never `mismatch` and never a block. Owner: Task 4 (`identity: empty claim field is cantCheck`).
3. **Pages of one type that aren't next to each other** (RC on p3 and p7 of a combined PDF) are both collected into that box, in page order. Owner: Task 6 (`planBox: non-adjacent pages collected in order`).
4. **A file replaced in place** (same name and size, new `lastModified`) resets its labels and cancels any review that used it. Owner: Task 2 (`reconcile: lastModified change resets labels`) and Task 6 (`review: source change cancels box review`).
5. **A merge box with only optional parts** (cheque present, Aadhaar and policy missing) is `missing`, and the message lists exactly the missing mandatory parts. Owner: Task 5 (`checklist: merge box missing mandatory parts`).

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/types/documents.ts` | new `DocType`s and labels, `PageLabel`, fingerprint fields | 1 |
| `src/types/claim.ts` | `portalFlow?`, `notNeededBoxes?`, `uploadSet?` on `ClaimData` | 1 |
| `src/lib/documents/naming.ts` | filename words; skip `Portal Upload/` | 1 |
| `src/lib/documents/kit/fingerprint.ts` | `fingerprintOf`, `reconcileEntry` | 2 |
| `src/lib/documents/folder.ts` | Scan re-checks indexed files' fingerprints | 2 |
| `src/lib/documents/kit/recognise.ts` | `recogniseText`, `recogniseName`, `knownType`, `labelEntry` | 3 |
| `src/lib/documents/kit/page-text.ts` | `pageTexts(blob)` via pdfjs, `pageCountOf(blob)` | 3 |
| `src/lib/documents/kit/identity.ts` | `identityCheck` | 4 |
| `src/lib/documents/kit/recipes/*.ts`, `recipes/index.ts` | recipe data, `recipeFor(claim)` | 5 |
| `src/lib/documents/kit/checklist.ts` | `checklist`, `missingMessage` | 5 |
| `src/lib/documents/kit/build.ts` | `planBox`, `buildBoxFile`, `sha256Hex` | 6 |
| `src/lib/documents/kit/review.ts` | `newUploadSet`, `markReviewed`, `invalidate`, `isReviewed` | 6 |
| `src/lib/documents/folder.ts` | `writePortalUpload` | 6 |
| `src/lib/documents/kit/useDocumentKit.ts` | hook wiring scan → labels → checklist → build → review | 7 |
| `src/components/documents/ClaimFolderCard.tsx` | location choice and Drive-for-desktop guide | 7 |
| `src/components/documents/PageLabelGrid.tsx` | Pages view | 8 |
| `src/components/documents/PortalChecklist.tsx` | checklist panel and missing message | 9 |
| `src/components/documents/UploadReview.tsx` | Review upload set | 10 |
| `src/components/tabs/DocumentsTab.tsx` | mount the new panels | 8–10 |
| vault docs | release notes | 11 |

---

### Task 1: Vocabulary and data shapes

**Files:** Modify `src/types/documents.ts`, `src/types/claim.ts`, `src/lib/documents/naming.ts`. Test `src/lib/documents/__tests__/kit-types.test.ts` (new).

**Interfaces — Produces:**

```ts
// documents.ts — DocType gains:
'aadhaar' | 'pan' | 'ckyc' | 'kycOther' | 'claimIntimation' | 'dischargeVoucher' | 'csr' | 'investigationReport' | 'rcBack' | 'dlBack'
// labels (also used as file stems, Windows-safe):
aadhaar:'Aadhaar Card', pan:'PAN Card', ckyc:'CKYC', kycOther:'Other KYC', claimIntimation:'Claim Intimation',
dischargeVoucher:'Discharge Voucher', csr:'CSR', investigationReport:'Investigation Report', rcBack:'RC Book Back', dlBack:'Driving Licence Back'

export interface PageLabel {
  type: DocType;
  by: 'known' | 'text' | 'name' | 'surveyor';    // 'ai' is added in Phase 4
  confirmed: boolean;
  overrideAt?: string;                           // set by "Use anyway" on an identity mismatch
}
export interface Fingerprint { size: number; lastModified: number; pageCount: number }
// ClaimDocument gains: pageCount?: number; pages?: Record<number, PageLabel>; fingerprint?: Fingerprint

// claim.ts — ClaimData gains:
portalFlow?: 'nontieup' | 'kia' | 'maruti' | 'claimsurvey';
notNeededBoxes?: Record<string, string[]>;       // key `${portal}-${flow}` → box ids
uploadSet?: UploadSet;                           // type from Task 6; declare it in src/types/documents.ts
```

Declare `UploadSet` in `documents.ts` now, so Task 6 fills in its behaviour:

```ts
export interface UploadSet {
  portal: string; flow: string; claimNo: string; builtAt: string;
  boxes: Record<string, { name: string; size: number; pages: number; sha256: string; sources: string[]; reviewedAt?: string }>;
}
```

- `sources` holds the ids of the source documents a box used. Task 6 uses it to invalidate the review.

- [ ] **Step 1: Write the failing tests.**
  - `every DocType has a label`: iterate a literal list of all 40 types, and expect a non-empty `DOC_TYPE_LABEL[t]`.
  - `docTypeFromRelPath recognises common words`: `'aadhar.pdf'` → `'aadhaar'`; `'Aadhaar Card.pdf'` → `'aadhaar'`; `'pan card.jpg'` → `'pan'`; `'cancelled cheque.pdf'` → `'cancelledCheque'`; `'RC.pdf'` → `'rc'`; `'dl front.jpg'` → `'dl'`; `'Scan_0001.pdf'` → `'other'`.
  - `Portal Upload is skipped`: `isScanSkippable('Portal Upload/New India/Driving Licence.pdf') === true`; `isScanSkippable('RC Book.pdf') === false`.
- [ ] **Step 2:** Run `npx vitest run src/lib/documents/__tests__/kit-types.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add the types and labels.
  - Extend the `TYPE_BY_LABEL` lookup in `naming.ts` with these aliases (lowercase stems): `rc`, `rc book`, `registration certificate` → rc; `dl`, `dl front`, `driving licence`, `driving license` → dl; `dl back` → dlBack; `rc back` → rcBack; `aadhar`, `aadhaar`, `aadhar card`, `aadhaar card` → aadhaar; `pan`, `pan card` → pan; `cheque`, `cancelled cheque`, `canceled cheque` → cancelledCheque; `policy`, `policy copy` → policy; `claim form` → claimForm; `estimate` → estimate; `invoice`, `bill` → invoice; `fir` → fir; `ckyc` → ckyc.
  - `isScanSkippable` returns true when the first path segment is `Portal Upload`.
- [ ] **Step 4:** Run `npx vitest run src/lib/documents`. Expected: PASS. Then run `npx tsc --noEmit -p .`. Expected: clean. If any `Record<DocType, …>` elsewhere now fails to type-check, add the new keys there.
- [ ] **Step 5:** Commit: `feat(documents): KYC and portal document types, page labels and fingerprints`.

### Task 2: Fingerprints, and Scan re-checks known files

**Files:** Create `src/lib/documents/kit/fingerprint.ts`. Modify `src/lib/documents/folder.ts` (`scanClaimFolder`). Test `src/lib/documents/__tests__/fingerprint.test.ts`.

**Interfaces — Produces:**
- `fingerprintOf(file: { size: number; lastModified: number }, pageCount: number): Fingerprint`
- `reconcileEntry(entry: ClaimDocument, fp: Fingerprint): { entry: ClaimDocument; reset: boolean }`
  - A missing `entry.fingerprint` → it's stored, and `reset: false`.
  - Equal → unchanged.
  - Different in any field → `pages` deleted, `pageCount` updated, `reset: true`.
- `scanClaimFolder` now also returns `reset: string[]` (the relPaths whose labels were reset). For already-indexed files on this device, it computes the fingerprint and applies `reconcileEntry`.
  - The page count comes from `pageCountOf` (Task 3). Until Task 3 lands, pass `1` for non-PDFs and leave PDFs at `entry.pageCount ?? 0`.
  - A count of 0 means "not yet known" and never triggers a reset on its own: treat `0` as a match on that field.

- [ ] **Step 1: Write the failing tests:**
  - `reconcile: first sight stores fingerprint`
  - `reconcile: equal is unchanged`
  - `reconcile: lastModified change resets labels` (Review Focus 4): same size and pageCount, lastModified +1 → `reset:true`, `pages` undefined
  - `reconcile: pageCount 0 is unknown, not a change`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `fingerprint.ts`. In `scanClaimFolder`, for each `known` entry on this device, apply `reconcileEntry` with the file's `size` and `lastModified`, and collect the resets.
- [ ] **Step 4:** Run `npx vitest run src/lib/documents`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(documents): fingerprint claim files and reset labels when a file changes`.

### Task 3: Free recognisers and page text

**Files:** Create `src/lib/documents/kit/recognise.ts` and `src/lib/documents/kit/page-text.ts`. Test `src/lib/documents/__tests__/recognise.test.ts`.

**Interfaces — Produces:**
- `recogniseText(text: string): DocType | null`. It lowercases and collapses whitespace, evaluates every rule, and returns the type **only if exactly one** type matches; otherwise `null`.
- `recogniseName(relPath: string): DocType | null`. This is `docTypeFromRelPath`, with `'other'` mapped to `null`.
- `knownType(entry: ClaimDocument): DocType | null`. Returns `entry.type` when `entry.source === 'generated' || entry.source === 'photo'`, or when `entry.type` came from a field upload (`entry.type !== 'other'` and `entry.source === 'upload'` and the entry's relPath stem equals `DOC_TYPE_LABEL[entry.type]`, which is how `saveDocuments` names field uploads; verify this against `src/lib/documents/sink.ts` and `naming.ts` `relPathsFor`, and if field uploads are named differently, use that rule instead and say so in the report).
- `labelEntry(entry: ClaimDocument, pageTexts: string[] | null): ClaimDocument`. It fills `pages` for every page that **has no label yet**, never touching existing labels:
  1. `knownType` gives all pages `{type, by:'known', confirmed:true}`.
  2. Otherwise, per page, `recogniseText(pageTexts[i])` gives `{by:'text', confirmed:false}`.
  3. Otherwise, if the file is a single page, or `recogniseName` exists and no page got a text label, all unlabelled pages get `{type: name, by:'name', confirmed:false}`.
  4. Otherwise the page is left unlabelled.
  - An HTML entry (`mime === 'text/html'`) is never labelled (C1).
- `pageTexts(blob: Blob): Promise<string[] | null>` and `pageCountOf(blob: Blob): Promise<number>`.
  - PDFs use `pdfjs-dist`, the same loading as `src/lib/ai/processor.ts`.
  - Images return `null` and `1`.
  - Everything else returns `null` and `1`.
- The rule table (the floor; the builder may add rules, each with a test). Each rule is a function of the normalised text. "+" means all must appear.

  | Type | Rule |
  |---|---|
  | rc | "registration certificate", or ("chassis no" + "engine no") |
  | dl | "driving licence", or "driving license", or ("licence no" + "cov") |
  | aadhaar | "aadhaar", or "unique identification authority", or `/\b\d{4} \d{4} \d{4}\b/` + "government of india" |
  | pan | "permanent account number", or ("income tax department" + "pan") |
  | invoice | "tax invoice", or ("gstin" + "invoice no") |
  | estimate | "estimate" + ("labour" or "labor") |
  | policy | "policy schedule", or "certificate of insurance", or ("policy no" + "idv") |
  | cancelledCheque | "ifsc" + ("a/c" or "account no") + "pay" |
  | fir | "first information report" |
  | claimForm | "claim form" + "signature" |

- [ ] **Step 1: Write the failing tests:**
  - one positive per rule, using realistic snippets (e.g. `'FORM 23 CERTIFICATE OF REGISTRATION ... Chassis No: MA3EWB22S00 Engine No: K12MN'` → rc);
  - `ambiguous page returns null` (text matching both invoice and estimate);
  - `labelEntry keeps existing labels`;
  - `labelEntry: generated file is known and confirmed`;
  - `labelEntry: html is never labelled`;
  - `labelEntry: name applies only when no page got a text label`.
- [ ] **Step 2:** Run `npx vitest run src/lib/documents/__tests__/recognise.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. `page-text.ts` isn't unit-tested beyond a smoke test with a mocked pdfjs, following `src/lib/ai/__tests__/file-to-images-pages.test.ts`. Then wire `pageCountOf` into Task 2's Scan path in place of the placeholder.
- [ ] **Step 4:** Run `npx vitest run src/lib/documents`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(documents): free page recognisers from text layer and file names`.

### Task 4: Identity checks

**Files:** Create `src/lib/documents/kit/identity.ts`. Test `src/lib/documents/__tests__/identity.test.ts`.

**Interfaces — Produces:**

```ts
type IdentityResult = { status: 'match' | 'mismatch' | 'cantCheck'; found?: string; expected?: string };
identityCheck(type: DocType, pageText: string | null, claim: ClaimData): IdentityResult
```

**Rules** (spec §4.7a), with `N = normalise`:
- rc, rcBack, policy: `N(claim.vehicle.registrationNumber)` must be a substring of `N(text)`.
- rc, rcBack also: the last 6 characters of `N(claim.vehicle.chassisNumber)` must appear. Both checks must pass for `match`.
- policy also: `N(claim.policy.policyNumber)` must appear. Both must pass.
- claimForm: `N(claim.policy.claimNumber)` or `N(claim.vehicle.registrationNumber)` must appear.
- dl, dlBack: every word (length ≥ 2) of `claim.driver.name`, uppercased, must appear in `text.toUpperCase()`.
- aadhaar, pan, ckyc, kycOther: all the words of `claim.policy.insuredName`, or all the words of `claim.driver.name`, must appear.
- Any other type → `cantCheck`.
- `pageText` null or empty, or every claim field this type needs is empty → `cantCheck` (Review Focus 2). A partly empty pair (e.g. a registration but no chassis) checks only the present one.
- **`found` on a mismatch:**
  - Registration: the first `/[A-Z]{2}\s?-?\d{1,2}\s?-?[A-Z]{0,3}\s?-?\d{3,4}/` in the uppercased text, normalised.
  - Names: undefined. KYC and DL never echo text.
  - `expected` is the claim's normalised value for registration, else undefined.

- [ ] **Step 1: Write the failing tests:**
  - `identity: registration formats match` (Review Focus 1): claim `MH-18-AB-1234`, text `'Regn No MH 18 AB 1234'` → match.
  - `identity: other claim's RC is mismatch with found value`: text `'MH 12 XY 9999'` → `{status:'mismatch', found:'MH12XY9999', expected:'MH18AB1234'}`.
  - `identity: empty claim field is cantCheck` (Review Focus 2).
  - `identity: scanned page is cantCheck`.
  - `identity: aadhaar matches insured name and never returns found`.
  - `identity: rc needs registration and chassis tail`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Confirm the field paths against `src/types/claim.ts` (`vehicle.registrationNumber`, `vehicle.chassisNumber`, `driver.name`, `policy.policyNumber`, `policy.claimNumber`, `policy.insuredName`).
- [ ] **Step 4:** Run `npx vitest run src/lib/documents`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(documents): check a document belongs to this claim`.

### Task 5: Recipes, checklist and the missing message

**Files:** Create `src/lib/documents/kit/recipes/uiic-claimsurvey.ts`, `recipes/nia-nontieup.ts`, `recipes/nia-kia.ts`, `recipes/index.ts` and `src/lib/documents/kit/checklist.ts`. Test `src/lib/documents/__tests__/checklist.test.ts`.

**Interfaces — Produces:**

```ts
interface RecipeBox { id: string; label: string; mandatory: boolean; accepts: DocType[];
  combine: 'single' | 'merge'; mergeMandatory?: DocType[]; formats: string[] }
interface Recipe { portal: 'nia' | 'uiic'; flow: string; title: string; provisional?: boolean; boxes: RecipeBox[] }
recipeFor(claim: ClaimData): Recipe | null
// insurerShortForm(claim.policy.insurerName): 'NIA'/'NEW INDIA'… → nia; 'UIIC'… → uiic (use the existing insurers.ts mapping)
// flow = claim.portalFlow ?? (nia ? 'nontieup' : 'claimsurvey')
RECIPES: Recipe[]

type BoxStatus = 'ready' | 'check' | 'missing' | 'empty' | 'notNeeded';
interface BoxState { box: RecipeBox; status: BoxStatus; parts: Array<{ docId: string; pages: number[] }>;
  missingTypes: DocType[]; reasons: string[]; alternatives: number }
checklist(recipe: Recipe, claim: ClaimData, opts: { device: string; identity: Record<string, Record<number, IdentityResult>> }): BoxState[]
missingMessage(claim: ClaimData, states: BoxState[]): string
```

**Recipe data** (spec §4.5, defaults §8). Default formats are `['.pdf','.jpg','.jpeg','.png']`; boxes that take the NIA Excel also allow `.xlsx`.

- **`uiic-claimsurvey`**
  - Mandatory, single: `surveyReport` "Survey Report"; `billCheckReport` "Assessment Details"; `estimate` "Estimate"; `invoice` "Invoice"; `reinspectionReport` "Re-Inspection Report".
  - Optional, single: `dl`, `rc`, `photoFront`, `photoRear`, `photoLeft`, `photoRight`, `chassisPhoto` (provisional per §8(d)), `permit`, `fitness`, `fir`, `csr`, `pan`, `aadhaar`, `cancelledCheque`, `claimForm`, `dischargeVoucher`, `ckyc`, `investigationReport`, and `feeBill` labelled "Other 1 (Fee Bill)".
- **`nia-nontieup`**
  - Mandatory: `dl` "Driving License"; `rc` "Registration Certificate"; `claimForm` "Claim Form"; `chassisPhoto` "Chassis Number Photograph"; `odometerPhoto` "Odometer Reading Photograph".
  - Mandatory merge: `claimRelatedDocs` "Claim Related Documents", accepts `[policy, aadhaar, pan, ckyc, cancelledCheque, claimIntimation, kycOther]`, `mergeMandatory: [aadhaar, policy]`.
  - Optional: `estimate`; `puc`; `spot` "Spot Photograph and Spot Survey Report" (merge `[spotPhotos]`); `permitFitness` "Permit-Fitness" (merge `[permit, fitness]`); `fir` "FIR and Police Records"; `cancelledCheque`; `photos` "Front/Rear/Side Photograph" (merge `[photoFront, photoRear, photoLeft, photoRight]`); `reinspectionReport` "Re-inspection"; `invoice`; `others` "Others" (merge `[surveyReport, billCheckReport, feeBill]`).
- **`nia-kia`** (`provisional: true`): mandatory `rc`, `dl`, `claimForm`, and a merge `claimRelatedDocs` identical to non-tieup's.

**`checklist` rules, per box:**
1. If the box id is in `claim.notNeededBoxes[portal-flow]` → `notNeeded`.
2. Candidates are pages on entries **on this device** (`onThisDevice`) whose label type is in `accepts`, in `accepts` order, then file order, then page order.
3. For `single`, take the newest entry (`addedAt`) that has a matching page, using all its matching pages. `alternatives` = the number of other entries that match.
4. For `merge`, take, for each accepted type in order, the newest entry's matching pages. `missingTypes` = the `mergeMandatory` types with no page.
5. Status:
   - no parts → `missing` if mandatory, else `empty`;
   - a merge with `missingTypes.length > 0` → `missing`;
   - any part page unconfirmed, any identity `mismatch` without `overrideAt`, or any part whose only source is `text/html` (C1) → `check`, with a `reasons` entry from the copy below;
   - otherwise `ready`.
6. `.docx` and `.xlsx` parts are allowed only in `single` boxes whose `formats` include their extension. In a merge they're dropped and a reason is added.

**Reason copy** (exact strings):
- `"{label} is a guess. Confirm it in Pages."`
- `"{label} doesn't match this claim."`
- `"File the PDF of this report."`
- `"{file} can't be merged (Word/Excel)."`

**`missingMessage`:** returns `''` when nothing is missing. Otherwise:

`Claim {claimNo} ({registration}): please send the following documents: {items}.`

- `{items}` joins, with `', '`, the `DOC_TYPE_LABEL` of each missing single box's first `accepts` type and each merge's `missingTypes`, de-duplicated, in box order.
- `{claimNo}` is `policy.claimNumber`, and `{registration}` is `vehicle.registrationNumber` as entered.

- [ ] **Step 1: Write the failing tests:**
  - `recipeFor picks nia non-tieup by default and kia when portalFlow is kia`
  - `recipeFor returns null for an insurer with no recipe`
  - `checklist: ready when all confirmed`
  - `checklist: guess makes check with reason`
  - `checklist: merge box missing mandatory parts` (Review Focus 5): only a `cancelledCheque` page → `missing`, `missingTypes` = `['aadhaar','policy']`
  - `checklist: html-only report is check with File the PDF`
  - `checklist: not needed box`
  - `checklist: newest wins and alternatives counted`
  - `checklist: mismatch without override is check`
  - `missingMessage exact text` (assert the full string for a claim with chassis photo and PAN missing)
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run src/lib/documents`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(documents): portal recipes, checklist and missing-documents message`.

### Task 6: Building upload files and the review state

**Files:**
- Create `src/lib/documents/kit/build.ts` and `src/lib/documents/kit/review.ts`.
- Modify `src/lib/documents/folder.ts` (add `writePortalUpload`) and `package.json` (`pdf-lib`).
- Test `src/lib/documents/__tests__/build.test.ts` and `review.test.ts`.

**Interfaces — Produces:**

```ts
planBox(state: BoxState): Array<{ docId: string; pages: number[] }>        // pages sorted ascending per doc, docs in state order
buildBoxFile(box: RecipeBox, plan: ReturnType<typeof planBox>,
             read: (docId: string) => Promise<{ blob: Blob; mime: string; name: string }>): Promise<{ blob: Blob; name: string; pages: number }>
sha256Hex(blob: Blob): Promise<string>                                      // crypto.subtle
newUploadSet(recipe: Recipe, claim: ClaimData, built: Record<string, { name; size; pages; sha256; sources: string[] }>): UploadSet
markReviewed(set: UploadSet, boxId: string | 'all', now: string, blocked?: string[]): UploadSet  // 'all' refused while blocked is non-empty; a blocked boxId is refused
invalidate(set: UploadSet, change: { docIds?: string[]; claimFields?: boolean }): UploadSet  // clears reviewedAt on boxes whose sources include a changed doc; claimFields → all boxes
isReviewed(set: UploadSet): boolean   // every box in set.boxes has reviewedAt
writePortalUpload(claim: ClaimData, portalTitle: string, files: Array<{ name: string; blob: Blob }>): Promise<void>
// writes to "<claim folder>/Portal Upload/<portalTitle>/<name>", overwriting; creates folders; never touches other paths
```

**`buildBoxFile` rules:**
- **Single box** whose plan is one whole file (every page of that doc) in an accepted format → return the original blob as is, with name `<box.label><original ext>`.
- **Otherwise** build a PDF with `pdf-lib`:
  - PDF sources: `copyPages` of the planned pages (1-based → 0-based).
  - JPEG/PNG sources: one A4 portrait page (595×842 pt) with the image scaled to fit inside a 36 pt margin, keeping its aspect ratio.
  - The name is `<box.label>.pdf`.

**`markReviewed('all')`** must be refused (return the set unchanged) when the caller says a box is blocked. The UI computes that from the `BoxState`s, and `review.ts` takes it as a `blocked: string[]` third argument: `markReviewed(set, boxId, now, blocked?)`.

- [ ] **Step 1:** Run `npm install pdf-lib@^1.17.1`. Confirm `package.json` lists it.
- [ ] **Step 2: Write the failing tests.** `pdf-lib` runs in node, so create small PDFs in the test with `PDFDocument.create()`.
  - `planBox: non-adjacent pages collected in order` (Review Focus 3): RC labelled on p3 and p7 → plan `[{docId, pages:[3,7]}]`, and the built PDF has 2 pages.
  - `build: whole single file is passed through unchanged` (same bytes, via sha256).
  - `build: merge of two PDFs and one PNG gives page count sum`.
  - `review: source change cancels box review` (Review Focus 4).
  - `review: claimFields change cancels all`.
  - `review: markReviewed all refused while a box is blocked`.
  - `review: isReviewed only when every box reviewed`.
- [ ] **Step 3:** Run `npx vitest run src/lib/documents/__tests__/build.test.ts src/lib/documents/__tests__/review.test.ts`. Expected: FAIL.
- [ ] **Step 4:** Implement. `writePortalUpload` uses `getClaimDirHandle` and `getDirectoryHandle(..., {create:true})` for `Portal Upload` and the portal title, writing the same way `writeDocuments` does (via `.part` then rename, if that's how `writeDocuments` writes; follow it).
- [ ] **Step 5:** Run `npx vitest run src/lib/documents`, then `npm test`, then `npx tsc --noEmit -p .`. Expected: PASS and clean.
- [ ] **Step 6:** Commit: `feat(documents): build portal upload files and track their review`.

### Task 7: The kit hook and the claim-folder location choice

**Files:** Create `src/lib/documents/kit/useDocumentKit.ts`. Modify `src/components/documents/ClaimFolderCard.tsx` and `src/lib/documents/useClaimDocuments.ts` (scan wiring only). Test `src/lib/documents/__tests__/kit-orchestrate.test.ts` for the pure orchestration helper.

**Interfaces — Produces:**
- `labelClaim(claim: ClaimData, read: (doc) => Promise<Blob>, device: string): Promise<{ claim: ClaimData; texts: Record<string, (string|null)[]> }>`, a pure-ish orchestrator in `kit/orchestrate.ts`. For each entry on this device:
  - entries with no `pages` or with unlabelled pages: read once, `pageCountOf`, `pageTexts`, then `labelEntry`;
  - entries that are fully labelled are skipped.
  - It returns the updated claim plus the page texts, for identity checks.
- `useDocumentKit()` returns `{ recipe, states, identity, missingText, setFlow, setNotNeeded, setLabels(docId, pages: number[], type), confirmAll(), useAnyway(docId, page), build(), review: { set, markReviewed, blocked } }`.
  - It runs `labelClaim` after every Scan, and when the claim's documents change.
  - Identity results are computed from the texts per labelled page.
  - Any claim edit to the identity fields calls `invalidate(set, {claimFields:true})`.
  - Any label change or fingerprint reset calls `invalidate(set, {docIds})`.
- **Location choice in `ClaimFolderCard`:**
  - Two radio options stored in `localStorage['surveyos_claim_folders_location']`: `'local'` (default) "A folder on this computer", and `'driveDesktop'` "Google Drive (using Google Drive for desktop)".
  - Choosing `driveDesktop` shows the guide, as exact copy:
    1. "Install Google Drive for desktop from google.com/drive/download and sign in."
    2. "In its settings choose **Mirror files** (works offline), or **Stream files**."
    3. "Click **Choose folder** below and pick your claims folder inside the Google Drive drive (usually `G:\My Drive\…`)."
  - The existing pick-root flow is unchanged.
  - While Scan or Build reads files under `driveDesktop`, show `Fetching from Google Drive…` (C8).

- [ ] **Step 1: Write the failing tests** for `labelClaim`, with a fake `read`:
  - `labelClaim labels new entries once`;
  - `labelClaim skips fully labelled entries` (`read` not called);
  - `labelClaim ignores entries not on this device`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `orchestrate.ts`, the hook, the scan wiring and the location radio and guide.
- [ ] **Step 4:** Run `npx vitest run src/lib/documents`, then `npx tsc --noEmit -p .`. Expected: PASS and clean.
- [ ] **Step 5:** Commit: `feat(documents): label claim pages after scan; choose where claim folders live`.

### Task 8: Pages view (labelling)

**Files:** Create `src/components/documents/PageLabelGrid.tsx`. Modify `src/components/tabs/DocumentsTab.tsx` (add a "Pages" section below the documents list).

**Consumes:** `useDocumentKit().setLabels`, `confirmAll`, `useAnyway`, and `identity`; thumbnails from the existing `loadPdf` in `src/lib/photos/pdf-to-images.ts`, rendered lazily with an `IntersectionObserver`.

**UI rules:**
- Grouped by file.
- Each page shows its label chip (`DOC_TYPE_LABEL`), with a **dotted** border when unconfirmed and **solid** when confirmed.
- Identity marks: green "matches this claim"; red "doesn't match: shows {found}", or "doesn't match" for names; grey "can't check".
- Click selects a page, Shift+click a range.
- A type bar lists the types the current recipe still needs first, then all types. Clicking one calls `setLabels` for the selection.
- **Confirm all suggestions** button.
- A red page shows **Use anyway**.
- Images and Word/Excel files show one tile.
- Strings are surveyor copy and never show KYC numbers.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npx tsc --noEmit -p .` and `npm test`. Expected: clean and PASS.
- [ ] **Step 3:** Commit: `feat(documents): pages view to label and confirm document pages`.

### Task 9: Portal checklist panel

**Files:** Create `src/components/documents/PortalChecklist.tsx`. Modify `DocumentsTab.tsx` (mount it above the documents list).

**UI** (spec §4.6 mock):
- Header: `{recipe.title}` plus a flow switcher (shown for NIA: Non-tieup / KIA tie-up) and the counts `"{r} of {n} ready · {m} missing · {c} to check"`.
- One row per box: icon and word (Ready ✓ / Check ! / Missing ✗ / Not needed); the source files and pages (`"Documents.pdf p3–4"`); the reasons; "2 found" when `alternatives > 0`; and a **Not needed for this claim** toggle.
- Footer buttons:
  - **Copy missing-documents message**, disabled when `missingText === ''`. It copies, then shows `Copied` for 2 s.
  - **Label pages** scrolls to the Pages view.
  - **Build upload files** (Task 10).
- When `recipe === null`: `No portal list for this insurer yet.`
- The `provisional` recipe shows a muted line: `This list is provisional. Check it against the portal.`

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npx tsc --noEmit -p .` and `npm test`. Expected: clean and PASS.
- [ ] **Step 3:** Commit: `feat(documents): portal checklist with missing-documents message`.

### Task 10: Build and Review upload set

**Files:** Create `src/components/documents/UploadReview.tsx`. Modify `PortalChecklist.tsx` (wire **Build upload files**).

**UI rules:**
- **Build upload files** is enabled when no mandatory box is `missing`. It builds every `ready` or `check` box that has parts, writes them with `writePortalUpload`, and then opens the review.
- A `check` box is built but marked "needs you", and can't be ticked until it's `ready` (blocked).
- The review lists each built box: thumbnails of every page of the built file, the page count, size (KB/MB), the identity marks, and a **Looks right** checkbox.
- **All look right** is disabled while any box is blocked.
- Once `isReviewed`, the header says: `Upload set reviewed. Upload these files on the portal: Portal Upload/{title}/.`
- Any invalidation (shown on the next render) un-ticks the affected boxes and shows `Changed since review: check again.`

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npx tsc --noEmit -p .` and `npm test`. Expected: clean and PASS.
- [ ] **Step 3:** Commit: `feat(documents): build and review the portal upload set`.

### Task 11: Release notes

**Files:** Modify `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md` and `Changelog.md`, and `docs/portal-integration.md` (§6 Progress: a document-kit line).

- [ ] **Step 1:**
  - **Tasks.md:** add an "In Progress — Claim document kit" line: Phases 1–2 done, not deployed, owner to confirm recipe defaults §8(b)–(d), Phases 3–5 next.
  - **Changelog:** add a dated entry listing the features and the final test count.
- [ ] **Step 2:** Run `npm test` and `npx tsc --noEmit -p .`. Strict-decode the edited docs.
- [ ] **Step 3:** Commit: `docs: claim document kit phases 1–2`.
