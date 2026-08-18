import { describe, expect, test } from 'vitest';
import { billCheckPreambleFromClaim } from '../final-survey-preamble';
import type { ClaimData } from '@/types';

function claim(): ClaimData {
  return {
    policy: { insurerName: 'National Insurance Co. Ltd.', appointingOffice: 'DO-II Pune' },
    billCheck: { billNo: 'SM/INV/2026/1188', billDate: '2026-08-09', billTotal: 61832 },
  } as unknown as ClaimData;
}

describe('billCheckPreambleFromClaim', () => {
  test('names the appointing office, the billed figure and the allowed figure', () => {
    const text = billCheckPreambleFromClaim(claim(), 52936);
    expect(text).toContain('DO-II Pune');
    expect(text).toContain('61,832.00');
    expect(text).toContain('52,936.00');
  });

  test('does not describe an estimate — this document verifies a bill', () => {
    expect(billCheckPreambleFromClaim(claim(), 52936)).not.toContain('estimate');
  });

  test('falls back to the insurer when no appointing office is recorded', () => {
    const c = { policy: { insurerName: 'ACME General' }, billCheck: {} } as unknown as ClaimData;
    expect(billCheckPreambleFromClaim(c, 0)).toContain('ACME General');
  });
});
