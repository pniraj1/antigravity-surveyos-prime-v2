import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillCheckTab } from '../BillCheckTab';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types';

// F7: below lg the summary panel stacks under the grid, so the panel must scroll, not clip.
describe('BillCheckTab layout', () => {
  afterEach(() => { Object.assign(useClaimStore.getInitialState(), { currentClaim: null }); });
  it('children are full height only at lg+, and the panel scrolls below lg', () => {
    Object.assign(useClaimStore.getInitialState(), { currentClaim: createBlankClaim() });
    const html = renderToStaticMarkup(<BillCheckTab />);
    expect(html).toContain('overflow-y-auto lg:overflow-hidden');
    expect(html).toMatch(/class="flex flex-col lg:h-full min-h-0 /);
    expect(html).toContain('lg:col-span-4 xl:col-span-3 overflow-y-auto lg:h-full');
  });
});
