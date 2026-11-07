import { describe, it, expect } from 'vitest';
import { normalizeScanNotes } from '../normalizer';
import { planNotes, isEmptyNotesPlan } from '../notes';
import { createBlankClaim } from '@/types';

describe('normalizeScanNotes', () => {
  it('normalizes a full Scan backup JSON (_surveyos-backup.json)', () => {
    const backup = {
      app: 'surveyos-scan-backup',
      v: 1,
      claimId: 'scan-claim-123',
      vehicleNo: 'MH 12 AB 1234',
      insurer: 'NIA',
      claimNo: 'CN-999',
      notes: {
        spot: {
          'vehicle.odometer': '45210',
          'accident.placeOfAccident': 'Baner, Pune',
          'documentVerification.rc.status': 'YES',
          'documentVerification.rc.detail': 'Original seen',
        },
        valuation: {
          'valuationDetails.odometer': '45210',
          'valuationDetails.chassis': 'Good',
        },
        feeBill: {
          'feeBill.professionalFee': '2500',
          'feeBill.distanceKm': '45',
        },
      },
      rows: [
        { section: 'spotDamageRows', component: 'Front bumper', damage: 'Broken at centre' },
        { section: 'spotDamageRows', component: 'Bonnet', damage: 'Dented' },
        { section: 'valuationPartRows', component: 'Bodyshell', damage: 'Good' },
      ],
      updatedAt: 1730000000000,
    };

    const normalized = normalizeScanNotes(backup);
    expect(normalized).not.toBeNull();
    expect(normalized?.vehicle).toBe('MH 12 AB 1234');
    expect(normalized?.claimId).toBe('scan-claim-123');
    expect(normalized?.spot['vehicle.odometer']).toBe('45210');
    expect(normalized?.spot['documentVerification.rc']).toEqual({
      status: 'YES',
      detail: 'Original seen',
    });
    expect(normalized?.spotDamageRows).toEqual([
      { component: 'Front bumper', damage: 'Broken at centre' },
      { component: 'Bonnet', damage: 'Dented' },
    ]);
    expect(normalized?.valuationPartRows).toEqual([
      { component: 'Bodyshell', condition: 'Good' },
    ]);
    expect(normalized?.feeBill['feeBill.professionalFee']).toBe('2500');

    // Test compatibility with planNotes
    const claim = createBlankClaim('spot', 'private');
    const plan = planNotes(claim, normalized);
    expect(isEmptyNotesPlan(plan)).toBe(false);
    expect(plan.fill.map((f) => f.key)).toContain('vehicle.odometer');
    expect(plan.fill.map((f) => f.key)).toContain('accident.placeOfAccident');
    expect(plan.rows.damage).toHaveLength(2);
  });

  it('normalizes a manifest notes object (_surveyos-scan.json)', () => {
    const manifestNotes = {
      spot: {
        'vehicle.odometer': '32000',
        'documentVerification.dl': { status: 'YES', detail: 'Online check ok' },
      },
      spotDamageRows: [{ component: 'Headlight LH', damage: 'Shattered' }],
      valuation: {},
      valuationPartRows: [],
      feeBill: { 'feeBill.distanceKm': '30' },
      updatedAt: '2026-10-25T10:00:00+05:30',
      vehicle: 'MH14CD5678',
    };

    const normalized = normalizeScanNotes(manifestNotes);
    expect(normalized?.spot['vehicle.odometer']).toBe('32000');
    expect(normalized?.spotDamageRows).toEqual([{ component: 'Headlight LH', damage: 'Shattered' }]);
    expect(normalized?.vehicle).toBe('MH14CD5678');
  });

  it('returns null for null, undefined, or invalid inputs', () => {
    expect(normalizeScanNotes(null)).toBeNull();
    expect(normalizeScanNotes(undefined)).toBeNull();
    expect(normalizeScanNotes('not json')).toBeNull();
  });
});
