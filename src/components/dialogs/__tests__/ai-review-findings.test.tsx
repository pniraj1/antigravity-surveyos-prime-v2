import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';

const data = { spare_parts: [{ sr_no: 1, total_amount: 10 }], labour_items: [], painting_items: [], gross_amount: 10 };
const base = { isOpen: true, onClose: () => {}, onConfirm: () => {}, title: 'estimate', data };

describe('AIReviewDialog — Check before applying card', () => {
  it('renders nothing extra on a clean read', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[]} />);
    expect(html).not.toContain('Check before applying');
    expect(html).not.toContain('Smart Fix');
  });
  it('shows plain-language findings and the Smart Fix button', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[{ kind: 'gap', srNos: [38, 52], pages: [2] }]} onSmartFix={() => {}} />);
    expect(html).toContain('Check before applying');
    expect(html).toContain('Rows 38 and 52 look missing (page 3)');
    expect(html).toContain('Smart Fix');
  });
  it('shows inline progress instead of the button while running', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[{ kind: 'gap', srNos: [38], pages: [2] }]} onSmartFix={() => {}} smartFixProgress="Re-reading page 3…" />);
    expect(html).toContain('Re-reading page 3…');
    expect(html).not.toContain('>Smart Fix<');
  });
  it('turns green when Smart Fix resolved everything', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[]} smartFixed />);
    expect(html).toContain('All 1 rows found, totals match');
  });
  it('keeps the manual hint when something remains after Smart Fix', () => {
    const html = renderToStaticMarkup(<AIReviewDialog {...base} findings={[{ kind: 'gross', rows: 1, printed: 2 }]} smartFixed onSmartFix={() => {}} />);
    expect(html).toContain('Evidence Viewer or describe the fix below');
  });
});
