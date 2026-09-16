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

describe('spend ledger — per key, resets at Pacific midnight', () => {
  const T0 = Date.UTC(2026, 8, 15, 10, 0);            // 03:00 Pacific, 15 Sep
  it('counts per key:model and reports remaining against a limit', () => {
    const h = createHealth(memStore(), () => T0);
    h.recordSpend('k1', 'gemini-3.5-flash');
    h.recordSpend('k1', 'gemini-3.5-flash');
    h.recordSpend('k2', 'gemini-3.5-flash');
    expect(h.remaining('k1', 'gemini-3.5-flash', 20)).toBe(18);
    expect(h.remaining('k2', 'gemini-3.5-flash', 20)).toBe(19);
    expect(h.remaining('k1', 'gemini-3.5-flash-lite', 500)).toBe(500);
  });
  it('never goes below zero; Infinity limit stays Infinity', () => {
    const h = createHealth(memStore(), () => T0);
    for (let i = 0; i < 25; i++) h.recordSpend('k1', 'm');
    expect(h.remaining('k1', 'm', 20)).toBe(0);
    expect(h.remaining('k1', 'm', Infinity)).toBe(Infinity);
  });
  it('dead today or rested → 0', () => {
    let now = T0;
    const h = createHealth(memStore(), () => now);
    h.markDeadToday('k1', 'a');
    expect(h.remaining('k1', 'a', 20)).toBe(0);
    h.rest('k1', 'b', 3_600_000);
    expect(h.remaining('k1', 'b', Infinity)).toBe(0);
    now = T0 + 3_600_001;
    expect(h.remaining('k1', 'b', Infinity)).toBe(Infinity);
  });
  it('resets when the Pacific day changes, independently of the local-day busy reset', () => {
    let now = T0;
    const store = memStore();
    const h = createHealth(store, () => now);
    h.recordSpend('k1', 'm');
    h.recordCall('m', 'busy'); h.recordCall('m', 'busy'); h.recordCall('m', 'busy');
    now = Date.UTC(2026, 8, 16, 6, 59);                  // 23:59 Pacific, 15 Sep — same Pacific day
    expect(h.remaining('k1', 'm', 20)).toBe(19);
    now = Date.UTC(2026, 8, 16, 7, 1);                   // 00:01 Pacific, 16 Sep
    expect(h.remaining('k1', 'm', 20)).toBe(20);
  });
  it('a store that throws → full limit (no history)', () => {
    const h = createHealth({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, () => T0);
    h.recordSpend('k1', 'm');
    expect(h.remaining('k1', 'm', 20)).toBe(20);
  });
});
