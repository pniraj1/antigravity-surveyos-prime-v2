import { describe, it, expect } from 'vitest';
import { getDocPrompt } from '../prompts';

describe('Final Bill Prompt (Bill Check)', () => {
  it('reads both bills and repair estimates', () => {
    const prompt = getDocPrompt('final-bill');
    expect(prompt).toContain('REPAIR ESTIMATES');
  });

  it('copies part numbers character for character', () => {
    const prompt = getDocPrompt('final-bill');
    expect(prompt).toContain('character for character');
  });

  it('no longer treats the taxable amount as the primary anchor', () => {
    const prompt = getDocPrompt('final-bill');
    expect(prompt).not.toContain('PRIMARY anchor');
  });

  it('keeps the spare_parts, labour_items and painting_items keys', () => {
    const prompt = getDocPrompt('final-bill');
    expect(prompt).toContain('"spare_parts"');
    expect(prompt).toContain('"labour_items"');
    expect(prompt).toContain('"painting_items"');
  });
});
