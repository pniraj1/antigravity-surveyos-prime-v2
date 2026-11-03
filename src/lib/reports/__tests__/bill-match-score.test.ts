import { describe, expect, test } from 'vitest';
import { scorePair, sideConflicts, SURE_SCORE, MIN_SCORE } from '../bill-match-score';

const rowOf = (particulars: string, estimated = 0, section = 'parts', partNumber = '') =>
  ({ particulars, estimated, assessed: estimated, section, partNumber }) as const;
const billOf = (description: string, taxableAmount = 0, section = 'parts', partNumber = '') =>
  ({ description, taxableAmount, section, partNumber }) as const;

describe('scorePair', () => {
  test('same words, same amount is sure', () => {
    expect(scorePair(rowOf('FRONT BUMPER', 5000), billOf('BUMPER FRONT ASSY', 5000)).score).toBeGreaterThanOrEqual(SURE_SCORE);
  });

  test('LH against RH is never sure, even at the same price', () => {
    const s = scorePair(rowOf('HEAD LAMP LH', 8450), billOf('HEAD LAMP RH', 8450));
    expect(s.score).toBeLessThan(SURE_SCORE);
    expect(s.reasons.join(' ')).toMatch(/left.*right|right.*left/i);
  });

  test('front against rear is never sure', () => {
    expect(scorePair(rowOf('FRONT BUMPER', 5000), billOf('REAR BUMPER', 5000)).score).toBeLessThan(SURE_SCORE);
  });

  test('a match on amount alone needs checking, not sure', () => {
    const s = scorePair(rowOf('BRACKET', 450), billOf('CLIP', 450));
    expect(s.score).toBeGreaterThanOrEqual(MIN_SCORE);
    expect(s.score).toBeLessThan(SURE_SCORE);
  });

  test('a short name inside a longer one is not a full match', () => {
    expect(scorePair(rowOf('BUMPER'), billOf('FRONT BUMPER BRACKET')).score).toBeLessThan(SURE_SCORE);
  });

  test('part number match is sure', () => {
    expect(scorePair(rowOf('X', 0, 'parts', '56100-0R190'), billOf('Y', 0, 'parts', '561000R190')).score).toBe(100);
  });

  test('unrelated item at a different price is below the bar', () => {
    expect(scorePair(rowOf('FRONT BUMPER', 10000), billOf('RADIATOR ASSY', 6000)).score).toBeLessThan(MIN_SCORE);
  });
});

describe('sideConflicts', () => {
  test('names the clashing words on each side', () => {
    expect(sideConflicts('HEAD LAMP LH', 'HEAD LAMP RH')).toEqual(new Set(['lh', 'rh']));
    expect(sideConflicts('FRONT BUMPER', 'BUMPER FRONT')).toEqual(new Set());
  });
});
