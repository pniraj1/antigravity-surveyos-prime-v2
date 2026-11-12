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
        // Scan's stored section names (Repository.kt): fee notes live under "fee_bill".
        fee_bill: {
          'feeBill.professionalFee': '2500',
          'feeBill.distanceKm': '45',
        },
      },
      // Scan tags rows with their notes section ("spot" / "valuation"), as BackupJson.kt writes them.
      rows: [
        { id: 'r1', section: 'spot', sortOrder: 0, component: 'Front bumper', damage: 'Broken at centre' },
        { id: 'r2', section: 'spot', sortOrder: 1, component: 'Bonnet', damage: 'Dented' },
        { id: 'r3', section: 'valuation', sortOrder: 0, component: 'Bodyshell', damage: 'Good' },
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

  it('reads notes from a whole _surveyos-scan.json file (Drive folder picker)', () => {
    const manifest = {
      app: 'surveyos-scan',
      v: 1,
      vehicle: 'MH12AB1234',
      insurer: 'NIA',
      claimNo: null,
      exportedAt: '2026-11-12T10:00:00+05:30',
      files: [],
      notes: {
        spot: { 'vehicle.odometer': '45210', 'documentVerification.rc': { status: 'YES', detail: '' } },
        spotDamageRows: [{ component: 'Front bumper', damage: 'Broken' }],
        valuation: { 'valuationDetails.chassis': 'Good' },
        valuationPartRows: [{ component: 'Bodyshell', condition: 'Good' }],
        feeBill: { 'feeBill.tollCharges': '270' },
        updatedAt: '2026-11-12T10:00:00+05:30',
      },
      claimId: 'scan-claim-9',
    };

    const n = normalizeScanNotes(JSON.stringify(manifest));
    expect(n?.spot['vehicle.odometer']).toBe('45210');
    expect(n?.spot['documentVerification.rc']).toEqual({ status: 'YES', detail: '' });
    expect(n?.spotDamageRows).toEqual([{ component: 'Front bumper', damage: 'Broken' }]);
    expect(n?.valuation['valuationDetails.chassis']).toBe('Good');
    expect(n?.valuationPartRows).toEqual([{ component: 'Bodyshell', condition: 'Good' }]);
    expect(n?.feeBill['feeBill.tollCharges']).toBe('270');
    expect(n?.updatedAt).toBe('2026-11-12T10:00:00+05:30');
    expect(n?.vehicle).toBe('MH12AB1234');
    expect(n?.claimId).toBe('scan-claim-9');
  });

  it('returns null for null, undefined, or invalid inputs', () => {
    expect(normalizeScanNotes(null)).toBeNull();
    expect(normalizeScanNotes(undefined)).toBeNull();
    expect(normalizeScanNotes('not json')).toBeNull();
  });
});
