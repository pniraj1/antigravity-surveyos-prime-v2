'use client';

import { useCallback, useState } from 'react';
import { SaveToCloudDialog } from '@/components/dialogs/SaveToCloudDialog';
import { getCloudChoice, rememberCloudChoice } from '@/lib/photos/cloud-choice-memo';

interface PendingPrompt {
  fileLabel: string;
  resolve: (ok: boolean) => void;
}

/**
 * Shared "Save to Drive?" confirmation, reused by every upload path
 * (Documents, Photos, Estimate) instead of auto-uploading silently.
 */
export function useSaveToCloudPrompt() {
  const [pending, setPending] = useState<PendingPrompt | null>(null);

  const confirmSaveToCloud = useCallback((fileLabel: string, claimId?: string): Promise<boolean> => {
    if (claimId) {
      const known = getCloudChoice(claimId);
      if (known !== undefined) return Promise.resolve(known);
    }
    return new Promise<boolean>((resolve) => {
      setPending({
        fileLabel,
        resolve: (ok) => {
          if (claimId) rememberCloudChoice(claimId, ok);
          resolve(ok);
        },
      });
    });
  }, []);

  const handleChoice = useCallback((ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  }, [pending]);

  const saveToCloudDialog = pending ? (
    <SaveToCloudDialog
      fileLabel={pending.fileLabel}
      onConfirm={() => handleChoice(true)}
      onCancel={() => handleChoice(false)}
    />
  ) : null;

  return { confirmSaveToCloud, saveToCloudDialog };
}
