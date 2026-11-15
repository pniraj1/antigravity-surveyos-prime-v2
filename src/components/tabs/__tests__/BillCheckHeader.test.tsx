import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillCheckHeader } from '../bill-check/BillCheckHeader';

vi.mock('@/components/ai/AIControls', () => ({
  ProviderToggle: () => null, DocModeToggle: () => null, ModelSelector: () => null, ProviderHealthBadge: () => null,
}));
vi.mock('@/components/documents/UsePhoneFiles', () => ({ UsePhoneFiles: () => null }));
vi.mock('@/components/sync/SaveProgressButton', () => ({ SaveProgressButton: () => null }));
vi.mock('@/components/tabs/report/PrintMenu', () => ({ PrintMenu: () => null }));

const render = (upload: 'final-bill' | 'estimate') =>
  renderToStaticMarkup(
    <BillCheckHeader
      showEvidence={false}
      onToggleEvidence={() => {}}
      bcSummary={{ grandTotalBilled: 0, netLiability: 0, notInBillTotal: 0 }}
      claimId="c1"
      fmt={(n) => String(n)}
      upload={upload}
      onUploadChange={() => {}}
    />,
  );

describe('BillCheckHeader upload choice', () => {
  it('estimate: Upload Estimate and both choice labels', () => {
    const html = render('estimate');
    expect(html).toContain('Upload Estimate');
    expect(html).toContain('Final bill');
    expect(html).toContain('>Estimate<');
    expect(html).toContain('title="Upload the estimate"');
  });

  it('final-bill: keeps Upload Bill', () => {
    const html = render('final-bill');
    expect(html).toContain('Upload Bill');
    expect(html).not.toContain('Upload Estimate');
  });
});
