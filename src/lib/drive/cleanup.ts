/**
 * Drive cleanup: completed claims -> Drive trash (recoverable ~30 days). Nothing local is deleted.
 * Only Prime calls this, and only after the surveyor's two confirmations (see DriveCleanup.tsx).
 */
import type { ClaimData } from '@/types';
import { driveRequest, findRootFolder, loadDriveIndexStrict } from './index';
import { findScanFolder, phoneScansFolder } from './scan-status-sync';

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

export interface CleanupLookup {
  index: Record<string, string>;
  scanFolders: Record<string, string>;
  /** Claim ids whose Drive lookup failed: shown as "Couldn't check Drive", never trashed or stamped. */
  failed: Set<string>;
  /** SurveyOS root and Phone Scans folder ids: never trashed. */
  protectedIds: Set<string>;
}

/** Read-only lookup. A failure is reported in `failed`, never mistaken for "not on Drive". */
export async function loadCleanupLookup(claims: ClaimData[]): Promise<CleanupLookup> {
  const out: CleanupLookup = { index: {}, scanFolders: {}, failed: new Set(), protectedIds: new Set() };
  let ps: string | null;
  try {
    const root = await findRootFolder(); // find only: a cleanup never creates the SurveyOS folder
    if (!root) return out; // nothing on Drive
    out.index = await loadDriveIndexStrict(root);
    out.protectedIds.add(root);
    ps = await phoneScansFolder();
    if (ps) out.protectedIds.add(ps);
  } catch {
    claims.forEach(c => out.failed.add(c.id));
    return out;
  }
  if (!ps) return out; // no Scan folders
  for (const c of claims) {
    if (!c.scanClaimId) continue;
    try {
      const id = await findScanFolder(c.scanClaimId, ps); // Phone Scans resolved once above
      if (id) out.scanFolders[c.scanClaimId] = id;
    } catch { out.failed.add(c.id); }
  }
  return out;
}

/** Moves a folder to the Drive trash (PATCH, never DELETE). */
export async function trashFolder(id: string): Promise<void> {
  await driveRequest(`https://www.googleapis.com/drive/v3/files/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

export interface CleanupIO {
  /** The claim as it is now (open store copy, else IndexedDB). */
  read(id: string): Promise<ClaimData | undefined>;
  /** Writes ONLY driveTrashedAt onto the current copy of the claim. */
  stamp(id: string, at: string): Promise<void>;
}

/** Trashes the picked claims' folders. Stamps a claim only when at least one folder was trashed. */
export async function runCleanup(ids: string[], lookup: CleanupLookup, io: CleanupIO) {
  const r = { trashed: 0, skipped: 0, failed: 0 };
  for (const id of ids) {
    try {
      const fresh = await io.read(id); // re-read: it may have been reopened since the list loaded
      if (!fresh || !fresh.completedAt || fresh.driveTrashedAt || lookup.failed.has(id)) { r.skipped++; continue; }
      const t = cleanupTargets(fresh, lookup.index, lookup.scanFolders);
      const folders = [t.prime, t.scan].filter((x): x is string => !!x);
      if (folders.length === 0) { r.skipped++; continue; }
      if (folders.some(f => lookup.protectedIds.has(f))) { r.failed++; continue; }
      for (const f of folders) await trashFolder(f);
      await io.stamp(id, new Date().toISOString());
      r.trashed++;
    } catch { r.failed++; }
  }
  return r;
}
