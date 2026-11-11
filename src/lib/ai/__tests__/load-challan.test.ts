import { describe, it, expect } from 'vitest';
import { getDocPrompt } from '../prompts';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types/claim';
import { applyLoadChallan } from '@/stores/slices/aiDataSlice';

// The Documents tab card id is 'load-challan'. It once had a prompt and a save
// step filed under 'lok-challan', so every challan read with a generic prompt
// and Apply saved nothing.
describe('load challan / E-way bill', () => {
  it('the card key gets the challan prompt, not the generic fallback', () => {
    const p = getDocPrompt('load-challan');
    expect(p).toMatch(/e-way bill/i);
    expect(p).toMatch(/challan/i);
  });

  it('Apply on the card key fills the claim', () => {
    useClaimStore.setState({ currentClaim: createBlankClaim() });
    useClaimStore.getState().applyExtractedData('load-challan', {
      document_kind: 'E-way Bill',
      document_no: '331234567890',
      document_date: '2026-11-02',
      valid_until: '2026-11-04',
      origin: 'Nashik',
      destination: 'Pune',
      goods_description: 'Cement OPC 53 grade, 400 bags',
      goods_value: '185000',
      hazardous: '',
      weight: '20',
      weight_unit: 'MT',
    });
    const c = useClaimStore.getState().currentClaim!;
    expect(c.spotDetails.challanNo).toBe('331234567890');
    expect(c.spotDetails.challanDate).toBe('2026-11-02');
    expect(c.spotDetails.loadOrigin).toBe('Nashik');
    expect(c.spotDetails.loadDest).toBe('Pune');
    expect(c.spotDetails.actualLoad).toBe(20000);
    expect(c.vehicle.natureOfGoods).toBe('Cement OPC 53 grade, 400 bags');
    expect(c.spotDetails.loadDesc).toBe('Cement OPC 53 grade, 400 bags; value Rs. 185000');
    expect(c.documentVerification.loadChallan).toEqual({
      status: 'YES',
      detail: 'E-way Bill No. 331234567890 dt 2026-11-02, valid until 2026-11-04',
    });
  });

  it('leaves out a "not hazardous" answer', () => {
    const out = applyLoadChallan(createBlankClaim(), { goods_description: 'Rice, 200 bags', hazardous: 'No' });
    expect(out.spotDetails.loadDesc).toBe('Rice, 200 bags');
  });

  it('converts printed weight units to kg', () => {
    const kg = (weight: string, weight_unit: string) =>
      applyLoadChallan(createBlankClaim(), { weight, weight_unit }).spotDetails.actualLoad;
    expect(kg('9.5', 'MT')).toBe(9500);
    expect(kg('9.5', 'tonnes')).toBe(9500);
    expect(kg('45', 'quintal')).toBe(4500);
    expect(kg('2500', 'kg')).toBe(2500);
    expect(kg('2500', '')).toBe(2500);
  });

  it('keeps what the surveyor already has when the document leaves a field out', () => {
    const claim = createBlankClaim();
    claim.spotDetails.loadOrigin = 'Surat';
    claim.documentVerification.loadChallan = { status: 'YES', detail: 'typed by surveyor' };
    const out = applyLoadChallan(claim, { document_no: 'LC-77', origin: '' });
    expect(out.spotDetails.loadOrigin).toBe('Surat');
    expect(out.documentVerification.loadChallan.detail).toBe('typed by surveyor');
  });
});
