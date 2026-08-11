'use client';

import { useCallback, useState } from 'react';
import { SaveToCloudDialog } from '@/components/dialogs/SaveToCloudDialog';

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

  const confirmSaveToCloud = useCallback((fileLabel: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ fileLabel, resolve });
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
