import { describe, it, expect } from 'vitest';
import { validatePacket, KNOWN_FLOWS } from '../src/lib/packet-validate.js';

const good = () => ({
  v: 1, portal: 'nia', flow: 'nontieup', claimNo: '3101/1', builtAt: '2026-09-21T10:00:00Z',
  fields: { surveyPlace: 'Pune', netSalvage: 300 },
  files: [{ slot: 'assessmentExcel', name: 'a.xlsx', mime: 'application/x', base64: 'UEsDBA==' }],
});

describe('validatePacket', () => {
  it('accepts a well-formed packet', () => {
    expect(validatePacket(good()).ok).toBe(true);
  });
  it('rejects wrong version, portal, flow', () => {
    expect(validatePacket({ ...good(), v: 2 }).ok).toBe(false);
    expect(validatePacket({ ...good(), portal: 'uiic' }).ok).toBe(false);
    expect(validatePacket({ ...good(), flow: 'maruti' }).ok).toBe(false);
  });
  it('rejects blank claim number and non-scalar field values', () => {
    expect(validatePacket({ ...good(), claimNo: ' ' }).ok).toBe(false);
    expect(validatePacket({ ...good(), fields: { a: { b: 1 } } }).ok).toBe(false);
  });
  it('rejects unknown file slot, bad base64, and files over 1 MB', () => {
    expect(validatePacket({ ...good(), files: [{ ...good().files[0], slot: 'rc' }] }).ok).toBe(false);
    expect(validatePacket({ ...good(), files: [{ ...good().files[0], base64: '***' }] }).ok).toBe(false);
    const big = 'A'.repeat(1_400_000);
    expect(validatePacket({ ...good(), files: [{ ...good().files[0], base64: big }] }).ok).toBe(false);
  });
  it('rejects non-objects', () => {
    expect(validatePacket(null).ok).toBe(false);
    expect(validatePacket('x').ok).toBe(false);
  });
});

describe('KNOWN_FLOWS', () => {
  it('drives which portal flows are accepted', () => {
    expect(KNOWN_FLOWS).toEqual({ nia: ['nontieup'], uiic: ['claimsurvey'] });
    expect(validatePacket({ ...good(), portal: 'uiic', flow: 'claimsurvey' }).ok).toBe(true);
  });
});
