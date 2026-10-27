'use client';

import { useCallback, useState } from 'react';
import { EstimateModeDialog } from '@/components/dialogs/EstimateModeDialog';
import {
  buildBillModePrompt,
  buildEstimateModePrompt,
  type EstimateApplyMode,
} from '@/stores/slices/aiDataSlice';
import { useClaimStore } from '@/stores/claim-store';

interface PendingPrompt {
  kind: 'estimate' | 'bill';
  fileLabel: string;
  /** Sheet rows (estimate) or already-billed rows (bill). */
  rowCount: number;
  total?: number;
  billNo?: string;
  resolve: (mode: EstimateApplyMode | null) => void;
}

/**
 * Asks whether an incoming estimate (or bill) is more pages, a supplementary,
 * or a re-scan, BEFORE the document is sent for extraction.
 *
 * Resolves to the chosen mode, or null if the surveyor cancelled — in which
 * case the caller must not extract. A claim with nothing to lose resolves
 * straight to 'replace' without showing anything: there is nothing to ask.
 */
export function useEstimateModePrompt() {
  const [pending, setPending] = useState<PendingPrompt | null>(null);

  const confirmEstimateMode = useCallback(
    (fileLabel: string): Promise<EstimateApplyMode | null> => {
      const summary = buildEstimateModePrompt(useClaimStore.getState().currentClaim);
      if (!summary) return Promise.resolve('replace');

      return new Promise<EstimateApplyMode | null>((resolve) => {
        setPending({ kind: 'estimate', fileLabel, ...summary, resolve });
      });
    },
    [],
  );

  const confirmBillMode = useCallback(
    (fileLabel: string): Promise<'replace' | 'continue' | null> => {
      const summary = buildBillModePrompt(useClaimStore.getState().currentClaim);
      if (!summary) return Promise.resolve('replace');

      return new Promise<'replace' | 'continue' | null>((resolve) => {
        setPending({
          kind: 'bill',
          fileLabel,
          rowCount: summary.billedRows,
          billNo: summary.billNo,
          // The bill dialog only offers 'continue' | 'replace'.
          resolve: resolve as PendingPrompt['resolve'],
        });
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
      kind={pending.kind}
      fileLabel={pending.fileLabel}
      rowCount={pending.rowCount}
      total={pending.total}
      billNo={pending.billNo}
      onChoose={(mode) => handleChoice(mode)}
      onCancel={() => handleChoice(null)}
    />
  ) : null;

  return { confirmEstimateMode, confirmBillMode, estimateModeDialog };
}
