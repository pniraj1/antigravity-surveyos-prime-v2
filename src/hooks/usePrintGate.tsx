'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { BeforePrintDialog } from '@/components/dialogs/BeforePrintDialog';
import { useClaimStore } from '@/stores/claim-store';
import { policyCheckStatus } from '@/lib/policy/policy-check';

export type GatedReport = 'final' | 'uiic-final' | 'bill-check' | 'uiic-bill-check';

interface PendingPrint {
  report: GatedReport;
  /** Decided when the dialog opens, so the card stays visible after it turns green. */
  showPolicy: boolean;
  run: () => void;
  /** Dialog button caption; the dialog defaults to "Print". */
  printLabel?: string;
}

/**
 * Wraps every print / Word-export action. Runs `run` straight away unless the
 * report needs a question first (UIIC reports ask the repair dates; any report
 * asks the policy check until it is answered).
 * Render `gateDialog` once next to the buttons that call `gate`.
 */
export function usePrintGate(): {
  gate: (report: GatedReport, run: () => void, printLabel?: string) => void;
  gateDialog: ReactNode;
} {
  const [pending, setPending] = useState<PendingPrint | null>(null);

  const gate = useCallback((report: GatedReport, run: () => void, printLabel?: string) => {
    const claim = useClaimStore.getState().currentClaim;
    const showPolicy = !!claim && !policyCheckStatus(claim).complete;
    if (report.startsWith('uiic') || showPolicy) setPending({ report, showPolicy, run, printLabel });
    else run();
  }, []);

  const gateDialog = pending ? (
    <BeforePrintDialog
      showUiic={pending.report.startsWith('uiic')}
      showPolicy={pending.showPolicy}
      onPrint={() => {
        const { run } = pending;
        setPending(null);
        run();
      }}
      onCancel={() => setPending(null)}
      printLabel={pending.printLabel}
    />
  ) : null;

  return { gate, gateDialog };
}
