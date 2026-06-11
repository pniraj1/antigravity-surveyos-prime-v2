// ═══════════════════════════════════════════════════════════
// LOCAL-FIRST SOURCE — read a synced file from the local folder
// so Prime can open it without calling the Worker.
// ═══════════════════════════════════════════════════════════

import { claimFolderName, placeFile, type PlaceInput } from './nomenclature'
import { ensureReadWrite } from './directory-handle'
import { MANIFEST_FILENAME, type LocalManifest } from './sync-manifest'

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
    const claimDir = await root.getDirectoryHandle(claimFolderName(claim))
    const fh = await claimDir.getFileHandle(MANIFEST_FILENAME)
    const text = await (await fh.getFile()).text()
    const parsed = JSON.parse(text) as LocalManifest
    return typeof parsed.receivedDocsAtSync === 'number' ? parsed.receivedDocsAtSync : 0
  } catch {
    return 0
  }
}
