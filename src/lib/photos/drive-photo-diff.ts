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
  const driveNames = new Set(local.map((p) => p.driveName).filter((n): n is string => !!n));
  const legacyNames = new Set(local.filter((p) => !p.driveName).map((p) => p.name));
  return drive.filter((file) =>
    !driveNames.has(file.name) &&
    !legacyNames.has(stripped(file.name)) &&
    !legacyNames.has(base(file.name)),
  );
}
