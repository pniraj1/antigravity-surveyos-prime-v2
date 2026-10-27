'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { BeforePrintDialog } from '@/components/dialogs/BeforePrintDialog';

export type GatedReport = 'final' | 'uiic-final' | 'bill-check' | 'uiic-bill-check';

interface PendingPrint {
  report: GatedReport;
  run: () => void;
}

/**
 * Wraps every print / Word-export action. Runs `run` straight away unless the
 * report needs a question first (UIIC reports ask the repair dates).
 * Render `gateDialog` once next to the buttons that call `gate`.
 */
export function usePrintGate(): { gate: (report: GatedReport, run: () => void) => void; gateDialog: ReactNode } {
  const [pending, setPending] = useState<PendingPrint | null>(null);

  const gate = useCallback((report: GatedReport, run: () => void) => {
    if (report.startsWith('uiic')) setPending({ report, run });
    else run();
  }, []);

  const gateDialog = pending ? (
    <BeforePrintDialog
      showUiic={pending.report.startsWith('uiic')}
      showPolicy={false}
      onPrint={() => {
        const { run } = pending;
        setPending(null);
        run();
      }}
      onCancel={() => setPending(null)}
    />
  ) : null;

  return { gate, gateDialog };
}
