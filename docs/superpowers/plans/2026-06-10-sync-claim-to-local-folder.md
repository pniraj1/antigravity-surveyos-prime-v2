# Sync Claim Documents to a Local Folder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a surveyor pick a local root folder once, then sync a Sync claim's documents/photos into a per-claim folder (real files in Explorer), downloading each file once and incrementally — with a "Sync all" bulk action, a per-document "✓ on disk" indicator, and local-first reading so synced docs open with no Worker call.

**Architecture:** Two phases. **Phase A (SurveyOS Sync Worker):** extend the bridge so a document's *all* files are listed in the claim manifest (`files[]`) and individually streamable (`/file/:claimId/:docId/:fileIndex`). **Phase B (SurveyOS-Prime-V2):** a `src/lib/local-sync/` engine built on the File System Access API — pure nomenclature + manifest-diff logic, a directory-handle store (IndexedDB), a sync engine, a local-first file resolver, a React hook, and UI wired into `SyncDrivePicker`.

**Tech Stack:** Phase A — Cloudflare Workers, Hono, Vitest. Phase B — Next.js 16 / React 19 / TypeScript, `idb`, File System Access API, Vitest, sonner toasts.

**Spec:** `docs/superpowers/specs/2026-06-10-sync-claim-to-local-folder-design.md`

**Repos / working dirs:**
- Worker: `C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS Sync\worker`
- Prime: `C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2`

> **Phase ordering:** Complete and **deploy** Phase A (Task 3) before starting Phase B Task 4's manual verification — Prime's new `files[]`/`fileIndex` calls require the deployed Worker. Phase B unit tests do not require the deployed Worker.

---

## File structure

**Phase A — Worker** (`SurveyOS Sync/worker/`)
| File | Responsibility | Action |
|---|---|---|
| `src/lib/bridge-helpers.ts` | Add pure `toDocFiles()` + `resolveFileId()` | Modify |
| `src/lib/__tests__/bridge-helpers.test.ts` | Unit tests for the two helpers | Create |
| `src/routes/bridge.ts` | Use `toDocFiles` in `/claims/:id`; add `/file/:claimId/:docId/:fileIndex` | Modify |

**Phase B — Prime** (`SurveyOS-Prime-V2/`)
| File | Responsibility | Action |
|---|---|---|
| `src/lib/sync-bridge/types.ts` | Add `BridgeFileMeta`; add `files` to `SyncDocMeta` | Modify |
| `src/lib/sync-bridge/client.ts` | Add `fetchSyncDocFileAt(token, claimId, docId, fileIndex, docType)` | Modify |
| `src/lib/local-sync/fs-access.d.ts` | Ambient types for File System Access API | Create |
| `src/lib/local-sync/nomenclature.ts` | **Pure** name/path derivation | Create |
| `src/lib/local-sync/sync-manifest.ts` | Manifest types + **pure** `diffManifest`/`isDocSynced`; read/write helpers | Create |
| `src/lib/local-sync/directory-handle.ts` | Pick + persist root handle (IndexedDB), permission, support check | Create |
| `src/lib/local-sync/sync-engine.ts` | `syncClaim` + `syncAllClaims` orchestration | Create |
| `src/lib/local-sync/local-source.ts` | `getLocalFile` local-first resolver | Create |
| `src/lib/local-sync/useLocalSync.ts` | React hook: folder state, sync actions, claim sync-state | Create |
| `src/lib/local-sync/__tests__/*.test.ts` | Unit tests for pure modules | Create |
| `src/components/sync-bridge/SyncDrivePicker.tsx` | Sync button (per-claim), Sync-all, "✓ on disk" badge, local-first pick | Modify |

---

# PHASE A — Worker Bridge Extension

## Task 1: Pure bridge helpers for multi-file docs (TDD)

**Files:**
- Modify: `src/lib/bridge-helpers.ts`
- Create: `src/lib/__tests__/bridge-helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/bridge-helpers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toDocFiles, resolveFileId } from '../bridge-helpers'

describe('toDocFiles', () => {
  it('maps a multi-file slot to indexed entries', () => {
    const doc = {
      mimeType: 'image/jpeg', fileSizeKb: 0, file_id: 'legacy',
      files: [
        { file_id: 'a', mimeType: 'image/jpeg', fileSizeKb: 12 },
        { file_id: 'b', mimeType: 'image/png', fileSizeKb: 34 },
      ],
    }
    expect(toDocFiles(doc)).toEqual([
      { fileIndex: 0, mimeType: 'image/jpeg', fileSizeKb: 12 },
      { fileIndex: 1, mimeType: 'image/png', fileSizeKb: 34 },
    ])
  })

  it('maps a legacy single-file doc to one entry at index 0', () => {
    const doc = { mimeType: 'application/pdf', fileSizeKb: 50, file_id: 'only' }
    expect(toDocFiles(doc)).toEqual([{ fileIndex: 0, mimeType: 'application/pdf', fileSizeKb: 50 }])
  })

  it('returns [] when there is no file at all', () => {
    expect(toDocFiles({ mimeType: 'image/jpeg', fileSizeKb: 0 })).toEqual([])
  })
})

describe('resolveFileId', () => {
  const multi = { file_id: 'legacy', files: [{ file_id: 'a' }, { file_id: 'b' }] }
  it('resolves by index from files[]', () => {
    expect(resolveFileId(multi, 0)).toBe('a')
    expect(resolveFileId(multi, 1)).toBe('b')
  })
  it('returns null for an out-of-range index', () => {
    expect(resolveFileId(multi, 2)).toBeNull()
    expect(resolveFileId(multi, -1)).toBeNull()
  })
  it('falls back to legacy file_id only at index 0', () => {
    const legacy = { file_id: 'only' }
    expect(resolveFileId(legacy, 0)).toBe('only')
    expect(resolveFileId(legacy, 1)).toBeNull()
  })
  it('returns null when no file exists', () => {
    expect(resolveFileId({}, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from the worker dir): `npm test -- bridge-helpers`
Expected: FAIL — `toDocFiles`/`resolveFileId` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/lib/bridge-helpers.ts`:
```ts
// ── Multi-file document helpers ─────────────────────────────

interface RawFile { file_id: string; mimeType: string; fileSizeKb: number }
interface RawDoc {
  mimeType?: string
  fileSizeKb?: number
  file_id?: string
  files?: RawFile[]
}

/** One file entry surfaced in the bridge claim manifest. */
export interface BridgeFileMeta {
  fileIndex: number
  mimeType: string
  fileSizeKb: number
}

/** List every file in a document slot. Legacy single-file docs → one entry at index 0. */
export function toDocFiles(doc: RawDoc): BridgeFileMeta[] {
  if (doc.files && doc.files.length > 0) {
    return doc.files.map((f, i) => ({ fileIndex: i, mimeType: f.mimeType, fileSizeKb: f.fileSizeKb }))
  }
  if (doc.file_id) {
    return [{ fileIndex: 0, mimeType: doc.mimeType ?? 'application/octet-stream', fileSizeKb: doc.fileSizeKb ?? 0 }]
  }
  return []
}

/** Resolve the Telegram file_id for a given file index. Returns null if out of range / absent. */
export function resolveFileId(doc: RawDoc, fileIndex: number): string | null {
  if (doc.files && doc.files.length > 0) {
    const f = doc.files[fileIndex]
    return f ? f.file_id : null
  }
  if (fileIndex === 0 && doc.file_id) return doc.file_id
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- bridge-helpers`
Expected: PASS (all cases).

