import { describe, it, expect } from 'vitest';
import { backupOnlyNotes } from '../backup-notes';

const mapOf = (o: Record<string, string>) => new Map(Object.entries(o).map(([k, v]) => [k, new Blob([v])]));
const backupJsonWithOdometer = (odo: string) => JSON.stringify({
  app: 'surveyos-scan-backup', vehicleNo: 'MH12AB1234', notes: { spot: { 'vehicle.odometer': odo } }, rows: [], updatedAt: '2026-11-11T10:00:00+05:30',
});

describe('backupOnlyNotes', () => {
  it('reads notes from a backup-only zip', async () => {
    const n = await backupOnlyNotes(mapOf({ 'MH02/_surveyos-backup.json': backupJsonWithOdometer('45210') }));
    expect(n?.spot['vehicle.odometer']).toBe('45210');
  });
  it('returns null when the zip has a manifest', async () => {
    expect(await backupOnlyNotes(mapOf({ '_surveyos-scan.json': '{}', '_surveyos-backup.json': '{}' }))).toBeNull();
  });
  it('returns null when neither file is there', async () => {
    expect(await backupOnlyNotes(mapOf({ 'a.jpg': 'x' }))).toBeNull();
  });
  it('throws a clear error when the backup cannot be read', async () => {
    await expect(backupOnlyNotes(mapOf({ '_surveyos-backup.json': 'not json' }))).rejects.toThrow("Couldn't read the notes in this zip.");
  });
});
