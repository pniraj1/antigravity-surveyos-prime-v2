import { describe, it, expect } from 'vitest';
import { computeProfessionalFee, parseIdv } from '../professional-fee';
import { FALLBACK_FEE_SCHEDULE } from '@/lib/config/fee-schedule';

const S = FALLBACK_FEE_SCHEDULE;
const fee = (est: number, idv = 0) => computeProfessionalFee(est, idv, S);

describe('computeProfessionalFee — IISLA 2022 slabs', () => {
  it('flat slabs by boundary', () => {
    expect(fee(0)).toBe(0);         // no estimate → no auto-fill
    expect(fee(20000)).toBe(850);
    expect(fee(20001)).toBe(1500);
    expect(fee(50000)).toBe(1500);
    expect(fee(50001)).toBe(1800);
    expect(fee(100000)).toBe(1800);
    expect(fee(100001)).toBe(2800);
    expect(fee(200000)).toBe(2800);
  });

  it('slab 5: 2800 + 0.70% over 2,00,000, capped 15,000', () => {
    expect(fee(200001)).toBe(2800);                 // +~0
    expect(fee(1200000)).toBe(2800 + Math.round(0.007 * 1000000)); // 9800
    expect(fee(3000000)).toBe(15000);               // 2800+19600=22400 → capped
  });

  it('slab 6: 15000 + 0.70% over 30,00,000, capped 25,000', () => {
    expect(fee(3000001)).toBe(15000);
    expect(fee(4300000)).toBe(15000 + Math.round(0.007 * 1300000)); // 24100
    expect(fee(10000000)).toBe(25000);              // capped
  });

  it('IDV cap: when estimate > IDV, fee is based on IDV', () => {
    expect(fee(1000000, 150000)).toBe(2800);        // basis = 150000 → slab 4
    expect(fee(150000, 1000000)).toBe(2800);        // estimate < idv → basis = estimate
    expect(fee(150000, 0)).toBe(2800);              // idv 0/unknown → ignore cap
  });
});

describe('parseIdv', () => {
  it('strips currency formatting', () => {
    expect(parseIdv('₹5,00,000')).toBe(500000);
    expect(parseIdv('500000')).toBe(500000);
    expect(parseIdv(500000)).toBe(500000);
    expect(parseIdv('')).toBe(0);
    expect(parseIdv(null)).toBe(0);
  });
});
