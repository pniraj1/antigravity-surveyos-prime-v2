/**
 * Google Drive notes loader for SurveyOS Scan folders.
 * Queries `SurveyOS/Phone Scans/` claim folders and pulls notes from either
 * `_surveyos-backup.json` (Scan's "Text only" sync) or `_surveyos-scan.json` (Full sync).
 */
import { driveRequest } from '@/lib/drive';
import { phoneScansFolder } from '@/lib/drive/scan-status-sync';
import { normalizeScanNotes, type NormalizedNotesPayload } from './normalizer';
import { sameVehicle } from './manifest';

const API = 'https://www.googleapis.com/drive/v3/files';

export interface ScanDriveFolderItem {
  id: string;
  name: string;
  vehicle: string;
  modifiedTime?: string;
  scanClaimId?: string;
  fileCount?: number;
  hasNotes?: boolean;
}

export interface DriveFolderFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
}

export interface ScanFolderDetails {
  folderId: string;
  fileCount: number;
  photoCount: number;
  docCount: number;
  hasNotes: boolean;
  lastModified?: string;
  files: DriveFolderFile[];
}

/**
 * Lists the Scan claim folders in My Drive/SurveyOS/Phone Scans/, newest first.
 * Only Phone Scans: the SurveyOS root holds Prime's own claim folders (`REG_xxxxxx`, see getOrCreateClaimFolder),
 * which are not phone scans and have no notes; listing them gave the picker's duplicate rows.
 */
export async function listScanDriveFolders(strict = false): Promise<ScanDriveFolderItem[]> {
  // strict: a Drive error throws instead of looking like "no phone folders" (a caller about to make a folder must not guess)
  const parentId = await phoneScansFolder().catch((e) => { if (strict) throw e; return null; });
  if (!parentId) return [];
  const qs = new URLSearchParams({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name,createdTime,modifiedTime,appProperties)',
    spaces: 'drive',
    orderBy: 'modifiedTime desc',
    pageSize: '1000', // ponytail: Drive's max page; add nextPageToken paging past 1000 claims
  });
  const res = await driveRequest(`${API}?${qs}`);
  if (!res.ok) {
    if (strict) throw new Error(`Drive API error ${res.status} listing Phone Scans`);
    return [];
  }
  const data = await res.json();
  const files = (data.files ?? []) as Array<{ id: string; name: string; modifiedTime?: string; appProperties?: Record<string, string> }>;
  return files.map((f) => ({
    id: f.id,
    name: f.name,
    // "MH12AB1234 - NIA" (Scan's name) or first token
    vehicle: f.name.split(/[-–—_]/)[0]?.trim().toUpperCase() || f.name.trim(),
    modifiedTime: f.modifiedTime,
    scanClaimId: f.appProperties?.claimId,
  }));
}

/**
 * The one phone folder for this vehicle that no other claim already uses as its Drive folder, else null
 * (none, or several such as two insurers: the surveyor picks). One Drive folder per claim, spec 2026-11-21.
 * [index] is the Drive index (claim id → folder id). Throws when Drive can't be read, so the caller never takes a failure for "none".
 */
export async function onePhoneFolderFor(
  vehicle: string,
  claimId: string,
  index: Record<string, string>,
): Promise<ScanDriveFolderItem | null> {
  const usedByOthers = new Set(Object.entries(index).filter(([id]) => id !== claimId).map(([, folder]) => folder));
  const hits = (await listScanDriveFolders(true)).filter((f) => sameVehicle(f.vehicle, vehicle) && !usedByOthers.has(f.id));
  return hits.length === 1 ? hits[0] : null;
}

