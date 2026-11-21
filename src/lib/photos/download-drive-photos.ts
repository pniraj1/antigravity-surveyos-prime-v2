import { downloadFileAsBase64 } from '@/lib/drive';
import { isDocumentFileName } from '@/lib/photos/document-annexure';
import type { ClaimSlice } from '@/stores/slices/claimSlice';
import type { DriveFileLite } from './drive-photo-diff';
import { useClaimStore } from '@/stores/claim-store';
import { claimDocuments } from '@/lib/documents/index-ops';
import { saveDocuments } from '@/lib/documents/sink';
import type { FolderInput } from '@/lib/documents/folder';

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 800, h: 600 });
    img.src = dataUrl;
  });
}

export interface DownloadResult { added: number; failed: DriveFileLite[] }
export type DownloadProgressCallback = (progress: { completed: number; total: number }) => void;

/**
 * Downloads each file and adds it to the open claim. Stops (without counting
 * the rest) as soon as isStillCurrent() is false, so photos never land in another claim.
 */
export async function downloadDrivePhotos(
  files: readonly DriveFileLite[],
  addPhoto: ClaimSlice['addPhoto'],
  isStillCurrent: () => boolean,
  onProgress?: DownloadProgressCallback,
): Promise<DownloadResult> {
  let added = 0;
  const failed: DriveFileLite[] = [];
  const total = files.length;
  // The photos also go to the vehicle folder on the PC, as an upload does; one already there (From Phone) is not written twice.
  const claim = useClaimStore.getState().currentClaim;
  const inFolder = new Set(claim ? claimDocuments(claim).flatMap((d) => d.driveFileId ?? []) : []);
  const toSave: FolderInput[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const dataUrl = await downloadFileAsBase64(file.id, file.mimeType);
      const { w, h } = await imageSize(dataUrl);
      if (!isStillCurrent()) break;
      const name = file.name.replace(/\.[^.]+$/, '').substring(0, 30);
      const kind = isDocumentFileName(file.name) ? 'document' : 'damage';
      addPhoto(dataUrl, name, w, h, kind, file.name);
      added++;
      if (kind === 'damage' && !inFolder.has(file.id)) {
        toSave.push({ blob: await (await fetch(dataUrl)).blob(), name: file.name, driveFileId: file.id });
      }
    } catch {
      failed.push(file); // the rest still arrive
    }
    onProgress?.({ completed: i + 1, total });
  }
  // claim.id: the sink writes nothing if another claim is open by then (no folder yet → the folder window asks).
  if (claim && toSave.length) void saveDocuments('damagePhotos', toSave, 'photo', claim.id);
  return { added, failed };
}
