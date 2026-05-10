import { getClaimFolderId, driveRequest, listFilesInFolder } from '@/lib/drive/index';
import { getDriveFileCache, setDriveFileCache, getDriveQueue } from '@/lib/storage/indexeddb';
import { getCachedFileList, setCachedFileList } from '@/lib/drive/list-cache';
import type { DriveFile } from '@/lib/drive/list-cache';

export type { DriveFile } from '@/lib/drive/list-cache';

export async function listClaimDriveFiles(claimId: string): Promise<DriveFile[]> {
  const cached = getCachedFileList(claimId);
  if (cached) return cached;

  const folderId = await getClaimFolderId(claimId);

  const driveFiles: DriveFile[] = folderId
    ? (await listFilesInFolder(folderId)).map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
      }))
    : [];

  const queue = await getDriveQueue();
  const pendingFiles: DriveFile[] = queue
    .filter(item => item.claimId === claimId)
    .map(item => ({
      id: `pending_${item.id}`,
      name: item.fileName,
      mimeType: item.mimeType,
      pending: true,
    }));

  const merged = [...driveFiles, ...pendingFiles];
  setCachedFileList(claimId, merged);
  return merged;
}

export async function ensureFileInCache(fileId: string, mimeType: string): Promise<Blob> {
  const cached = await getDriveFileCache(fileId);
  if (cached) {
    return new Blob([cached.data], { type: cached.mimeType });
  }

  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  );
  const blob = await res.blob();
  const data = await blob.arrayBuffer();

  const storedMimeType = mimeType || 'application/octet-stream';
  await setDriveFileCache({
    fileId,
    mimeType: storedMimeType,
    data,
    cachedAt: Date.now(),
  });
  return new Blob([data], { type: storedMimeType });
}

export async function findFileByName(claimId: string, name: string): Promise<DriveFile | null> {
  const files = await listClaimDriveFiles(claimId);
  const lower = name.toLowerCase();
  return files.find(f => !f.pending && f.name.toLowerCase() === lower) ?? null;
}
