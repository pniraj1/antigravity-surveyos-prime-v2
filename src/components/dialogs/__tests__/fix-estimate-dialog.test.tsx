import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FixEstimateDialog } from '@/components/dialogs/FixEstimateDialog';
import { useExtractionStore } from '@/stores/extraction-store';

const props = { open: true, onClose: () => {} };

describe('FixEstimateDialog first stage', () => {
  beforeEach(() => {
    useExtractionStore.setState({ files: {} });
  });

  it('renders nothing when closed', () => {
    expect(renderToStaticMarkup(<FixEstimateDialog {...props} open={false} />)).toBe('');
  });

  it('asks what went wrong, offers only the picker without a remembered file, and disables Send', () => {
    const html = renderToStaticMarkup(<FixEstimateDialog {...props} />);
    expect(html).toContain('Fix estimate reading');
    expect(html).toContain('Tell the AI what it got wrong');
    expect(html).toContain('e.g. items 38–52 missing · last column is taxable, without GST · page 3 not read');
    expect(html).toContain('Choose the estimate file again');
    expect(html).not.toContain('Re-reading:');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Send<\/button>/);
  });
});
