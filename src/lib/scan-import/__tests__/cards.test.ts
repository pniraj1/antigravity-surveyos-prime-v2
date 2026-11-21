import { describe, it, expect } from 'vitest';
import type { ClaimDocument, DocType } from '@/types/documents';
import { cardIdFor, cardPhoneState, phoneFileFor, phoneListGroups } from '../cards';

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
  it('invoiceHasNoCardSoPhoneBillsAreListed', () => {
    const bill = doc('b1', 'invoice', 'scan', '1');
    expect(cardIdFor('invoice')).toBeNull();
    expect(phoneListGroups({ documents: { b1: bill } }).map((g) => g.type)).toEqual(['invoice']);
  });
  it('emptyWithoutDocuments', () => expect(phoneListGroups({})).toEqual([]));
});

describe('phoneFileFor other-type cards (matched by file name)', () => {
  const named = (id: string, relPath: string, source: ClaimDocument['source'] = 'scan', addedAt = '1'): ClaimDocument =>
    ({ ...doc(id, 'other', source, addedAt), relPath });
  const claimOf = (...ds: ClaimDocument[]) => ({ documents: Object.fromEntries(ds.map((d) => [d.id, d])) });

  it('authFileGoesToAuthOnly', () => {
    const c = claimOf(named('a', 'Authorization.pdf'));
    expect(phoneFileFor(c, 'auth')?.id).toBe('a');
    expect(phoneFileFor(c, 'load-challan')).toBeNull();
  });
  it('loadChallanFileGoesToLoadChallanOnly', () => {
    const c = claimOf(named('l', 'Load Challan.pdf'));
    expect(phoneFileFor(c, 'load-challan')?.id).toBe('l');
    expect(phoneFileFor(c, 'auth')).toBeNull();
  });
  it('newestMatchWins', () => {
    const c = claimOf(named('old', 'Auth.pdf', 'scan', '1'), named('new', 'Authority letter.pdf', 'scan', '2'));
    expect(phoneFileFor(c, 'auth')?.id).toBe('new');
  });
  it('unrelatedNameMatchesNoCard', () => {
    const c = claimOf(named('i', 'Insurance letter.pdf'));
    expect(phoneFileFor(c, 'auth')).toBeNull();
    expect(phoneFileFor(c, 'load-challan')).toBeNull();
  });
  it('uploadSourceIsIgnored', () => {
    expect(phoneFileFor(claimOf(named('u', 'Authorization.pdf', 'upload')), 'auth')).toBeNull();
  });
  it('subfolderPathStillMatches', () => {
    expect(phoneFileFor(claimOf(named('s', 'Other/Authorization 2.pdf')), 'auth')?.id).toBe('s');
  });
});