- [ ] **Step 5: Type-check + commit**

```bash
npm run type-check
git add src/lib/bridge-helpers.ts src/lib/__tests__/bridge-helpers.test.ts
git commit -m "feat(bridge): pure helpers to list + resolve all files in a doc slot"
```

---

## Task 2: Wire helpers into the bridge routes

**Files:**
- Modify: `src/routes/bridge.ts`

- [ ] **Step 1: Import the helpers**

In `src/routes/bridge.ts`, update the import from `bridge-helpers`:
```ts
import { toClaimSummary, toDocFiles, resolveFileId } from '../lib/bridge-helpers'
```

- [ ] **Step 2: Add `files[]` to the claim manifest**

In the `/claims/:id` handler, change the `.map((d) => ({ ... }))` block so each document also carries `files`:
```ts
  const documents = claim.documents
    .filter((d) => d.status === 'received' && (d.file_id || (d.files?.length ?? 0) > 0))
    .map((d) => ({
      docId: d.docId,
      docType: d.docType,
      status: d.status,
      mimeType: d.mimeType,
      fileSizeKb: d.fileSizeKb,
      uploadedAt: d.uploadedAt,
      fileCount: d.files?.length ?? (d.file_id ? 1 : 0),
      files: toDocFiles(d),
    }))
```

- [ ] **Step 3: Add the per-file streaming route**

Immediately **after** the existing `router.get('/file/:claimId/:docId', ...)` handler (after its closing `})`), add:
```ts
// GET /api/bridge/file/:claimId/:docId/:fileIndex — stream one specific file in a slot
router.get('/file/:claimId/:docId/:fileIndex', async (c) => {
  const surveyor = c.get('surveyor')
  const claim = await getDocument<SyncClaim>(c.env, 'sync_claims', c.req.param('claimId'))
  if (!claim) return c.json({ ok: false, error: 'Claim not found' }, 404)
  if (claim.telegramId !== surveyor.telegramId) {
    return c.json({ ok: false, error: 'Forbidden' }, 403)
  }

  const doc = claim.documents.find((d) => d.docId === c.req.param('docId'))
  if (!doc) return c.json({ ok: false, error: 'Document not found' }, 404)

  const fileIndex = Number.parseInt(c.req.param('fileIndex'), 10)
  if (!Number.isInteger(fileIndex)) {
    return c.json({ ok: false, error: 'Invalid file index' }, 400)
  }

  const fileId = resolveFileId(doc, fileIndex)
  if (!fileId) return c.json({ ok: false, error: 'No file at this index' }, 404)

  // Per-file mime: prefer the indexed file's own mime, else the doc's.
  const mime = doc.files?.[fileIndex]?.mimeType ?? doc.mimeType ?? 'application/octet-stream'

  let url: string
  try {
    url = await getFileUrl(c.env, fileId)
  } catch {
    return c.json({ ok: false, error: 'Could not resolve file from Telegram' }, 502)
  }

  const upstream = await fetch(url)
  if (!upstream.ok || !upstream.body) {
    return c.json({ ok: false, error: 'File fetch failed' }, 502)
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: PASS. (Note: `SyncDocument` already declares `files?: Array<{ file_id; mimeType; fileSizeKb }>` and `mimeType`, so `toDocFiles(d)` / `resolveFileId(doc, i)` type-check against it.)

- [ ] **Step 5: Commit**

```bash
git add src/routes/bridge.ts
git commit -m "feat(bridge): expose files[] in claim manifest + per-file streaming route"
```

---

## Task 3: Deploy the Worker

**Files:** none (deploy only)

- [ ] **Step 1: Full test + type-check**

Run (worker dir): `npm test && npm run type-check`
Expected: both PASS.

- [ ] **Step 2: Deploy**

Run: `npm run deploy`
Expected: `wrangler deploy` uploads successfully and prints the worker URL
(`https://surveyos-sync-worker.pnirajindia.workers.dev`).

- [ ] **Step 3: Smoke-check the new route shape (optional, needs a real bridge token)**

With a valid token `T` and a known `claimId`, confirm the manifest now includes `files`:
```bash
curl -s -H "Authorization: Bearer T" \
  "https://surveyos-sync-worker.pnirajindia.workers.dev/api/bridge/claims/CLAIMID" | head -c 600
```
Expected: each document object contains a `"files": [ { "fileIndex": 0, ... } ]` array.

---

# PHASE B — Prime Local-Sync Engine

## Task 4: Bridge types + per-file client call (TDD)

**Files:**
- Modify: `src/lib/sync-bridge/types.ts`
- Modify: `src/lib/sync-bridge/client.ts`
- Modify: `src/lib/sync-bridge/__tests__/client.test.ts`

- [ ] **Step 1: Add the manifest file type**

