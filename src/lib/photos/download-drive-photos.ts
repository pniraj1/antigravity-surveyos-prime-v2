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

/** Downloads each file and adds it to the open claim. Returns how many were added. */
export async function downloadDrivePhotos(
  files: readonly DriveFileLite[],
  addPhoto: ClaimSlice['addPhoto'],
): Promise<number> {
  let added = 0;
  for (const file of files) {
    try {
      const dataUrl = await downloadFileAsBase64(file.id, file.mimeType);
      const { w, h } = await imageSize(dataUrl);
      const name = file.name.replace(/\.[^.]+$/, '').substring(0, 30);
      const kind = isDocumentFileName(file.name) ? 'document' : 'damage';
      addPhoto(dataUrl, name, w, h, kind, file.name);
      added++;
    } catch {
      // skip individual failures; the rest still arrive
    }
  }
  return added;
}
