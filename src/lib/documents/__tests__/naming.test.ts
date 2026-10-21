import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimDocument } from '@/types/documents';
import { folderNameFor, extForFile, relPathsFor, oldNameFor, docTypeFromRelPath, isScanSkippable, safeFileStem } from '../naming';

describe('safeFileStem', () => {
  it('replaces characters Windows forbids in file names, collapses spaces and trims', () => {
    expect(safeFileStem('Front/Rear/Side Photograph')).toBe('Front-Rear-Side Photograph');
    expect(safeFileStem(' a\\b:c*d?e"f<g>h|i ')).toBe('a-b-c-d-e-f-g-h-i');
    expect(safeFileStem('Spot   Photograph  and Report')).toBe('Spot Photograph and Report');
  });
});

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

describe('docTypeFromRelPath', () => {
  it('reads a top-level file from its own name', () => {
    expect(docTypeFromRelPath('RC Book.pdf')).toBe('rc');
    expect(docTypeFromRelPath('Final Survey Report.pdf')).toBe('surveyReport');
    expect(docTypeFromRelPath('Primary Assessment Template.xlsx')).toBe('niaAssessmentExcel');
  });
  it('ignores case and a numbered suffix', () => {
    expect(docTypeFromRelPath('rc book 2.jpg')).toBe('rc');
    expect(docTypeFromRelPath('Driving Licence 10.jpg')).toBe('dl');
  });
  it('reads a file in a subfolder from the subfolder', () => {
    expect(docTypeFromRelPath('Damage Photos/Damage Photos 3.jpg')).toBe('damagePhotos');
    expect(docTypeFromRelPath('Spot Photos/whatever the camera called it.jpg')).toBe('spotPhotos');
  });
  it('falls back to other', () => {
    expect(docTypeFromRelPath('scan0001.pdf')).toBe('other');
    expect(docTypeFromRelPath('Random Folder/thing.pdf')).toBe('other');
  });
});

describe('isScanSkippable', () => {
  it('skips our own working files and superseded copies', () => {
    expect(isScanSkippable('RC Book.pdf.part')).toBe(true);
    expect(isScanSkippable('_surveyos-sync.json')).toBe(true);
    expect(isScanSkippable('RC Book (old).pdf')).toBe(true);
    expect(isScanSkippable('Final Survey Report (old 3).html')).toBe(true);
  });
  it('skips Portal Upload in any letter case', () => {
    expect(isScanSkippable('Portal Upload/NIA Non-Tieup/RC.pdf')).toBe(true);
    expect(isScanSkippable('portal upload/NIA Non-Tieup/RC.pdf')).toBe(true);
    expect(isScanSkippable('PORTAL UPLOAD/x.pdf')).toBe(true);
  });
  it('keeps ordinary files', () => {
    expect(isScanSkippable('RC Book.pdf')).toBe(false);
    expect(isScanSkippable('_estimate.pdf')).toBe(false);
    expect(isScanSkippable('Damage Photos/Damage Photos 1.jpg')).toBe(false);
  });
});
