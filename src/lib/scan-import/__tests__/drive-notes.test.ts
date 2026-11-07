import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listScanDriveFolders, fetchNotesFromScanFolder } from '../drive-notes';

vi.mock('@/lib/drive', () => ({
  driveRequest: vi.fn(),
}));

vi.mock('@/lib/drive/scan-status-sync', () => ({
  phoneScansFolder: vi.fn(),
}));

describe('drive-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listScanDriveFolders returns folders with parsed vehicle', async () => {
    const { phoneScansFolder } = await import('@/lib/drive/scan-status-sync');
    const { driveRequest } = await import('@/lib/drive');

    vi.mocked(phoneScansFolder).mockResolvedValue('phone-scans-id');
    vi.mocked(driveRequest).mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [
          {
            id: 'f1',
            name: 'MH12AB1234 - NIA',
            modifiedTime: '2026-11-01T10:00:00Z',
            appProperties: { claimId: 'scan-1' },
          },
          {
            id: 'f2',
            name: 'MH14CD5678',
            modifiedTime: '2026-10-30T10:00:00Z',
          },
        ],
      }),
    } as any);

    const list = await listScanDriveFolders();
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      id: 'f1',
      name: 'MH12AB1234 - NIA',
      vehicle: 'MH12AB1234',
      modifiedTime: '2026-11-01T10:00:00Z',
      scanClaimId: 'scan-1',
    });
    expect(list[1].vehicle).toBe('MH14CD5678');
  });

  it('fetchNotesFromScanFolder prefers _surveyos-scan.json when present', async () => {
    const { driveRequest } = await import('@/lib/drive');

    // Call 1: list files in folder
    vi.mocked(driveRequest)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            { id: 'b1', name: '_surveyos-backup.json' },
            { id: 's1', name: '_surveyos-scan.json' },
          ],
        }),
      } as any)
      // Call 2: download s1
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            spot: { 'vehicle.odometer': '45210' },
            spotDamageRows: [{ component: 'Front bumper', damage: 'Broken' }],
          }),
      } as any);

    const notes = await fetchNotesFromScanFolder('folder-123');
    expect(notes?.spot['vehicle.odometer']).toBe('45210');
    expect(notes?.spotDamageRows).toHaveLength(1);
  });

  it('fetchNotesFromScanFolder falls back to _surveyos-backup.json', async () => {
    const { driveRequest } = await import('@/lib/drive');

    // Call 1: list files in folder (only backup.json present, Text only mode)
    vi.mocked(driveRequest)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: 'b1', name: '_surveyos-backup.json' }],
        }),
      } as any)
      // Call 2: download b1
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            app: 'surveyos-scan-backup',
            v: 1,
            claimId: 'scan-1',
            vehicleNo: 'MH12AB1234',
            notes: {
              spot: { 'vehicle.odometer': '55000' },
            },
            rows: [],
          }),
      } as any);

    const notes = await fetchNotesFromScanFolder('folder-123');
    expect(notes?.spot['vehicle.odometer']).toBe('55000');
    expect(notes?.vehicle).toBe('MH12AB1234');
  });
});
