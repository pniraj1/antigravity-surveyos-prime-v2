import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DOCUMENT_ANNEXURE_OPTIONS,
  resolveAnnexureOptions,
  partitionPhotos,
} from '@/lib/photos/document-annexure';
import type { PhotoItem } from '@/types/assessment';

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

const photo = (name: string, kind?: PhotoItem['kind']): PhotoItem => ({
  dataUrl: `data:image/jpeg;base64,${name}`,
  name,
  w: 100,
  h: 200,
  ...(kind ? { kind } : {}),
});

describe('partitionPhotos', () => {
  it('splits documents from damage photos', () => {
    const { damage, documents } = partitionPhotos([
      photo('front', 'damage'),
      photo('rc', 'document'),
    ]);
    expect(damage.map(d => d.item.name)).toEqual(['front']);
    expect(documents.map(d => d.item.name)).toEqual(['rc']);
  });

  it('treats a missing kind as damage, keeping pre-existing claims valid', () => {
    const { damage, documents } = partitionPhotos([photo('legacy')]);
    expect(damage.map(d => d.item.name)).toEqual(['legacy']);
    expect(documents).toEqual([]);
  });

  it('reports the index into the full array, not the filtered position', () => {
    const { documents } = partitionPhotos([
      photo('front', 'damage'),   // 0
      photo('rc', 'document'),    // 1
      photo('rear', 'damage'),    // 2
      photo('dl', 'document'),    // 3
    ]);
    // The second *document* sits at index 3 of the full array, not index 1.
    expect(documents.map(d => d.index)).toEqual([1, 3]);
  });

  it('returns empty partitions for an empty array', () => {
    expect(partitionPhotos([])).toEqual({ damage: [], documents: [] });
  });
});
