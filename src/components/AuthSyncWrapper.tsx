'use client';

import { useAuth } from '@/hooks/useAuth';
import { useCloudSync } from '@/hooks/useCloudSync';
import { useAutoSave } from '@/hooks/useAutoSave';
import { SaveStatusBar } from '@/components/layout/SaveStatusBar';
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { getClaim } from '@/lib/storage/indexeddb';
import { logger } from '@/lib/utils/logger';

/**
 * A wrapper component that initializes global Auth and Cloud Sync listeners.
 */
export function AuthSyncWrapper({ children }: { children: React.ReactNode }) {
  // Initialize Auth listener
  useAuth();
  
  useCloudSync();
  useAutoSave(2000); // 2s debounce before cloud push

  const currentClaimId = useUIStore((state) => state.currentClaimId);
  const currentClaim = useClaimStore((state) => state.currentClaim);
  const loadClaim = useClaimStore((state) => state.loadClaim);

  // Recovery Logic: If we have a persisted ID but no loaded claim, load it.
  useEffect(() => {
    if (currentClaimId && !currentClaim) {
      logger.log('[Recovery] Attempting to recover claim:', currentClaimId);
      getClaim(currentClaimId)
        .then((claim) => {
          if (claim) {
            loadClaim(claim);
            logger.log('[Recovery] Successfully recovered claim:', currentClaimId);
          } else {
            logger.warn('[Recovery] Claim ID persisted but not found in DB:', currentClaimId);
          }
        })
        .catch((err) => {
          logger.error('[Recovery] Failed to recover claim:', err);
        });
    }
  }, [currentClaimId, currentClaim, loadClaim]);

  return (
    <>
      <Toaster position="top-right" richColors />
      <SaveStatusBar />
      {children}
    </>
  );
}
