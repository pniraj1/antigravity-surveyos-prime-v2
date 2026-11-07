import type { PhotoItem } from '@/types';

export interface DriveFileLite { id: string; name: string; mimeType: string }

const base = (fileName: string) => fileName.replace(/\.[^.]+$/, '').substring(0, 30);
// Legacy uploads were named photo_<ms>_<name>.jpg; local photos kept just <name>.
const stripped = (fileName: string) => base(fileName.replace(/^photo_\d+_/, ''));

/**
 * Drive photos that this device does not have yet.
 * Exact match on PhotoItem.driveName; photos from before driveName existed
 * fall back to comparing their local name with the Drive name's stem.
 */
export function findNewDrivePhotos(
  local: readonly PhotoItem[],
  drive: readonly DriveFileLite[],
): DriveFileLite[] {
  const localIds = new Set(local.map((p) => p.sourceDocId).filter((id): id is string => !!id));
  const driveNames = new Set(local.map((p) => p.driveName).filter((n): n is string => !!n));
  const legacyNames = new Set<string>();

  for (const p of local) {
    if (!p.driveName) {
      legacyNames.add(p.name);
      legacyNames.add(base(p.name));
    }
  }

  return drive.filter((file) => {
    // Only image files are photos
    if (file.mimeType && !file.mimeType.startsWith('image/')) {
      return false;
    }

    // Match by ID (e.g. sourceDocId or driveFileId)
    if (file.id && (localIds.has(file.id) || driveNames.has(file.id))) {
      return false;
    }

    // Match by Drive name
    if (driveNames.has(file.name)) {
      return false;
    }

    // Match by filename / legacy local name
    if (
      legacyNames.has(file.name) ||
      legacyNames.has(stripped(file.name)) ||
      legacyNames.has(base(file.name))
    ) {
      return false;
    }

    return true;
  });
}
