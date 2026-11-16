import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssessmentSummary } from '../AssessmentSummary';
import { useClaimStore } from '@/stores/claim-store';
import { uploadLabels } from '@/lib/reports/bill-check-mode';
import type { ClaimData } from '@/types';

describe('Assessment headings follow the claim base document', () => {
  // Server render reads the store's initial state, so put the claim under test there.
  const render = (baseDocument?: string) => {
    Object.assign(useClaimStore.getInitialState(), {
      currentClaim: { id: 'c', assessmentRows: [], extraBillItems: [], billCheck: { baseDocument }, vehicle: {}, accident: {}, depreciationType: 'standard', feeBill: {} } as unknown as ClaimData,
    });
    return renderToStaticMarkup(<AssessmentSummary />);
  };
  afterEach(() => { Object.assign(useClaimStore.getInitialState(), { currentClaim: null }); });

  it('from-bill says Bill vs assessment comparison and Billed', () => {
    const html = render('final-bill');
    expect(html).toContain('Bill vs assessment comparison');
    expect(html).toContain('>Billed<');
    expect(html).not.toContain('>Estimated<');
  });
  it('normal claim keeps Estimate wording', () => {
    const html = render('estimate');
    expect(html).toContain('Estimate vs assessment comparison');
    expect(html).toContain('>Estimated<');
  });
  it('the section table heading is the base label', () => {
    expect(uploadLabels({ billCheck: { baseDocument: 'final-bill' } }).base + '(taxable amount)').toBe('Billed(taxable amount)');
    expect(uploadLabels({}).base + '(taxable amount)').toBe('Estimate(taxable amount)');
  });
});
