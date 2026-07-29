import { describe, it, expect, beforeEach } from 'vitest';
import type { ClaimData } from '@/types';
import { applyRemoteDeletion, type RemoteDeletionDeps } from '../indexeddb';

const mk = (id: string, updatedAt: string): ClaimData =>
  ({ id, updatedAt, reportNo: `R-${id}` } as ClaimData);

/** In-memory stand-in for the three store operations this function performs. */
function makeFakeDeps() {
  const claims = new Map<string, ClaimData>();
  const recovered: { claim: ClaimData; reason: string }[] = [];
  const deps: RemoteDeletionDeps = {
    getClaim: async (id) => claims.get(id),
    addRecoveredClaim: async (claim, reason) => { recovered.push({ claim, reason }); },
    removeClaimRecord: async (id) => { claims.delete(id); },
  };
  return { claims, recovered, deps };
}

describe('applyRemoteDeletion', () => {
  let f: ReturnType<typeof makeFakeDeps>;
  beforeEach(() => { f = makeFakeDeps(); });

  it('reports absent when the device never had the claim', async () => {
    const outcome = await applyRemoteDeletion('missing', '2026-07-29T10:00:00.000Z', f.deps);
    expect(outcome).toBe('absent');
    expect(f.recovered).toHaveLength(0);
  });

  it('drops a stale copy quietly, with no Recovered entry', async () => {
    f.claims.set('c1', mk('c1', '2026-07-29T09:00:00.000Z'));
    const outcome = await applyRemoteDeletion('c1', '2026-07-29T10:00:00.000Z', f.deps);
    expect(outcome).toBe('dropped');
    expect(f.recovered).toHaveLength(0);
    expect(f.claims.has('c1')).toBe(false);
  });

  it('stashes a copy edited after the deletion, then removes it', async () => {
    f.claims.set('c2', mk('c2', '2026-07-29T11:00:00.000Z'));
    const outcome = await applyRemoteDeletion('c2', '2026-07-29T10:00:00.000Z', f.deps);
    expect(outcome).toBe('stashed');
    expect(f.recovered).toHaveLength(1);
    expect(f.recovered[0].reason).toBe('deleted-on-another-device');
    expect(f.claims.has('c2')).toBe(false);
  });

  it('removes the claim even when it stashed it first', async () => {
    f.claims.set('c3', mk('c3', '2026-07-29T11:00:00.000Z'));
    await applyRemoteDeletion('c3', '2026-07-29T10:00:00.000Z', f.deps);
    expect(f.claims.has('c3')).toBe(false);
  });
});
