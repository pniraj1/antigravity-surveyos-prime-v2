import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimDocument } from '@/types/documents';
import { folderNameFor, extForFile, relPathsFor, oldNameFor } from '../naming';

const existing = (relPaths: string[], type: ClaimDocument['type'] = 'damagePhotos'): ClaimDocument[] =>
  relPaths.map((relPath, i) => ({ id: `d${i}`, type, relPath, mime: 'image/jpeg', size: 1, addedAt: '', source: 'photo', devices: [] }));

describe('folderNameFor', () => {
  it('is sticky once set', () => {
    const c = createBlankClaim(); c.documentsFolder = 'KEEP-ME';
    c.vehicle.registrationNumber = 'MH12AB1234'; c.policy.insurerName = 'New India Assurance';
    expect(folderNameFor(c)).toBe('KEEP-ME');
  });
  it('is registration + insurer short form', () => {
    const c = createBlankClaim();
    c.vehicle.registrationNumber = 'MH12AB1234';
    c.policy.insurerName = 'The New India Assurance Company Limited';
    expect(folderNameFor(c)).toBe('MH12AB1234 - NIA');
  });
  it('drops the part it does not have', () => {
    const c = createBlankClaim();
    c.vehicle.registrationNumber = 'MH12AB1234';
    expect(folderNameFor(c)).toBe('MH12AB1234');
    c.vehicle.registrationNumber = ''; c.policy.insurerName = 'United India Insurance Co. Ltd.';
    expect(folderNameFor(c)).toBe('UIIC');
  });
  it('falls back to the claim number, then to claim', () => {
    const c = createBlankClaim();
    c.policy.claimNumber = '3101/00312/24-C';
    expect(folderNameFor(c)).toBe('3101 00312 24-C');
    c.policy.claimNumber = '';
    expect(folderNameFor(c)).toBe('claim');
  });
  it('sanitises a registration with stray characters', () => {
    const c = createBlankClaim();
    c.vehicle.registrationNumber = 'MH/12 AB*1234'; c.policy.insurerName = 'National Insurance';
    expect(folderNameFor(c)).toBe('MH 12 AB 1234 - NIC');
  });
});

describe('extForFile', () => {
  it('prefers mime, falls back to the file name, then bin', () => {
    expect(extForFile('application/pdf')).toBe('pdf');
    expect(extForFile('image/png')).toBe('png');
    expect(extForFile('image/jpeg')).toBe('jpg');
    expect(extForFile('text/html')).toBe('html');
    expect(extForFile('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('xlsx');
    expect(extForFile('application/msword')).toBe('doc');
    expect(extForFile('', 'scan.HEIC')).toBe('heic');
    expect(extForFile('', 'noext')).toBe('bin');
  });
});

describe('relPathsFor', () => {
  it('single-file type, one file → flat label', () => {
    expect(relPathsFor('rc', [{ mime: 'application/pdf' }], [])).toEqual(['RC Book.pdf']);
  });
  it('single-file type, batch → numbered flat files', () => {
    expect(relPathsFor('rc', [{ mime: 'image/jpeg' }, { mime: 'image/jpeg' }], [])).toEqual(['RC Book 1.jpg', 'RC Book 2.jpg']);
  });
  it('multi-file type → subfolder, numbering continues after the highest existing', () => {
    const ex = existing(['Damage Photos/Damage Photos 1.jpg', 'Damage Photos/Damage Photos 7.jpg']);
    expect(relPathsFor('damagePhotos', [{ mime: 'image/jpeg' }, { mime: 'image/png' }], ex))
      .toEqual(['Damage Photos/Damage Photos 8.jpg', 'Damage Photos/Damage Photos 9.png']);
  });
  it('multi-file numbering ignores other types', () => {
    const ex = existing(['Spot Photos/Spot Photos 3.jpg'], 'spotPhotos');
    expect(relPathsFor('damagePhotos', [{ mime: 'image/jpeg' }], ex)).toEqual(['Damage Photos/Damage Photos 1.jpg']);
  });
});

describe('oldNameFor', () => {
  it('inserts (old) before the extension and counts up when taken', () => {
    expect(oldNameFor('RC Book.pdf', new Set())).toBe('RC Book (old).pdf');
    expect(oldNameFor('RC Book.pdf', new Set(['RC Book (old).pdf']))).toBe('RC Book (old 2).pdf');
    expect(oldNameFor('Final Survey Report.html', new Set(['Final Survey Report (old).html', 'Final Survey Report (old 2).html']))).toBe('Final Survey Report (old 3).html');
  });
});
