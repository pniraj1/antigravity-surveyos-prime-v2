import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types';
import {
  parseSiteNotesExtraction, planSiteNotes, siteNotesUpdates, siteNoteFields, isEmptyPlan,
  type SiteNotesExtraction,
} from '../site-notes';

const ex = (over: Partial<SiteNotesExtraction>): SiteNotesExtraction => ({ fields: [], damageRows: [], unmapped: [], ...over });

describe('parseSiteNotesExtraction', () => {
  it('fills missing arrays and drops malformed entries', () => {
    const out = parseSiteNotesExtraction(JSON.stringify({
      fields: [{ path: 'vehicle.odometer', value: 45320, evidence: 'odometer 45320' }, { nope: 1 }],
    }));
    expect(out).toEqual({
      fields: [{ path: 'vehicle.odometer', value: '45320', evidence: 'odometer 45320' }],
      damageRows: [],
      unmapped: [],
    });
  });

  it('strips markdown code fences', () => {
    const fence = (body: string) => ['```json', body, '```'].join('\n');
    expect(parseSiteNotesExtraction(fence('{"unmapped":["x"]}')).unmapped).toEqual(['x']);
    expect(() => parseSiteNotesExtraction(fence('not json'))).toThrow();
  });

  it('throws on non-JSON', () => {
    expect(() => parseSiteNotesExtraction('not json')).toThrow();
  });
});

describe('planSiteNotes', () => {
  it('fills empty fields and fields still at their blank default', () => {
    const claim = createBlankClaim('spot');
    const plan = planSiteNotes(claim, ex({ fields: [
      { path: 'vehicle.odometer', value: '45320', evidence: 'odometer 45320' },
      { path: 'spotDetails.drivable', value: 'no', evidence: 'towed' },
    ] }));
    expect(plan.fills.map((f) => [f.path, f.value])).toEqual([
      ['vehicle.odometer', '45320'], ['spotDetails.drivable', 'no'],
    ]);
    expect(plan.conflicts).toEqual([]);
  });

  it('never overwrites a filled field — it becomes a conflict', () => {
    const c = createBlankClaim('spot');
    const claim = { ...c, vehicle: { ...c.vehicle, odometer: '40000' } };
    const plan = planSiteNotes(claim, ex({ fields: [{ path: 'vehicle.odometer', value: '45320', evidence: 'e' }] }));
    expect(plan.fills).toEqual([]);
    expect(plan.conflicts).toEqual([{ path: 'vehicle.odometer', label: 'Odometer', current: '40000', proposed: '45320', evidence: 'e' }]);
  });

  it('drops paths that are not allowed (insured details, amounts)', () => {
    const plan = planSiteNotes(createBlankClaim('spot'), ex({ fields: [
      { path: 'policy.insuredName', value: 'Ramesh', evidence: 'e' },
      { path: 'assessmentRows', value: '5000', evidence: 'e' },
    ] }));
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it('sends invalid enum values to unmapped', () => {
    const plan = planSiteNotes(createBlankClaim('spot'), ex({ fields: [
      { path: 'spotDetails.airbags', value: 'maybe', evidence: 'airbags maybe' },
    ] }));
    expect(plan.fills).toEqual([]);
    expect(plan.unmapped).toEqual(['airbags maybe']);
  });

  it('accepts only ISO datetime-local for accident.dateAndTime', () => {
    const plan = planSiteNotes(createBlankClaim('spot'), ex({ fields: [
      { path: 'accident.dateAndTime', value: 'yesterday evening', evidence: 'yesterday evening' },
    ] }));
    expect(plan.fills).toEqual([]);
    expect(plan.unmapped).toEqual(['yesterday evening']);
    const ok = planSiteNotes(createBlankClaim('spot'), ex({ fields: [
      { path: 'accident.dateAndTime', value: '2026-10-02T18:30', evidence: 'e' },
    ] }));
    expect(ok.fills.map((f) => f.value)).toEqual(['2026-10-02T18:30']);
  });

  it('matches enums case-insensitively and stores lower case', () => {
    const plan = planSiteNotes(createBlankClaim('spot'), ex({ fields: [
      { path: 'spotDetails.drivable', value: 'Yes', evidence: 'e' },
    ] }));
    expect(plan.fills.map((f) => f.value)).toEqual(['yes']);
  });

  it('drops damage rows already on the claim or repeated in the extraction', () => {
    const c = createBlankClaim('spot');
    const claim = { ...c, spotDamageRows: [{ id: 'old', component: 'Bonnet', damage: 'dent' }] };
    const plan = planSiteNotes(claim, ex({ damageRows: [
      { component: ' bonnet ', damage: 'dent', evidence: 'e' },
      { component: 'Door', damage: 'scratch', evidence: 'e' },
      { component: 'DOOR', damage: 'scratch', evidence: 'e' },
    ] }));
    expect(plan.damageRows.map((r) => r.component)).toEqual(['Door']);
  });

  it('keeps damage rows only for spot surveys', () => {
    const rows = [{ component: 'Front bumper', damage: 'cracked - replace', evidence: 'e' }];
    expect(planSiteNotes(createBlankClaim('spot'), ex({ damageRows: rows })).damageRows).toHaveLength(1);
    expect(planSiteNotes(createBlankClaim('final'), ex({ damageRows: rows })).damageRows).toEqual([]);
  });

  it('allows reinspection fields on final surveys only', () => {
    const paths = (t: 'spot' | 'final' | 'valuation') => siteNoteFields(t).map((f) => f.path);
    expect(paths('final')).toContain('reinspection.observations');
    expect(paths('spot')).not.toContain('reinspection.observations');
  });
});

describe('siteNotesUpdates', () => {
  it('returns whole updated sections and appends damage rows', () => {
    const c = createBlankClaim('spot');
    const claim = { ...c, spotDamageRows: [{ id: 'old', component: 'Bonnet', damage: 'dent' }] };
    const plan = planSiteNotes(claim, ex({
      fields: [{ path: 'vehicle.odometer', value: '45320', evidence: 'e' }],
      damageRows: [{ component: 'Front bumper', damage: 'cracked', evidence: 'e' }],
    }));
    const updates = siteNotesUpdates(claim, plan, (i) => `new-${i}`);
    expect(updates.vehicle?.odometer).toBe('45320');
    expect(updates.vehicle?.make).toBe(c.vehicle.make);
    expect(updates.spotDamageRows).toEqual([
      { id: 'old', component: 'Bonnet', damage: 'dent' },
      { id: 'new-0', component: 'Front bumper', damage: 'cracked' },
    ]);
    expect(updates.assessmentRows).toBeUndefined();
    expect(claim.vehicle.odometer).toBe('');
  });
});
