import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormulaNumericInput } from '../FormulaNumericInput';
import { evaluateFormula, isFormulaCandidate } from '@/lib/utils/formula-eval';

describe('FormulaNumericInput rendering', () => {
  it('renders input with numeric value as string', () => {
    const html = renderToStaticMarkup(
      <FormulaNumericInput
        value={350}
        onChange={() => {}}
        className="test-input"
        placeholder="0.00"
      />
    );
    expect(html).toContain('value="350"');
    expect(html).toContain('inputMode="decimal"');
  });

  it('renders input with numeric mode when integerOnly is true', () => {
    const html = renderToStaticMarkup(
      <FormulaNumericInput
        value={18}
        integerOnly
        onChange={() => {}}
        placeholder="18"
      />
    );
    expect(html).toContain('value="18"');
    expect(html).toContain('inputMode="numeric"');
  });

  it('renders empty string when value is null or undefined', () => {
    const html = renderToStaticMarkup(
      <FormulaNumericInput
        value={undefined}
        onChange={() => {}}
        placeholder="0.00"
      />
    );
    expect(html).toContain('value=""');
  });
});

describe('Formula evaluation logic in FormulaNumericInput', () => {
  it('detects and evaluates inline formulas', () => {
    expect(isFormulaCandidate('=150+200')).toBe(true);
    expect(evaluateFormula('=150+200')).toBe(350);

    expect(isFormulaCandidate('150+200')).toBe(true);
    expect(evaluateFormula('150+200')).toBe(350);

    expect(isFormulaCandidate('1000*0.18')).toBe(true);
    expect(evaluateFormula('1000*0.18')).toBe(180);

    expect(isFormulaCandidate('(100+50)*1.18')).toBe(true);
    expect(evaluateFormula('(100+50)*1.18')).toBe(177);
  });

  it('handles percentage suffix cleaning', () => {
    const raw = '18%';
    const clean = raw.endsWith('%') ? raw.slice(0, -1).trim() : raw;
    expect(parseInt(clean, 10)).toBe(18);
  });
});
