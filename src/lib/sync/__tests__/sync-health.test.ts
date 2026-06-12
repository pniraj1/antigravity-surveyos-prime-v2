import { describe, it, expect } from 'vitest';
import { computeSyncHealth } from '@/lib/sync/sync-health';

describe('computeSyncHealth', () => {
  it('reports 100% when both sides are empty', () => {
    expect(computeSyncHealth([], [])).toEqual({
      total: 0, syncedCount: 0, localOnlyCount: 0, cloudOnlyCount: 0, syncedPct: 100,
    });
  });

  it('reports 100% when every local claim is in the cloud', () => {
    const r = computeSyncHealth(['a', 'b'], ['a', 'b']);
    expect(r.syncedPct).toBe(100);
    expect(r.localOnlyCount).toBe(0);
  });

  it('exposes local-only claims that never reached the cloud (the 21-vs-27 case)', () => {
    const local = Array.from({ length: 27 }, (_, i) => `c${i}`);
    const cloud = local.slice(0, 21); // 6 local-only
    const r = computeSyncHealth(local, cloud);
    expect(r.total).toBe(27);
    expect(r.syncedCount).toBe(21);
    expect(r.localOnlyCount).toBe(6);
    expect(r.cloudOnlyCount).toBe(0);
    expect(r.syncedPct).toBe(78); // round(21/27*100)
  });

  it('counts cloud-only claims not yet pulled to this device', () => {
    const r = computeSyncHealth(['a'], ['a', 'b']);
    expect(r.cloudOnlyCount).toBe(1);
    expect(r.syncedPct).toBe(50);
  });
});
