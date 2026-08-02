import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DOCUMENT_ANNEXURE_OPTIONS,
  resolveAnnexureOptions,
  partitionPhotos,
  buildDocLayout,
  DEFAULT_DOCUMENT_ANNEXURE_OPTIONS as D,
  buildStripContent,
  isDocumentFileName,
  DOC_FILE_PREFIX,
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

describe('damage sheet exclusion', () => {
  it('never includes documents among the damage photos', () => {
    const { damage } = partitionPhotos([
      photo('rc', 'document'),
      photo('front', 'damage'),
      photo('dl', 'document'),
    ]);
    expect(damage).toHaveLength(1);
    expect(damage.every(d => d.item.kind !== 'document')).toBe(true);
  });
});

describe('buildDocLayout', () => {
  const verified = { ...D, verified: true };

  it('portrait 1-up fills the whole grid', () => {
    const c = buildDocLayout(1, verified, true);
    expect(c.cols).toBe(1);
    expect(c.rows).toBe(1);
    expect(c.cellW).toBeCloseTo(555, 1);
    expect(c.cellH).toBeCloseTo(637, 1);
  });

  it('portrait 2-up is two columns of full height', () => {
    const c = buildDocLayout(2, verified, true);
    expect(c.cols).toBe(2);
    expect(c.rows).toBe(1);
    expect(c.cellW).toBeCloseTo(273.5, 1);
    expect(c.cellH).toBeCloseTo(637, 1);
  });

  it('portrait 4-up is a 2x2 grid', () => {
    const c = buildDocLayout(4, verified, true);
    expect(c.cols).toBe(2);
    expect(c.rows).toBe(2);
    expect(c.cellW).toBeCloseTo(273.5, 1);
    expect(c.cellH).toBeCloseTo(314.5, 1);
  });

  it('landscape 2-up widens the cells and shortens them', () => {
    const c = buildDocLayout(2, verified, false);
    expect(c.cellW).toBeCloseTo(397, 1);
    expect(c.cellH).toBeCloseTo(390, 1);
  });

  it('landscape 4-up halves the cell height', () => {
    const c = buildDocLayout(4, verified, false);
    expect(c.cellW).toBeCloseTo(397, 1);
    expect(c.cellH).toBeCloseTo(191, 1);
  });

  it('reclaims the strip height when verified is off', () => {
    const off = { ...D, verified: false };
    expect(buildDocLayout(1, off, true).cellH).toBeCloseTo(732, 1);
    expect(buildDocLayout(1, off, false).cellH).toBeCloseTo(485, 1);
  });

  it('reserves a fixed strip height regardless of optional lines', () => {
    const bare = { ...D, verified: true, showLicence: false, showDatePlace: false };
    expect(buildDocLayout(1, bare, true).cellH)
      .toBeCloseTo(buildDocLayout(1, verified, true).cellH, 1);
  });

  it('perPage matches the requested layout', () => {
    expect(buildDocLayout(1, verified, true).perPage).toBe(1);
    expect(buildDocLayout(2, verified, true).perPage).toBe(2);
    expect(buildDocLayout(4, verified, true).perPage).toBe(4);
  });
});

const profile = {
  name: 'A. Surveyor',
  irdaiLicence: 'SLA-12345',
  iiislaNumber: '6789',
};

describe('buildStripContent', () => {
  it('always returns the surveyor name', () => {
    const s = buildStripContent(profile, { ...D, verified: true });
    expect(s.name).toBe('A. Surveyor');
  });

  it('includes the licence line when enabled', () => {
    const s = buildStripContent(profile, { ...D, verified: true, showLicence: true });
    expect(s.licence).toBe('IRDAI: SLA-12345 · IIISLA: 6789');
  });

  it('omits the licence line when disabled', () => {
    const s = buildStripContent(profile, { ...D, verified: true, showLicence: false });
    expect(s.licence).toBeNull();
  });

  it('omits the licence line when both numbers are blank rather than printing a bare label', () => {
    const s = buildStripContent(
      { name: 'A. Surveyor', irdaiLicence: '', iiislaNumber: '' },
      { ...D, verified: true, showLicence: true },
    );
    expect(s.licence).toBeNull();
  });

  it('includes only the number that is present', () => {
    const s = buildStripContent(
      { name: 'A. Surveyor', irdaiLicence: 'SLA-12345', iiislaNumber: '' },
      { ...D, verified: true, showLicence: true },
    );
    expect(s.licence).toBe('IRDAI: SLA-12345');
  });

  it('formats place and date together', () => {
    const s = buildStripContent(profile, {
      ...D, verified: true, showDatePlace: true, place: 'Nagpur', verifiedDate: '2026-08-01',
    });
    expect(s.placeDate).toBe('Nagpur · 2026-08-01');
  });

  it('shows the date alone when no place is set', () => {
    const s = buildStripContent(profile, {
      ...D, verified: true, showDatePlace: true, place: '', verifiedDate: '2026-08-01',
    });
    expect(s.placeDate).toBe('2026-08-01');
  });

  it('omits place and date when disabled', () => {
    const s = buildStripContent(profile, { ...D, verified: true, showDatePlace: false });
    expect(s.placeDate).toBeNull();
  });
});

describe('isDocumentFileName', () => {
  it('recognises the document prefix used for Drive uploads', () => {
    expect(isDocumentFileName(`${DOC_FILE_PREFIX}1234_rc.jpg`)).toBe(true);
  });

  it('treats a photo-prefixed file as a damage photo', () => {
    expect(isDocumentFileName('photo_1234_front.jpg')).toBe(false);
  });

  it('treats an unrecognised name as a damage photo', () => {
    expect(isDocumentFileName('IMG_0042.jpg')).toBe(false);
  });
});