In `src/lib/sync-bridge/types.ts`, add a new interface and extend `SyncDocMeta`:
```ts
/** One file inside a document slot (mirrors the Worker's manifest `files[]`). */
export interface BridgeFileMeta {
  fileIndex: number;
  mimeType: string;
  fileSizeKb: number;
}
```
Then inside `SyncDocMeta`, add the field (after `fileCount`):
```ts
  /** Every file in this slot. Present from the multi-file bridge; may be undefined on older payloads. */
  files?: BridgeFileMeta[];
```

- [ ] **Step 2: Write the failing client test**

In `src/lib/sync-bridge/__tests__/client.test.ts`, add at the end (keep existing imports; add `fetchSyncDocFileAt` to the import from `../client`):
```ts
import { fetchSyncDocFileAt } from '../client'

describe('fetchSyncDocFileAt', () => {
  it('GETs the per-file route with the bearer token and wraps a numbered File', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
      headers: new Headers({ 'Content-Type': 'image/jpeg' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const file = await fetchSyncDocFileAt('tok', 'c1', 'd1', 2, 'Damage Photos')

    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('image/jpeg')
    expect(file.name).toMatch(/^Damage Photos 3\.(jpg|jpeg)$/) // index 2 → human #3
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${SYNC_WORKER_URL}/api/bridge/file/c1/d1/2`)
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
  })
})
```
(Ensure `SYNC_WORKER_URL` is imported in this test file — it is already used by existing tests.)

- [ ] **Step 3: Run to verify failure**

Run (Prime dir): `npm test -- client.test`
Expected: FAIL — `fetchSyncDocFileAt` not exported.

- [ ] **Step 4: Implement `fetchSyncDocFileAt`**

In `src/lib/sync-bridge/client.ts`, add after `fetchSyncDocFile`:
```ts
/** Stream one specific file (by index) from a multi-file slot, named "<docType> <n>.<ext>". */
export async function fetchSyncDocFileAt(
  token: string,
  claimId: string,
  docId: string,
  fileIndex: number,
  docType: string,
): Promise<File> {
  const resp = await fetch(
    `${SYNC_WORKER_URL}/api/bridge/file/${encodeURIComponent(claimId)}/${encodeURIComponent(docId)}/${fileIndex}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) throw new Error('Could not download the file from SurveyOS Sync');
  const blob = await resp.blob();
  const mime = resp.headers.get('Content-Type') ?? blob.type ?? 'application/octet-stream';
  const safeType = docType.replace(/[^\w\- ]+/g, '').trim() || 'document';
  return new File([blob], `${safeType} ${fileIndex + 1}.${extFor(mime)}`, { type: mime });
}
```

- [ ] **Step 5: Run to verify pass + type-check**

Run: `npm test -- client.test && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync-bridge/types.ts src/lib/sync-bridge/client.ts src/lib/sync-bridge/__tests__/client.test.ts
git commit -m "feat(sync-bridge): files[] manifest type + per-file client fetch"
```

---

## Task 5: Pure nomenclature (TDD)

**Files:**
- Create: `src/lib/local-sync/nomenclature.ts`
- Test: `src/lib/local-sync/__tests__/nomenclature.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/local-sync/__tests__/nomenclature.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { sanitizeSegment, claimFolderName, extFor, placeFile } from '../nomenclature'

describe('sanitizeSegment', () => {
  it('removes Windows-illegal characters and trims dots/spaces', () => {
    expect(sanitizeSegment('RC: Book?/*')).toBe('RC Book')
    expect(sanitizeSegment('  trailing.  ')).toBe('trailing')
    expect(sanitizeSegment('a\\b|c')).toBe('a b c')
  })
  it('falls back to the provided default when empty', () => {
    expect(sanitizeSegment('***', 'document')).toBe('document')
  })
})

describe('claimFolderName', () => {
  it('joins vehicle and insurer, sanitized', () => {
    expect(claimFolderName({ vehicleNumber: 'MH12AB1234', insuranceCompany: 'HDFC ERGO' }))
      .toBe('MH12AB1234 - HDFC ERGO')
  })
})

describe('extFor', () => {
  it('maps common mime types', () => {
    expect(extFor('image/png')).toBe('png')
    expect(extFor('application/pdf')).toBe('pdf')
    expect(extFor('image/jpeg')).toBe('jpg')
    expect(extFor('anything/else')).toBe('jpg')
  })
})

describe('placeFile', () => {
  it('single-file slot → flat file in the claim folder', () => {
    expect(placeFile({ docType: 'RC Book', fileIndex: 0, fileCount: 1, mimeType: 'image/jpeg', docId: 'd1' }))
      .toEqual({ dir: [], fileName: 'RC Book.jpg' })
  })
  it('multi-file slot → subfolder per docType, numbered files', () => {
    expect(placeFile({ docType: 'Damage Photos', fileIndex: 0, fileCount: 3, mimeType: 'image/jpeg', docId: 'd2' }))
      .toEqual({ dir: ['Damage Photos'], fileName: 'Damage Photos 1.jpg' })
    expect(placeFile({ docType: 'Damage Photos', fileIndex: 2, fileCount: 3, mimeType: 'image/png', docId: 'd2' }))
      .toEqual({ dir: ['Damage Photos'], fileName: 'Damage Photos 3.png' })
  })
  it('empty docType falls back to "document"', () => {
    expect(placeFile({ docType: '   ', fileIndex: 0, fileCount: 1, mimeType: 'application/pdf', docId: 'd3' }))
      .toEqual({ dir: [], fileName: 'document.pdf' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- nomenclature`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/local-sync/nomenclature.ts`:
```ts
// ═══════════════════════════════════════════════════════════
// LOCAL-SYNC NOMENCLATURE — pure name/path derivation.
// Sync stores no per-file original name, so names derive from docType.
// ═══════════════════════════════════════════════════════════

const ILLEGAL = /[\\/:*?"<>|]+/g // Windows-illegal path characters

/** Make a string safe as a single Windows folder/file segment. */
export function sanitizeSegment(raw: string, fallback = 'document'): string {
  const cleaned = raw.replace(ILLEGAL, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').trim()
  return cleaned.length > 0 ? cleaned : fallback
}

/** Map a mime type to a file extension (mirrors the bridge client's extFor). */
export function extFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('pdf')) return 'pdf'
  return 'jpg'
}

/** Folder name for a claim: "<VehicleNumber> - <Insurer>", sanitized. */
export function claimFolderName(claim: { vehicleNumber: string; insuranceCompany: string }): string {
  return sanitizeSegment(`${claim.vehicleNumber} - ${claim.insuranceCompany}`, 'claim')
}

export interface PlaceInput {
  docType: string
  fileIndex: number
  fileCount: number
  mimeType: string
  docId: string
}

/** Where a file goes inside its claim folder. `dir` = subfolder segments (relative). */
export interface FilePlacement {
  dir: string[]
  fileName: string
}

/**
 * Single-file slot → flat `<docType>.<ext>` in the claim folder.
 * Multi-file slot → subfolder `<docType>/` containing `<docType> <n>.<ext>` (n = fileIndex + 1).
 */
export function placeFile(input: PlaceInput): FilePlacement {
  const ext = extFor(input.mimeType)
  const type = sanitizeSegment(input.docType, 'document')
  if (input.fileCount > 1) {
    return { dir: [type], fileName: `${type} ${input.fileIndex + 1}.${ext}` }
  }
  return { dir: [], fileName: `${type}.${ext}` }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- nomenclature`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-sync/nomenclature.ts src/lib/local-sync/__tests__/nomenclature.test.ts
git commit -m "feat(local-sync): pure nomenclature for claim folders + file placement"
```

---

## Task 6: Manifest types + pure diff/synced helpers (TDD)

**Files:**
- Create: `src/lib/local-sync/sync-manifest.ts`
- Test: `src/lib/local-sync/__tests__/sync-manifest.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/local-sync/__tests__/sync-manifest.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { diffManifest, isDocSynced, fileKey, emptyManifest, type LocalManifest, type RemoteFile } from '../sync-manifest'

const remote = (over: Partial<RemoteFile>): RemoteFile => ({
  docId: 'd1', fileIndex: 0, docType: 'RC Book', mimeType: 'image/jpeg', fileSizeKb: 10, uploadedAt: 't0', ...over,
})

describe('diffManifest', () => {
  it('returns all remote files when local is empty', () => {
    const out = diffManifest([remote({}), remote({ fileIndex: 1 })], emptyManifest('c1'))
    expect(out).toHaveLength(2)
  })
  it('skips files already recorded with matching size + uploadedAt', () => {
    const local: LocalManifest = emptyManifest('c1')
    local.files[fileKey('d1', 0)] = { fileName: 'RC Book.jpg', relPath: 'RC Book.jpg', fileSizeKb: 10, uploadedAt: 't0' }
    const out = diffManifest([remote({})], local)
    expect(out).toEqual([])
  })
  it('re-downloads when size or uploadedAt changed', () => {
    const local: LocalManifest = emptyManifest('c1')
    local.files[fileKey('d1', 0)] = { fileName: 'RC Book.jpg', relPath: 'RC Book.jpg', fileSizeKb: 10, uploadedAt: 't0' }
    expect(diffManifest([remote({ fileSizeKb: 99 })], local)).toHaveLength(1)
    expect(diffManifest([remote({ uploadedAt: 't1' })], local)).toHaveLength(1)
  })
})

describe('isDocSynced', () => {
  it('true only when every file index of a doc is present', () => {
    const local: LocalManifest = emptyManifest('c1')
    local.files[fileKey('d1', 0)] = { fileName: 'a', relPath: 'a', fileSizeKb: 1, uploadedAt: 't' }
    expect(isDocSynced('d1', 2, local)).toBe(false) // missing index 1
    local.files[fileKey('d1', 1)] = { fileName: 'b', relPath: 'b', fileSizeKb: 1, uploadedAt: 't' }
    expect(isDocSynced('d1', 2, local)).toBe(true)
  })
  it('false for a doc with zero files', () => {
    expect(isDocSynced('d9', 0, emptyManifest('c1'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- sync-manifest`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/local-sync/sync-manifest.ts`:
```ts
// ═══════════════════════════════════════════════════════════
// LOCAL-SYNC MANIFEST — per-claim record of what is already on disk.
// Pure diff/synced helpers (tested) + thin file read/write (manual).
// ═══════════════════════════════════════════════════════════

export const MANIFEST_FILENAME = '_surveyos-sync.json'

/** A file the Sync bridge says exists, flattened from the claim manifest. */
export interface RemoteFile {
  docId: string
  fileIndex: number
  docType: string
  mimeType: string
  fileSizeKb: number
  uploadedAt: string
}

/** What we recorded after writing a file locally. */
export interface ManifestEntry {
  fileName: string
  relPath: string
  fileSizeKb: number
  uploadedAt: string
}

export interface LocalManifest {
  claimId: string
  syncedAt: string | null
  files: Record<string, ManifestEntry>
}

/** Stable key for one file of one document. */
export function fileKey(docId: string, fileIndex: number): string {
  return `${docId}:${fileIndex}`
}

export function emptyManifest(claimId: string): LocalManifest {
  return { claimId, syncedAt: null, files: {} }
}

/** Files present remotely but missing locally, or whose size/uploadedAt changed. */
export function diffManifest(remote: readonly RemoteFile[], local: LocalManifest): RemoteFile[] {
  return remote.filter((r) => {
    const existing = local.files[fileKey(r.docId, r.fileIndex)]
    if (!existing) return true
    return existing.fileSizeKb !== r.fileSizeKb || existing.uploadedAt !== r.uploadedAt
  })
}

/** A document is "synced" only when all of its file indices are present. */
export function isDocSynced(docId: string, fileCount: number, local: LocalManifest): boolean {
  if (fileCount <= 0) return false
  for (let i = 0; i < fileCount; i++) {
    if (!local.files[fileKey(docId, i)]) return false
  }
  return true
}
```

- [ ] **Step 4: Run to verify pass + type-check**

Run: `npm test -- sync-manifest && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-sync/sync-manifest.ts src/lib/local-sync/__tests__/sync-manifest.test.ts
git commit -m "feat(local-sync): manifest types + pure diff/isDocSynced helpers"
```

---

## Task 7: File System Access types + directory handle store

**Files:**
- Create: `src/lib/local-sync/fs-access.d.ts`
- Create: `src/lib/local-sync/directory-handle.ts`

> No unit tests — this is thin glue over browser APIs (verified manually in Task 12). Keep it minimal.

- [ ] **Step 1: Ambient FS Access types**

Create `src/lib/local-sync/fs-access.d.ts`:
```ts
// Minimal ambient declarations for the File System Access API (desktop Chromium).
// TS's lib.dom does not yet ship these stably.

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemDirectoryHandle {
  queryPermission?(desc?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(desc?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileSystemFileHandle>
}

interface FileSystemFileHandle {
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream {
  write(data: BufferSource | Blob | string): Promise<void>
  close(): Promise<void>
}

interface Window {
  showDirectoryPicker?(opts?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
}
```

- [ ] **Step 2: Implement the handle store**

Create `src/lib/local-sync/directory-handle.ts`:
```ts
// ═══════════════════════════════════════════════════════════
// DIRECTORY HANDLE STORE — pick a root folder, persist its handle
// in IndexedDB, and re-verify permission each session.
// ═══════════════════════════════════════════════════════════

import { openDB } from 'idb'

const DB_NAME = 'surveyos-local-sync'
const STORE = 'handles'
const ROOT_KEY = 'root'

/** True when the browser supports picking a writable folder (desktop Chromium). */
export function isLocalSyncSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE)
    },
  })
}

/** Retrieve the previously-picked root handle, or null if none stored. */
export async function getStoredRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const database = await db()
  const handle = (await database.get(STORE, ROOT_KEY)) as FileSystemDirectoryHandle | undefined
  return handle ?? null
}

/** Prompt the user to pick a root folder and persist the handle. Throws if unsupported/cancelled. */
export async function pickRootFolder(): Promise<FileSystemDirectoryHandle> {
  if (!isLocalSyncSupported()) throw new Error('This browser cannot open a local folder. Use desktop Chrome or Edge.')
  const handle = await window.showDirectoryPicker!({ mode: 'readwrite' })
  const database = await db()
  await database.put(STORE, handle, ROOT_KEY)
  return handle
}

/** Ensure readwrite permission on a handle, requesting it if needed. Returns true if granted. */
export async function ensureReadWrite(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const }
  if (!handle.queryPermission || !handle.requestPermission) return true // older impls: assume granted
  if ((await handle.queryPermission(opts)) === 'granted') return true
  return (await handle.requestPermission(opts)) === 'granted'
}
```

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add src/lib/local-sync/fs-access.d.ts src/lib/local-sync/directory-handle.ts
git commit -m "feat(local-sync): FS Access types + IndexedDB-backed root folder handle"
```

