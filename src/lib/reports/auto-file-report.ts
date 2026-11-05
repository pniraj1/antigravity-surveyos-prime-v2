// src/lib/reports/auto-file-report.ts
/**
 * Canonical auto-filing for generated reports.
 * Directs HTML and PDF reports straight into the allocated claim folder
 * with standardized, sanitized file names, registers them in `claim.documents`,
 * and syncs state.
 */

import type { ClaimData } from '@/types/claim';
import type { DocType } from '@/types/documents';
import { getClaimFolderHandle, verifyHandlePermission } from '@/lib/storage/claim-folder-store';
import { saveDocuments } from '@/lib/documents/sink';
import { useClaimStore } from '@/stores/claim-store';

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

export function finalSurveyFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `Final_Survey_Report_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

export function reinspectionFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `Reinspection_Report_${sanitizeReportNo(claim.reportNo || claim.reinspection?.refNo)}.${cleanExtension(ext)}`;
}

export function uiicFinalFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `UIIC_Final_Survey_Report_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

export function spotFeeBillFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `Spot_Fee_Bill_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

export function valuationFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `Valuation_Report_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

export function billCheckFileName(claim: Partial<ClaimData>, ext = 'html'): string {
  return `Bill_Check_${sanitizeReportNo(claim.reportNo)}.${cleanExtension(ext)}`;
}

/**
 * Automatically writes a rendered report into the claim's allocated folder
 * (if assigned and accessible) and registers it into the claim document index.
 */
export async function saveReportToClaimFolder(
  claim: ClaimData,
  fileName: string,
  blob: Blob,
  docType: DocType = 'surveyReport'
): Promise<boolean> {
  if (!claim?.id) return false;
  try {
    const handle = await getClaimFolderHandle(claim.id);
    if (handle) {
      const permitted = await verifyHandlePermission(handle, 'readwrite');
      if (permitted) {
        const fh = await handle.getFileHandle(fileName, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
      }
    }
    await saveDocuments(docType, [{ blob, name: fileName }], 'generated', claim.id);
    return true;
  } catch (err) {
    console.warn(`[AutoFileReport] Could not auto-file ${fileName} for claim ${claim.id}:`, err);
    return false;
  }
}

/**
 * Automatically writes a rendered report for a given claimId into the claim's folder.
 * If the current claim in the store matches claimId, updates documents index & store;
 * otherwise writes directly to the allocated directory handle.
 */
export async function saveGeneratedReportToClaimFolder(
  claimId: string,
  fileName: string,
  blob: Blob,
  docType: DocType = 'surveyReport'
): Promise<boolean> {
  if (!claimId) return false;
  try {
    const currentClaim = useClaimStore.getState().currentClaim;
    if (currentClaim && currentClaim.id === claimId) {
      return await saveReportToClaimFolder(currentClaim, fileName, blob, docType);
    }
    const handle = await getClaimFolderHandle(claimId);
    if (handle) {
      const permitted = await verifyHandlePermission(handle, 'readwrite');
      if (permitted) {
        const fh = await handle.getFileHandle(fileName, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
      }
    }
    return true;
  } catch (err) {
    console.warn(`[AutoFileReport] Could not auto-file ${fileName} for claimId ${claimId}:`, err);
    return false;
  }
}