/** Downloads and normalizes notes from a specific Scan claim folder on Drive. */
export async function fetchNotesFromScanFolder(folderId: string): Promise<NormalizedNotesPayload | null> {
  const qs = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false and (name='_surveyos-scan.json' or name='_surveyos-backup.json')`,
    fields: 'files(id,name,createdTime)',
    spaces: 'drive',
  });

  const res = await driveRequest(`${API}?${qs}`);
  if (!res.ok) return null;
  const data = await res.json();
  const files = (data.files ?? []) as Array<{ id: string; name: string }>;

  // Prefer _surveyos-scan.json if present, else fallback to _surveyos-backup.json
  const target =
    files.find((f) => f.name === '_surveyos-scan.json') ??
    files.find((f) => f.name === '_surveyos-backup.json');

  if (!target) return null;

  const downloadRes = await driveRequest(`${API}/${encodeURIComponent(target.id)}?alt=media`);
  if (!downloadRes.ok) return null;

  const text = await downloadRes.text();
  return normalizeScanNotes(text);
}

/**
 * Queries Google Drive for files inside a specific Scan claim folder and computes
 * surveyor-relevant counts (photos, docs, total files), presence of notes, and last modified timestamp.
 */
export async function fetchScanFolderDetails(folderId: string): Promise<ScanFolderDetails | null> {
  try {
    const qs = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,modifiedTime,createdTime)',
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
      pageSize: '1000',
    });

    const res = await driveRequest(`${API}?${qs}`);
    if (!res.ok) return null;
    const data = await res.json();
    const files = (data.files ?? []) as DriveFolderFile[];

    const hasNotes = files.some(
      (f) =>
        f.name === '_surveyos-backup.json' ||
        f.name === '_surveyos-scan.json' ||
        f.name.toLowerCase().endsWith('.txt')
    );

    const photoCount = files.filter(
      (f) =>
        /\.(jpe?g|png|webp|heic)$/i.test(f.name) ||
        (f.mimeType && f.mimeType.startsWith('image/'))
    ).length;

    const docCount = files.filter(
      (f) =>
        /\.pdf$/i.test(f.name) ||
        f.mimeType === 'application/pdf'
    ).length;

    const fileCount = files.filter(
      (f) =>
        !f.name.startsWith('.') &&
        f.name !== '_surveyos-status.json' &&
        f.mimeType !== 'application/vnd.google-apps.folder'
    ).length;

    let lastModified: string | undefined;
    for (const f of files) {
      if (f.modifiedTime && !f.name.startsWith('.')) {
        if (!lastModified || new Date(f.modifiedTime).getTime() > new Date(lastModified).getTime()) {
          lastModified = f.modifiedTime;
        }
      }
    }

    return {
      folderId,
      fileCount,
      photoCount,
      docCount,
      hasNotes,
      lastModified,
      files,
    };
  } catch {
    return null;
  }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function format12HourTime(d: Date): string {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Formats an ISO date string into plain, surveyor-friendly relative or calendar time.
 * E.g. "Just now", "5 mins ago", "Today at 3:15 PM", "Yesterday at 2:30 PM", "15 Nov at 11:45 AM".
 */
export function formatSyncTime(iso?: string, now: number = Date.now()): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';

  const diffMs = now - d.getTime();
  // Tolerate small future clock drift (-60s to +60s)
  if (diffMs >= -60 * 1000 && diffMs < 60 * 1000) {
    return 'Just now';
  }

  if (diffMs >= 60 * 1000 && diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    return `${mins} min${mins === 1 ? '' : 's'} ago`;
  }

  const nowDate = new Date(now);
  const isToday =
    d.getFullYear() === nowDate.getFullYear() &&
    d.getMonth() === nowDate.getMonth() &&
    d.getDate() === nowDate.getDate();

  const timeStr = format12HourTime(d);

  if (isToday) {
    return `Today at ${timeStr}`;
  }

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterdayDate.getFullYear() &&
    d.getMonth() === yesterdayDate.getMonth() &&
    d.getDate() === yesterdayDate.getDate();

  if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  }

  const isSameYear = d.getFullYear() === nowDate.getFullYear();
  if (isSameYear) {
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} at ${timeStr}`;
  }

  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} at ${timeStr}`;
}

