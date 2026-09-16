import { describe, it, expect, beforeEach } from 'vitest';
import { takeFault, _setFaultForTests, takeDrop, _setDropForTests } from '../fault';

describe('takeFault', () => {
  beforeEach(() => _setFaultForTests(null));
  it('returns the canned 503 once, then null', () => {
    _setFaultForTests('503');
    expect(takeFault()).toMatchObject({ status: 503 });
    expect(takeFault()).toBeNull();
  });
  it('429-day carries a PerDay quotaId', () => {
    _setFaultForTests('429-day');
    const e = takeFault()!;
    expect(e.status).toBe(429);
    expect(JSON.stringify(e.details)).toContain('PerDayPerProjectPerModel');
  });
  it('429-zero carries both day and minute violations', () => {
    _setFaultForTests('429-zero');
    const s = JSON.stringify(takeFault()!.details);
    expect(s).toContain('PerDay');
    expect(s).toContain('PerMinute');
  });
  it('unknown value → null', () => {
    _setFaultForTests('banana');
    expect(takeFault()).toBeNull();
  });
});

describe('takeDrop', () => {
  beforeEach(() => _setDropForTests(null));
  it('returns the serial once, then null', () => {
    _setDropForTests('38');
    expect(takeDrop()).toBe(38);
    expect(takeDrop()).toBeNull();
  });
  it('non-numeric → null', () => { _setDropForTests('x'); expect(takeDrop()).toBeNull(); });
});
