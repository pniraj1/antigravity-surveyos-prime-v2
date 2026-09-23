// ═══════════════════════════════════════════════════════════
// SYNC ENGINE — write a claim's new files into its local folder.
// Incremental: only files diffManifest() flags are downloaded.
// ═══════════════════════════════════════════════════════════

import { getSyncClaim, fetchSyncDocFileAt } from '@/lib/sync-bridge/client'
import type { SyncClaimSummary } from '@/lib/sync-bridge/types'
import { placeFile } from './nomenclature'
import {
  MANIFEST_FILENAME, diffManifest, emptyManifest, fileKey, partitionClaimsForSync,
  type LocalManifest, type RemoteFile,
} from './sync-manifest'
import { getClaimRecordedDocs, resolveSyncFolderName } from './local-source'

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
    return parsed.files ? { ...emptyManifest(claimId), ...parsed } : emptyManifest(claimId)
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

/** True when `relPath` (segments + name) already exists under `dir`. */
async function fileExists(dir: FileSystemDirectoryHandle, segments: string[], name: string): Promise<boolean> {
  try {
    let d = dir
    for (const seg of segments) d = await d.getDirectoryHandle(seg)
    await d.getFileHandle(name)
    return true
  } catch {
    return false
  }
}

/** `RC Book.pdf` → `RC Book (2).pdf` → `(3)` … until nothing is there. */
async function freeFileName(dir: FileSystemDirectoryHandle, segments: string[], name: string): Promise<string> {
  if (!(await fileExists(dir, segments, name))) return name
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let n = 2; n < 100; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!(await fileExists(dir, segments, candidate))) return candidate
  }
  return `${stem} (${Date.now()})${ext}`
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
  const claimDir = await ensureDir(root, [await resolveSyncFolderName(root, claim)])
  const manifest = await readManifest(claimDir, claim.claimId)
  // Records the received-doc count for change detection. The claim-list tick compares this against
  // the claim summary's `receivedDocs`. Both are server-side counts of "received" docs; the detail
  // endpoint additionally drops received docs that have no file, so if they ever diverge the count
  // is <= summary.receivedDocs — i.e. the claim reads "new" (re-syncs), never falsely "synced".
  manifest.receivedDocsAtSync = detail.documents.length

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
      const key = fileKey(r.docId, r.fileIndex)
      // A file this manifest already recorded is ours to rewrite (the remote
      // copy changed). Anything else on disk belongs to someone — Prime writes
      // into this same folder now — so take the next free name instead of
      // truncating it.
      const owned = manifest.files[key]
      const fileName = owned
        ? owned.fileName
        : await freeFileName(claimDir, placement.dir, placement.fileName)
      const fh = await targetDir.getFileHandle(fileName, { create: true })
      const w = await fh.createWritable()
      await w.write(file)
      await w.close()

      manifest.files[key] = {
        fileName,
        relPath: [...placement.dir, fileName].join('/'),
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

  if (todo.length === 0) await writeManifest(claimDir, manifest)

  onProgress?.({ claimLabel: claim.label, done, total: todo.length, failed })
  return { downloaded: done, failed }
}

/** Sync many claims sequentially, skipping ones already fully on disk (no Worker call). */
export async function syncAllClaims(
  token: string,
  root: FileSystemDirectoryHandle,
  claims: readonly SyncClaimSummary[],
  onClaim?: (index: number, total: number, label: string) => void,
): Promise<{ downloaded: number; failed: number; skipped: number }> {
  // Read each claim's locally-recorded count (disk only — no Worker calls), then decide.
  const recorded = new Map<string, number>()
  for (const c of claims) recorded.set(c.claimId, await getClaimRecordedDocs(root, c))
  const { toSync } = partitionClaimsForSync(claims, recorded)

  let downloaded = 0
  let failed = 0
  for (let i = 0; i < toSync.length; i++) {
    const c = toSync[i]
    onClaim?.(i + 1, toSync.length, c.label)
    const res = await syncClaim(token, root, {
      claimId: c.claimId, vehicleNumber: c.vehicleNumber, insuranceCompany: c.insuranceCompany, label: c.label,
    })
    downloaded += res.downloaded
    failed += res.failed
  }
  return { downloaded, failed, skipped: claims.length - toSync.length }
}
