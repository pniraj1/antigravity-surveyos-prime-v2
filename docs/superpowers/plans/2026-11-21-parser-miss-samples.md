# Parser-Miss Samples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the row parser gives up on a digital estimate or final bill, a copy of that PDF goes silently to Firestore. The admin downloads it from the admin panel, and that deletes it; anything not downloaded is auto-deleted after 15 days.

**Architecture:** A new module `src/lib/ai/parser-sample.ts` holds everything. Surveyor side: one fire-and-forget call at the parser-decline line in `processor.ts`. Admin side: list, download and delete. The PDF is stored as raw Firestore `Bytes`, which avoids the base64 bloat, in pieces of at most 900,000 bytes under `parserSamples/{sha256}/parserSampleChunks/{i}`. The SHA-256 doc id means re-sending the same file is denied by the rules (create only, no update), which de-duplicates it for free. A Firestore TTL policy on `expireAt` does the 15-day delete. The admin UI is one card in the existing Dev Notes tab, so no new nav tab.

**Tech Stack:** Next.js 16 client, Firebase JS SDK Firestore (`Bytes`, `writeBatch`), Web Crypto `crypto.subtle.digest`, File System Access `showSaveFilePicker` (with an anchor fallback), Vitest.

**Spec:** Owner decisions in chat on 2026-11-21 (no separate spec doc):
- Store the failed PDF in Firestore.
- Admin downloads it from the admin panel; the download deletes it straight away.
- Firestore auto-deletes it after 15 days.
- No notification to the surveyor, and no asking them.

## Global Constraints

- Silent: no toast, no UI and no console noise on the surveyor side. Any failure (network, rules denial, duplicate, quota) is swallowed and never touches the extraction result.
- Only estimates and final bills that reached the parser and were declined. That means `parserEligible` was true: one file, all pages text. Nothing else is sent.
- Only `application/pdf`, and at most 6,000,000 bytes per file (changed after final review: 10 MiB request limit). Bigger files are skipped.
- A piece is at most 900,000 bytes, under Firestore's 1 MiB document limit.
- Retention: `expireAt` = upload time + 15 days, on the sample doc and on every piece. TTL does not cascade to subcollections, so each piece needs its own field.
- Stored metadata, exactly: `uid`, `docType`, `fileName`, `reason`, `pages`, `size`, `chunks`, `createdAt`, `expireAt`. No claim id, no insurer, no extracted data.
- Surveyors can only create. Only admin can read and delete. Nobody can update.
- Deleting happens only after the file is confirmed saved: `showSaveFilePicker` write closed, or the admin confirms in the fallback. Cancelling the save never deletes.
- Firebase project for rules deploy: `surveyos-v2-antigravity-in`. Never run a bare `firebase deploy`, because the default target is the dead site. No deploy is part of executing this plan; deploy needs the owner's approval.
- Prime ↔ SurveyOS Scan impact: none. Report it as "none" at the end.

## Review Focus

1. **Same bill extracted twice, or by two surveyors:** the second send must be denied quietly and must not create a second copy. Pinned by the rules (create only) and by the Task 1 test `swallows a rejected write`.
2. **A scanned PDF or a photo:** it never reaches the parser, so nothing is sent. Pinned by the Task 1 test `skips non-pdf and oversized files` and by the hook placement (inside the `parserEligible` branch only).
3. **Admin cancels the save dialog:** the sample must stay in Firestore. Pinned by the Task 3 test `does not delete when the save is cancelled`.
4. **Signed-out or offline surveyor:** `auth.currentUser` is null, or the write rejects, so the send is skipped or swallowed and extraction carries on. Pinned by the Task 1 tests `skips when signed out` and `swallows a rejected write`.
5. **Pieces joined in the wrong order:** the downloaded PDF must equal the uploaded one byte-for-byte. Pinned by the Task 1 round-trip test and by `chunk` sorting on the field `i` in Task 3.

---

### Task 1: Sample sender (surveyor side) and the decline hook

**Files:**
- Create: `src/lib/ai/parser-sample.ts`
- Modify: `src/lib/ai/processor.ts:410` (the `console.log('[Parser] declined: …')` line)
- Test: `src/lib/ai/__tests__/parser-sample.test.ts`

**Interfaces:**
- Produces:
  - `export const CHUNK_BYTES = 900_000`, `export const MAX_SAMPLE_BYTES = 8_000_000`, `export const RETENTION_DAYS = 15`
  - `export const SAMPLES = 'parserSamples'`, `export const CHUNKS = 'parserSampleChunks'`
  - `export function splitBytes(b: Uint8Array, size?: number): Uint8Array[]`
  - `export function joinBytes(parts: Uint8Array[]): Uint8Array`
  - `export function expiryFrom(now: Date): Date` (now + 15 days)
  - `export interface ParserSampleMeta { uid: string; docType: string; fileName: string; reason: string; pages: number; size: number; chunks: number; createdAt: Timestamp; expireAt: Timestamp }`
  - `export async function sendParserSample(o: { file: File; docType: string; reason: string; pages: number }): Promise<void>`: it never throws.

