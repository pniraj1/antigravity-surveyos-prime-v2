import { describe, it, expect } from 'vitest';
import { isReportDetailsComplete, missingReportDetails } from '../profile-gaps';
import type { SurveyorProfile } from '@/types/vehicle';

const full = {
  name: 'A Surveyor', licenceNumber: 'SLA-1', signatureDataUrl: 'data:x', stampDataUrl: 'data:y',
} as SurveyorProfile;
const withProfile = (p: Partial<SurveyorProfile>) => ({ ...full, ...p }) as SurveyorProfile;

describe('profile-gaps', () => {
  it('complete profile has no gaps', () => {
    expect(missingReportDetails(full)).toEqual([]);
    expect(isReportDetailsComplete(full)).toBe(true);
  });
  it('whitespace name is missing', () => {
    expect(missingReportDetails(withProfile({ name: '   ' }))).toEqual(['name']);
  });
  it('empty profile lists all four in order', () => {
    const empty = withProfile({ name: '', licenceNumber: '', signatureDataUrl: null, stampDataUrl: null });
    expect(missingReportDetails(empty)).toEqual(['name', 'licence number', 'signature', 'stamp']);
  });
  it('whitespace licence is incomplete', () => {
    expect(isReportDetailsComplete(withProfile({ licenceNumber: '  ' }))).toBe(false);
  });
});
