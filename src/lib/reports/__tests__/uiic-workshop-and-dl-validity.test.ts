import { describe, it, expect } from 'vitest';
import { buildUIICFinalHTML } from '../uiic-final-builder';
import type { ClaimData } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';

function makeBaseClaim(overrides: Partial<ClaimData> = {}): ClaimData {
  return {
    id: 'test-claim-1',
    reportNo: 'MOTOR/926/2026',
    reportDate: '2026-11-06',
    depreciationType: 'standard',
    vehicle: {
      registrationNumber: 'MH19CV6974',
      dateOfRegistration: '2020-02-05',
      make: 'VOLKSWAGEN',
      model: 'AMEO',
      yearOfManufacture: 2018,
    } as any,
    policy: {
      policyNumber: '2310023125P115198891',
      claimNumber: '23100251260C050054001/1',
      insuredName: 'AJAY GAHININATH RODGE',
      idv: 450000,
    } as any,
    accident: {
      workshopName: '',
      placeOfSurvey: 'Volkswagen Dhule',
    } as any,
    spotDetails: {
      repairWorkshop: 'Spot Crane Service Yard',
    } as any,
    driver: {
      name: 'AJAY RODGE',
      licenceNumber: 'MH19 19980017274',
      validityNonTransport: '2031-08-08',
      validityTransport: '2026-08-08',
    } as any,
    reinspection: {} as any,
    assessmentRows: [],
    feeBill: {
      salvageValue: 0,
      compulsoryExcess: 0,
      voluntaryExcess: 0,
      towingCharges: 0,
    } as any,
    ...overrides,
  } as ClaimData;
}

const mockProfile: SurveyorProfile = {
  name: 'Vikram Patil',
  qualifications: 'B.Sc., Dip. in Auto Engg.',
  licenceNumber: 'SLA-34369',
  iiislaNumber: 'F/W/00200',
  address: '62, Vighnaharata Colony, Dhule',
} as any;

describe('UIIC Final Report - Workshop and DL Validity integrity', () => {
  it('does NOT secretly pull spot repair workshop into final survey workshop name', () => {
    // When final workshop is empty, it should NOT print Spot Crane Service Yard
    const claim = makeBaseClaim({
      accident: { workshopName: '', placeOfSurvey: 'Test Place' } as any,
      spotDetails: { repairWorkshop: 'Spot Crane Service Yard' } as any,
    });

    const html = buildUIICFinalHTML(claim, mockProfile);
    expect(html).not.toContain('Spot Crane Service Yard');
  });

  it('prints final survey workshop name when entered', () => {
    const claim = makeBaseClaim({
      accident: { workshopName: 'Volkswagen Dhule Aakash Wheels', placeOfSurvey: 'Test Place' } as any,
      spotDetails: { repairWorkshop: 'Spot Crane Service Yard' } as any,
    });

    const html = buildUIICFinalHTML(claim, mockProfile);
    expect(html).toContain('Volkswagen Dhule Aakash Wheels');
    expect(html).not.toContain('Spot Crane Service Yard');
  });

  it('publishes BOTH NT and TR validity dates when both exist on driver licence', () => {
    const claim = makeBaseClaim({
      driver: {
        name: 'AJAY RODGE',
        licenceNumber: 'MH19 19980017274',
        validityNonTransport: '2031-08-08',
        validityTransport: '2026-08-08',
      } as any,
    });

    const html = buildUIICFinalHTML(claim, mockProfile);
    // Should display both NT: 08.08.2031 and TR: 08.08.2026
    expect(html).toContain('NT: 08.08.2031');
    expect(html).toContain('TR: 08.08.2026');
  });

  it('publishes clean single date when only Non-Transport validity exists', () => {
    const claim = makeBaseClaim({
      driver: {
        name: 'AJAY RODGE',
        licenceNumber: 'MH19 19980017274',
        validityNonTransport: '2031-08-08',
        validityTransport: '',
      } as any,
    });

    const html = buildUIICFinalHTML(claim, mockProfile);
    expect(html).toContain('08.08.2031');
    expect(html).not.toContain('TR:');
  });

  it('prints the driver Date of Birth under the licence holder name', () => {
    const claim = makeBaseClaim({
      driver: { name: 'AJAY RODGE', licenceNumber: 'MH19 19980017274', dateOfBirth: '1985-07-22' } as any,
    });
    const html = buildUIICFinalHTML(claim, mockProfile);
    expect(html).toContain('22.07.1985');
    const dob = html.indexOf('>Date of Birth<');
    expect(dob).toBeGreaterThan(html.indexOf('Name of Driving Licence Holder'));
    expect(dob).toBeLessThan(html.indexOf('Driving Licence Number'));
  });
});
