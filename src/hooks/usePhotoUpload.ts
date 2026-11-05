'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { uploadWithDuplicateCheck } from '@/lib/drive/upload-with-check';
import { PHOTO_FILE_PREFIX } from '@/lib/photos/document-annexure';
import { compressImage } from '@/lib/photos/compress-image';
import { saveDocuments } from '@/lib/documents/sink';
import { useSaveToCloudPrompt } from '@/hooks/useSaveToCloudPrompt';
import { isOnDrive, photoNameOf } from '@/lib/scan-import/phone-files';
import type { PhotoItem } from '@/types/assessment';

export type PhotoMeta = Pick<PhotoItem, 'tag' | 'sourceDocId'>;

/**
 * Compress, add to the claim, and (if the surveyor agrees) send to Drive.
 * Shared by the Photos tab and the Site screen so both behave identically.
 */
export function usePhotoUpload() {
  const addPhoto = useClaimStore((s) => s.addPhoto);
  const [isProcessing, setIsProcessing] = useState(false);
  const { confirmSaveToCloud, saveToCloudDialog } = useSaveToCloudPrompt();

  /** `meta[i]` goes with file i (Use phone files: tag and source document). Gallery / Browse passes none. */
  const uploadPhotos = useCallback(async (input: FileList | File[], meta?: readonly PhotoMeta[]) => {
    // Copy synchronously: callers reset the <input> right after calling us.
    const picked = Array.from(input)
      .map((file, i) => ({ file, meta: meta?.[i] }))
      .filter(({ file }) => file.type.startsWith('image/'));
    const files = picked.map((p) => p.file);
    const claim = useClaimStore.getState().currentClaim;
    if (!claim || files.length === 0) return;

    setIsProcessing(true);
    try {
      const label = claim.vehicle?.registrationNumber || claim.id;
      const { profile } = useProfileStore.getState();
      const isDriveConnected = useUIStore.getState().isDriveConnected;
      const saveToDrive = isDriveConnected && profile.autoUploadDrive !== false
        ? await confirmSaveToCloud(files.length > 1 ? `${files.length} photos` : files[0].name, claim.id)
        : false;

      const saved: File[] = [];
      let failed = 0;
      for (let i = 0; i < files.length; i++) {
        const { file, meta: m } = picked[i];
        try {
          const { dataUrl, w, h } = await compressImage(file, 600, 0.85, 'image/jpeg');
          // The surveyor may have opened another claim during the awaits.
          if (useClaimStore.getState().currentClaim?.id !== claim.id) break;
          const name = photoNameOf(file.name);
          const existingCount = claim.photos?.length || 0;
          const photoIndex = String(existingCount + i + 1).padStart(2, '0');
          const driveName = `${PHOTO_FILE_PREFIX}${photoIndex}_${name}.jpg`;
          // A phone file moved from Scan's Drive folder is already on Drive: never a second copy.
          const toDrive = saveToDrive && !isOnDrive(m?.sourceDocId ? claim.documents?.[m.sourceDocId] : undefined);
          addPhoto(dataUrl, name, w, h, 'damage', toDrive ? driveName : undefined, m);
          // A phone photo is already in the claim folder: don't write a second copy.
          if (!m?.sourceDocId) saved.push(file);
          if (toDrive) {
            uploadWithDuplicateCheck(claim.id, driveName, file, label).catch(() => {});
          }
        } catch {
          failed++;
        }
      }
      if (failed > 0) toast.error(`${failed} photo(s) couldn't be added — try a JPEG or retake.`);
      if (saved.length) {
        void saveDocuments('damagePhotos', saved.map((f) => ({ blob: f, name: f.name })), 'photo', claim.id);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [addPhoto, confirmSaveToCloud]);

  return { uploadPhotos, isProcessing, saveToCloudDialog };
}
