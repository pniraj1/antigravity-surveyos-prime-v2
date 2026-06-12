import { describe, it, expect } from 'vitest';
import { applySkewMargin, DEFAULT_SKEW_MARGIN_MS } from '@/lib/firebase/sync-cursor';

describe('applySkewMargin', () => {
  it('returns null for a null cursor (full pull on first login)', () => {
    expect(applySkewMargin(null)).toBeNull();
  });

  it('rolls a valid ISO timestamp back by the default margin', () => {
    const since = '2026-06-12T10:00:00.000Z';
    const expected = new Date(Date.parse(since) - DEFAULT_SKEW_MARGIN_MS).toISOString();
    expect(applySkewMargin(since)).toBe(expected);
  });

  it('honours a custom margin', () => {
    const since = '2026-06-12T10:00:00.000Z';
    expect(applySkewMargin(since, 60_000)).toBe('2026-06-12T09:59:00.000Z');
  });

  it('returns null for an invalid timestamp (safe fallback to full pull)', () => {
    expect(applySkewMargin('not-a-date')).toBeNull();
  });
});
