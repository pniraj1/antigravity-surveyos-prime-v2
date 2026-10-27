import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FixEstimateDialog, FixSourceToggle, defaultFixSource } from '@/components/dialogs/FixEstimateDialog';
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

describe('which estimate the file is', () => {
  it('defaults to Supplementary only for a remembered supplementary upload', () => {
    expect(defaultFixSource('append', false)).toBe('supplementary');
    expect(defaultFixSource('replace', false)).toBe('estimate');
    expect(defaultFixSource('continue', false)).toBe('estimate');
    expect(defaultFixSource(undefined, false)).toBe('estimate');
    expect(defaultFixSource('append', true)).toBe('estimate'); // surveyor picked another file
  });

  it('the toggle offers both options with the current one selected', () => {
    const html = renderToStaticMarkup(<FixSourceToggle value="supplementary" onChange={() => {}} />);
    expect(html).toContain('Original estimate');
    expect(html).toContain('Supplementary estimate');
    expect(html).toMatch(/checked=""[^>]*>Supplementary estimate/);
  });

  it('the first stage shows the toggle', () => {
    expect(renderToStaticMarkup(<FixEstimateDialog {...props} />)).toContain('This file is:');
  });
});
