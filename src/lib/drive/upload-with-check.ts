// ═══════════════════════════════════════════════════════════
// DUPLICATE-CHECKED DRIVE UPLOAD
// Wraps uploadFileToDrive with a pre-check for existing files.
// If a file with the same name exists, delegates to showDialog
// callback which returns the user's choice.
// ═══════════════════════════════════════════════════════════

import {
  getDriveToken,
  getOrCreateClaimFolder,
  listFilesInFolder,
  uploadFileToDrive,
  deleteFile,
} from './index';
import { logger } from '../utils/logger';

export type DuplicateAction = 'replace' | 'keep-both' | 'cancel';

export interface ExistingFile {
  id: string;
  name: string;
  mimeType: string;
}

/**
 * Generate a suffixed filename that doesn't collide with existing files.
 * "rc.pdf" → "rc (2).pdf", "rc (2).pdf" → "rc (3).pdf", etc.
 */
export function generateSuffixedName(fileName: string, existingNames: string[]): string {
  const dotIdx = fileName.lastIndexOf('.');
  const base = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  const ext = dotIdx > 0 ? fileName.slice(dotIdx) : '';

  let n = 2;
  let candidate = `${base} (${n})${ext}`;
  const lowerNames = new Set(existingNames.map(name => name.toLowerCase()));
  while (lowerNames.has(candidate.toLowerCase())) {
    n++;
    candidate = `${base} (${n})${ext}`;
  }
  return candidate;
}

/**
 * Upload a file to Drive with duplicate detection.
 *
 * @param claimId     - The claim this file belongs to
 * @param fileName    - Target filename on Drive (e.g. "rc.pdf")
 * @param blob        - File data
 * @param claimLabel  - Human-readable claim label for folder naming
 * @param showDialog  - Callback that presents the user with a choice.
 *                      Receives the existing file info and a suggested suffix name.
 *                      Returns the user's decision as a Promise.
 *
 * If Drive is not linked (no token), falls through to uploadFileToDrive
 * which handles queuing. No duplicate check for queued uploads.
 */
export async function uploadWithDuplicateCheck(
  claimId: string,
  fileName: string,
  blob: Blob,
  claimLabel: string,
  showDialog: (existing: ExistingFile, suffixedName: string) => Promise<DuplicateAction>,
): Promise<void> {
  // If Drive isn't linked, skip duplicate check — uploadFileToDrive will queue
  if (!getDriveToken()) {
    return uploadFileToDrive(claimId, fileName, blob, claimLabel);
  }

  let folderId: string;
  let existingFiles: ExistingFile[];

  try {
    folderId = await getOrCreateClaimFolder(claimId, claimLabel);
    existingFiles = await listFilesInFolder(folderId);
  } catch (err) {
    // Network error during check — fall through to direct upload (best-effort)
    logger.log(`[Drive] Duplicate check failed, uploading directly: ${err}`);
    return uploadFileToDrive(claimId, fileName, blob, claimLabel);
  }

  // Case-insensitive match
  const match = existingFiles.find(
    f => f.name.toLowerCase() === fileName.toLowerCase()
  );

  if (!match) {
    // No duplicate — upload directly
    return uploadFileToDrive(claimId, fileName, blob, claimLabel);
  }

  // Duplicate found — ask user
  const allNames = existingFiles.map(f => f.name);
  const suffixedName = generateSuffixedName(fileName, allNames);
  const action = await showDialog(match, suffixedName);

  switch (action) {
    case 'replace':
      await deleteFile(match.id);
      return uploadFileToDrive(claimId, fileName, blob, claimLabel);

    case 'keep-both':
      return uploadFileToDrive(claimId, suffixedName, blob, claimLabel);

    case 'cancel':
      logger.log(`[Drive] Upload of "${fileName}" cancelled by user (duplicate).`);
      return;
  }
}
