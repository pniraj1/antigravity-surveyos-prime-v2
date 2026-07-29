import { describe, it, expect } from 'vitest';
import { makeTombstone, isTombstone, shouldStashOnRemoteDelete } from '../tombstone';
import type { ClaimData } from '@/types';

const NOW = '2026-07-29T10:00:00.000Z';

describe('makeTombstone', () => {
  it('records identity, deletion time and the next version', () => {
    const t = makeTombstone('claim-1', 'uid-1', 4, NOW);
    expect(t).toEqual({
      id: 'claim-1',
      ownerId: 'uid-1',
      deleted: true,
      deletedAt: NOW,
      updatedAt: NOW,
      version: 4,
    });
  });

  it('sets updatedAt equal to deletedAt so the delta pull carries it', () => {
    const t = makeTombstone('claim-1', 'uid-1', 1, NOW);
    expect(t.updatedAt).toBe(t.deletedAt);
  });

  it('carries NO claim payload — this is the personal-data guarantee', () => {
    const t = makeTombstone('claim-1', 'uid-1', 1, NOW) as unknown as Record<string, unknown>;
    for (const forbidden of [
      'insured', 'vehicle', 'photos', 'assessment', 'reportNo',
      'surveyType', 'spotDamage', 'insurer', 'claimNo',
    ]) {
      expect(t[forbidden]).toBeUndefined();
    }
    expect(Object.keys(t).sort()).toEqual(
      ['deleted', 'deletedAt', 'id', 'ownerId', 'updatedAt', 'version'],
    );
  });
});

describe('isTombstone', () => {
  it('is true for a tombstone', () => {
    expect(isTombstone(makeTombstone('c', 'u', 1, NOW))).toBe(true);
  });

  it('is false for a live claim', () => {
    const claim = { id: 'c', updatedAt: NOW, reportNo: 'R1' } as unknown as ClaimData;
    expect(isTombstone(claim)).toBe(false);
  });

  it('is false for a claim that merely has a falsy deleted field', () => {
    const claim = { id: 'c', updatedAt: NOW, deleted: false } as unknown as ClaimData;
    expect(isTombstone(claim)).toBe(false);
  });
});

describe('shouldStashOnRemoteDelete', () => {
  it('stashes when the local copy was edited after the deletion', () => {
    expect(shouldStashOnRemoteDelete('2026-07-29T11:00:00.000Z', NOW)).toBe(true);
  });

  it('drops a copy older than the deletion — a stale duplicate', () => {
    expect(shouldStashOnRemoteDelete('2026-07-29T09:00:00.000Z', NOW)).toBe(false);
  });

  it('drops a copy edited at exactly the deletion instant', () => {
    expect(shouldStashOnRemoteDelete(NOW, NOW)).toBe(false);
  });
});
