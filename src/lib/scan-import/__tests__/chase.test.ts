import { describe, it, expect } from 'vitest';
import { createBlankClaim, type ClaimData } from '@/types';
import type { ScanChase } from '../manifest';
import { planChase } from '../chase';

const claim = (patch: (c: ClaimData) => ClaimData = (c) => c) => patch(createBlankClaim('spot'));
const chase: ScanChase = {
  contacts: {
    insured: { name: 'Ravi', phone: '9800000001' },
    garage: { name: 'Raj Motors', phone: '9800000002', email: 'g@x.in' },
  },
  slotStates: { rc: 'received' },
};
const ask = (at: string, docs: string[]) => ({ at, to: 'insured' as const, via: 'whatsapp' as const, lang: 'en' as const, docs });

describe('planChase', () => {
  it('fillsOnlyBlanks', () => {
    const plan = planChase(claim((c) => ({ ...c, policy: { ...c.policy, insuredName: 'Existing' } })), chase, 'id1');
    expect(plan.fills).toEqual([
      { path: 'policy.insuredMobile', value: '9800000001' },
      { path: 'accident.workshopName', value: 'Raj Motors' },
      { path: 'accident.workshopPhone', value: '9800000002' },
      { path: 'accident.workshopEmail', value: 'g@x.in' },
    ]);
    expect(plan.scanClaimId).toBe('id1');
    expect(plan.conflict).toBeNull();
  });

  it('keepsPrimeValueButStoresScanValue', () => {
    const plan = planChase(claim((c) => ({ ...c, policy: { ...c.policy, insuredName: 'Existing' } })), chase, undefined);
    expect(plan.fills.some((f) => f.path === 'policy.insuredName')).toBe(false);
    expect(plan.next?.contacts?.insured?.name).toBe('Ravi');
    expect(plan.next?.slotStates).toEqual({ rc: 'received' });
  });

  it('noChaseIsNoop', () => {
    const c = claim();
    const plan = planChase(c, undefined, undefined);
    expect(plan.fills).toEqual([]);
    expect(plan.next).toBe(c.scanChase);
  });

  it('asksUnionDedup', () => {
    const a1 = ask('2026-10-31T18:20:00+05:30', ['rc']);
    const a2 = ask('2026-11-01T09:00:00+05:30', ['dl']);
    const c = claim((x) => ({ ...x, scanChase: { asks: [a2], importedAt: 't' } }));
    const plan = planChase(c, { asks: [a1, a2] }, undefined);
    expect(plan.next?.asks).toEqual([a1, a2]);
  });

  it('differentScanClaimIdIsConflict', () => {
    const c = claim((x) => ({ ...x, scanClaimId: 'old' }));
    const plan = planChase(c, chase, 'new');
    expect(plan.conflict).toMatch(/old/);
    expect(plan.fills).toEqual([]);
    expect(planChase(c, chase, 'old').conflict).toBeNull();
  });

  it('keepsPrimeOriginAsksOnReimport', () => {
    const x = ask('2026-11-01T10:00:00+05:30', ['rc']);
    const y = ask('2026-11-02T10:00:00+05:30', ['dl']);
    const plan = planChase(claim((c) => ({ ...c, scanChase: { importedAt: 'z', asks: [x] } })), { ...chase, asks: [y] }, undefined);
    expect(plan.next?.asks).toEqual([x, y]);
  });
});
