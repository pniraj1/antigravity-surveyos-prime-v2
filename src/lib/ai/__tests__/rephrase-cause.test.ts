import { describe, it, expect } from 'vitest';
import { buildCausePrompt, cleanCauseReply } from '../rephrase-cause';

describe('buildCausePrompt', () => {
  it('carries the text, the house style and the no-new-facts rule', () => {
    const p = buildCausePrompt('गाडी पार्क केली होती, कुत्र्याने वायर तोडली');
    expect(p).toContain('गाडी पार्क केली होती');
    expect(p).toContain('As per the claim form');
    expect(p).toContain('Right-Hand (RH / Offside)');
    expect(p).toMatch(/never add/i);
  });
});

describe('cleanCauseReply', () => {
  it('strips quotes, labels and extra whitespace', () => {
    expect(cleanCauseReply('"As per the claim form, x."\n')).toBe('As per the claim form, x.');
    expect(cleanCauseReply('Rephrased: As per the claim form,  x.')).toBe('As per the claim form, x.');
  });
});
