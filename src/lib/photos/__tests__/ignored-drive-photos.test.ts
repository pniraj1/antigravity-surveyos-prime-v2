import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getIgnoredDrivePhotos, ignoreDrivePhotos } from '../ignored-drive-photos';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function stub(store: Record<string, string>) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } },
  });
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('ignored drive photos', () => {
  let store: Record<string, string>;
  beforeEach(() => { store = {}; stub(store); });

  it('starts empty, remembers names per claim, and merges', () => {
    expect(getIgnoredDrivePhotos('c1').size).toBe(0);
    ignoreDrivePhotos('c1', ['a.jpg']);
    ignoreDrivePhotos('c1', ['b.jpg']);
    expect([...getIgnoredDrivePhotos('c1')].sort()).toEqual(['a.jpg', 'b.jpg']);
    expect(getIgnoredDrivePhotos('c2').size).toBe(0);
  });

  it('survives corrupt storage and a throwing localStorage', () => {
    store['surveyos_ignored_drive_photos_c1'] = '{not json';
    expect(getIgnoredDrivePhotos('c1').size).toBe(0);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } },
    });
    expect(getIgnoredDrivePhotos('c1').size).toBe(0);
    expect(() => ignoreDrivePhotos('c1', ['a.jpg'])).not.toThrow();
  });
});
