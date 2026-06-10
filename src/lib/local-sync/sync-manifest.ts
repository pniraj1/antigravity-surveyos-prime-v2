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
