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

describe('BillCheckHeader upload button & clean header', () => {
  it('renders Upload Document and omits in-header final bill / estimate toggle buttons', () => {
    const html = render('final-bill');
    expect(html).toContain('Upload Document');
    // Header no longer renders duplicate 'Final bill' or 'Estimate' toggle buttons
    expect(html).not.toContain('>Final bill<');
    expect(html).not.toContain('>Estimate<');
  });

  it('renders Upload button that connects to onOpenUploadDialog without overlay input', () => {
    const openUpload = vi.fn();
    const html = renderToStaticMarkup(
      <BillCheckHeader
        showEvidence={false}
        onToggleEvidence={() => {}}
        bcSummary={{ grandTotalBilled: 0, netLiability: 0, notInBillTotal: 0 }}
        claimId="c1"
        fmt={(n) => String(n)}
        upload="final-bill"
        onOpenUploadDialog={openUpload}
      />
    );
    expect(html).toContain('Upload Document');
    expect(html).toContain('aria-label="Upload Document"');
    // When onOpenUploadDialog is provided, input overlay should not trap clicks
    expect(html).not.toContain('opacity-0 cursor-pointer z-10');
  });

  it('renders Brand Orange pill [Reconciliation Cockpit (N)] when onOpenReconcileWizard is provided', () => {
    const openWizard = vi.fn();
    const html = renderToStaticMarkup(
      <BillCheckHeader
        showEvidence={false}
        onToggleEvidence={() => {}}
        bcSummary={{ grandTotalBilled: 0, netLiability: 0, notInBillTotal: 0 }}
        claimId="c1"
        fmt={(n) => String(n)}
        onOpenReconcileWizard={openWizard}
        reconcileCount={5}
      />
    );
    expect(html).toContain('Reconciliation Cockpit (5)');
    expect(html).toContain('rounded-full');
    expect(html).toContain('border-amber-400');
    expect(html).toContain('bg-amber-50');
    expect(html).toContain('title="Open 4-Stage Reconciliation Cockpit"');
  });

  it('renders Brand Orange pill with count (0) when reconcileCount is 0', () => {
    const html = renderToStaticMarkup(
      <BillCheckHeader
        showEvidence={false}
        onToggleEvidence={() => {}}
        bcSummary={{ grandTotalBilled: 0, netLiability: 0, notInBillTotal: 0 }}
        claimId="c1"
        fmt={(n) => String(n)}
        onOpenReconcileWizard={() => {}}
        reconcileCount={0}
      />
    );
    expect(html).toContain('Reconciliation Cockpit (0)');
    expect(html).toContain('rounded-full');
  });
});
