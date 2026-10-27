import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BeforePrintDialog } from '@/components/dialogs/BeforePrintDialog';
import { usePrintGate } from '@/hooks/usePrintGate';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types/claim';
import { buildUIICFinalHTML } from '@/lib/reports/uiic-final-builder';

const props = { showPolicy: false, onPrint: () => {}, onCancel: () => {} };
const LABELS = [
  'Reinspection appointment date',
  'Repair Authorisation Date',
  'Est. Repair Completion Date',
  'Actual Repair Completion Date',
  'Repairs as per assessment',
];

describe('BeforePrintDialog', () => {
  beforeEach(() => {
    useClaimStore.setState({ currentClaim: createBlankClaim('final') });
  });

  it('asks the five UIIC repair/reinspection fields', () => {
    const html = renderToStaticMarkup(<BeforePrintDialog {...props} showUiic />);
    expect(html).toContain('Before printing — UIIC');
    LABELS.forEach(l => expect(html).toContain(l));
    ['YES', 'NO', 'PARTIAL'].forEach(b => expect(html).toContain(`>${b}<`));
    expect(html).toContain('Blank dates are allowed if reinspection is not done yet.');
  });

  it('uses printLabel for the confirm button', () => {
    const html = renderToStaticMarkup(<BeforePrintDialog {...props} showUiic printLabel="Export Word" />);
    expect(html).toContain('Export Word');
  });

  it('renders none of the UIIC fields when showUiic is false', () => {
    const html = renderToStaticMarkup(<BeforePrintDialog {...props} showUiic={false} />);
    LABELS.forEach(l => expect(html).not.toContain(l));
  });

  it('renders on an old claim with no reinspection dates', () => {
    const claim = createBlankClaim('final');
    useClaimStore.setState({ currentClaim: { ...claim, reinspection: {} as typeof claim.reinspection } });
    expect(() => renderToStaticMarkup(<BeforePrintDialog {...props} showUiic />)).not.toThrow();
  });
});

describe('usePrintGate', () => {
  function Probe({ kind, run }: { kind: Parameters<ReturnType<typeof usePrintGate>['gate']>[0]; run: () => void }) {
    const { gate, gateDialog } = usePrintGate();
    gate(kind, run); // ponytail: server render observes only the synchronous path; the UIIC hold-back is browser-only
    return <>{gateDialog}</>;
  }

  it('runs straight away for non-UIIC reports', () => {
    const run = vi.fn();
    renderToStaticMarkup(<Probe kind="final" run={run} />);
    renderToStaticMarkup(<Probe kind="bill-check" run={run} />);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('dates typed in the dialog reach the report', () => {
  it('a run that reads the store at execution time builds UIIC output with the new date', () => {
    useClaimStore.setState({ currentClaim: createBlankClaim('final') });
    // What each print place does: read the claim when `run` executes, not when gate() was called.
    const run = () => buildUIICFinalHTML(useClaimStore.getState().currentClaim!, null);
    const stale = run();
    useClaimStore.getState().updateReinspection({ repairAuthDate: '2026-03-05' });
    const fresh = run();
    expect(stale).not.toContain('05.03.2026');
    expect(fresh).toContain('05.03.2026');
  });
});
