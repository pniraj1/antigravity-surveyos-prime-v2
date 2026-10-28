import { describe, it, expect } from 'vitest';
import { getDocPrompt } from '../prompts';

describe('Estimate and Final Bill Prompt Overhaul', () => {
  it('estimate prompt includes footer-first tax posture reconciliation', () => {
    const prompt = getDocPrompt('estimate');
    expect(prompt).toContain('RECONCILE THE SUMMARY FIRST');
    expect(prompt).not.toContain('put it in "total_amount" and set "taxable_amount" to total_amount / (1 + gst_percent/100)');
  });

  it('estimate prompt includes all assessment table fields and categories', () => {
    const prompt = getDocPrompt('estimate');
    expect(prompt).toContain('part_number');
    expect(prompt).toContain('hsn_sac');
    expect(prompt).toContain('quantity');
    expect(prompt).toContain('unit_price');
    expect(prompt).toContain('taxable_amount');
    expect(prompt).toContain('gst_percent');
    expect(prompt).toContain('total_amount');
    expect(prompt).toContain('category');
    expect(prompt).toContain('rubber');
    expect(prompt).toContain('fiberglass');
  });

  it('estimate prompt includes _audit feedback envelope in JSON schema', () => {
    const prompt = getDocPrompt('estimate');
    expect(prompt).toContain('_audit');
    expect(prompt).toContain('tax_posture');
    expect(prompt).toContain('columns_detected');
    expect(prompt).toContain('reconciliation_note');
    expect(prompt).toContain('warnings');
  });

  it('final-bill prompt includes footer deduction and _audit schema', () => {
    const prompt = getDocPrompt('final-bill');
    expect(prompt).toContain('RECONCILE THE SUMMARY FIRST');
    expect(prompt).not.toContain('put it in "total_amount" and set "taxable_amount" to total_amount / (1 + gst_percent/100)');
    expect(prompt).toContain('_audit');
    expect(prompt).toContain('part_number');
    expect(prompt).toContain('hsn_sac');
    expect(prompt).toContain('rubber');
    expect(prompt).toContain('fiberglass');
  });
});
