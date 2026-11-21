import { describe, it, expect, vi } from 'vitest';

// Photos fetched from Drive must also land in the vehicle folder on the PC, like an upload does.
const saves = vi.hoisted(() => [] as Array<{ type: string; names: string[]; ids: string[]; claimId?: string }>);

vi.stubGlobal('Image', class { naturalWidth = 4; naturalHeight = 3; onload?: () => void; set src(_v: string) { setTimeout(() => this.onload?.()); } });
vi.mock('@/lib/drive', () => ({ downloadFileAsBase64: async () => 'data:image/jpeg;base64,/9j/' }));
vi.mock('@/stores/claim-store', () => ({ useClaimStore: { getState: () => ({ currentClaim: {
  id: 'c1', documents: { d1: { id: 'd1', type: 'damagePhotos', driveFileId: 'from-phone' } } } }) } }));
vi.mock('@/lib/documents/sink', () => ({
  saveDocuments: async (type: string, files: Array<{ name: string; driveFileId?: string }>, _s: string, claimId?: string) => {
    saves.push({ type, names: files.map((f) => f.name), ids: files.map((f) => f.driveFileId ?? ''), claimId });
    return [];
  },
}));

const { downloadDrivePhotos } = await import('../download-drive-photos');

describe('downloadDrivePhotos', () => {
  it('saves new damage photos to the claim folder, not documents or files already there', async () => {
    const addPhoto = vi.fn();
    const r = await downloadDrivePhotos([
      { id: 'p1', name: 'Bumper.jpg', mimeType: 'image/jpeg' },
      { id: 'from-phone', name: 'Final Photos 1.jpg', mimeType: 'image/jpeg' }, // already saved by From Phone
      { id: 'rc', name: 'doc_RC Book.jpg', mimeType: 'image/jpeg' }, // a document photo, not a damage photo
    ] as never, addPhoto, () => true);

    expect(r.added).toBe(3);
    expect(addPhoto).toHaveBeenCalledTimes(3);
    expect(saves).toEqual([{ type: 'damagePhotos', names: ['Bumper.jpg'], ids: ['p1'], claimId: 'c1' }]);
  });
});
