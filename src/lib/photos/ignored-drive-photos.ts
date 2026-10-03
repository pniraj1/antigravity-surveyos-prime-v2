const key = (claimId: string) => `surveyos_ignored_drive_photos_${claimId}`;

/** Drive photo names the surveyor dismissed or deleted on this device. */
export function getIgnoredDrivePhotos(claimId: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(claimId)) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : []);
  } catch {
    return new Set();
  }
}

export function ignoreDrivePhotos(claimId: string, names: string[]): void {
  if (names.length === 0) return;
  try {
    const all = getIgnoredDrivePhotos(claimId);
    names.forEach((n) => all.add(n));
    localStorage.setItem(key(claimId), JSON.stringify([...all]));
  } catch {
    // storage blocked - the banner may offer the photo again, which is harmless
  }
}
