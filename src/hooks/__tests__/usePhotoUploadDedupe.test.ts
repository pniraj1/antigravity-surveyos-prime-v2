import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const overrides = {
    useEffect: (fn: () => void) => { fn(); },
    useCallback: <T,>(fn: T) => fn,
    useDebugValue: () => {},
    useSyncExternalStore: <T,>(_sub: unknown, getSnapshot: () => T) => getSnapshot(),
    useState: <T,>(init: T) => [typeof init === 'function' ? (init as () => T)() : init, vi.fn()],
  };
  return { ...actual, ...overrides, default: { ...actual, ...overrides } };
});

const mockAddPhoto = vi.fn();
const mockUpdateClaim = vi.fn();
let mockCurrentClaim: any = {
  id: 'claim-123',
  vehicle: { registrationNumber: 'KA01AB1234' },
  photos: [],
  documents: {},
};

vi.mock('@/stores/claim-store', () => {
  const store = {
    getState: () => ({
      currentClaim: mockCurrentClaim,
      addPhoto: mockAddPhoto,
      updateClaim: mockUpdateClaim,
    }),
  };
  const useClaimStore = ((selector: any) => selector(store.getState())) as any;
  useClaimStore.getState = store.getState;
  return { useClaimStore };
});

vi.mock('@/stores/profile-store', () => ({
  useProfileStore: {
    getState: () => ({
      profile: { autoUploadDrive: true },
    }),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: {
    getState: () => ({
      isDriveConnected: true,
    }),
  },
}));

const mockConfirmSaveToCloud = vi.fn().mockResolvedValue(true);
vi.mock('@/hooks/useSaveToCloudPrompt', () => ({
  useSaveToCloudPrompt: () => ({
    confirmSaveToCloud: mockConfirmSaveToCloud,
    saveToCloudDialog: null,
  }),
}));

vi.mock('@/lib/photos/compress-image', () => ({
  compressImage: vi.fn().mockResolvedValue({
    dataUrl: 'data:image/jpeg;base64,mockdata',
    w: 800,
    h: 600,
  }),
}));

const mockUploadWithDuplicateCheck = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/drive/upload-with-check', () => ({
  uploadWithDuplicateCheck: (...args: any[]) => mockUploadWithDuplicateCheck(...args),
}));

const mockSaveDocuments = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/documents/sink', () => ({
  saveDocuments: (...args: any[]) => mockSaveDocuments(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

import { usePhotoUpload } from '../usePhotoUpload';
import { PHOTO_FILE_PREFIX } from '@/lib/photos/document-annexure';

describe('usePhotoUpload deduplication and drive hygiene', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentClaim = {
      id: 'claim-123',
      vehicle: { registrationNumber: 'KA01AB1234' },
      photos: [],
      documents: {},
    };
  });

  it('uses deterministic photo names starting from 01 when no existing photos', async () => {
    const { uploadPhotos } = usePhotoUpload();
    const file1 = new File(['content1'], 'bumper.jpg', { type: 'image/jpeg' });
    const file2 = new File(['content2'], 'door.jpg', { type: 'image/jpeg' });

    await uploadPhotos([file1, file2]);

    const expectedName1 = `${PHOTO_FILE_PREFIX}01_bumper.jpg`;
    const expectedName2 = `${PHOTO_FILE_PREFIX}02_door.jpg`;

    // Verified in addPhoto call
    expect(mockAddPhoto).toHaveBeenCalledTimes(2);
    expect(mockAddPhoto).toHaveBeenNthCalledWith(
      1,
      'data:image/jpeg;base64,mockdata',
      'bumper',
      800,
      600,
      'damage',
      expectedName1,
      undefined
    );
    expect(mockAddPhoto).toHaveBeenNthCalledWith(
      2,
      'data:image/jpeg;base64,mockdata',
      'door',
      800,
      600,
      'damage',
      expectedName2,
      undefined
    );

    // Verified in uploadWithDuplicateCheck call
    expect(mockUploadWithDuplicateCheck).toHaveBeenCalledTimes(2);
    expect(mockUploadWithDuplicateCheck).toHaveBeenNthCalledWith(
      1,
      'claim-123',
      expectedName1,
      file1,
      'KA01AB1234'
    );
    expect(mockUploadWithDuplicateCheck).toHaveBeenNthCalledWith(
      2,
      'claim-123',
      expectedName2,
      file2,
      'KA01AB1234'
    );
  });

  it('offsets deterministic index by existing photos count', async () => {
    mockCurrentClaim.photos = [
      { id: 'p1', name: 'p1' },
      { id: 'p2', name: 'p2' },
      { id: 'p3', name: 'p3' },
    ];

    const { uploadPhotos } = usePhotoUpload();
    const file1 = new File(['content1'], 'dent.jpg', { type: 'image/jpeg' });
    const file2 = new File(['content2'], 'scratch.jpg', { type: 'image/jpeg' });

    await uploadPhotos([file1, file2]);

    const expectedName1 = `${PHOTO_FILE_PREFIX}04_dent.jpg`;
    const expectedName2 = `${PHOTO_FILE_PREFIX}05_scratch.jpg`;

    expect(mockUploadWithDuplicateCheck).toHaveBeenNthCalledWith(
      1,
      'claim-123',
      expectedName1,
      file1,
      'KA01AB1234'
    );
    expect(mockUploadWithDuplicateCheck).toHaveBeenNthCalledWith(
      2,
      'claim-123',
      expectedName2,
      file2,
      'KA01AB1234'
    );
  });

  it('passes claim.id as 4th parameter to saveDocuments', async () => {
    const { uploadPhotos } = usePhotoUpload();
    const file = new File(['content'], 'hood.jpg', { type: 'image/jpeg' });

    await uploadPhotos([file]);

    expect(mockSaveDocuments).toHaveBeenCalledTimes(1);
    expect(mockSaveDocuments).toHaveBeenCalledWith(
      'damagePhotos',
      [{ blob: file, name: 'hood.jpg' }],
      'photo',
      'claim-123'
    );
  });
});
