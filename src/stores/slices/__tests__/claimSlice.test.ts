import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createClaimSlice, type ClaimSlice } from '../claimSlice';
import { createBlankClaim } from '@/types';
import { DEFAULT_DOCUMENT_ANNEXURE_OPTIONS } from '@/lib/photos/document-annexure';
import type { PhotoItem } from '@/types/assessment';

/**
 * A fresh, isolated instance of the claim slice per test — never the shared
 * `useClaimStore` singleton, so tests can't leak state into each other.
 * `replacePhotoImage` and `updateDocumentAnnexure` never touch useUIStore /
 * useAuthStore / IndexedDB, so seeding state via `setState` directly (rather
 * than through `loadClaim`/`newClaim`) keeps this test free of those
 * side-effecting dependencies.
 */
function makeStore() {
  return create<ClaimSlice>()(createClaimSlice);
}

const photo = (name: string, kind: PhotoItem['kind']): PhotoItem => ({
  dataUrl: `data:image/jpeg;base64,${name}`,
  name,
  w: 100,
  h: 200,
  kind,
});

describe('replacePhotoImage', () => {
  it('on a mixed damage/document array, replaces only the targeted entry', () => {
    const store = makeStore();
    const original = [
      photo('d1', 'damage'),
      photo('doc1', 'document'),
      photo('d2', 'damage'),
      photo('doc2', 'document'), // the second document — index 3
    ];
    store.setState({ currentClaim: { ...createBlankClaim(), photos: original } });

    store.getState().replacePhotoImage(3, 'data:image/jpeg;base64,rotated', 200, 150);

    const photos = store.getState().currentClaim!.photos;
    expect(photos[3]).toEqual({
      ...original[3],
      dataUrl: 'data:image/jpeg;base64,rotated',
      w: 200,
      h: 150,
    });
    // Every other entry keeps its original dataUrl, w, h and kind.
    expect(photos[0]).toEqual(original[0]);
    expect(photos[1]).toEqual(original[1]);
    expect(photos[2]).toEqual(original[2]);
  });

  it('is a no-op for an out-of-range index', () => {
    const store = makeStore();
    const original = [photo('d1', 'damage'), photo('doc1', 'document')];
    store.setState({ currentClaim: { ...createBlankClaim(), photos: original } });

    store.getState().replacePhotoImage(5, 'data:image/jpeg;base64,new', 1, 1);

    expect(store.getState().currentClaim!.photos).toEqual(original);
  });
});

describe('updateDocumentAnnexure', () => {
  it('on a claim with no documentAnnexure, produces a complete options object', () => {
    const store = makeStore();
    const claim = { ...createBlankClaim(), documentAnnexure: undefined };
    expect(claim.documentAnnexure).toBeUndefined();
    store.setState({ currentClaim: claim });

    store.getState().updateDocumentAnnexure({ verified: true });

    expect(store.getState().currentClaim!.documentAnnexure).toEqual({
      ...DEFAULT_DOCUMENT_ANNEXURE_OPTIONS,
      verified: true,
    });
  });
});
