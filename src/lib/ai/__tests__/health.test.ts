import { describe, it, expect } from 'vitest';
import { createHealth, keyHash, nextPacificMidnight, localDayKey } from '../health';

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

describe('busyRate', () => {
  it('is 0 until three calls have been made today', () => {
    const h = createHealth(memStore(), () => 1_000);
    h.recordCall('m', 'busy'); h.recordCall('m', 'busy');
    expect(h.busyRate('m')).toBe(0);
    h.recordCall('m', 'ok');
    expect(h.busyRate('m')).toBeCloseTo(2 / 3);
  });
  it('resets at local midnight', () => {
    let t = new Date(2026, 8, 15, 23, 0).getTime();
    const s = memStore();
    const h = createHealth(s, () => t);
    for (let i = 0; i < 3; i++) h.recordCall('m', 'busy');
    expect(h.busyRate('m')).toBe(1);
    t = new Date(2026, 8, 16, 0, 5).getTime();
    expect(createHealth(s, () => t).busyRate('m')).toBe(0);
  });
});

describe('deadToday', () => {
  it('marks one model for one key until next Pacific midnight', () => {
    let t = Date.UTC(2026, 8, 15, 10, 0); // 03:00 Pacific (PDT)
    const s = memStore();
    const h = createHealth(s, () => t);
    h.markDeadToday('k1', 'gemini-2.5-flash');
    expect(h.isDeadToday('k1', 'gemini-2.5-flash')).toBe(true);
    expect(h.isDeadToday('k1', 'gemini-flash-lite-latest')).toBe(false);
    expect(h.isDeadToday('k2', 'gemini-2.5-flash')).toBe(false);
    t = Date.UTC(2026, 8, 16, 7, 30); // 00:30 Pacific next day
    expect(createHealth(s, () => t).isDeadToday('k1', 'gemini-2.5-flash')).toBe(false);
  });
  it("'*' marks the whole provider for that key", () => {
    const h = createHealth(memStore(), () => Date.UTC(2026, 8, 15, 10, 0));
    h.markDeadToday('k1', '*');
    expect(h.isDeadToday('k1', 'anything')).toBe(true);
  });
});

describe('notFound', () => {
  it('remembers a 404 for seven days', () => {
    let t = 0;
    const s = memStore();
    createHealth(s, () => t).markNotFound('gemini-3.5-flash');
    t = 6 * 86_400_000;
    expect(createHealth(s, () => t).isNotFound('gemini-3.5-flash')).toBe(true);
    t = 8 * 86_400_000;
    expect(createHealth(s, () => t).isNotFound('gemini-3.5-flash')).toBe(false);
  });
});

describe('storage failure', () => {
  it('a null store degrades to no history without throwing', () => {
    const h = createHealth(null, () => 0);
    h.recordCall('m', 'busy'); h.markDeadToday('k', 'm'); h.markNotFound('m');
    expect(h.busyRate('m')).toBe(0);
    expect(h.isDeadToday('k', 'm')).toBe(false);
    expect(h.isNotFound('m')).toBe(false);
  });
  it('a throwing store is treated as null', () => {
    const bad = { getItem: () => { throw new Error('private mode'); }, setItem: () => { throw new Error('private mode'); } };
    const h = createHealth(bad, () => 0);
    h.recordCall('m', 'busy');
    expect(h.busyRate('m')).toBe(0);
  });
});

describe('helpers', () => {
  it('keyHash is short, stable and not the key', () => {
    const a = keyHash('AQ.Ab12345secret');
    expect(a).toBe(keyHash('AQ.Ab12345secret'));
    expect(a).not.toContain('secret');
    expect(a.length).toBeLessThanOrEqual(12);
  });
  it('nextPacificMidnight is 07:00 UTC in September (PDT)', () => {
    const t = Date.UTC(2026, 8, 15, 10, 0);
    expect(nextPacificMidnight(t)).toBe(Date.UTC(2026, 8, 16, 7, 0));
  });
  it('localDayKey formats the local date', () => {
    expect(localDayKey(new Date(2026, 8, 15, 12).getTime())).toBe('2026-09-15');
  });
  it('handles the spring-forward day (23-hour day)', () => {
    expect(nextPacificMidnight(Date.UTC(2026, 2, 8, 9, 0))).toBe(Date.UTC(2026, 2, 9, 7, 0));   // 01:00 PST Mar 8 → 00:00 PDT Mar 9
  });
  it('handles the fall-back day (25-hour day)', () => {
    expect(nextPacificMidnight(Date.UTC(2026, 10, 1, 8, 30))).toBe(Date.UTC(2026, 10, 2, 8, 0)); // 01:30 PDT Nov 1 → 00:00 PST Nov 2
  });
  it('deadUntilLabel renders the Pacific-midnight instant in IST', () => {
    const h = createHealth(memStore(), () => Date.UTC(2026, 8, 15, 10, 0)); // Sep: PDT → next midnight = Sep 16 07:00Z = 12:30 pm IST
    expect(h.deadUntilLabel()).toBe('12:30 pm IST');
  });
});
