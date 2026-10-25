import { describe, it, expect } from 'vitest';
import { readZip } from '../zip';
import { findManifest, sameVehicle } from '../manifest';
import { buildZip } from './zip-helper';

const manifestJson = (extra: object = {}) =>
  JSON.stringify({ app: 'surveyos-scan', v: 1, vehicle: 'MH 12 AB 1234', insurer: 'X', claimNo: null, exportedAt: 't', files: [], ...extra });

describe('readZip', () => {
  it('readsStoredAndDeflated', async () => {
    const files = await readZip(buildZip([
      { name: 'a/s.txt', data: 'stored text', method: 0 },
      { name: 'a/d.txt', data: 'deflated '.repeat(50), method: 8 },
      { name: 'a/', data: '', method: 0 },
    ]));
    expect([...files.keys()]).toEqual(['a/s.txt', 'a/d.txt']);
    expect(await files.get('a/s.txt')!.text()).toBe('stored text');
    expect(await files.get('a/d.txt')!.text()).toBe('deflated '.repeat(50));
  });
});

describe('findManifest', () => {
  it('refusesNoManifest', async () => {
    const files = await readZip(buildZip([{ name: 'x/a.txt', data: 'hi' }]));
    await expect(findManifest(files)).rejects.toThrow('Not a SurveyOS Scan export');
  });
  it('manifestOneFolderDown', async () => {
    const files = await readZip(buildZip([{ name: 'MH12 Claim/_surveyos-scan.json', data: manifestJson() }]));
    const found = await findManifest(files);
    expect(found.root).toBe('MH12 Claim/');
    expect(found.manifest.vehicle).toBe('MH 12 AB 1234');
  });
  it('manifestAtRoot', async () => {
    const found = await findManifest(await readZip(buildZip([{ name: '_surveyos-scan.json', data: manifestJson() }])));
    expect(found.root).toBe('');
  });
  it('ignoresUnknownKeys', async () => {
    const files = await readZip(buildZip([{ name: 'f/_surveyos-scan.json', data: manifestJson({ future: { a: 1 } }) }]));
    expect((await findManifest(files)).manifest.files).toEqual([]);
  });
});

describe('sameVehicle', () => {
  it('vehicleMatchIgnoresSpacesAndCase', () => {
    expect(sameVehicle('mh 12-ab 1234', 'MH12AB1234')).toBe(true);
    expect(sameVehicle('MH12AB1234', 'MH12AB9999')).toBe(false);
  });
});