---

## Task 8: Sync engine (write + orchestrate)

**Files:**
- Create: `src/lib/local-sync/sync-engine.ts`

> The pure planning (`diffManifest`) is already tested in Task 6. This module is the I/O orchestration; verified manually in Task 12. Keep functions small and dependency-injected so behavior is obvious.

- [ ] **Step 1: Implement**

Create `src/lib/local-sync/sync-engine.ts`:
```ts
// ═══════════════════════════════════════════════════════════
// SYNC ENGINE — write a claim's new files into its local folder.
// Incremental: only files diffManifest() flags are downloaded.
// ═══════════════════════════════════════════════════════════

import { getSyncClaim, fetchSyncDocFileAt } from '@/lib/sync-bridge/client'
import type { SyncClaimSummary } from '@/lib/sync-bridge/types'
import { claimFolderName, placeFile } from './nomenclature'
import {
  MANIFEST_FILENAME, diffManifest, emptyManifest, fileKey,
  type LocalManifest, type RemoteFile,
} from './sync-manifest'

export interface SyncProgress {
  claimLabel: string
  done: number
  total: number
  failed: number
}

interface ClaimRef {
  claimId: string
  vehicleNumber: string
  insuranceCompany: string
  label: string
}

/** Resolve (creating as needed) a subdirectory path under a parent handle. */
async function ensureDir(parent: FileSystemDirectoryHandle, segments: string[]): Promise<FileSystemDirectoryHandle> {
  let dir = parent
  for (const seg of segments) dir = await dir.getDirectoryHandle(seg, { create: true })
  return dir
}

async function readManifest(claimDir: FileSystemDirectoryHandle, claimId: string): Promise<LocalManifest> {
  try {
    const fh = await claimDir.getFileHandle(MANIFEST_FILENAME)
    const text = await (await fh.getFile()).text()
    const parsed = JSON.parse(text) as LocalManifest
    return parsed.files ? parsed : emptyManifest(claimId)
  } catch {
    return emptyManifest(claimId)
  }
}

async function writeManifest(claimDir: FileSystemDirectoryHandle, manifest: LocalManifest): Promise<void> {
  const fh = await claimDir.getFileHandle(MANIFEST_FILENAME, { create: true })
  const w = await fh.createWritable()
  await w.write(JSON.stringify(manifest, null, 2))
  await w.close()
}

/** Flatten a Sync claim detail into the remote file list. */
function toRemoteFiles(detail: Awaited<ReturnType<typeof getSyncClaim>>): RemoteFile[] {
  const out: RemoteFile[] = []
  for (const doc of detail.documents) {
    const files = doc.files ?? (doc.fileCount > 0
      ? [{ fileIndex: 0, mimeType: doc.mimeType, fileSizeKb: doc.fileSizeKb }]
      : [])
    for (const f of files) {
      out.push({
        docId: doc.docId, fileIndex: f.fileIndex, docType: doc.docType,
        mimeType: f.mimeType, fileSizeKb: f.fileSizeKb, uploadedAt: doc.uploadedAt,
      })
    }
  }
  return out
}

/** Sync one claim's new files into <root>/<claim folder>/. Returns counts. */
export async function syncClaim(
  token: string,
  root: FileSystemDirectoryHandle,
  claim: ClaimRef,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ downloaded: number; failed: number }> {
  const detail = await getSyncClaim(token, claim.claimId)
  const remote = toRemoteFiles(detail)
  const claimDir = await ensureDir(root, [claimFolderName(claim)])
  const manifest = await readManifest(claimDir, claim.claimId)

  const todo = diffManifest(remote, manifest)
  let done = 0
  let failed = 0
  const fileCountByDoc = new Map<string, number>()
  for (const r of remote) fileCountByDoc.set(r.docId, (fileCountByDoc.get(r.docId) ?? 0) + 1)

  for (const r of todo) {
    onProgress?.({ claimLabel: claim.label, done, total: todo.length, failed })
    try {
      const file = await fetchSyncDocFileAt(token, claim.claimId, r.docId, r.fileIndex, r.docType)
      const placement = placeFile({
        docType: r.docType, fileIndex: r.fileIndex,
        fileCount: fileCountByDoc.get(r.docId) ?? 1, mimeType: r.mimeType, docId: r.docId,
      })
      const targetDir = await ensureDir(claimDir, placement.dir)
      const fh = await targetDir.getFileHandle(placement.fileName, { create: true })
      const w = await fh.createWritable()
      await w.write(file)
      await w.close()

      manifest.files[fileKey(r.docId, r.fileIndex)] = {
        fileName: placement.fileName,
        relPath: [...placement.dir, placement.fileName].join('/'),
        fileSizeKb: r.fileSizeKb,
        uploadedAt: r.uploadedAt,
      }
      manifest.syncedAt = new Date().toISOString()
      await writeManifest(claimDir, manifest) // persist after each file (resumable)
      done++
    } catch {
      failed++
    }
  }

  onProgress?.({ claimLabel: claim.label, done, total: todo.length, failed })
  return { downloaded: done, failed }
}

/** Sync many claims sequentially (avoids bursting the Worker). */
export async function syncAllClaims(
  token: string,
  root: FileSystemDirectoryHandle,
  claims: readonly SyncClaimSummary[],
  onClaim?: (index: number, total: number, label: string) => void,
): Promise<{ downloaded: number; failed: number }> {
  let downloaded = 0
  let failed = 0
  for (let i = 0; i < claims.length; i++) {
    const c = claims[i]
    onClaim?.(i + 1, claims.length, c.label)
    const res = await syncClaim(token, root, {
      claimId: c.claimId, vehicleNumber: c.vehicleNumber, insuranceCompany: c.insuranceCompany, label: c.label,
    })
    downloaded += res.downloaded
    failed += res.failed
  }
  return { downloaded, failed }
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/lib/local-sync/sync-engine.ts
git commit -m "feat(local-sync): incremental claim sync engine + sync-all"
```

