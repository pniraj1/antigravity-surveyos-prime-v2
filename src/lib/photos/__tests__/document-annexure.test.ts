import { describe, it, expect } from 'vitest';
import { DEFAULT_DOCUMENT_ANNEXURE_OPTIONS, resolveAnnexureOptions } from '@/lib/photos/document-annexure';

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

describe('resolveAnnexureOptions', () => {
  it('returns the full defaults when a claim has no documentAnnexure at all', () => {
    expect(resolveAnnexureOptions(undefined)).toEqual(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS);
  });

  it('overrides only the fields present on a partially-populated older claim', () => {
    const resolved = resolveAnnexureOptions({ layout: 1, verified: true });

    expect(resolved.layout).toBe(1);
    expect(resolved.verified).toBe(true);
    expect(resolved.pageOrientation).toBe(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.pageOrientation);
    expect(resolved.showBorder).toBe(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.showBorder);
  });

  it('returns a complete object faithfully when every field is already present', () => {
    const complete: typeof DEFAULT_DOCUMENT_ANNEXURE_OPTIONS = {
      ...DEFAULT_DOCUMENT_ANNEXURE_OPTIONS,
      layout: 1,
      pageOrientation: 'landscape',
      verified: true,
      place: 'Mumbai',
    };

    expect(resolveAnnexureOptions(complete)).toEqual(complete);
  });

  it('returns a new object, so mutating the result never affects the shared defaults constant', () => {
    const resolved = resolveAnnexureOptions(undefined);
    resolved.layout = 1;
    resolved.borderColor = '#000000';

    expect(resolved).not.toBe(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.layout).toBe(2);
    expect(DEFAULT_DOCUMENT_ANNEXURE_OPTIONS.borderColor).toBe('#E5E7EB');
  });
});
