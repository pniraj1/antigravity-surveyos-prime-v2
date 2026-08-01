import { describe, expect, test } from 'vitest';
import { getCompulsoryExcess } from '../assessment';

describe('getCompulsoryExcess', () => {
  test('prefers compulsoryExcess — the field the PDF builders already trusted', () => {
    expect(getCompulsoryExcess({ compulsoryExcess: 1000, lessExcess: 0 })).toBe(1000);
  });

  test('falls back to legacy lessExcess when compulsoryExcess was never written', () => {
    expect(getCompulsoryExcess({ lessExcess: 750 })).toBe(750);
  });

  test('keeps an explicit zero instead of falling through to the legacy field', () => {
    // `??` not `||`: "no excess on this policy" must not silently become 750.
    expect(getCompulsoryExcess({ compulsoryExcess: 0, lessExcess: 750 })).toBe(0);
  });

  test('never invents an excess when the claim has none', () => {
    // Guards the old `fb?.lessExcess ?? 500` in FloatingReportPreview, which
    // deducted a phantom 500 no other screen or report deducted.
    expect(getCompulsoryExcess({})).toBe(0);
    expect(getCompulsoryExcess(undefined)).toBe(0);
    expect(getCompulsoryExcess(null)).toBe(0);
  });
});