---

## Task 9: Local-first file resolver (TDD on path)

**Files:**
- Create: `src/lib/local-sync/local-source.ts`
- Test: `src/lib/local-sync/__tests__/local-source.test.ts`

- [ ] **Step 1: Write the failing test (pure path resolution)**

Create `src/lib/local-sync/__tests__/local-source.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { localRelPath } from '../local-source'

describe('localRelPath', () => {
  it('matches the engine placement for a single-file doc', () => {
    expect(localRelPath(
      { vehicleNumber: 'MH12AB1234', insuranceCompany: 'HDFC ERGO' },
      { docType: 'RC Book', fileIndex: 0, fileCount: 1, mimeType: 'image/jpeg', docId: 'd1' },
    )).toEqual(['MH12AB1234 - HDFC ERGO', 'RC Book.jpg'])
  })
  it('matches the engine placement for a multi-file doc', () => {
    expect(localRelPath(
      { vehicleNumber: 'MH12AB1234', insuranceCompany: 'HDFC ERGO' },
      { docType: 'Damage Photos', fileIndex: 1, fileCount: 3, mimeType: 'image/png', docId: 'd2' },
    )).toEqual(['MH12AB1234 - HDFC ERGO', 'Damage Photos', 'Damage Photos 2.png'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- local-source`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/local-sync/local-source.ts`:
```ts
// ═══════════════════════════════════════════════════════════
// LOCAL-FIRST SOURCE — read a synced file from the local folder
// so Prime can open it without calling the Worker.
// ═══════════════════════════════════════════════════════════

