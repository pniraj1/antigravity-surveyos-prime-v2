import { describe, it, expect } from 'vitest';
import { buildValuationHTML } from '../valuation-report-builder';
import { buildSpotFeeBillHTML } from '../spot-fee-bill-builder';
import { createBlankClaim } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';

const mockProfile: SurveyorProfile = {
  name: 'Er. Test Surveyor',
  qualifications: 'B.E. (Mech), FIIISLA',
  address: 'Mumbai, Maharashtra',
  licenceNumber: 'SLA-12345',
  bankName: 'HDFC Bank',
  bankAccount: '1234567890',
  bankIFSC: 'HDFC0001234',
  panNumber: 'ABCDE1234F',
} as SurveyorProfile;

describe('Valuation and Spot Fee Bill Report Fallbacks', () => {
  it('1. buildValuationHTML falls back to claim.accident?.dateOfSurvey (or spotDetails.surveyDatetime) when valuationDetails.inspectionDate is empty', () => {
    const claimWithAccidentDate = {
      ...createBlankClaim('valuation', 'private'),
      reportDate: '',
      accident: {
        ...createBlankClaim('valuation', 'private').accident,
        dateOfSurvey: '2026-08-12',
      },
      valuationDetails: {
        ...createBlankClaim('valuation', 'private').valuationDetails,
        inspectionDate: '',
      },
    };

    const html1 = buildValuationHTML(claimWithAccidentDate, mockProfile);
    expect(html1).toContain('12.08.2026');

    const claimWithSpotDate = {
      ...createBlankClaim('valuation', 'private'),
      reportDate: '',
      accident: {
        ...createBlankClaim('valuation', 'private').accident,
        dateOfSurvey: '',
      },
      spotDetails: {
        ...createBlankClaim('valuation', 'private').spotDetails,
        surveyDatetime: '2026-09-15T10:30',
      },
      valuationDetails: {
        ...createBlankClaim('valuation', 'private').valuationDetails,
        inspectionDate: '',
      },
    };

    const html2 = buildValuationHTML(claimWithSpotDate, mockProfile);
    expect(html2).toContain('15.09.2026');
  });

  it('2. buildValuationHTML falls back to claim.accident?.placeOfSurvey (or accident.workshopName) when valuationDetails.inspectionPlace is empty', () => {
    const claimWithPlaceOfSurvey = {
      ...createBlankClaim('valuation', 'private'),
      accident: {
        ...createBlankClaim('valuation', 'private').accident,
        placeOfSurvey: 'Apex Garage, Pune',
      },
      valuationDetails: {
        ...createBlankClaim('valuation', 'private').valuationDetails,
        inspectionPlace: '',
      },
    };

    const html1 = buildValuationHTML(claimWithPlaceOfSurvey, mockProfile);
    expect(html1).toContain('APEX GARAGE, PUNE');

    const claimWithWorkshopName = {
      ...createBlankClaim('valuation', 'private'),
      accident: {
        ...createBlankClaim('valuation', 'private').accident,
        placeOfSurvey: '',
        workshopName: 'Sai Auto Body',
      },
      valuationDetails: {
        ...createBlankClaim('valuation', 'private').valuationDetails,
        inspectionPlace: '',
      },
    };

    const html2 = buildValuationHTML(claimWithWorkshopName, mockProfile);
    expect(html2).toContain('SAI AUTO BODY');
  });

  it('3. buildValuationHTML falls back to claim.vehicle?.odometer when valuationDetails.odometer is empty', () => {
    const claimWithVehicleOdo = {
      ...createBlankClaim('valuation', 'private'),
      vehicle: {
        ...createBlankClaim('valuation', 'private').vehicle,
        odometer: '45210',
      },
      valuationDetails: {
        ...createBlankClaim('valuation', 'private').valuationDetails,
        odometer: '',
      },
    };

    const html = buildValuationHTML(claimWithVehicleOdo, mockProfile);
    expect(html).toContain('45210');
  });

  it('4. buildSpotFeeBillHTML falls back to valuationDetails.inspectionDate and valuationDetails.inspectionPlace when accident/spot are empty', () => {
    const claimWithValuation = {
      ...createBlankClaim('spot', 'private'),
      accident: {
        ...createBlankClaim('spot', 'private').accident,
        dateOfSurvey: '',
        timeOfSurvey: '',
        placeOfSurvey: '',
      },
      spotDetails: {
        ...createBlankClaim('spot', 'private').spotDetails,
        surveyDatetime: '',
        repairWorkshop: '',
      },
      valuationDetails: {
        ...createBlankClaim('spot', 'private').valuationDetails,
        inspectionDate: '2026-10-05',
        inspectionPlace: 'Surat Motor Works',
      },
    };

    const html = buildSpotFeeBillHTML(claimWithValuation, mockProfile);
    expect(html).toContain('05.10.2026');
    expect(html).toContain('Surat Motor Works');
  });
});
