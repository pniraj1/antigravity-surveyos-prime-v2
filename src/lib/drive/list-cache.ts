// src/lib/drive/list-cache.ts

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  pending?: boolean; // true = queued for upload, not yet in Drive
}

const cache = new Map<string, DriveFile[]>();

export function getCachedFileList(claimId: string): DriveFile[] | null {
  return cache.get(claimId) ?? null;
}

export function setCachedFileList(claimId: string, files: DriveFile[]): void {
  cache.set(claimId, files);
}

export function invalidateClaimFileList(claimId: string): void {
  cache.delete(claimId);
}
