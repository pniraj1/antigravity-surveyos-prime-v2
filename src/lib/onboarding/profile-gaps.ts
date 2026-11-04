import type { SurveyorProfile } from '@/types/vehicle';

/** Profile details that print on every report, in display order. */
export function missingReportDetails(profile: SurveyorProfile): string[] {
  const gaps: string[] = [];
  if (!profile.name?.trim()) gaps.push('name');
  if (!profile.licenceNumber?.trim()) gaps.push('licence number');
  if (!profile.signatureDataUrl) gaps.push('signature');
  if (!profile.stampDataUrl) gaps.push('stamp');
  return gaps;
}

/** Name and licence number are the minimum a report needs. */
export function isReportDetailsComplete(profile: SurveyorProfile): boolean {
  return !!profile.name?.trim() && !!profile.licenceNumber?.trim();
}
