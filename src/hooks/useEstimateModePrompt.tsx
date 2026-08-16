'use client';

import { useCallback, useState } from 'react';
import { EstimateModeDialog } from '@/components/dialogs/EstimateModeDialog';
import { buildEstimateModePrompt, type EstimateApplyMode } from '@/stores/slices/aiDataSlice';
import { useClaimStore } from '@/stores/claim-store';

interface PendingPrompt {
  fileLabel: string;
  rowCount: number;
  total: number;
  resolve: (mode: EstimateApplyMode | null) => void;
}

/**
 * Asks whether an incoming estimate is a supplementary or a re-scan, BEFORE the
 * document is sent for extraction.
 *
 * Resolves to the chosen mode, or null if the surveyor cancelled — in which
 * case the caller must not extract. A sheet with no rows resolves straight to
 * 'replace' without showing anything: there is nothing to lose, so there is
 * nothing to ask.
 */
export function useEstimateModePrompt() {
  const [pending, setPending] = useState<PendingPrompt | null>(null);

  const confirmEstimateMode = useCallback(
    (fileLabel: string): Promise<EstimateApplyMode | null> => {
      const summary = buildEstimateModePrompt(useClaimStore.getState().currentClaim);
      if (!summary) return Promise.resolve('replace');

      return new Promise<EstimateApplyMode | null>((resolve) => {
        setPending({ fileLabel, ...summary, resolve });
      });
    },
    [],
  );

  const handleChoice = useCallback(
    (mode: EstimateApplyMode | null) => {
      pending?.resolve(mode);
      setPending(null);
    },
    [pending],
  );

  const estimateModeDialog = pending ? (
    <EstimateModeDialog
      fileLabel={pending.fileLabel}
      rowCount={pending.rowCount}
      total={pending.total}
      onChoose={(mode) => handleChoice(mode)}
      onCancel={() => handleChoice(null)}
    />
  ) : null;

  return { confirmEstimateMode, estimateModeDialog };
}
