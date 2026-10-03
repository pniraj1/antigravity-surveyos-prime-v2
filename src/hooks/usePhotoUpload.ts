'use client';

import { useCallback, useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { uploadFileToDrive } from '@/lib/drive';
import { PHOTO_FILE_PREFIX } from '@/lib/photos/document-annexure';
import { compressImage } from '@/lib/photos/compress-image';
import { saveDocuments } from '@/lib/documents/sink';
import { useSaveToCloudPrompt } from '@/hooks/useSaveToCloudPrompt';

/**
 * Compress, add to the claim, and (if the surveyor agrees) send to Drive.
 * Shared by the Photos tab and the Site screen so both behave identically.
 */
export function usePhotoUpload() {
  const addPhoto = useClaimStore((s) => s.addPhoto);
  const [isProcessing, setIsProcessing] = useState(false);
  const { confirmSaveToCloud, saveToCloudDialog } = useSaveToCloudPrompt();

  const uploadPhotos = useCallback(async (input: FileList | File[]) => {
    // Copy synchronously: callers reset the <input> right after calling us.
    const files = Array.from(input).filter((f) => f.type.startsWith('image/'));
    const claim = useClaimStore.getState().currentClaim;
    if (!claim || files.length === 0) return;

    setIsProcessing(true);
    try {
      const label = claim.vehicle?.registrationNumber || claim.id;
      const { profile } = useProfileStore.getState();
      const saveToDrive = profile.autoUploadDrive !== false
        ? await confirmSaveToCloud(files.length > 1 ? `${files.length} photos` : files[0].name, claim.id)
        : false;

      const saved: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const { dataUrl, w, h } = await compressImage(file, 600, 1.0);
          const name = file.name.split('.')[0].substring(0, 30);
          // The index keeps names unique when a phone names every shot "image".
          const driveName = `${PHOTO_FILE_PREFIX}${Date.now()}_${i}_${name}.jpg`;
          addPhoto(dataUrl, name, w, h, 'damage', saveToDrive ? driveName : undefined);
          saved.push(file);
          if (saveToDrive) {
            // uploadFileToDrive queues and toasts on failure itself.
            uploadFileToDrive(claim.id, driveName, file, label).catch(() => {});
          }
        } catch {
          // skip images that fail to compress
        }
      }
      if (saved.length) {
        void saveDocuments('damagePhotos', saved.map((f) => ({ blob: f, name: f.name })), 'photo');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [addPhoto, confirmSaveToCloud]);

  return { uploadPhotos, isProcessing, saveToCloudDialog };
}