import { claimFolderName, placeFile, type PlaceInput } from './nomenclature'
import { ensureReadWrite } from './directory-handle'

/** Full relative path segments of a file under the root: [claimFolder, ...dir, fileName]. */
export function localRelPath(
  claim: { vehicleNumber: string; insuranceCompany: string },
  place: PlaceInput,
): string[] {
  const placement = placeFile(place)
  return [claimFolderName(claim), ...placement.dir, placement.fileName]
}

/**
 * Return the on-disk File for a synced doc/file, or null if absent / no folder / no permission.
 * Never throws — callers fall back to the Worker.
 */
export async function getLocalFile(
  root: FileSystemDirectoryHandle | null,
  claim: { vehicleNumber: string; insuranceCompany: string },
  place: PlaceInput,
): Promise<File | null> {
  if (!root) return null
  try {
    if (!(await ensureReadWrite(root))) return null
    const segments = localRelPath(claim, place)
    const fileName = segments[segments.length - 1]
    const dirs = segments.slice(0, -1)
    let dir = root
    for (const seg of dirs) dir = await dir.getDirectoryHandle(seg)
    const fh = await dir.getFileHandle(fileName)
    return await fh.getFile()
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run to verify pass + type-check**

Run: `npm test -- local-source && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-sync/local-source.ts src/lib/local-sync/__tests__/local-source.test.ts
git commit -m "feat(local-sync): local-first file resolver with shared path logic"
```

---

## Task 10: useLocalSync hook

**Files:**
- Create: `src/lib/local-sync/useLocalSync.ts`

> Glue over the engine + handle store; verified manually in Task 12.

- [ ] **Step 1: Implement**

Create `src/lib/local-sync/useLocalSync.ts`:
```ts
'use client';

// ═══════════════════════════════════════════════════════════
// useLocalSync — folder connection + sync actions for the UI.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  isLocalSyncSupported, getStoredRootHandle, pickRootFolder, ensureReadWrite,
} from './directory-handle'
import { syncClaim, syncAllClaims, type SyncProgress } from './sync-engine'
import type { SyncClaimSummary } from '@/lib/sync-bridge/types'

interface ClaimRef {
  claimId: string; vehicleNumber: string; insuranceCompany: string; label: string
}

export function useLocalSync(token: string) {
  const supported = isLocalSyncSupported()
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)

  useEffect(() => {
    if (!supported) return
    getStoredRootHandle().then(setRoot).catch(() => setRoot(null))
  }, [supported])

  /** Ensure we have a permitted root folder, prompting once if needed. */
  const ensureRoot = useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
    let handle = root
    if (!handle) {
      try { handle = await pickRootFolder(); setRoot(handle) }
      catch (err) { toast.error(err instanceof Error ? err.message : 'Could not open a folder.'); return null }
    }
    if (!(await ensureReadWrite(handle))) {
      toast.error('Folder access was not granted.')
      return null
    }
    return handle
  }, [root])

  const runSyncClaim = useCallback(async (claim: ClaimRef) => {
    if (!token) return
    const handle = await ensureRoot()
    if (!handle) return
    setBusy(true)
    try {
      const res = await syncClaim(token, handle, claim, setProgress)
      toast.success(
        `Synced ${res.downloaded} file${res.downloaded === 1 ? '' : 's'} to your folder` +
        (res.failed ? ` (${res.failed} failed)` : '.'),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }, [token, ensureRoot])

  const runSyncAll = useCallback(async (claims: readonly SyncClaimSummary[]) => {
    if (!token) return
    const handle = await ensureRoot()
    if (!handle) return
    setBusy(true)
    try {
      const res = await syncAllClaims(token, handle, claims, (i, total, label) =>
        setProgress({ claimLabel: `${label} (${i}/${total})`, done: 0, total: 0, failed: 0 }),
      )
      toast.success(`Synced ${res.downloaded} files across ${claims.length} claims` + (res.failed ? ` (${res.failed} failed).` : '.'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync-all failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }, [token, ensureRoot])

  return { supported, connected: !!root, busy, progress, root, runSyncClaim, runSyncAll, ensureRoot }
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/lib/local-sync/useLocalSync.ts
git commit -m "feat(local-sync): useLocalSync hook for folder + sync actions"
```

---

## Task 11: Wire UI into SyncDrivePicker

**Files:**
- Modify: `src/components/sync-bridge/SyncDrivePicker.tsx`

This adds: a "Sync all to local folder" button on the claim-list view, a "Sync to local folder"
button on the claim-detail view, a per-document "✓ on disk" badge, and local-first pick (read from
disk when present, else Worker). It must load the current claim's local manifest to drive the badge.

- [ ] **Step 1: Add imports + hook**

At the top of `SyncDrivePicker.tsx`, add to the lucide import list `FolderDown` and `HardDriveDownload`, and add:
```tsx
import { useLocalSync } from '@/lib/local-sync/useLocalSync';
import { getLocalFile } from '@/lib/local-sync/local-source';
import { isDocSynced, emptyManifest, MANIFEST_FILENAME, type LocalManifest } from '@/lib/local-sync/sync-manifest';
import { claimFolderName } from '@/lib/local-sync/nomenclature';
```
Inside the component body (after the existing `useState` hooks), add:
```tsx
  const localSync = useLocalSync(token);
  const [claimManifest, setClaimManifest] = useState<LocalManifest | null>(null);
```

- [ ] **Step 2: Load the local manifest when a claim opens (for the badge)**

Add this effect after the existing effects:
```tsx
  // Read the opened claim's local manifest so we can show "✓ on disk" per document.
  useEffect(() => {
    if (!detail || !localSync.root) { setClaimManifest(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const claimDir = await localSync.root!.getDirectoryHandle(
          claimFolderName({ vehicleNumber: detail.vehicleNumber, insuranceCompany: detail.insuranceCompany }),
        );
        const fh = await claimDir.getFileHandle(MANIFEST_FILENAME);
        const text = await (await fh.getFile()).text();
        if (!cancelled) setClaimManifest(JSON.parse(text) as LocalManifest);
      } catch {
        if (!cancelled) setClaimManifest(emptyManifest(detail.claimId));
      }
    })();
    return () => { cancelled = true; };
  }, [detail, localSync.root, localSync.busy]);
```

- [ ] **Step 3: Local-first pick**

Replace the body of `pickDoc` so it tries the local file before the Worker. Find:
```tsx
  const pickDoc = async (docId: string, docType: string) => {
    if (!detail) return;
    setDownloadingId(docId);
    try {
      const file = await fetchSyncDocFile(token, detail.claimId, docId, docType);
      onPick(file);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not download the document.');
    } finally {
      setDownloadingId(null);
    }
  };
```
Replace with:
```tsx
  const pickDoc = async (docId: string, docType: string) => {
    if (!detail) return;
    setDownloadingId(docId);
    try {
      const doc = detail.documents.find((d) => d.docId === docId);
      const fileCount = doc?.fileCount ?? 1;
      const mimeType = doc?.mimeType ?? 'image/jpeg';
      // Local-first: if the newest file of this doc is already on disk, read it (no Worker call).
      const local = await getLocalFile(
        localSync.root,
        { vehicleNumber: detail.vehicleNumber, insuranceCompany: detail.insuranceCompany },
        { docType, fileIndex: fileCount - 1, fileCount, mimeType, docId },
      );
      const file = local ?? await fetchSyncDocFile(token, detail.claimId, docId, docType);
      onPick(file);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not download the document.');
    } finally {
      setDownloadingId(null);
    }
  };
```

- [ ] **Step 4: "Sync all" button on the claim-list view**

In the claim-list block, immediately inside `{!loading && !detail && (` and before the `groups.length === 0 ? ...`, add a sync-all bar (only when supported and there are claims):
```tsx
            {localSync.supported && claims.length > 0 && (
              <button
                onClick={() => localSync.runSyncAll(claims)}
                disabled={localSync.busy}
                className="w-full mb-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{ background: 'rgba(212,175,55,0.12)', color: '#B8860B', border: '1px solid rgba(212,175,55,0.3)' }}
              >
                {localSync.busy
                  ? <><Loader2 size={13} className="animate-spin" /> {localSync.progress?.claimLabel ?? 'Syncing…'}</>
                  : <><FolderDown size={13} /> Sync all claims to local folder</>}
              </button>
            )}
```

- [ ] **Step 5: "Sync to local folder" button on the claim-detail view**

In the claim-detail block, immediately inside `{!loading && detail && (`, before the documents list `<div>`, add:
```tsx
            {localSync.supported && (
              <button
                onClick={() => localSync.runSyncClaim({
                  claimId: detail.claimId,
                  vehicleNumber: detail.vehicleNumber,
                  insuranceCompany: detail.insuranceCompany,
                  label: `${detail.vehicleNumber} - ${detail.insuranceCompany}`,
                })}
                disabled={localSync.busy}
                className="w-full mb-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{ background: 'rgba(212,175,55,0.12)', color: '#B8860B', border: '1px solid rgba(212,175,55,0.3)' }}
              >
                {localSync.busy
                  ? <><Loader2 size={13} className="animate-spin" /> {localSync.progress ? `Syncing ${localSync.progress.done}/${localSync.progress.total}…` : 'Syncing…'}</>
                  : <><HardDriveDownload size={13} /> Sync to local folder</>}
              </button>
            )}
```

- [ ] **Step 6: Per-document "✓ on disk" badge**

In the document list `detail.documents.map((d) => { ... })`, the right-hand side currently shows the
downloading spinner or `{d.fileSizeKb} KB`. Replace that trailing expression:
```tsx
                    {downloadingId === d.docId ? (
                      <Loader2 size={14} className="animate-spin shrink-0" />
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {d.fileSizeKb} KB
                      </span>
                    )}
```
with:
```tsx
                    {downloadingId === d.docId ? (
                      <Loader2 size={14} className="animate-spin shrink-0" />
                    ) : claimManifest && isDocSynced(d.docId, d.fileCount, claimManifest) ? (
                      <span className="text-[10px] font-bold shrink-0" style={{ color: '#16a34a' }}>✓ on disk</span>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {d.fileSizeKb} KB
                      </span>
                    )}
```

- [ ] **Step 7: Type-check + tests + build**

Run: `npx tsc --noEmit && npm test -- sync-bridge local-sync && npm run build`
Expected: tsc clean; the sync-bridge + local-sync unit suites pass; Next.js build produces `out/`.

- [ ] **Step 8: Commit**

```bash
git add src/components/sync-bridge/SyncDrivePicker.tsx
git commit -m "feat(local-sync): per-claim + bulk sync, on-disk badge, local-first pick in picker"
```

---

## Task 12: Manual end-to-end verification

Requires: deployed Worker (Phase A), a connected Sync surveyor with a claim containing a multi-file
(photos) slot, desktop Chrome/Edge, Prime running (`npm run dev`).

- [ ] **Step 1: Folder pick + first sync**

Open a claim → Documents → ✈️ on any card → open a claim in the picker → **Sync to local folder** →
pick a folder. Expected: progress shows "Syncing n/m…", then a success toast. In Windows Explorer,
the chosen folder contains `<Vehicle> - <Insurer>/` with single docs flat (e.g. `RC Book.jpg`),
multi-photo slots in a subfolder (`Damage Photos/Damage Photos 1.jpg`, `… 2.jpg`), and a
`_surveyos-sync.json`.

- [ ] **Step 2: Incremental re-sync**

Add a new photo to that claim in SurveyOS Sync, then click **Sync to local folder** again.
Expected: only the new photo downloads (toast "Synced 1 file"); existing files untouched.

- [ ] **Step 3: On-disk badge + local-first pick**

Re-open the claim in the picker. Expected: synced documents show **✓ on disk**. Open DevTools →
Network, tap a synced document. Expected: it lands in the field with **no** `…/api/bridge/file/…`
request (served from disk). Tap an unsynced doc → the bridge request appears (Worker fallback).

- [ ] **Step 4: Sync all**

From the claim-list view, click **Sync all claims to local folder**. Expected: claims sync
sequentially with "(i/total)" progress; folders for each claim appear; already-synced files are
skipped.

- [ ] **Step 5: Permission re-grant**

Restart the browser, reopen Prime, open the picker, click a sync button. Expected: a one-time
permission prompt for the folder; after granting, sync proceeds. Denying shows a clear toast and no
crash.

- [ ] **Step 6: Unsupported browser**

(Optional) Open Prime in Firefox. Expected: the sync buttons do not render; the per-field picker and
local-first pick degrade gracefully (everything falls back to the Worker).

---

## Self-review notes

- **Spec coverage:** Worker `files[]` manifest → Task 1-2; per-file route → Task 2; deploy → Task 3;
  Prime types + per-file fetch → Task 4; nomenclature (flat vs subfolder, sanitize, ext) → Task 5;
  manifest diff + isDocSynced → Task 6; directory handle + permission + support check → Task 7;
  incremental syncClaim + writeManifest-after-each-file + syncAllClaims → Task 8; local-first
  getLocalFile → Task 9; hook (folder state, progress, actions) → Task 10; UI (per-claim sync,
  sync-all, ✓ on disk, local-first pick) → Task 11; error handling (unsupported hidden, permission
  re-prompt, per-file skip-on-fail) → Tasks 7/8/10/11 + verified in Task 12; tests for all pure
  modules → Tasks 1,4,5,6,9.
- **Type consistency:** `BridgeFileMeta { fileIndex; mimeType; fileSizeKb }` identical in Worker
  (Task 1) and Prime types (Task 4). `RemoteFile`/`LocalManifest`/`ManifestEntry`/`fileKey` defined
  in Task 6 and consumed in Tasks 8-9. `PlaceInput`/`FilePlacement`/`placeFile` defined in Task 5,
  used by Tasks 8 (`placeFile`) and 9 (`localRelPath`). `fetchSyncDocFileAt(token, claimId, docId,
  fileIndex, docType)` defined in Task 4, called in Task 8. `getLocalFile(root, claim, place)` and
  `useLocalSync(token)` signatures consistent between Tasks 9/10 and the Task 11 call sites.
- **Reused, not reinvented:** `extFor` logic mirrored from the existing client; `idb` already a
  dependency (used by `src/lib/storage/indexeddb.ts`); sonner toasts as elsewhere.
- **Deferred (per spec):** rehydrating previously-picked evidence from disk on fresh sessions;
  background auto-sync; per-file UI status. Not implemented.
```
