import { describe, it, expect } from 'vitest';
import { canOverwrite, selectDirtyClaims, countUnsynced } from '../sync-guard';
import type { ClaimData } from '@/types';

describe('canOverwrite', () => {
  it('allows when cloud is at the same version the device based on', () => {
    expect(canOverwrite(5, 5)).toBe(true);
  });
  it('allows when the device is ahead of the cloud (new claim, cloud=0)', () => {
    expect(canOverwrite(0, 0)).toBe(true);
    expect(canOverwrite(3, 2)).toBe(true);
  });
  it('refuses when the cloud has moved ahead of the device', () => {
    expect(canOverwrite(5, 6)).toBe(false);
  });
});

const mk = (id: string, updatedAt: string) => ({ id, updatedAt } as ClaimData);

describe('selectDirtyClaims', () => {
  it('includes claims never pushed', () => {
    const claims = [mk('a', '2026-01-01T00:00:00Z')];
    expect(selectDirtyClaims(claims, new Map()).map(c => c.id)).toEqual(['a']);
  });
  it('includes claims edited since last push, excludes up-to-date ones', () => {
    const claims = [mk('a', '2026-01-02T00:00:00Z'), mk('b', '2026-01-01T00:00:00Z')];
    const pushed = new Map([['a', '2026-01-01T00:00:00Z'], ['b', '2026-01-01T00:00:00Z']]);
    expect(selectDirtyClaims(claims, pushed).map(c => c.id)).toEqual(['a']);
  });
});

describe('countUnsynced', () => {
  it('counts only dirty claims', () => {
    const claims = [mk('a', '2026-01-02T00:00:00Z'), mk('b', '2026-01-01T00:00:00Z')];
    const pushed = new Map([['a', '2026-01-01T00:00:00Z'], ['b', '2026-01-01T00:00:00Z']]);
    expect(countUnsynced(claims, pushed)).toBe(1);
  });
});
