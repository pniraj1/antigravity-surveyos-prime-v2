import { describe, expect, test } from 'vitest';
import { resolveSectionMove } from '../section-move';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1',
    particulars: 'FRONT BUMPER',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

describe('resolveSectionMove', () => {
  test('moving a part into labour stashes its type and switches to labour', () => {
    const r = row({ partType: 'plastic', section: 'parts' });
    expect(resolveSectionMove(r, 'labour')).toEqual({
      section: 'labour',
      partType: 'labour',
      previousPartType: 'plastic',
      depOverride: undefined,
    });
  });

  test('moving a part into paint stashes its type and switches to paint', () => {
    const r = row({ partType: 'fiberglass', section: 'parts' });
    expect(resolveSectionMove(r, 'paint')).toEqual({
      section: 'paint',
      partType: 'paint',
      previousPartType: 'fiberglass',
      depOverride: undefined,
    });
  });

  test('moving back into parts restores the remembered type', () => {
    // The regression this exists to prevent: plastic depreciates at 50%,
    // metal at the age scale. Defaulting to metal re-prices the item.
    const r = row({ partType: 'labour', section: 'labour', previousPartType: 'plastic' });
    expect(resolveSectionMove(r, 'parts')).toEqual({
      section: 'parts',
      partType: 'plastic',
      previousPartType: undefined,
      depOverride: undefined,
    });
  });

  test('moving into parts with nothing remembered falls back to metal', () => {
    const r = row({ partType: 'labour', section: 'labour' });
    expect(resolveSectionMove(r, 'parts')).toEqual({
      section: 'parts',
      partType: 'metal',
      previousPartType: undefined,
      depOverride: undefined,
    });
  });

  test('a manual depreciation override is cleared in every direction', () => {
    // Labour and paint are Nil depreciation under the tariff. A 40% override
    // riding along would quietly cut an 8,000 labour line to 4,800.
    for (const [from, to] of [
      ['parts', 'labour'],
      ['parts', 'paint'],
      ['labour', 'parts'],
      ['paint', 'parts'],
      ['labour', 'paint'],
    ] as const) {
      const r = row({ section: from, partType: from === 'parts' ? 'metal' : from, depOverride: 40 });
      const changes = resolveSectionMove(r, to);
      expect(changes.depOverride).toBeUndefined();
      // The key must be PRESENT and undefined, not absent. Callers spread this
      // over the row, and an absent key leaves the old 40 in place — which
      // toBeUndefined() alone would not catch.
      expect('depOverride' in changes).toBe(true);
    }
  });

  test('labour to paint does not overwrite a remembered part type', () => {
    const r = row({ partType: 'labour', section: 'labour', previousPartType: 'plastic' });
    expect(resolveSectionMove(r, 'paint')).toEqual({
      section: 'paint',
      partType: 'paint',
      previousPartType: 'plastic',
      depOverride: undefined,
    });
  });

  test('moving to the section it already occupies changes nothing', () => {
    const r = row({ partType: 'plastic', section: 'parts' });
    expect(resolveSectionMove(r, 'parts')).toEqual({});
  });
});

describe('depOverride across section moves', () => {
  test('clears a manual override when a part moves into labour', () => {
    // Carrying 50% onto a labour line would re-price it with nothing on screen
    // reporting the change. The surveyor re-enters it after the move.
    const r = row({ partType: 'plastic', section: 'parts', depOverride: 50 });
    expect(resolveSectionMove(r, 'labour')).toMatchObject({
      section: 'labour', partType: 'labour', depOverride: undefined,
    });
  });

  test('clears a manual override set on a labour row moving to paint', () => {
    const r = row({ partType: 'labour', section: 'labour', depOverride: 30 });
    expect(resolveSectionMove(r, 'paint')).toMatchObject({
      section: 'paint', partType: 'paint', depOverride: undefined,
    });
  });
});
