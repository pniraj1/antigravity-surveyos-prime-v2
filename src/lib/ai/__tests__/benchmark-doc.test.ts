import { describe, expect, test } from 'vitest';
import { validateBenchmarkInput } from '../benchmark-doc';

describe('validateBenchmarkInput', () => {
  test('accepts a normal total', () => {
    expect(validateBenchmarkInput(62392.5)).toBeNull();
  });

  test('rejects zero — it would make the delta percentage undefined', () => {
    expect(validateBenchmarkInput(0)).toBe('Expected total must be greater than zero.');
  });

  test('rejects a negative total', () => {
    expect(validateBenchmarkInput(-100)).toBe('Expected total must be greater than zero.');
  });

  test('rejects NaN', () => {
    expect(validateBenchmarkInput(Number.NaN)).toBe('Enter the grand total printed on the document.');
  });

  test('rejects Infinity', () => {
    expect(validateBenchmarkInput(Number.POSITIVE_INFINITY))
      .toBe('Enter the grand total printed on the document.');
  });
});
