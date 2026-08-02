import { describe, it, expect } from 'vitest';
import { DEFAULT_DOCUMENT_ANNEXURE_OPTIONS } from '@/lib/photos/document-annexure';

describe('DEFAULT_DOCUMENT_ANNEXURE_OPTIONS', () => {
  it('defaults to 2-up portrait, the optimal layout for phone screenshots', () => {
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.layout).toBe(2);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.pageOrientation).toBe('portrait');
  });

  it('defaults verified to false so the app never asserts verification on its own', () => {
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.verified).toBe(false);
  });

  it('matches the photo sheet defaults for the shared cosmetic options', () => {
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.pagePadding).toBe(20);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.cellGap).toBe(8);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.showBorder).toBe(true);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.borderColor).toBe('#E5E7EB');
  });
});
