'use client';

import { useCallback } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { getDriveToken } from '@/lib/drive';

/**
 * Non-intrusive cloud save resolver.
 * When Google Drive is connected, uploads proceed automatically to Drive in the background.
 * When Google Drive is not connected, files stay on local device without interrupting the surveyor.
 */
export function useSaveToCloudPrompt() {
  const confirmSaveToCloud = useCallback(async (_fileLabel?: string, _claimId?: string): Promise<boolean> => {
    const isDriveConnected = useUIStore.getState().isDriveConnected;
    const hasToken = !!getDriveToken();
    return isDriveConnected || hasToken;
  }, []);

  return { confirmSaveToCloud, saveToCloudDialog: null };
}
