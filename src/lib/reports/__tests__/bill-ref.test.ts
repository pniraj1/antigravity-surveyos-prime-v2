import { describe, it, expect } from 'vitest';
import { printableRef } from '../bill-ref';

describe('printableRef', () => {
  it('prints a clean ref', () => expect(printableRef({ refSrNo: 68, refStatus: 'clean' })).toBe(68));
  it('prints a manual ref', () => expect(printableRef({ refSrNo: '61, 65', refStatus: 'manual' })).toBe('61, 65'));
  it('legacy ref without status prints', () => expect(printableRef({ refSrNo: 12 })).toBe(12));
  it('hides a doubtful ref', () => expect(printableRef({ refSrNo: 146, refStatus: 'ambiguous' })).toBeUndefined());
});
