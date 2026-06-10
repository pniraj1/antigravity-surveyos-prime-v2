# Sync Claim Documents to a Local Folder — Design

**Date:** 2026-06-10
**Status:** Approved
**Area:** Prime V2 (Documents tab / Sync bridge) + SurveyOS Sync Worker (bridge routes)

---

## Problem

Pulling Sync documents into Prime re-streams the bytes from Telegram through the Cloudflare
Worker on **every** view — there is no persistence, so browsing/loading feels slow and repeats the
same network work. Surveyors also have no way to keep the collected photos/documents as real files
they can open outside SurveyOS Prime.

## Goal

Let a surveyor pick a **root folder** on their PC once, then **sync** a claim's documents and photos
into a per-claim folder with sensible names — downloading each file **once**, incrementally. This
makes repeat access instant (served from disk, not the Worker), cuts Worker traffic over time, and
gives the surveyor real files usable in Windows Explorer.

## Non-Goals

- Mobile / non-Chromium support. The File System Access API is desktop-Chromium only; the feature is
  hidden elsewhere. (Confirmed: surveyors use desktop Chrome/Edge.)
- Automatic background sync / polling. Sync is **surveyor-triggered** (a button), incremental.
- Two-way sync or editing files back into Sync. This is **download-only** (Sync stays collection-only,
  Prime read-only over the bridge).
- Changing the existing per-field ✈️ picker behavior (it keeps using the "latest file" route).

---

## Key Finding That Shapes the Design

The Sync Worker bridge currently exposes only **one file per document slot** — a slot can hold many
files (`doc.files[]`, e.g. a "Damage Photos" slot), but `GET /api/bridge/file/:claimId/:docId`
returns only the newest (`worker/src/routes/bridge.ts:101-105`). The manifest reports `fileCount`
but there is no way to fetch the others. Sync also stores **no original filename** per file — only
`docType`, `mimeType`, and size. Therefore:

- To sync **all** photos, the Worker bridge must be extended to list and stream each file in a slot.
- File names are **derived from `docType`** (Sync has no per-file name to mirror).

---

## Architecture — Two Cooperating Parts

1. **Worker bridge extension** (repo: `SurveyOS Sync/worker`) — surface every file in a slot.
2. **Prime local-sync engine** (repo: `SurveyOS-Prime-V2`) — pick a root folder, mirror a claim's
   files into a per-claim folder via the File System Access API, incrementally.

---

## Part 1 — Worker Bridge Extension

**Manifest — `GET /api/bridge/claims/:id`:** for each document, additionally return a `files` array:
```ts
files: Array<{ fileIndex: number; mimeType: string; fileSizeKb: number }>
```
`fileIndex` is the position in `doc.files[]` (0-based). Legacy single-file docs (only `file_id`,
no `files[]`) report a single entry `{ fileIndex: 0, mimeType, fileSizeKb }`. Existing `fileCount`
is retained for backward compatibility with the current picker. No new requests — same call, larger
body.

**New route — `GET /api/bridge/file/:claimId/:docId/:fileIndex`:** streams the file at that index.
- Resolves `doc.files[fileIndex].file_id` (or the legacy `doc.file_id` when `fileIndex === 0` and no
  `files[]`).
- Out-of-range / missing index → `404`.
- Same auth (`bridgeAuth`), same streaming pass-through, same CORS + `Cache-Control` as the existing
  route.
- The existing `…/:docId` route is unchanged (keeps serving "the latest file" for the per-field
  picker).

**Cost note:** the manifest change adds zero calls. The per-file route adds one request per file at
sync time, but each file is fetched **once** (incremental local cache), replacing today's
"fetch on every view" pattern — net Worker traffic decreases over a claim's lifetime. Workers bill
per request + CPU (streaming pass-through is negligible CPU); egress is free.

---

## Part 2 — Prime Local-Sync Engine

New, focused modules under `src/lib/local-sync/`:

| File | Responsibility | Tested |
|---|---|---|
| `directory-handle.ts` | `showDirectoryPicker()`, persist the `FileSystemDirectoryHandle` in IndexedDB, re-verify `readwrite` permission each session | Manual (browser API) |
| `nomenclature.ts` | **Pure.** Derive sanitized claim-folder, subfolder, and file names from claim/doc metadata | Unit |
| `sync-manifest.ts` | Read/write a `_surveyos-sync.json` manifest file inside each claim folder | Unit (pure diff portion) |
| `sync-engine.ts` | Orchestrate: diff local manifest vs Sync manifest, download only missing/changed files, write them, update the manifest, report progress | Unit (diff logic) |
| `useLocalSync.ts` | React hook: connected-folder state, per-claim sync status/progress | Manual |

