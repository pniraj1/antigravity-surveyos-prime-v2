import { describe, test, expect } from 'vitest';
import { evaluateFormula, isFormulaCandidate } from '../formula-eval';

describe('evaluateFormula', () => {
  test('evaluates simple addition with leading =', () => {
    expect(evaluateFormula('=150+200')).toBe(350);
  });

  test('evaluates simple addition without =', () => {
    expect(evaluateFormula('150+200')).toBe(350);
  });

  test('evaluates subtraction', () => {
    expect(evaluateFormula('=500-120')).toBe(380);
    expect(evaluateFormula('500-120')).toBe(380);
  });

  test('evaluates multiplication and division with precedence', () => {
    expect(evaluateFormula('=100+50*2')).toBe(200);
    expect(evaluateFormula('=100/2+10')).toBe(60);
  });

  test('handles parentheses correctly', () => {
    expect(evaluateFormula('=(100+50)*2')).toBe(300);
    expect(evaluateFormula('((150+200)*2)/2')).toBe(350);
    expect(evaluateFormula('=(100+50)*1.18')).toBe(177);
  });

  test('handles decimals and rounding to 2 places', () => {
    expect(evaluateFormula('=150.55+200.25')).toBe(350.8);
    expect(evaluateFormula('100/3')).toBe(33.33);
    expect(evaluateFormula('100/6')).toBe(16.67);
  });

  test('handles unary minus and plus', () => {
    expect(evaluateFormula('=-50+100')).toBe(50);
    expect(evaluateFormula('100 + -50')).toBe(50);
    expect(evaluateFormula('-(50+50)')).toBe(-100);
  });

  test('handles whitespace gracefully', () => {
    expect(evaluateFormula('  =  150   +   200  ')).toBe(350);
    expect(evaluateFormula('  150 + 200  ')).toBe(350);
  });

  test('returns single number directly', () => {
    expect(evaluateFormula('=350')).toBe(350);
    expect(evaluateFormula('350.50')).toBe(350.5);
  });

  test('rejects division by zero', () => {
    expect(evaluateFormula('=100/0')).toBeNull();
    expect(evaluateFormula('50/(10-10)')).toBeNull();
  });

  test('rejects invalid or incomplete syntax', () => {
    expect(evaluateFormula('')).toBeNull();
    expect(evaluateFormula('=')).toBeNull();
    expect(evaluateFormula('=150+')).toBeNull();
    expect(evaluateFormula('150+*200')).toBeNull();
    expect(evaluateFormula('(150+200')).toBeNull();
    expect(evaluateFormula('150+200)')).toBeNull();
    expect(evaluateFormula('150 200')).toBeNull();
    expect(evaluateFormula('alert(1)')).toBeNull();
    expect(evaluateFormula('=150+abc')).toBeNull();
    expect(evaluateFormula('12.34.56')).toBeNull();
  });

  test('rejects non-string inputs safely', () => {
    expect(evaluateFormula(null as any)).toBeNull();
    expect(evaluateFormula(undefined as any)).toBeNull();
  });
});

describe('isFormulaCandidate', () => {
  test('detects leading =', () => {
    expect(isFormulaCandidate('=150+200')).toBe(true);
    expect(isFormulaCandidate('=350')).toBe(true);
  });

  test('detects math expressions without =', () => {
    expect(isFormulaCandidate('150+200')).toBe(true);
    expect(isFormulaCandidate('100 * 1.18')).toBe(true);
    expect(isFormulaCandidate('500-200')).toBe(true);
    expect(isFormulaCandidate('1000/2')).toBe(true);
  });

  test('returns false for plain numbers or text', () => {
    expect(isFormulaCandidate('350')).toBe(false);
    expect(isFormulaCandidate('1234.56')).toBe(false);
    expect(isFormulaCandidate('Bonnet')).toBe(false);
    expect(isFormulaCandidate('')).toBe(false);
  });
});
