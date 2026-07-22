import { describe, it, expect } from 'vitest';
import {
  FALLBACK_FEE_SCHEDULE, mergeWithFallback, getActiveFeeSchedule, type FeeSchedule,
} from '../fee-schedule';

describe('fee-schedule config', () => {
  it('fallback is the IISLA-2022 six-slab schedule', () => {
    expect(FALLBACK_FEE_SCHEDULE.version).toBe('IISLA-2022');
    expect(FALLBACK_FEE_SCHEDULE.slabs).toHaveLength(6);
    expect(FALLBACK_FEE_SCHEDULE.slabs[0]).toMatchObject({ upTo: 20000, base: 850 });
    expect(FALLBACK_FEE_SCHEDULE.slabs[5]).toMatchObject({ upTo: null, base: 15000, maxFee: 25000 });
  });

  it('mergeWithFallback returns fallback for empty/missing slabs', () => {
    expect(mergeWithFallback(null)).toBe(FALLBACK_FEE_SCHEDULE);
    expect(mergeWithFallback({ slabs: [] })).toBe(FALLBACK_FEE_SCHEDULE);
  });

  it('mergeWithFallback keeps a valid custom schedule and backfills meta', () => {
    const raw: Partial<FeeSchedule> = { slabs: FALLBACK_FEE_SCHEDULE.slabs };
    const merged = mergeWithFallback(raw);
    expect(merged.slabs).toHaveLength(6);
    expect(merged.updatedBy).toBe('unknown');
    expect(merged.version).toBe('IISLA-2022');
  });

  it('getActiveFeeSchedule resolves personal → global → fallback', () => {
    const personal = { ...FALLBACK_FEE_SCHEDULE, version: 'personal' };
    const global = { ...FALLBACK_FEE_SCHEDULE, version: 'global' };
    expect(getActiveFeeSchedule(personal, global).version).toBe('personal');
    expect(getActiveFeeSchedule(undefined, global).version).toBe('global');
    expect(getActiveFeeSchedule(undefined, null)).toBe(FALLBACK_FEE_SCHEDULE);
  });
});
