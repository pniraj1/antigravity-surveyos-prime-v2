import { downloadFileAsBase64 } from '@/lib/drive';
import { isDocumentFileName } from '@/lib/photos/document-annexure';
import type { ClaimSlice } from '@/stores/slices/claimSlice';
import type { DriveFileLite } from './drive-photo-diff';

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 800, h: 600 });
    img.src = dataUrl;
  });
}

export interface DownloadResult { added: number; failed: DriveFileLite[] }

/**
 * Downloads each file and adds it to the open claim. Stops (without counting
 * the rest) as soon as isStillCurrent() is false, so photos never land in another claim.
 */
export async function downloadDrivePhotos(
  files: readonly DriveFileLite[],
  addPhoto: ClaimSlice['addPhoto'],
  isStillCurrent: () => boolean,
): Promise<DownloadResult> {
  let added = 0;
  const failed: DriveFileLite[] = [];
  for (const file of files) {
    try {
      const dataUrl = await downloadFileAsBase64(file.id, file.mimeType);
      const { w, h } = await imageSize(dataUrl);
      if (!isStillCurrent()) break;
      const name = file.name.replace(/\.[^.]+$/, '').substring(0, 30);
      const kind = isDocumentFileName(file.name) ? 'document' : 'damage';
      addPhoto(dataUrl, name, w, h, kind, file.name);
      added++;
    } catch {
      failed.push(file); // the rest still arrive
    }
  }
  return { added, failed };
}
