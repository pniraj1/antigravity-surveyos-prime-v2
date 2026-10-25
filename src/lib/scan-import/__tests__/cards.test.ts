import { describe, it, expect } from 'vitest';
import type { ClaimDocument, DocType } from '@/types/documents';
import { cardPhoneState, phoneListGroups } from '../cards';

const doc = (id: string, type: DocType, source: ClaimDocument['source'], addedAt: string): ClaimDocument =>
  ({ id, type, relPath: `${id}.jpg`, mime: 'image/jpeg', size: 1, addedAt, source, devices: ['PC'] });

describe('cardPhoneState', () => {
  const phone = doc('p', 'rc', 'scan', '2026-10-25T10:00:00Z');
  it('noPhoneFileNoState', () => expect(cardPhoneState(null, false)).toBeNull());
  it('unreadCardIsFresh', () => expect(cardPhoneState(phone, false)).toBe('fresh'));
  it('readCardWithoutReadTimeIsPlainRead', () => expect(cardPhoneState(phone, true)).toBeNull());
  it('readCardNewerPhoneFile', () => expect(cardPhoneState(phone, true, '2026-10-25T09:00:00Z')).toBe('newer'));
  it('readCardOlderPhoneFile', () => expect(cardPhoneState(phone, true, '2026-10-25T11:00:00Z')).toBeNull());
});

describe('phoneListGroups', () => {
  it('groupsUncardedScanDocsByType', () => {
    const documents = Object.fromEntries([
      doc('s2', 'spotPhotos', 'scan', '3'),
      doc('rc', 'rc', 'scan', '1'),            // has a card
      doc('s1', 'spotPhotos', 'scan', '2'),
      doc('ch', 'cancelledCheque', 'scan', '4'),
      doc('up', 'estimate', 'upload', '5'),     // not from the phone
    ].map((d) => [d.id, d]));
    const groups = phoneListGroups({ documents });
    expect(groups.map((g) => g.type)).toEqual(['spotPhotos', 'cancelledCheque']);
    expect(groups[0].docs.map((d) => d.id)).toEqual(['s1', 's2']);
  });
  it('emptyWithoutDocuments', () => expect(phoneListGroups({})).toEqual([]));
});
