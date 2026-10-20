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

// Pages shorter than 40 normalised characters count as having no usable text layer, so pad real-looking text.
const PAD = '  Government of India Transport Department Maharashtra State  ';
const page = (s: string): string => s + PAD;

describe('identityCheck', () => {
  it('identity: registration formats match', () => {
    const c = claim({ reg: 'MH-18-AB-1234' });
    expect(identityCheck('rc', page('Regn No MH 18 AB 1234'), c).status).toBe('match');
    expect(identityCheck('rc', page('regn no mh-18-ab-1234'), c).status).toBe('match');
    expect(identityCheck('rc', page('Regn No mh18ab1234'), c).status).toBe('match');
    expect(identityCheck('policy', page('Vehicle MH18AB1234'), c).status).toBe('match');
  });

  it("identity: other claim's RC is mismatch with found value", () => {
    expect(identityCheck('rc', page('Regn No MH 12 XY 9999'), claim({ reg: 'MH-18-AB-1234' }))).toEqual({
      status: 'mismatch', found: 'MH12XY9999', expected: 'MH18AB1234',
    });
  });

  it('identity: empty claim field is cantCheck', () => {
    expect(identityCheck('rc', page('MH 12 XY 9999'), claim()).status).toBe('cantCheck');
    // a partly empty pair checks only the present one
    expect(identityCheck('rc', page('MH 18 AB 1234'), claim({ reg: 'MH18AB1234' })).status).toBe('match');
    expect(identityCheck('aadhaar', page('RAJESH KUMAR'), claim()).status).toBe('cantCheck');
    expect(identityCheck('claimForm', page('anything'), claim()).status).toBe('cantCheck');
  });

  it('identity: scanned page is cantCheck', () => {
    const c = claim({ reg: 'MH18AB1234' });
    expect(identityCheck('rc', null, c).status).toBe('cantCheck');
    expect(identityCheck('rc', '', c).status).toBe('cantCheck');
    expect(identityCheck('rc', '   \n ', c).status).toBe('cantCheck');
  });

  it('identity: near-empty text layer is cantCheck', () => {
    const c = claim({ reg: 'MH18AB1234', driver: 'Suresh Patil' });
    expect(identityCheck('rc', 'Page 1 of 3', c).status).toBe('cantCheck');
    expect(identityCheck('dl', 'SURESH PATIL', c).status).toBe('cantCheck');
  });

  it('identity: aadhaar matches insured name and never returns found', () => {
    const c = claim({ insured: 'Rajesh Kumar Sharma', driver: 'Suresh Patil' });
    expect(identityCheck('aadhaar', page('Name: RAJESH KUMAR SHARMA  1234 5678 9012'), c)).toEqual({ status: 'match' });
    expect(identityCheck('aadhaar', page('SURESH PATIL 1234 5678 9012'), c).status).toBe('match');
    expect(identityCheck('aadhaar', page('AMIT VERMA 1234 5678 9012'), c)).toEqual({ status: 'mismatch' });
    expect(identityCheck('pan', page('AMIT VERMA ABCDE1234F'), c)).toEqual({ status: 'mismatch' });
  });

  it('identity: rc needs registration and chassis tail', () => {
    const c = claim({ reg: 'MH18AB1234', chassis: 'MA3EWB22S00123456' });
    expect(identityCheck('rc', page('MH 18 AB 1234 Chassis MA3EWB22S00123456'), c).status).toBe('match');
    expect(identityCheck('rcBack', page('MH18AB1234 ch no ...123456'), c).status).toBe('match');
    expect(identityCheck('rc', page('MH 18 AB 1234 Chassis MA3EWB22S00999999'), c).status).toBe('mismatch');
    expect(identityCheck('rc', page('MH 12 XY 9999 Chassis MA3EWB22S00123456'), c).status).toBe('mismatch');
  });

  it('identity: policy needs registration and policy number', () => {
    const c = claim({ reg: 'MH18AB1234', policyNo: 'P/123/456' });
    expect(identityCheck('policy', page('MH18AB1234 Policy No P/123/456'), c).status).toBe('match');
    expect(identityCheck('policy', page('MH18AB1234 Policy No P/999/000'), c).status).toBe('mismatch');
  });

  it('identity: claim form accepts claim number or registration', () => {
    const c = claim({ reg: 'MH18AB1234', claimNo: 'CL-2026-77' });
    expect(identityCheck('claimForm', page('Claim No CL/2026/77'), c).status).toBe('match');
    expect(identityCheck('claimForm', page('Vehicle MH 18 AB 1234'), c).status).toBe('match');
    expect(identityCheck('claimForm', page('nothing here'), c).status).toBe('mismatch');
  });

  it('identity: dl checks every driver-name token and never returns found', () => {
    const c = claim({ driver: 'Suresh R Patil' });
    expect(identityCheck('dl', page('Name SURESH PATIL'), c)).toEqual({ status: 'match' });
    expect(identityCheck('dlBack', page('Name SURESH KUMAR'), c)).toEqual({ status: 'mismatch' });
  });

  it('identity: other types are cantCheck', () => {
    expect(identityCheck('estimate', page('MH12XY9999'), claim({ reg: 'MH18AB1234' })).status).toBe('cantCheck');
  });

  describe('names are whole tokens', () => {
    it.each([
      ['Suresh R. Patil', 'SURESH RAMESH PATIL', 'match'],
      ['Patil, Suresh', 'SURESH PATIL', 'match'],
      ['ABC Logistics Pvt. Ltd.', 'ABC LOGISTICS PRIVATE LIMITED', 'match'],
      ['Raj Patil', 'RAJESH PATIL', 'mismatch'],
    ])('%s vs %s -> %s', (name, text, status) => {
      expect(identityCheck('dl', page(text), claim({ driver: name }))).toEqual({ status });
      expect(identityCheck('pan', page(text), claim({ insured: name }))).toEqual({ status });
    });

    it('a name that is only initials and titles is cantCheck', () => {
      expect(identityCheck('dl', page('SURESH PATIL'), claim({ driver: 'Mr. S' })).status).toBe('cantCheck');
    });
  });

  describe('short fields count as absent', () => {
    it('claim number 77 on a claim form is cantCheck', () => {
      expect(identityCheck('claimForm', page('Claim 77 here'), claim({ claimNo: '77' })).status).toBe('cantCheck');
    });

    it('chassis AB12 is skipped, the registration still decides', () => {
      const c = claim({ reg: 'MH18AB1234', chassis: 'AB12' });
      expect(identityCheck('rc', page('MH 18 AB 1234'), c).status).toBe('match');
      expect(identityCheck('rc', page('MH 18 AB 1234'), claim({ chassis: 'AB12' })).status).toBe('cantCheck');
    });

    it('policy number under 4 characters is skipped', () => {
      const c = claim({ reg: 'MH18AB1234', policyNo: 'P1' });
      expect(identityCheck('policy', page('MH18AB1234'), c).status).toBe('match');
    });

    it('a registration shorter than 6 characters is absent', () => {
      expect(identityCheck('rc', page('MH 18 AB 1234'), claim({ reg: 'MH18' })).status).toBe('cantCheck');
    });
  });

  describe('registration comparison is canonical', () => {
    it('MH-18-A-123 matches MH18A0123', () => {
      expect(identityCheck('rc', page('Regn MH18A0123'), claim({ reg: 'MH-18-A-123' })).status).toBe('match');
    });

    it('a single-digit district matches its padded form', () => {
      expect(identityCheck('rc', page('Regn MH 01 AB 1234'), claim({ reg: 'MH1AB1234' })).status).toBe('match');
    });

    it('found skips digit runs that only look like a registration', () => {
      const text = page('Policy No 1234567890 Regn MH 12 XY 9999');
      expect(identityCheck('rc', text, claim({ reg: 'MH18AB1234' }))).toEqual({
        status: 'mismatch', found: 'MH12XY9999', expected: 'MH18AB1234',
      });
    });

    it('a stray serial number is a mismatch with no found value', () => {
      const r = identityCheck('rc', page('SL NO 4567'), claim({ reg: 'MH18AB1234' }));
      expect(r.status).toBe('mismatch');
      expect(r.found).toBeUndefined();
      expect(r.expected).toBe('MH18AB1234');
    });

    it('a registration outside the usual pattern is compared as plain text', () => {
      expect(identityCheck('rc', page('Regn 22 BH 1234 AA'), claim({ reg: '22BH1234AA' })).status).toBe('match');
    });
  });
});
