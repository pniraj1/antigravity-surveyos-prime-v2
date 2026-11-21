import { describe, expect, test } from 'vitest';
import { numberToWords } from '../utils';

describe('numberToWords', () => {
  test('a float a hair under a whole rupee reads as that rupee', () => {
    // MH40BG5830: printed 640000.00, read "six lakh thirty nine thousand nine hundred ninety nine".
    expect(numberToWords(639999.9999999999)).toBe('SIX LAKH FORTY THOUSAND');
  });

  test('real paise are still dropped, not rounded up', () => {
    expect(numberToWords(51500.75)).toBe('FIFTY ONE THOUSAND FIVE HUNDRED');
  });
});
