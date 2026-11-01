import { describe, it, expect } from 'vitest';
import { groupForCleanup, cleanupTargets } from '../cleanup';
import type { ClaimData } from '@/types';

const c = (id: string, completedAt?: string, extra: Record<string, unknown> = {}) =>
  ({ id, completedAt, vehicle: { registrationNumber: id }, policy: { insurerName: 'NIA' }, ...extra }) as unknown as ClaimData;

describe('groupForCleanup', () => {
  it('completed only, year then month, newest first; skips already-trashed', () => {
    const g = groupForCleanup([
      c('a', '2025-03-10T10:00:00Z'), c('b', '2026-01-15T10:00:00Z'), c('open'),
      c('d', '2026-01-20T10:00:00Z'), c('e', '2026-06-15T10:00:00Z'),
      c('t', '2026-06-16T10:00:00Z', { driveTrashedAt: '2026-07-01T00:00:00Z' }),
    ]);
    expect(g.map(y => y.year)).toEqual([2026, 2025]);
    expect(g[0].months.map(m => m.month)).toEqual([5, 0]); // June, January (0-based)
    expect(g[0].months[1].claims.map(x => x.id)).toEqual(['d', 'b']);
    expect(g[1].months[0].claims.map(x => x.id)).toEqual(['a']);
  });
  it('empty when nothing completed', () => expect(groupForCleanup([c('x')])).toEqual([]));
});

describe('cleanupTargets', () => {
  const claim = c('k1', '2026-01-01T00:00:00Z', { scanClaimId: 's1' });
  it('finds both folders', () =>
    expect(cleanupTargets(claim, { k1: 'P' }, { s1: 'S' })).toEqual({ prime: 'P', scan: 'S' }));
  it('not on Drive -> null', () =>
    expect(cleanupTargets(claim, {}, {})).toEqual({ prime: null, scan: null }));
  it('no scanClaimId -> scan null', () =>
    expect(cleanupTargets(c('k1', 'x'), { k1: 'P' }, { s1: 'S' })).toEqual({ prime: 'P', scan: null }));
});
