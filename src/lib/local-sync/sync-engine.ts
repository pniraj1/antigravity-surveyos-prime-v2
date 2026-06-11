// ═══════════════════════════════════════════════════════════
// SYNC ENGINE — write a claim's new files into its local folder.
// Incremental: only files diffManifest() flags are downloaded.
// ═══════════════════════════════════════════════════════════

import { getSyncClaim, fetchSyncDocFileAt } from '@/lib/sync-bridge/client'
import type { SyncClaimSummary } from '@/lib/sync-bridge/types'
import { claimFolderName, placeFile } from './nomenclature'
import {
  MANIFEST_FILENAME, diffManifest, emptyManifest, fileKey, partitionClaimsForSync,
  type LocalManifest, type RemoteFile,
} from './sync-manifest'
import { getClaimRecordedDocs } from './local-source'

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
