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
