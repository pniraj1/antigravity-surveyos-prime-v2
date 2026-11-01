/**
 * Drive cleanup: completed claims -> Drive trash (recoverable ~30 days). Nothing local is deleted.
 * Only Prime calls this, and only after the surveyor's two confirmations (see DriveCleanup.tsx).
 */
import type { ClaimData } from '@/types';
import { driveRequest, loadDriveIndex } from './index';
import { findScanFolder } from './scan-status-sync';

export interface CleanupMonth { month: number; claims: ClaimData[] } // month is 0-based
export interface CleanupYear { year: number; months: CleanupMonth[] }
export interface CleanupTargets { prime: string | null; scan: string | null }

/** Completed, not yet trashed claims, grouped year then month, newest first. */
export function groupForCleanup(claims: ClaimData[]): CleanupYear[] {
  const done = claims
    .filter(c => c.completedAt && !c.driveTrashedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const years: CleanupYear[] = [];
  for (const c of done) {
    const d = new Date(c.completedAt!);
    let y = years.find(x => x.year === d.getFullYear());
    if (!y) years.push((y = { year: d.getFullYear(), months: [] }));
    let m = y.months.find(x => x.month === d.getMonth());
    if (!m) y.months.push((m = { month: d.getMonth(), claims: [] }));
    m.claims.push(c);
  }
  return years; // ISO strings sort the same as dates, so years and months are already newest first
}

/** Folder ids for one claim: Prime's from the Drive index, Scan's by scanClaimId. */
export function cleanupTargets(
  claim: ClaimData, index: Record<string, string>, scanFolders: Record<string, string>,
): CleanupTargets {
  return {
    prime: index[claim.id] ?? null,
    scan: (claim.scanClaimId && scanFolders[claim.scanClaimId]) || null,
  };
}

/** Looks up Scan folders for the claims (read-only). Missing/failed lookups are simply absent. */
export async function loadCleanupLookup(claims: ClaimData[]) {
  const index = await loadDriveIndex();
  const scanFolders: Record<string, string> = {};
  for (const c of claims) {
    if (!c.scanClaimId) continue;
    try { const id = await findScanFolder(c.scanClaimId); if (id) scanFolders[c.scanClaimId] = id; } catch { /* shown as not on Drive */ }
  }
  return { index, scanFolders };
}

/** Moves a folder to the Drive trash (PATCH, never DELETE). */
export async function trashFolder(id: string): Promise<void> {
  await driveRequest(`https://www.googleapis.com/drive/v3/files/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}
