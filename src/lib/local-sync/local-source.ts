// ═══════════════════════════════════════════════════════════
// LOCAL-FIRST SOURCE — read a synced file from the local folder
// so Prime can open it without calling the Worker.
// ═══════════════════════════════════════════════════════════

import { claimFolderName, legacyClaimFolderName, placeFile, type PlaceInput } from './nomenclature'
import { ensureReadWrite } from './directory-handle'
import { MANIFEST_FILENAME, type LocalManifest } from './sync-manifest'

/**
 * The folder this claim's synced files are actually in: the short-form name,
 * or the pre-2026-09 long-form one when that is what exists on disk. New
 * claims get the short form (the name returned when neither exists).
 */
export async function resolveSyncFolderName(
  root: FileSystemDirectoryHandle,
  claim: { vehicleNumber: string; insuranceCompany: string },
): Promise<string> {
  const short = claimFolderName(claim)
  try { await root.getDirectoryHandle(short); return short } catch { /* not there yet */ }
  const legacy = legacyClaimFolderName(claim)
  if (legacy !== short) {
    try { await root.getDirectoryHandle(legacy); return legacy } catch { /* nor there */ }
  }
  return short
}

/** Full relative path segments of a file under the root: [claimFolder, ...dir, fileName]. */
export function localRelPath(
  claim: { vehicleNumber: string; insuranceCompany: string },
  place: PlaceInput,
  folderName: string = claimFolderName(claim),
): string[] {
  const placement = placeFile(place)
  return [folderName, ...placement.dir, placement.fileName]
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
    const folderName = await resolveSyncFolderName(root, claim)
    const segments = localRelPath(claim, place, folderName)
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

/**
 * Read a claim's locally-recorded receivedDocsAtSync from its folder manifest.
 * Returns 0 if no folder / no manifest / unreadable. Never throws (local disk I/O only).
 */
export async function getClaimRecordedDocs(
  root: FileSystemDirectoryHandle | null,
  claim: { vehicleNumber: string; insuranceCompany: string },
): Promise<number> {
  if (!root) return 0
  try {
    const claimDir = await root.getDirectoryHandle(await resolveSyncFolderName(root, claim))
    const fh = await claimDir.getFileHandle(MANIFEST_FILENAME)
    const text = await (await fh.getFile()).text()
    const parsed = JSON.parse(text) as LocalManifest
    return typeof parsed.receivedDocsAtSync === 'number' ? parsed.receivedDocsAtSync : 0
  } catch {
    return 0
  }
}
