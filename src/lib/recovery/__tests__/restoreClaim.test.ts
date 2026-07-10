import { describe, it, expect, vi } from 'vitest';
import type { ClaimData } from '@/types';
import { restoreRecoveredClaim, summarizeClaim, type RestoreDeps } from '../restoreClaim';

const mk = (over: Partial<ClaimData> = {}): ClaimData =>
  ({ id: 'c1', reportNo: 'SPOT-1', updatedAt: '2026-01-01T00:00:00Z', photos: [], version: 0, ...over } as ClaimData);

const deps = (over: Partial<RestoreDeps> = {}): RestoreDeps => ({
  getClaim: vi.fn().mockResolvedValue(undefined),
  saveClaim: vi.fn().mockResolvedValue(undefined),
  addRecoveredClaim: vi.fn().mockResolvedValue(undefined),
  now: () => '2026-07-10T00:00:00Z',
  ...over,
});

describe('restoreRecoveredClaim', () => {
  it('inherits the LIVE cloud version, not the stale snapshot version', async () => {
    // This is the whole ballgame: the snapshot was stashed at v0 while the
    // cloud moved to v7. Restoring v0 would be refused on the next push.
    const live = mk({ version: 7, reportNo: 'SPOT-1-OLD' });
    const snapshot = mk({ version: 0, reportNo: 'SPOT-2-CORRECTED' });
    const d = deps({ getClaim: vi.fn().mockResolvedValue(live) });

    const restored = await restoreRecoveredClaim(snapshot, d);

    expect(restored.version).toBe(7);
    expect(restored.reportNo).toBe('SPOT-2-CORRECTED');
  });

  it('stashes the copy it is about to overwrite, before overwriting it', async () => {
    const live = mk({ version: 3, reportNo: 'REDONE-WORK' });
    const d = deps({ getClaim: vi.fn().mockResolvedValue(live) });

    await restoreRecoveredClaim(mk({ version: 0 }), d);

    expect(d.addRecoveredClaim).toHaveBeenCalledWith(live, 'replaced-by-restore');
    const stash = (d.addRecoveredClaim as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0];
    const save = (d.saveClaim as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0];
    expect(stash).toBeLessThan(save); // reversible: never a one-way door
  });

  it('never trades a populated photo set for an empty one', async () => {
    const live = mk({ version: 2, photos: ['a', 'b'] as unknown as ClaimData['photos'] });
    const snapshot = mk({ version: 0, photos: [] });
    const d = deps({ getClaim: vi.fn().mockResolvedValue(live) });

    const restored = await restoreRecoveredClaim(snapshot, d);

    expect(restored.photos).toHaveLength(2);
  });

  it('keeps the snapshot photos when it has them', async () => {
    const live = mk({ version: 2, photos: ['old'] as unknown as ClaimData['photos'] });
    const snapshot = mk({ version: 0, photos: ['new1', 'new2'] as unknown as ClaimData['photos'] });
    const d = deps({ getClaim: vi.fn().mockResolvedValue(live) });

    const restored = await restoreRecoveredClaim(snapshot, d);

    expect(restored.photos).toEqual(['new1', 'new2']);
  });

  it('marks the restored claim dirty so it syncs to the cloud', async () => {
    const d = deps({ getClaim: vi.fn().mockResolvedValue(mk({ version: 4 })) });
    const restored = await restoreRecoveredClaim(mk({ updatedAt: '2026-01-01T00:00:00Z' }), d);
    expect(restored.updatedAt).toBe('2026-07-10T00:00:00Z');
  });

  it('restores cleanly when the live claim is gone (deleted)', async () => {
    const d = deps({ getClaim: vi.fn().mockResolvedValue(undefined) });
    const restored = await restoreRecoveredClaim(mk({ version: 5 }), d);
    expect(d.addRecoveredClaim).not.toHaveBeenCalled(); // nothing to stash
    expect(restored.version).toBe(5);
  });
});

describe('summarizeClaim', () => {
  it('counts the work in a claim so two copies can be told apart', () => {
    const s = summarizeClaim(mk({
      reportNo: 'SPOT-2',
      vehicle: { registrationNumber: 'MH12AB1234' },
      policy: { insuredName: 'R. Sharma' },
      assessmentRows: [1, 2, 3],
      spotDamageRows: [1],
      photos: [1, 2],
    } as unknown as Partial<ClaimData>));

    expect(s).toMatchObject({
      reportNo: 'SPOT-2', vehicleNo: 'MH12AB1234', insuredName: 'R. Sharma',
      assessmentRows: 3, spotDamageRows: 1, photos: 2,
    });
  });

  it('falls back to dashes on an empty claim', () => {
    expect(summarizeClaim(mk())).toMatchObject({ reportNo: 'SPOT-1', vehicleNo: '—', insuredName: '—', assessmentRows: 0 });
  });
});
