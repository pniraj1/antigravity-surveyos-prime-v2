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
