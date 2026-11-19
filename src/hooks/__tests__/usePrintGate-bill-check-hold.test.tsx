import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { toast } from 'sonner';
import { usePrintGate } from '@/hooks/usePrintGate';
import { useClaimStore } from '@/stores/claim-store';
import { CASH_LOSS_NO_BILL_CHECK } from '@/hooks/useBillCheckPrintGate';
import type { ClaimData } from '@/types/claim';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('usePrintGate bill-check hold', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['bill-check', 'uiic-bill-check'] as const)('%s on a cash-loss claim is held with a toast', (kind) => {
    useClaimStore.setState({ currentClaim: { cashLoss: { enabled: true, notionalPercent: 30 }, assessmentRows: [] } as unknown as ClaimData });
    const run = vi.fn();
    function Probe() { usePrintGate().gate(kind, run); return null; }
    renderToString(<Probe />);
    expect(run).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining(CASH_LOSS_NO_BILL_CHECK));
  });
});
