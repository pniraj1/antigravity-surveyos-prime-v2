import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { TabTipBanner } from '../TabTip';
import { TAB_HELP, getNextClaimTab, getTabLabel } from '@/lib/onboarding/tab-help';

describe('TabTipBanner presentation component', () => {
  it('renders tip with title, digital PDF advice, Next button, and Got it button', () => {
    const docHelp = TAB_HELP.documents;
    const nextTab = getNextClaimTab('documents', 'final');
    const onNext = vi.fn();
    const onDismiss = vi.fn();

    const html = renderToStaticMarkup(
      <TabTipBanner
        title={docHelp.title}
        tip={docHelp.tip}
        nextTabLabel={nextTab ? getTabLabel(nextTab) : null}
        onNext={onNext}
        onDismiss={onDismiss}
      />
    );

    expect(html).toContain('Documents:');
    expect(html).toContain('Ask the garage to WhatsApp or email');
    expect(html).toContain('Next: AI Review');
    expect(html).toContain('Got it');
    expect(html).toContain('print:hidden');
  });

  it('adapts Next button target based on survey type (Spot skips to Report Center from Details)', () => {
    const detailsHelp = TAB_HELP.details;
    const nextTabSpot = getNextClaimTab('details', 'spot');

    const html = renderToStaticMarkup(
      <TabTipBanner
        title={detailsHelp.title}
        tip={detailsHelp.tip}
        nextTabLabel={nextTabSpot ? getTabLabel(nextTabSpot) : null}
        onNext={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(html).toContain('Claim Details:');
    expect(html).toContain('Next: Report Center');
    expect(html).not.toContain('Next: Assessment');
  });

  it('renders without Next button on terminal tabs', () => {
    const riHelp = TAB_HELP.reinspection;
    const nextTabFinal = getNextClaimTab('reinspection', 'final'); // null

    const html = renderToStaticMarkup(
      <TabTipBanner
        title={riHelp.title}
        tip={riHelp.tip}
        nextTabLabel={nextTabFinal ? getTabLabel(nextTabFinal) : null}
        onDismiss={vi.fn()}
      />
    );

    expect(html).toContain('Reinspection:');
    expect(html).not.toContain('Next:');
    expect(html).toContain('Got it');
  });
});
