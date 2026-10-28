import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { stripPageTags } from '@/lib/ai/row-check';

describe('AIReviewDialog — AI Audit feedback card', () => {
  const base = { isOpen: true, onClose: () => {}, onConfirm: () => {}, title: 'estimate' };

  it('renders AI audit card when _audit is provided in data', () => {
    const dataWithAudit = {
      _audit: {
        tax_posture: 'exclusive',
        columns_detected: ['Part No', 'Description', 'Rate', 'Amount'],
        reconciliation_note: 'Footer adds 18% GST to subtotal',
        warnings: [],
      },
      spare_parts: [{ sr_no: 1, total_amount: 100 }],
    };
    const html = renderToStaticMarkup(<AIReviewDialog {...base} data={dataWithAudit} />);
    expect(html).toContain('AI Audit &amp; Tax Deduction');
    expect(html).toContain('GST Extra (Taxable Rates)');
    expect(html).toContain('Footer adds 18% GST to subtotal');
    expect(html).toContain('Part No');
  });

  it('renders warnings when _audit contains warnings', () => {
    const dataWithWarnings = {
      _audit: {
        tax_posture: 'inclusive',
        columns_detected: ['Srl', 'Amount'],
        reconciliation_note: 'Amount matches gross',
        warnings: ['Row 5 GST rate ambiguous, defaulted to 18%'],
      },
      spare_parts: [],
    };
    const html = renderToStaticMarkup(<AIReviewDialog {...base} data={dataWithWarnings} />);
    expect(html).toContain('Audit Warnings');
    expect(html).toContain('Row 5 GST rate ambiguous, defaulted to 18%');
    expect(html).toContain('Tax Inclusive (Gross Rates)');
  });

  it('stripPageTags strips _audit so it is never saved into claim store', () => {
    const data = {
      _audit: { tax_posture: 'exclusive' },
      spare_parts: [{ sr_no: 1, particulars: 'Test', _page: 0 }],
    };
    const cleaned = stripPageTags(data);
    expect(cleaned).not.toHaveProperty('_audit');
    expect(cleaned.spare_parts[0]).not.toHaveProperty('_page');
  });
});
