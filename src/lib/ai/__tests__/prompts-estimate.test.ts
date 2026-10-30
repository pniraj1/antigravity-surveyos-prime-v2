import { describe, it, expect } from 'vitest';
import { getDocPrompt } from '../prompts';

describe('Estimate and Final Bill Prompt Structure', () => {
  it('estimate prompt includes all essential extraction rules', () => {
    const prompt = getDocPrompt('estimate');
    expect(prompt).toContain('Extract EVERY SINGLE line item from ALL pages');
    expect(prompt).toContain('spare_parts');
    expect(prompt).toContain('labour_items');
    expect(prompt).toContain('painting_items');
  });

  it('estimate prompt includes essential line item fields', () => {
    const prompt = getDocPrompt('estimate');
    expect(prompt).toContain('part_number');
    expect(prompt).toContain('hsn_sac');
    expect(prompt).toContain('taxable_amount');
    expect(prompt).toContain('gst_percent');
    expect(prompt).toContain('total_amount');
    expect(prompt).toContain('category');
  });

  it('final-bill prompt includes essential extraction fields', () => {
    const prompt = getDocPrompt('final-bill');
    expect(prompt).toContain('Extract EVERY SINGLE line item from ALL pages');
    expect(prompt).toContain('spare_parts');
    expect(prompt).toContain('labour_items');
    expect(prompt).toContain('painting_items');
    expect(prompt).toContain('part_number');
    expect(prompt).toContain('hsn_sac');
  });
});
