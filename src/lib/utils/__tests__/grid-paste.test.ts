import { describe, test, expect } from 'vitest';
import { parseClipboardValue, buildPasteUpdates } from '../grid-paste';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: 'r1', particulars: 'Bonnet', section: 'parts',
    estimated: 8000, assessed: 5600, gst: 18,
    allowed: true, action: 'replace', isDisposal: false,
    partType: 'metal', partNumber: '', hsnSac: '',
    ...overrides,
  } as AssessmentRow;
}

describe('parseClipboardValue', () => {
  test('parses number for gst column', () => {
    expect(parseClipboardValue('18', 'gst')).toBe(18);
  });
  test('parses float for assessed column', () => {
    expect(parseClipboardValue('1234.5', 'assessed')).toBe(1234.5);
  });
  test('returns null for NaN number column', () => {
    expect(parseClipboardValue('abc', 'gst')).toBeNull();
  });
  test('trims and returns string for particulars', () => {
    expect(parseClipboardValue('  Bonnet  ', 'particulars')).toBe('Bonnet');
  });
  test('returns null for empty string column', () => {
    expect(parseClipboardValue('   ', 'particulars')).toBeNull();
  });
  test('accepts valid action enum', () => {
    expect(parseClipboardValue('repair', 'action')).toBe('repair');
    expect(parseClipboardValue('disallow', 'action')).toBe('disallow');
    expect(parseClipboardValue('', 'action')).toBe('');
  });
  test('rejects invalid action enum', () => {
    expect(parseClipboardValue('destroy', 'action')).toBeNull();
  });
  test('accepts valid partType enum', () => {
    expect(parseClipboardValue('plastic', 'partType')).toBe('plastic');
    expect(parseClipboardValue('labour', 'partType')).toBe('labour');
  });
  test('rejects invalid partType enum', () => {
    expect(parseClipboardValue('wood', 'partType')).toBeNull();
  });
  test('parses boolean true variants', () => {
    expect(parseClipboardValue('true', 'isDisposal')).toBe(true);
    expect(parseClipboardValue('1', 'isDisposal')).toBe(true);
    expect(parseClipboardValue('yes', 'isDisposal')).toBe(true);
    expect(parseClipboardValue('TRUE', 'isDisposal')).toBe(true);
  });
  test('parses boolean false variants', () => {
    expect(parseClipboardValue('false', 'isDisposal')).toBe(false);
    expect(parseClipboardValue('0', 'isDisposal')).toBe(false);
    expect(parseClipboardValue('no', 'isDisposal')).toBe(false);
  });
  test('returns null for unrecognised boolean input', () => {
    expect(parseClipboardValue('maybe', 'isDisposal')).toBeNull();
  });
});

describe('buildPasteUpdates', () => {
  const rows = [
    row({ id: 'r1', gst: 5 }),
    row({ id: 'r2', gst: 5 }),
    row({ id: 'r3', gst: 5, isDisposal: true }),
    row({ id: 'r4', gst: 5 }),
  ];

  test('applies value to all rows in range', () => {
    const updates = buildPasteUpdates(rows, 'r1', 'r4', 'particulars', 'Test');
    expect(Object.keys(updates)).toHaveLength(4);
    expect(updates['r1']).toEqual({ particulars: 'Test' });
    expect(updates['r4']).toEqual({ particulars: 'Test' });
  });

  test('works when anchor is below focus (reverse selection)', () => {
    const updates = buildPasteUpdates(rows, 'r4', 'r1', 'particulars', 'Test');
    expect(Object.keys(updates)).toHaveLength(4);
  });

  test('skips disposal rows for gst column', () => {
    const updates = buildPasteUpdates(rows, 'r1', 'r4', 'gst', 28);
    expect(updates['r3']).toBeUndefined();
    expect(Object.keys(updates)).toHaveLength(3);
  });

  test('skips non-parts rows for depOverride', () => {
    const mixed = [
      row({ id: 'r1', section: 'parts', allowed: true }),
      row({ id: 'r2', section: 'labour' as any, allowed: true }),
      row({ id: 'r3', section: 'parts', allowed: false }),
    ];
    const updates = buildPasteUpdates(mixed, 'r1', 'r3', 'depOverride', 10);
    expect(updates['r1']).toEqual({ depOverride: 10 });
    expect(updates['r2']).toBeUndefined();
    expect(updates['r3']).toBeUndefined();
  });

  test('returns empty object for null parsedValue', () => {
    const updates = buildPasteUpdates(rows, 'r1', 'r2', 'gst', null);
    expect(updates).toEqual({});
  });

  test('returns empty object if anchor row not found', () => {
    const updates = buildPasteUpdates(rows, 'missing', 'r2', 'gst', 18);
    expect(updates).toEqual({});
  });

  test('single-row selection (anchor === focus) applies to one row', () => {
    const updates = buildPasteUpdates(rows, 'r2', 'r2', 'gst', 28);
    expect(Object.keys(updates)).toHaveLength(1);
    expect(updates['r2']).toEqual({ gst: 28 });
  });
});
