import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillCheckUploadPanel } from '../bill-check/BillCheckUploadPanel';

vi.mock('@/components/ai/AIControls', () => ({ ProviderToggle: () => null, ModelSelector: () => null }));
vi.mock('@/components/documents/UsePhoneFiles', () => ({ UsePhoneFiles: () => null }));

const render = (upload: 'final-bill' | 'estimate') =>
  renderToStaticMarkup(
    <BillCheckUploadPanel
      bc={{ billNo: '', billDate: '', billTotal: 0 }}
      onBillCheckChange={() => {}}
      isProcessing={false}
      progress=""
      onFileUpload={() => {}}
      onPhoneFile={() => {}}
      upload={upload}
      onUploadChange={() => {}}
    />,
  );

describe('BillCheckUploadPanel upload choice', () => {
  it('estimate: estimate wording and both choice labels', () => {
    const html = render('estimate');
    expect(html).toContain('Upload Estimate');
    expect(html).toContain('Step 1 — Upload the estimate');
    expect(html).toContain('This upload is:');
    expect(html).toContain('Final bill');
    expect(html).toContain('Estimate');
    expect(html).not.toContain('Upload Final Workshop Bill');
  });

  it('final-bill: keeps today\'s wording', () => {
    const html = render('final-bill');
    expect(html).toContain('Upload Final Workshop Bill');
    expect(html).not.toContain('Upload Estimate');
  });
});
