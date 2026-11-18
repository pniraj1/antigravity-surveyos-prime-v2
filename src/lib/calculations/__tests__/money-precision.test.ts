import { describe, it, expect } from 'vitest';
import { withGst } from '../utils';
import { fmt } from '@/components/tabs/bill-check/config';

// Bill Check used to show 79,999.59 as ₹80,000 while the report printed 79,999.59,
// and stored the GST-inclusive billed amount as a whole rupee.
describe('money keeps its paise', () => {
  it('Bill Check fmt shows the same two decimals as the report', () => {
    expect(fmt(79999.59)).toBe('₹79,999.59');
    expect(fmt(80000)).toBe('₹80,000.00');
  });

  it('withGst rounds to paise, not to the rupee', () => {
    expect(withGst(1000.5, 18)).toBe(1180.59);
    expect(withGst(100, 28)).toBe(128);
  });

  it('withGst gives no float noise', () => {
    expect(withGst(0.1 + 0.2, 0)).toBe(0.3);
  });
});