- [ ] **Step 1: Write the failing tests.** Mock `@/lib/firebase/config` as `{ db: {}, auth: { currentUser: { uid: 'u1' } } }`, and mock `firebase/firestore` (`doc`, `writeBatch` returning `{ set: vi.fn(), commit }`, `Bytes.fromUint8Array`, `Timestamp.fromDate`).

```ts
it('splits and joins back unchanged', () => {
  const b = Uint8Array.from({ length: 2_000_001 }, (_, i) => i % 251);
  const parts = splitBytes(b);
  expect(parts.map(p => p.length)).toEqual([900_000, 900_000, 200_001]);
  expect(joinBytes(parts)).toEqual(b);
});
it('expires 15 days later', () => {
  expect(expiryFrom(new Date('2026-11-21T00:00:00Z')).toISOString()).toBe('2026-12-06T00:00:00.000Z');
});
it('skips non-pdf and oversized files', async () => {
  await sendParserSample({ file: new File(['x'], 'a.png', { type: 'image/png' }), docType: 'estimate', reason: 'r', pages: 1 });
  await sendParserSample({ file: new File([new Uint8Array(8_000_001)], 'a.pdf', { type: 'application/pdf' }), docType: 'estimate', reason: 'r', pages: 1 });
  expect(commit).not.toHaveBeenCalled();
});
it('skips when signed out', async () => { /* auth.currentUser = null → commit not called */ });
it('writes pieces then the sample doc, keyed by sha-256', async () => {
  // 1,000,000-byte pdf → batch.set called 3 times: chunk 0, chunk 1, then the sample doc;
  // the sample doc data has chunks: 2, size: 1_000_000, uid: 'u1', and exactly the 9 meta keys;
  // doc() was called with SAMPLES and a 64-char hex id
});
it('swallows a rejected write', async () => {
  commit.mockRejectedValueOnce(new Error('permission-denied'));
  await expect(sendParserSample(/* small pdf */)).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run, and expect a FAIL (module missing).** `npx vitest run src/lib/ai/__tests__/parser-sample.test.ts`

- [ ] **Step 3: Implement the surveyor side of `parser-sample.ts`.**
  - The id is the hex string of `crypto.subtle.digest('SHA-256', bytes)`.
  - One `writeBatch`: the piece docs `parserSamples/{id}/parserSampleChunks/{i}` with `{ i, uid, data: Bytes.fromUint8Array(part), expireAt }` first, then the sample doc. A single batch is atomic, so the admin never sees half a sample.
  - Firestore caps a batch at 10 MiB. At 8 MB of pieces plus metadata, this fits.
  - The whole body sits in `try { … } catch { /* ponytail: silent by owner decision */ }`, with no logging.

- [ ] **Step 4: Hook it into `processor.ts`.** Replace the decline log line with a lazy, fire-and-forget call. The dynamic import keeps Firebase out of processor tests:

```ts
void import('./parser-sample').then(m => m.sendParserSample({ file: files[0], docType: key, reason: parsed.reason, pages: totalPages })).catch(() => {});
```

  Keep the existing `console.log` line above it unchanged.

- [ ] **Step 5: Run the new test file and the existing AI tests.** Run `npx vitest run src/lib/ai`. All tests must pass, with no new failures compared with `main`.

- [ ] **Step 6: Commit.** `git commit -m "feat(parser): send declined digital PDFs to parserSamples"`

---

### Task 2: Firestore rules and TTL

**Files:**
- Modify: `firestore.rules`. Add the block after the `/newSignups/{uid}` match (around line 94).

**Interfaces:**
- Consumes: collection names `parserSamples` and `parserSampleChunks`, and the meta keys from Task 1.

- [ ] **Step 1: Add the rules.**

```
// Parser-miss samples: a declined digital estimate/bill, kept ≤15 days for parser work.
// Surveyors create only (re-sending the same file = update = denied, which de-duplicates it). Admin reads and deletes.
// ponytail: any signed-in user can create; TTL bounds the cost. Add a per-uid daily cap if abused.
match /parserSamples/{id} {
  allow create: if isSignedIn()
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.keys().hasOnly(['uid','docType','fileName','reason','pages','size','chunks','createdAt','expireAt'])
    && request.resource.data.docType in ['estimate', 'final-bill']
    && request.resource.data['size'] <= 8000000   // bracket form: `.size` reads like the map's size() method
    && request.resource.data.expireAt is timestamp
    && request.resource.data.expireAt <= request.time + duration.value(16, 'd');
  allow read, delete: if isAdmin();

  match /parserSampleChunks/{i} {
    allow create: if isSignedIn()
      && request.resource.data.uid == request.auth.uid
      && request.resource.data.keys().hasOnly(['i','uid','data','expireAt'])
      && request.resource.data.data is bytes
      && request.resource.data.data.size() <= 900000
      && request.resource.data.expireAt is timestamp
      && request.resource.data.expireAt <= request.time + duration.value(16, 'd');
    allow read, delete: if isAdmin();
  }
}
```

- [ ] **Step 2: Check the rules compile.** Run `npx firebase-tools@latest --project surveyos-v2-antigravity-in deploy --only firestore:rules --dry-run`. Expected: `rules file firestore.rules compiled successfully`. If `--dry-run` is not supported by the installed CLI, report that and skip; do NOT run a real deploy.

- [ ] **Step 3: Commit.** `git commit -m "feat(rules): parserSamples create-only for surveyors, admin read/delete"`

- [ ] **Step 4 (OWNER, after deploy approval, not for subagents):** turn on TTL for both collection groups.

```powershell
gcloud firestore fields ttls update expireAt --collection-group=parserSamples --enable-ttl --project=surveyos-v2-antigravity-in
```
```powershell
gcloud firestore fields ttls update expireAt --collection-group=parserSampleChunks --enable-ttl --project=surveyos-v2-antigravity-in
```
  The other route is Firebase console → Firestore → TTL → Create policy, once for each group. TTL deletes usually run within 24 hours after `expireAt`.

---

### Task 3: Admin card (list, download, delete)

**Files:**
- Modify: `src/lib/ai/parser-sample.ts` (add the admin functions)
- Create: `src/components/admin/ParserSamplesCard.tsx`
- Modify: `src/components/admin/tabs/DevNotesTab.tsx`. Render `<ParserSamplesCard />` right after `<BramhaIndexCard />`.
- Test: `src/components/admin/__tests__/parser-samples-card.test.tsx`

**Interfaces:**
- Consumes: `SAMPLES`, `CHUNKS`, `joinBytes` and `ParserSampleMeta` from Task 1.
- Produces, in `parser-sample.ts`:
  - `export async function listParserSamples(): Promise<(ParserSampleMeta & { id: string })[]>`: newest first, `orderBy('createdAt','desc')`.
  - `export async function loadParserSample(id: string): Promise<Blob>`: reads the pieces, sorts them by `i`, joins them, returns `type: 'application/pdf'`.
  - `export async function deleteParserSample(id: string, chunks: number): Promise<void>`: one `writeBatch` deleting every piece and the sample doc.
  - `export async function saveBlob(blob: Blob, name: string): Promise<boolean>`: true only when saved.
    - It uses `window.showSaveFilePicker` and returns true after `writable.close()` resolves. On `AbortError` it returns false.
    - Without the picker (Firefox or Safari), it falls back to an anchor `download` click, then returns `window.confirm('Did the file save? OK deletes it from the server.')`.

- [ ] **Step 1: Write the failing tests.** Mock `@/lib/ai/parser-sample` and render the card.

```ts
it('lists samples with reason, pages and days left', async () => {
  // listParserSamples → one sample {fileName:'MH40_INV.pdf', reason:'no header line…', pages:13, expireAt in 10 days}
  // expect text 'MH40_INV.pdf', '13 pages', 'no header line', '10 days left'
});
it('deletes after a confirmed save and drops the row', async () => {
  // saveBlob → true; click 'Download' → deleteParserSample called with (id, chunks); row gone
});
it('does not delete when the save is cancelled', async () => {
  // saveBlob → false; click 'Download' → deleteParserSample not called; row still there
});
it('shows an empty state', async () => { /* [] → 'No unread bills right now.' */ });
```

- [ ] **Step 2: Run, and expect a FAIL.** `npx vitest run src/components/admin/__tests__/parser-samples-card.test.tsx`

- [ ] **Step 3: Implement the admin functions and `ParserSamplesCard`.**
  - Copy the card shell from `BramhaIndexCard` in `DevNotesTab.tsx`: same border and header classes, a `FileWarning` icon, and the title "Bills the parser couldn't read".
  - One line of copy under the title: "Download a bill to work on the parser. Downloading deletes it from the server; anything left is deleted automatically 15 days after it arrived."
  - Each row shows the file name, doc type, pages, size in KB, the reason, the date received and "N days left". It has a `Download` button that shows a spinner while busy.
  - Load the list on mount. A failure shows a `toast.error`. This is the admin side, so errors are not silent here.
  - Saved file name: `${fileName}`, or `parser-sample-${id.slice(0,8)}.pdf` when the name is empty.

- [ ] **Step 4: Run the card tests and the admin suite, and expect them all to PASS.** Run `npx vitest run src/components/admin`, then `npx tsc --noEmit`, which should report no new errors.

- [ ] **Step 5: Commit.** `git commit -m "feat(admin): parser samples card, download deletes"`

---

### Task 4: Vault records

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`. Replace the 2026-11-14 "Next with owner: learning loop…" line with this feature's status.
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`. Add an entry for 2026-11-21.
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-11-21-parser-miss-samples.md`

- [ ] **Step 1: Write the entries.**
  - Status: not deployed, and TTL not turned on. Owner steps pending: deploy rules and hosting to `surveyos-v2-antigravity-in`, run the two `gcloud` TTL commands, then decline one real digital PDF and download it from Dev Notes.
  - Record that the owner chose silent collection with no notice to the surveyor, and that a Terms or Privacy line was offered and not added. This is an open DPDP item to keep visible.
  - Prime ↔ Scan coupling: none.

- [ ] **Step 2: Commit.** `git commit -m "docs(kb): parser-miss samples status"`
