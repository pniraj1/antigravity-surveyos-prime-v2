import { describe, it, expect } from 'vitest';
import { incrementReportNo } from '../profile-store';

describe('incrementReportNo', () => {
  it('follows a custom format with fiscal year suffix', () => {
    expect(incrementReportNo('spot -257-2026/2027')).toBe('spot -258-2026/2027');
  });

  it('increments the default scheme, preserving zero-padding', () => {
    expect(incrementReportNo('SPO/2026/003')).toBe('SPO/2026/004');
    expect(incrementReportNo('SPO/2026/099')).toBe('SPO/2026/100');
  });

  it('handles a bare trailing number', () => {
    expect(incrementReportNo('Spot/253')).toBe('Spot/254');
  });

  it('skips 4-digit years when picking the sequence', () => {
    expect(incrementReportNo('UIIC/SPOT/2026/MH-1042')).toBe('UIIC/SPOT/2026/MH-1043');
  });

  it('returns null when there is nothing to increment', () => {
    expect(incrementReportNo('REPORT/2026')).toBeNull();
    expect(incrementReportNo('DRAFT')).toBeNull();
  });
});
