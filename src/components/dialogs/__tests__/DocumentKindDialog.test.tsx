import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentKindDialog } from '@/components/dialogs/DocumentKindDialog';

describe('DocumentKindDialog', () => {
  it('shows the question, both answers and the explanation', () => {
    const html = renderToStaticMarkup(<DocumentKindDialog onChoose={() => {}} onCancel={() => {}} />);
    for (const t of [
      'What is this document?',
      'Estimate',
      'Final bill',
      'Cancel',
      'Choose Final bill when the insurer asks you to assess from the bill (UIIC). Bill Check will then read the estimate for Est. No.',
    ]) {
      expect(html).toContain(t);
    }
  });

  it('marks the current answer', () => {
    const html = renderToStaticMarkup(<DocumentKindDialog current="final-bill" onChoose={() => {}} onCancel={() => {}} />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>[^<]*Final bill/);
    expect(html).toContain('Current');
  });
  it('marks nothing when there is no current answer', () => {
    const html = renderToStaticMarkup(<DocumentKindDialog onChoose={() => {}} onCancel={() => {}} />);
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain('Current');
  });
});
