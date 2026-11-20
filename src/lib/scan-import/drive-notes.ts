/**
 * Google Drive notes loader for SurveyOS Scan folders.
 * Queries `SurveyOS/Phone Scans/` and `SurveyOS/` claim folders and pulls notes from either
 * `_surveyos-backup.json` (Scan's "Text only" sync) or `_surveyos-scan.json` (Full sync).
 */
import { driveRequest, getRootFolder } from '@/lib/drive';
import { phoneScansFolder } from '@/lib/drive/scan-status-sync';
import { normalizeScanNotes, type NormalizedNotesPayload } from './normalizer';

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

/** Lists the claim folders present in My Drive/SurveyOS/Phone Scans/ and My Drive/SurveyOS/, newest first. */
export async function listScanDriveFolders(): Promise<ScanDriveFolderItem[]> {
  const folders: ScanDriveFolderItem[] = [];
  const seenIds = new Set<string>();

  const searchRoots: string[] = [];
  try {
    const phoneRoot = await phoneScansFolder();
    if (phoneRoot) searchRoots.push(phoneRoot);
  } catch {
    // non-critical
  }

  try {
    const mainRoot = await getRootFolder();
    if (mainRoot && !searchRoots.includes(mainRoot)) {
      searchRoots.push(mainRoot);
    }
  } catch {
    // non-critical
  }

  for (const parentId of searchRoots) {
    try {
      const qs = new URLSearchParams({
        q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name,createdTime,modifiedTime,appProperties)',
        spaces: 'drive',
        orderBy: 'modifiedTime desc',
        pageSize: '50',
      });

      const res = await driveRequest(`${API}?${qs}`);
      if (!res.ok) continue;
      const data = await res.json();
      const files = (data.files ?? []) as Array<{
        id: string;
        name: string;
        modifiedTime?: string;
        appProperties?: Record<string, string>;
      }>;

      for (const f of files) {
        // Skip container folder "Phone Scans" itself when listing root SurveyOS
        if (f.name === 'Phone Scans' || seenIds.has(f.id)) continue;
        seenIds.add(f.id);

        // Extract vehicle from "MH12AB1234 - NIA" format or first token
        const vehicle = f.name.split(/[-–—_]/)[0]?.trim().toUpperCase() || f.name.trim();
        folders.push({
          id: f.id,
          name: f.name,
          vehicle,
          modifiedTime: f.modifiedTime,
          scanClaimId: f.appProperties?.claimId,
        });
      }
    } catch {
      // Ignore errors for individual parent query
    }
  }

  return folders.sort((a, b) => {
    const timeA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
    const timeB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
    return timeB - timeA;
  });
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

