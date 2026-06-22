import { describe, it, expect } from 'vitest';
import { stageVariant } from '../stage-variant';

describe('stageVariant', () => {
  it('maps known stages to their key', () => {
    expect(stageVariant('spot')).toBe('spot');
    expect(stageVariant('final')).toBe('final');
    expect(stageVariant('reinspection')).toBe('reinspection');
    expect(stageVariant('valuation')).toBe('valuation');
  });

  it('falls back to default for unknown stages', () => {
    expect(stageVariant('something-else')).toBe('default');
    expect(stageVariant('')).toBe('default');
  });
});
