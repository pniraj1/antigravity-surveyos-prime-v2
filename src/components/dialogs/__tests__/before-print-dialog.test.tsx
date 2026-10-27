import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BeforePrintDialog, BeforePrintDialogView } from '@/components/dialogs/BeforePrintDialog';
import { usePrintGate } from '@/hooks/usePrintGate';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim, type ClaimData } from '@/types/claim';
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

// renderToStaticMarkup reads zustand's initial state, so the policy tests render the pure view with a claim.
describe('BeforePrintDialogView policy block', () => {
  const answered = { nilDep: 'no', imt23: 'na', consumables: 'no', excessConfirmed: true } as const;
  const render = (claim: ClaimData) => renderToStaticMarkup(
    <BeforePrintDialogView {...props} showUiic={false} showPolicy claim={claim} updateReinspection={() => {}} />,
  );
  const printDisabled = (html: string) => !!html.split('<button').find(b => b.includes('Print</button>'))?.includes('disabled=""');

  it('blank claim: shows the policy title and disables Print', () => {
    const html = render(createBlankClaim('final'));
    expect(html).toContain('Policy check — confirm before printing');
    expect(html).toContain('Before printing');
    expect(html).not.toContain('Before printing — UIIC');
    expect(printDisabled(html)).toBe(true);
  });

  it('all four answered: Print is enabled', () => {
    const html = render({ ...createBlankClaim('final'), policyCheck: answered });
    expect(printDisabled(html)).toBe(false);
    expect(html).toContain('Policy check — confirm before printing');
  });

  it('old claim with no policyCheck is 0 of 4 and blocked', () => {
    const claim = createBlankClaim('final');
    delete (claim as Partial<ClaimData>).policyCheck;
    expect(printDisabled(render(claim))).toBe(true);
  });

  it('showPolicy false never disables Print', () => {
    const html = renderToStaticMarkup(
      <BeforePrintDialogView {...props} showUiic claim={createBlankClaim('final')} updateReinspection={() => {}} />,
    );
    expect(printDisabled(html)).toBe(false);
  });
});

describe('usePrintGate', () => {
  function Probe({ kind, run }: { kind: Parameters<ReturnType<typeof usePrintGate>['gate']>[0]; run: () => void }) {
    const { gate, gateDialog } = usePrintGate();
    gate(kind, run); // ponytail: server render observes only the synchronous path; the UIIC hold-back is browser-only
    return <>{gateDialog}</>;
  }

  it('runs straight away for non-UIIC reports once the policy check is complete', () => {
    useClaimStore.setState({
      currentClaim: { ...createBlankClaim('final'), policyCheck: { nilDep: 'no', imt23: 'na', consumables: 'no', excessConfirmed: true } },
    });
    const run = vi.fn();
    renderToStaticMarkup(<Probe kind="final" run={run} />);
    renderToStaticMarkup(<Probe kind="bill-check" run={run} />);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('usePrintGate with the policy check pending', () => {
  it('holds back every report kind, including non-UIIC', () => {
    useClaimStore.setState({ currentClaim: createBlankClaim('final') });
    const run = vi.fn();
    function Probe({ kind }: { kind: 'final' | 'bill-check' }) {
      const { gate, gateDialog } = usePrintGate();
      const [asked, setAsked] = useState(false);
      if (!asked) { setAsked(true); gate(kind, run); } // once, so the render-phase update does not loop
      return <>{gateDialog}</>;
    }
    // ponytail: server render can't click; the dialog showing proves gate() held the report back
    ['final', 'bill-check'].forEach(kind => {
      const html = renderToStaticMarkup(<Probe kind={kind as 'final' | 'bill-check'} />);
      expect(html).toContain('Policy check — confirm before printing');
    });
    expect(run).not.toHaveBeenCalled();
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
