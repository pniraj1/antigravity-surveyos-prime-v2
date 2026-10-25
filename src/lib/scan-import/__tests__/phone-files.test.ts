import { describe, it, expect } from 'vitest';
import type { ClaimDocument, DocType } from '@/types/documents';
import { phoneFilesOfTypes, photoGroups } from '../phone-files';

const doc = (id: string, type: DocType, source: ClaimDocument['source'], addedAt: string): ClaimDocument =>
  ({ id, type, relPath: `${id}.jpg`, mime: 'image/jpeg', size: 1, addedAt, source, devices: ['PC'] });
const claimOf = (...docs: ClaimDocument[]) => ({ documents: Object.fromEntries(docs.map((d) => [d.id, d])) });

describe('phoneFilesOfTypes', () => {
  it('listsOnlyScanDocsOfTypes', () => {
    const claim = claimOf(
      doc('e', 'estimate', 'scan', '1'),
      doc('s', 'supplementaryEstimate', 'scan', '2'),
      doc('u', 'estimate', 'upload', '3'),
      doc('i', 'invoice', 'scan', '4'),
    );
    expect(phoneFilesOfTypes(claim, ['estimate', 'supplementaryEstimate']).map((d) => d.id).sort()).toEqual(['e', 's']);
  });
  it('newestFirst', () => {
    const claim = claimOf(doc('a', 'invoice', 'scan', '2026-10-25T09:00:00Z'), doc('b', 'invoice', 'scan', '2026-10-25T11:00:00Z'));
    expect(phoneFilesOfTypes(claim, ['invoice']).map((d) => d.id)).toEqual(['b', 'a']);
  });
});

describe('photoGroups', () => {
  it('photoGroupsOrderAndTags', () => {
    const claim = claimOf(
      doc('ch', 'chassisPhoto', 'scan', '1'),
      doc('d2', 'damagePhotos', 'scan', '3'),
      doc('sp', 'spotPhotos', 'scan', '2'),
      doc('d1', 'damagePhotos', 'scan', '2'),
      doc('rc', 'rc', 'scan', '1'),            // not a photo
      doc('fr', 'photoFront', 'photo', '1'),   // not from the phone
    );
    const groups = photoGroups(claim);
    expect(groups.map((g) => [g.type, g.label, g.tag])).toEqual([
      ['damagePhotos', 'Final Photos', 'damage'],
      ['spotPhotos', 'Spot Photos', 'spot'],
      ['chassisPhoto', 'Chassis Number Photo', 'chassis'],
    ]);
    expect(groups[0].docs.map((d) => d.id)).toEqual(['d1', 'd2']);
  });
  it('emptyWhenNone', () => {
    expect(photoGroups({})).toEqual([]);
    expect(phoneFilesOfTypes({}, ['estimate'])).toEqual([]);
  });
});
