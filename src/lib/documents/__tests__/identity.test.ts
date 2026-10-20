import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types/claim';
import { identityCheck } from '../kit/identity';

function claim(over: {
  reg?: string; chassis?: string; driver?: string; policyNo?: string; claimNo?: string; insured?: string;
} = {}): ClaimData {
  const c = createBlankClaim();
  return {
    ...c,
    vehicle: { ...c.vehicle, registrationNumber: over.reg ?? '', chassisNumber: over.chassis ?? '' },
    driver: { ...c.driver, name: over.driver ?? '' },
    policy: {
      ...c.policy,
      policyNumber: over.policyNo ?? '', claimNumber: over.claimNo ?? '', insuredName: over.insured ?? '',
    },
  };
}

describe('identityCheck', () => {
  it('identity: registration formats match', () => {
    const c = claim({ reg: 'MH-18-AB-1234' });
    expect(identityCheck('rc', 'Regn No MH 18 AB 1234', c).status).toBe('match');
    expect(identityCheck('rc', 'regn no mh-18-ab-1234', c).status).toBe('match');
    expect(identityCheck('rc', 'Regn No mh18ab1234', c).status).toBe('match');
    expect(identityCheck('policy', 'Vehicle MH18AB1234', c).status).toBe('match');
  });

  it("identity: other claim's RC is mismatch with found value", () => {
    expect(identityCheck('rc', 'Regn No MH 12 XY 9999', claim({ reg: 'MH-18-AB-1234' }))).toEqual({
      status: 'mismatch', found: 'MH12XY9999', expected: 'MH18AB1234',
    });
  });

  it('identity: empty claim field is cantCheck', () => {
    expect(identityCheck('rc', 'MH 12 XY 9999', claim()).status).toBe('cantCheck');
    // a partly empty pair checks only the present one
    expect(identityCheck('rc', 'MH 18 AB 1234', claim({ reg: 'MH18AB1234' })).status).toBe('match');
    expect(identityCheck('aadhaar', 'RAJESH KUMAR', claim()).status).toBe('cantCheck');
    expect(identityCheck('claimForm', 'anything', claim()).status).toBe('cantCheck');
  });

  it('identity: scanned page is cantCheck', () => {
    const c = claim({ reg: 'MH18AB1234' });
    expect(identityCheck('rc', null, c).status).toBe('cantCheck');
    expect(identityCheck('rc', '', c).status).toBe('cantCheck');
    expect(identityCheck('rc', '   \n ', c).status).toBe('cantCheck');
  });

  it('identity: aadhaar matches insured name and never returns found', () => {
    const c = claim({ insured: 'Rajesh Kumar Sharma', driver: 'Suresh Patil' });
    expect(identityCheck('aadhaar', 'Name: RAJESH KUMAR SHARMA  1234 5678 9012', c)).toEqual({ status: 'match' });
    expect(identityCheck('aadhaar', 'SURESH PATIL 1234 5678 9012', c).status).toBe('match');
    const bad = identityCheck('aadhaar', 'AMIT VERMA 1234 5678 9012', c);
    expect(bad).toEqual({ status: 'mismatch' });
    expect(identityCheck('pan', 'AMIT VERMA ABCDE1234F', c)).toEqual({ status: 'mismatch' });
  });

  it('identity: rc needs registration and chassis tail', () => {
    const c = claim({ reg: 'MH18AB1234', chassis: 'MA3EWB22S00123456' });
    expect(identityCheck('rc', 'MH 18 AB 1234 Chassis MA3EWB22S00123456', c).status).toBe('match');
    expect(identityCheck('rcBack', 'MH18AB1234 ch no ...123456', c).status).toBe('match');
    expect(identityCheck('rc', 'MH 18 AB 1234 Chassis MA3EWB22S00999999', c).status).toBe('mismatch');
    expect(identityCheck('rc', 'MH 12 XY 9999 Chassis MA3EWB22S00123456', c).status).toBe('mismatch');
  });

  it('identity: policy needs registration and policy number', () => {
    const c = claim({ reg: 'MH18AB1234', policyNo: 'P/123/456' });
    expect(identityCheck('policy', 'MH18AB1234 Policy No P/123/456', c).status).toBe('match');
    expect(identityCheck('policy', 'MH18AB1234 Policy No P/999/000', c).status).toBe('mismatch');
  });

  it('identity: claim form accepts claim number or registration', () => {
    const c = claim({ reg: 'MH18AB1234', claimNo: 'CL-2026-77' });
    expect(identityCheck('claimForm', 'Claim No CL/2026/77', c).status).toBe('match');
    expect(identityCheck('claimForm', 'Vehicle MH 18 AB 1234', c).status).toBe('match');
    expect(identityCheck('claimForm', 'nothing here', c).status).toBe('mismatch');
  });

  it('identity: dl checks every driver-name word and never returns found', () => {
    const c = claim({ driver: 'Suresh R Patil' });
    expect(identityCheck('dl', 'Name SURESH PATIL', c)).toEqual({ status: 'match' });
    expect(identityCheck('dlBack', 'Name SURESH KUMAR', c)).toEqual({ status: 'mismatch' });
  });

  it('identity: other types are cantCheck', () => {
    expect(identityCheck('estimate', 'MH12XY9999', claim({ reg: 'MH18AB1234' })).status).toBe('cantCheck');
  });
});
