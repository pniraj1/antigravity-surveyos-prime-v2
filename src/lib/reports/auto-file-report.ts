// src/lib/reports/auto-file-report.ts
/**
 * Canonical auto-filing for generated reports.
 * Standardized, sanitized vehicle-first file names for Prime-made reports,
 * and the one call that files them.
 */

import type { ClaimData } from '@/types/claim';
import type { DocType } from '@/types/documents';
import { saveDocuments } from '@/lib/documents/sink';
import { useUIStore } from '@/stores/ui-store';
import { uploadFileToDrive } from '@/lib/drive';

/**
 * Sanitizes vehicle registration numbers for use in filesystem filenames.
 * Strips whitespace, uppercases, and replaces illegal Windows characters (/\:*?"<>|) with underscores.
 * If empty/missing/whitespace, returns ''.
 */
export function sanitizeRegNo(no?: string): string {
  if (!no || !no.trim()) return '';
  return no.trim().toUpperCase().replace(/\s+/g, '').replace(/[/\\:*?"<>|]/g, '_');
}

/**
 * Sanitizes report numbers for use in filesystem filenames.
 * Replaces illegal Windows characters (/\:*?"<>|) with underscores.
 */
export function sanitizeReportNo(no?: string): string {
  if (!no || !no.trim()) return 'DRAFT';
  return no.trim().replace(/[/\\:*?"<>|]/g, '_');
}

function cleanExtension(ext = 'html'): string {
  return ext.replace(/^\.+/, '') || 'html';
}

function filePrefix(claim: Partial<ClaimData>): string {
  const reg = sanitizeRegNo(claim.vehicle?.registrationNumber);
  return reg ? `${reg}_` : '';
}

export function finalSurveyFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `${filePrefix(claim)}Final_Survey_Report_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

export function reinspectionFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `${filePrefix(claim)}Reinspection_Report_${sanitizeReportNo(claim.reportNo || claim.reinspection?.refNo)}.${cleanExtension(ext)}`;
}

export function uiicFinalFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `${filePrefix(claim)}UIIC_Final_Survey_Report_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

export function spotFeeBillFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `${filePrefix(claim)}Spot_Fee_Bill_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

export function valuationFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `${filePrefix(claim)}Valuation_Report_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

export function billCheckFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `${filePrefix(claim)}Bill_Check_Report_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

/**
 * Files a rendered report in the claim: one vehicle-first file in the claim
 * folder, registered in `claim.documents` (through the sink), plus the Drive mirror.
 */
export async function saveReportToClaimFolder(
  claim: ClaimData,
  fileName: string,
  blob: Blob,
  docType: DocType = 'surveyReport'
): Promise<boolean> {
  if (!claim?.id) return false;
  try {
    if (useUIStore.getState().isDriveConnected) {
      void uploadFileToDrive(
        claim.id,
        fileName,
        blob,
        claim.vehicle?.registrationNumber || claim.id
      ).catch((err) => {
        console.warn(`[AutoFileReport] Drive mirror failed for ${fileName}:`, err);
      });
    }
    await saveDocuments(docType, [{ blob, name: fileName, keepName: true }], 'generated', claim.id);
    return true;
  } catch (err) {
    console.warn(`[AutoFileReport] Could not auto-file ${fileName} for claim ${claim.id}:`, err);
    return false;
  }
}
