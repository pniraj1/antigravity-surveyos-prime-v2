import { describe, it, expect } from 'vitest';
import { findNewDrivePhotos, type DriveFileLite } from '../drive-photo-diff';
import type { PhotoItem } from '@/types';

const f = (name: string): DriveFileLite => ({ id: name, name, mimeType: 'image/jpeg' });
const p = (name: string, driveName?: string): PhotoItem => ({ dataUrl: 'x', name, kind: 'damage', ...(driveName ? { driveName } : {}) });

describe('findNewDrivePhotos', () => {
  it('returns everything when the device has no photos', () => {
    expect(findNewDrivePhotos([], [f('photo_1_0_a.jpg')])).toHaveLength(1);
  });

  it('skips files whose exact Drive name is already local', () => {
    const local = [p('a', 'photo_1_0_a.jpg')];
    expect(findNewDrivePhotos(local, [f('photo_1_0_a.jpg'), f('photo_2_0_b.jpg')]).map(x => x.name))
      .toEqual(['photo_2_0_b.jpg']);
  });

  it('treats same-named iPhone shots as different files when driveName is set', () => {
    const local = [p('image', 'photo_1_0_image.jpg')];
    expect(findNewDrivePhotos(local, [f('photo_1_0_image.jpg'), f('photo_1_1_image.jpg')]).map(x => x.name))
      .toEqual(['photo_1_1_image.jpg']);
  });

  it('matches legacy local photos (no driveName) by stripped name', () => {
    const local = [p('IMG_2041')];
    expect(findNewDrivePhotos(local, [f('photo_1712345678_IMG_2041.jpg')])).toEqual([]);
  });

  it('matches legacy restored photos by base name', () => {
    const local = [p('rc')];
    expect(findNewDrivePhotos(local, [f('rc.jpg')])).toEqual([]);
  });

  it('returns nothing for an empty Drive folder', () => {
    expect(findNewDrivePhotos([p('a', 'photo_1_0_a.jpg')], [])).toEqual([]);
  });

  it('detects camera and image files on Drive without photo_ prefix when not yet in local photos', () => {
    const local = [p('chassis', 'photo_1_chassis.jpg')];
    const driveFiles: DriveFileLite[] = [
      { id: 'd1', name: 'photo_1_chassis.jpg', mimeType: 'image/jpeg' },
      { id: 'd2', name: 'IMG_20261107_123456.jpg', mimeType: 'image/jpeg' },
      { id: 'd3', name: 'damage_front.png', mimeType: 'image/png' },
      { id: 'd4', name: 'estimate.pdf', mimeType: 'application/pdf' },
    ];
    const result = findNewDrivePhotos(local, driveFiles);
    expect(result.map(x => x.name)).toEqual(['IMG_20261107_123456.jpg', 'damage_front.png']);
  });

  it('matches local photos by ID (sourceDocId) and filename', () => {
    const local: PhotoItem[] = [
      { dataUrl: 'x', name: 'custom_caption', kind: 'damage', sourceDocId: 'd2' },
      { dataUrl: 'x', name: 'damage_front.png', kind: 'damage' },
    ];
    const driveFiles: DriveFileLite[] = [
      { id: 'd2', name: 'IMG_20261107_123456.jpg', mimeType: 'image/jpeg' },
      { id: 'd3', name: 'damage_front.png', mimeType: 'image/png' },
      { id: 'd5', name: 'new_damage.jpg', mimeType: 'image/jpeg' },
    ];
    const result = findNewDrivePhotos(local, driveFiles);
    expect(result.map(x => x.name)).toEqual(['new_damage.jpg']);
  });
});
