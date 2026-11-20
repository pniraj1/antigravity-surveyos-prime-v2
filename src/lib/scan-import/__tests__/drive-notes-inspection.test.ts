import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listScanDriveFolders,
  fetchScanFolderDetails,
  formatSyncTime,
} from '../drive-notes';

vi.mock('@/lib/drive', () => ({
  driveRequest: vi.fn(),
  getRootFolder: vi.fn(),
}));

vi.mock('@/lib/drive/scan-status-sync', () => ({
  phoneScansFolder: vi.fn(),
}));

import { driveRequest, getRootFolder } from '@/lib/drive';
import { phoneScansFolder } from '@/lib/drive/scan-status-sync';

describe('drive-notes-inspection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listScanDriveFolders', () => {
    it('returns folders with modifiedTime, vehicle, and scanClaimId', async () => {
      vi.mocked(phoneScansFolder).mockResolvedValue('phone-scans-id');
      vi.mocked(getRootFolder).mockResolvedValue('surveyos-root-id');

      vi.mocked(driveRequest).mockImplementation(async (url: string) => {
        if (url.includes('phone-scans-id')) {
          return {
            ok: true,
            json: async () => ({
              files: [
                {
                  id: 'f-1',
                  name: 'MH12AB1234 - NIA',
                  modifiedTime: '2026-11-20T14:30:00.000Z',
                  appProperties: { claimId: 'scan-claim-1' },
                },
              ],
            }),
          } as any;
        }
        return {
          ok: true,
          json: async () => ({ files: [] }),
        } as any;
      });

      const folders = await listScanDriveFolders();
      expect(folders).toHaveLength(1);
      expect(folders[0]).toEqual({
        id: 'f-1',
        name: 'MH12AB1234 - NIA',
        vehicle: 'MH12AB1234',
        modifiedTime: '2026-11-20T14:30:00.000Z',
        scanClaimId: 'scan-claim-1',
      });
    });
  });

  describe('fetchScanFolderDetails', () => {
    it('queries Drive for files in folder and calculates counts, notes, and lastModified', async () => {
      vi.mocked(driveRequest).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'file-1',
              name: 'damage1.jpg',
              mimeType: 'image/jpeg',
              size: '102400',
              modifiedTime: '2026-11-20T14:00:00.000Z',
            },
            {
              id: 'file-2',
              name: 'rc_copy.png',
              mimeType: 'image/png',
              size: '204800',
              modifiedTime: '2026-11-20T14:15:00.000Z',
            },
            {
              id: 'file-3',
              name: 'estimate.pdf',
              mimeType: 'application/pdf',
              size: '512000',
              modifiedTime: '2026-11-20T14:20:00.000Z',
            },
            {
              id: 'file-4',
              name: '_surveyos-backup.json',
              mimeType: 'application/json',
              size: '4096',
              modifiedTime: '2026-11-20T14:25:00.000Z',
            },
            {
              id: 'file-5',
              name: '_surveyos-status.json',
              mimeType: 'application/json',
              size: '512',
              modifiedTime: '2026-11-20T14:30:00.000Z',
            },
            {
              id: 'file-6',
              name: '.DS_Store',
              mimeType: 'application/octet-stream',
              size: '6148',
              modifiedTime: '2026-11-20T14:05:00.000Z',
            },
          ],
        }),
      } as any);

      const details = await fetchScanFolderDetails('folder-abc');

      const calledUrl = decodeURIComponent(vi.mocked(driveRequest).mock.calls[0][0]).replace(/\+/g, ' ');
      expect(calledUrl).toContain("'folder-abc' in parents and trashed=false");
      expect(calledUrl).toContain('files(id,name,mimeType,size,modifiedTime,createdTime)');

      expect(details).not.toBeNull();
      expect(details?.folderId).toBe('folder-abc');
      // fileCount excludes _surveyos-status.json and .DS_Store (hidden) -> 4 files
      expect(details?.fileCount).toBe(4);
      // photoCount: damage1.jpg, rc_copy.png -> 2
      expect(details?.photoCount).toBe(2);
      // docCount: estimate.pdf -> 1
      expect(details?.docCount).toBe(1);
      // hasNotes: _surveyos-backup.json is present -> true
      expect(details?.hasNotes).toBe(true);
      // lastModified: latest among the files (2026-11-20T14:30:00.000Z)
      expect(details?.lastModified).toBe('2026-11-20T14:30:00.000Z');
      expect(details?.files).toHaveLength(6);
    });

    it('identifies notes from _surveyos-scan.json or text notes', async () => {
      vi.mocked(driveRequest).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'f-txt',
              name: 'survey_notes.txt',
              mimeType: 'text/plain',
              size: '120',
              modifiedTime: '2026-11-19T10:00:00.000Z',
            },
          ],
        }),
      } as any);

      const details = await fetchScanFolderDetails('folder-txt');
      expect(details?.hasNotes).toBe(true);
      expect(details?.fileCount).toBe(1);
      expect(details?.photoCount).toBe(0);
      expect(details?.docCount).toBe(0);
    });

    it('handles empty folder gracefully', async () => {
      vi.mocked(driveRequest).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      } as any);

      const details = await fetchScanFolderDetails('empty-folder');
      expect(details).toEqual({
        folderId: 'empty-folder',
        fileCount: 0,
        photoCount: 0,
        docCount: 0,
        hasNotes: false,
        lastModified: undefined,
        files: [],
      });
    });

    it('returns null when Drive request fails', async () => {
      vi.mocked(driveRequest).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      const details = await fetchScanFolderDetails('missing-folder');
      expect(details).toBeNull();
    });
  });

  describe('formatSyncTime', () => {
    it('returns Never for undefined, null, or empty string', () => {
      expect(formatSyncTime()).toBe('Never');
      expect(formatSyncTime(undefined)).toBe('Never');
      expect(formatSyncTime('')).toBe('Never');
      expect(formatSyncTime('invalid-date')).toBe('Never');
    });

    it('returns Just now for times less than 60 seconds ago or future drift', () => {
      const now = new Date('2026-11-20T15:00:00.000Z').getTime();
      expect(formatSyncTime('2026-11-20T14:59:30.000Z', now)).toBe('Just now');
      expect(formatSyncTime('2026-11-20T15:00:10.000Z', now)).toBe('Just now');
    });

    it('returns relative minutes for times within 60 minutes', () => {
      const now = new Date('2026-11-20T15:00:00.000Z').getTime();
      expect(formatSyncTime('2026-11-20T14:59:00.000Z', now)).toBe('1 min ago');
      expect(formatSyncTime('2026-11-20T14:55:00.000Z', now)).toBe('5 mins ago');
      expect(formatSyncTime('2026-11-20T14:15:00.000Z', now)).toBe('45 mins ago');
    });

    it('returns Today at formatted time when earlier today (> 1 hour)', () => {
      // Local time setup: 2026-11-20 18:00
      const localBase = new Date(2026, 10, 20, 18, 0, 0);
      const now = localBase.getTime();
      const pastToday = new Date(2026, 10, 20, 15, 15, 0).toISOString();

      expect(formatSyncTime(pastToday, now)).toBe('Today at 3:15 PM');
    });

    it('returns Yesterday at formatted time when yesterday', () => {
      const localBase = new Date(2026, 10, 20, 10, 0, 0);
      const now = localBase.getTime();
      const yesterday = new Date(2026, 10, 19, 14, 30, 0).toISOString();

      expect(formatSyncTime(yesterday, now)).toBe('Yesterday at 2:30 PM');
    });

    it('returns date and time for older dates', () => {
      const localBase = new Date(2026, 10, 20, 10, 0, 0);
      const now = localBase.getTime();
      const older = new Date(2026, 10, 15, 11, 45, 0).toISOString();

      expect(formatSyncTime(older, now)).toBe('15 Nov at 11:45 AM');
    });
  });
});
