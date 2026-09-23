import { describe, it, expect } from 'vitest';
import { insurerShortForm } from '../insurers';

describe('insurerShortForm', () => {
  it('maps the four public insurers however the policy spells them', () => {
    expect(insurerShortForm('THE NEW INDIA ASSURANCE COMPANY LIMITED')).toBe('NIA');
    expect(insurerShortForm('New India Assurance Co. Ltd.')).toBe('NIA');
    expect(insurerShortForm('National Insurance Company Limited')).toBe('NIC');
    expect(insurerShortForm('United India Insurance Co. Ltd.')).toBe('UIIC');
    expect(insurerShortForm('The Oriental Insurance Company Ltd')).toBe('OIC');
  });
  it('maps the common private insurers', () => {
    expect(insurerShortForm('ICICI Lombard General Insurance Co. Ltd.')).toBe('ICICI');
    expect(insurerShortForm('Bajaj Allianz General Insurance')).toBe('BAJAJ');
    expect(insurerShortForm('HDFC ERGO General Insurance Co Ltd')).toBe('HDFC');
    expect(insurerShortForm('TATA AIG General Insurance')).toBe('TATA');
    expect(insurerShortForm('Go Digit General Insurance Ltd')).toBe('DIGIT');
    expect(insurerShortForm('Cholamandalam MS General Insurance')).toBe('CHOLA');
    expect(insurerShortForm('Shriram General Insurance Co. Ltd.')).toBe('SHRIRAM');
  });
  it('falls back to the first meaningful word for an unknown insurer', () => {
    expect(insurerShortForm('Sunrise General Insurance Co. Ltd.')).toBe('SUNRISE');
    expect(insurerShortForm('The Ajanta Assurance Company Limited')).toBe('AJANTA');
  });
  it('returns empty for nothing usable', () => {
    expect(insurerShortForm(undefined)).toBe('');
    expect(insurerShortForm('   ')).toBe('');
    expect(insurerShortForm('Insurance Co. Ltd.')).toBe('');
  });
});
