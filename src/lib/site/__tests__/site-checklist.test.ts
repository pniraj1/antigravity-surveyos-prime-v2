import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types';
import { siteChecklist } from '../site-checklist';

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('siteChecklist', () => {
  it('lists everything for a blank spot claim', () => {
    const { missing, confirm } = siteChecklist(createBlankClaim('spot'));
    expect(ids(missing)).toEqual([
      'doc:rc', 'doc:dl', 'doc:policy',
      'vehicle.registrationNumber', 'vehicle.odometer', 'accident.dateAndTime',
      'accident.placeOfAccident', 'accident.causeOfAccident', 'accident.placeOfSurvey',
      'photo:damage',
    ]);
    expect(ids(confirm)).toEqual([
      'spotDetails.drivable', 'spotDetails.airbags', 'spotDetails.policeReported',
      'spotDetails.tpInvolved', 'spotDetails.panchanama', 'spotDetails.damageSeverity',
    ]);
    expect(confirm[0].value).toBe('yes');
  });

  it('drops documents that have been extracted and fields that are filled', () => {
    const c = createBlankClaim('spot');
    const claim = {
      ...c,
      extractedData: { rc: { any: 1 } },
      vehicle: { ...c.vehicle, odometer: '45320' },
      photos: [{ dataUrl: 'x', name: 'a', kind: 'damage' as const }],
    };
    const missing = ids(siteChecklist(claim).missing);
    expect(missing).not.toContain('doc:rc');
    expect(missing).not.toContain('vehicle.odometer');
    expect(missing).not.toContain('photo:damage');
  });

  it('does not count document photos as damage photos', () => {
    const c = createBlankClaim('spot');
    const claim = { ...c, photos: [{ dataUrl: 'x', name: 'rc', kind: 'document' as const }] };
    expect(ids(siteChecklist(claim).missing)).toContain('photo:damage');
  });

  it('final asks for the estimate and the workshop', () => {
    const missing = ids(siteChecklist(createBlankClaim('final')).missing);
    expect(missing).toContain('doc:estimate');
    expect(missing).toContain('accident.workshopName');
    expect(siteChecklist(createBlankClaim('final')).confirm).toEqual([]);
  });

  it('valuation documents go to Details (its uploads live there); spot goes to Documents', () => {
    const target = (t: 'spot' | 'valuation') =>
      siteChecklist(createBlankClaim(t)).missing.find((i) => i.id === 'doc:rc')?.target;
    expect(target('valuation')).toBe('details');
    expect(target('spot')).toBe('documents');
  });

  it('valuation points condition fields at the Valuation tab and shows insurable as Yes', () => {
    const { missing, confirm } = siteChecklist(createBlankClaim('valuation'));
    expect(missing.find((i) => i.id === 'valuationDetails.tyreCondition')?.target).toBe('valuation');
    expect(confirm).toEqual([{ id: 'valuationDetails.isInsurable', label: 'Insurable', target: 'valuation', value: 'Yes' }]);
  });
});
