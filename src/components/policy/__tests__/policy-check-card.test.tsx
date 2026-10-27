import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PolicyCheckCardView } from '../PolicyCheckCard';
import { PolicyCheckStripView } from '../PolicyCheckStrip';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData, PolicyCheck } from '@/types/claim';

// renderToStaticMarkup reads zustand's initial state, so the views take the claim directly.
const claimWith = (policyCheck?: PolicyCheck) => ({ ...createBlankClaim('final'), policyCheck });
const noop = () => {};
const card = (pc?: PolicyCheck) =>
  renderToStaticMarkup(<PolicyCheckCardView claim={claimWith(pc)} setPolicyCheck={noop} updateFeeBill={noop} />);
const strip = (pc?: PolicyCheck) =>
  renderToStaticMarkup(<PolicyCheckStripView claim={claimWith(pc)} open={false} onToggle={noop} />);

describe('PolicyCheckCard', () => {
  it('renders the three pill labels and the excess confirm', () => {
    const html = card();
    ['Nil / Zero Dep', 'IMT 23', 'Consumables cover', 'Confirm'].forEach(l => expect(html).toContain(l));
    expect(html).not.toContain('AI read:');
  });

  it('shows the AI read beside the question it answers', () => {
    expect(card({ aiRead: { nilDep: 'yes' } })).toContain('AI read: Yes');
  });

  it('renders for an old claim with no feeBill', () => {
    const old = { ...claimWith(), feeBill: undefined } as unknown as ClaimData;
    const html = renderToStaticMarkup(<PolicyCheckCardView claim={old} setPolicyCheck={noop} updateFeeBill={noop} />);
    expect(html).toContain('Excess');
  });

  it('lists warnings', () => {
    expect(card({ consumables: 'no' })).toContain('Consumables not payable');
  });
});

describe('PolicyCheckStrip', () => {
  it('shows 0 of 4 for a claim with no policy check', () => {
    expect(strip()).toContain('Policy check: 0 of 4 confirmed');
  });

  it('shows Policy checked when all four are answered', () => {
    const html = strip({ nilDep: 'no', imt23: 'na', consumables: 'yes', excessConfirmed: true });
    expect(html).toContain('Policy checked');
    expect(html).not.toContain('of 4');
  });
});