### Directory handle + permission
- First use: `showDirectoryPicker({ mode: 'readwrite' })` → store the handle in IndexedDB (handles are
  structured-cloneable). Persist a small record: `{ handle, pickedAt }`.
- Each session: retrieve handle → `handle.queryPermission({ mode: 'readwrite' })`; if not `granted`,
  call `requestPermission` (one click). If denied, the feature reports "folder access needed".
- A "Change folder" affordance re-runs the picker.

### Nomenclature (pure, in `nomenclature.ts`)
```
<root>/
  MH12AB1234 - HDFC ERGO/            ← `${vehicleNumber} - ${insuranceCompany}`, sanitized
    RC Book.jpg                      ← single-file slot → flat file `${docType}.${ext}`
    Policy Schedule.pdf
    Damage Photos/                   ← multi-file slot → subfolder named `${docType}`
      Damage Photos 1.jpg            ← `${docType} ${n}.${ext}`, n = fileIndex+1
      Damage Photos 2.jpg
    _surveyos-sync.json              ← incremental manifest (hidden-ish, leading underscore)
```
Rules:
- Sanitize names for Windows: strip/replace `\ / : * ? " < > |` and trailing dots/spaces; collapse
  whitespace; fall back to `document` / `claim` when empty.
- Extension from `mimeType` (`png`→png, `pdf`→pdf, else `jpg`), matching the existing `extFor` helper.
- Single-file slot (`files.length === 1`) → flat file in the claim folder.
- Multi-file slot (`files.length > 1`) → a subfolder per `docType` with numbered files.
- Name collisions across different docTypes that sanitize identically are disambiguated with a
  `(docId-short)` suffix.

### Incremental sync (`sync-engine.ts` + `sync-manifest.ts`)
- The manifest maps `"<docId>:<fileIndex>" → { fileName, relPath, fileSizeKb, uploadedAt }`.
- On **Sync claim**:
  1. Fetch the Sync claim manifest (now with `files[]`).
  2. Compute the **diff**: entries present in Sync but missing from the local manifest, or whose
     `fileSizeKb`/`uploadedAt` changed.
  3. For each diffed file: `GET …/file/:claimId/:docId/:fileIndex` → write bytes to the resolved
     path (creating claim folder / subfolders as needed) → record it in the manifest.
  4. Persist the manifest **after each successful file** (so an interrupted sync stays accurate and
     resumable). Report progress (`done / total`).
- Files already in the manifest and unchanged are **skipped** — re-sync only pulls new/changed files.

### Trigger / UI
- A **"Sync to local folder"** button per claim, surfaced in the Sync picker's claim-detail view.
- First click (no folder yet) → folder picker, then proceeds.
- Shows progress ("Syncing 3 / 12…") and, when idle, a "Last synced <time>" line derived from the
  manifest.
- Optional secondary "Open folder" hint (we cannot open Explorer directly, but we can show the
  resolved relative path).

---

## Error Handling

- **Unsupported browser** (`window.showDirectoryPicker` undefined) → the Sync-to-local UI is hidden,
  replaced by a short "Use desktop Chrome or Edge to sync to a local folder" note.
- **Permission denied / revoked mid-session** → sync stops with a clear toast; re-grant prompt on
  next attempt. No partial-manifest corruption (manifest written only after each file fully lands).
- **Single file fails** (network / Telegram 502) → that file is skipped and counted as failed; the
  rest continue; the manifest omits the failed file so the next sync retries only it.
- **Worker per-file 404** (index drift) → skip + report; does not abort the whole claim.
- All async boundaries narrow `unknown` errors and surface user-friendly messages (project rule).

---

## Testing

- **Unit — `nomenclature.ts`:** sanitization of Windows-illegal chars, single vs multi-file layout,
  extension mapping, collision disambiguation, empty-field fallbacks.
- **Unit — sync diff logic:** given a Sync manifest + a local manifest, returns exactly the
  new/changed files and skips unchanged ones; handles the first-ever sync (empty local manifest) and
  a re-sync after one new photo.
- **Worker unit:** the new `files[]` manifest shape (incl. legacy single-file docs → one entry) and
  the `:fileIndex` route bounds (valid index streams; out-of-range → 404).
- **Manual E2E:** pick folder → sync a claim with a multi-photo slot → verify real files appear in
  Explorer with correct names/subfolder → add a photo in Sync → re-sync pulls only the new one →
  revoke permission and confirm graceful re-prompt.

---

## Follow-ups (not blockers)

1. "Sync all claims" bulk action (current scope is per-claim).
2. Prime reading evidence straight from the local folder (further speed up in-app viewing) once a
   claim is synced.
3. A subtle per-document "synced to local" indicator in the picker.
