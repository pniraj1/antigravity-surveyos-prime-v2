import { describe, it, expect } from 'vitest';
import type { ClaimDocument } from '@/types/documents';
import { recogniseText, recogniseName, knownType, labelEntry } from '../kit/recognise';

const entry = (over: Partial<ClaimDocument> = {}): ClaimDocument => ({
  id: 'd1', type: 'other', relPath: 'scan.pdf', mime: 'application/pdf', size: 100,
  addedAt: '2026-01-01T00:00:00.000Z', source: 'upload', devices: ['PC'], ...over,
});

describe('recogniseText', () => {
  it.each([
    ['rc', 'FORM 23 CERTIFICATE OF REGISTRATION ... Chassis No: MA3EWB22S00 Engine No: K12MN'],
    ['rc', 'Registration Certificate of motor vehicle'],
    ['dl', 'Driving Licence  MH12 2019 0001234'],
    ['dl', 'Licence No MH1220190001234  COV LMV'],
    ['aadhaar', 'Unique Identification Authority of India  1234 5678 9012'],
    ['aadhaar', 'Government of India   1234 5678 9012   Male'],
    ['pan', 'INCOME TAX DEPARTMENT  Permanent Account Number ABCDE1234F'],
    ['pan', 'Income Tax Department  PAN ABCDE1234F'],
    ['invoice', 'TAX INVOICE  GSTIN 27ABCDE1234F1Z5  Invoice No 456'],
    ['invoice', 'GSTIN 27ABCDE1234F1Z5 Invoice No 456'],
    ['estimate', 'ESTIMATE  Labour charges  Parts'],
    ['policy', 'POLICY SCHEDULE  Policy No 12/34'],
    ['policy', 'Policy No 123  IDV Rs 5,00,000'],
    ['cancelledCheque', 'IFSC SBIN0001234  A/C 12345678  Pay ____ or bearer'],
    ['fir', 'FIRST INFORMATION REPORT under section 154 Cr.P.C.'],
    ['claimForm', 'Motor Claim Form  Signature of insured'],
  ] as const)('%s: %s', (type, text) => {
    expect(recogniseText(text)).toBe(type);
  });

  it('ambiguous page returns null', () => {
    expect(recogniseText('TAX INVOICE ... ESTIMATE of labour charges')).toBeNull();
  });

  it('unrelated text returns null', () => {
    expect(recogniseText('Company profile and coverage details')).toBeNull();
    expect(recogniseText('')).toBeNull();
  });
});

describe('recogniseName', () => {
  it('maps names to types and other to null', () => {
    expect(recogniseName('RC Book.pdf')).toBe('rc');
    expect(recogniseName('scan123.pdf')).toBeNull();
  });
});

describe('knownType', () => {
  it('generated and photo sources are known', () => {
    expect(knownType(entry({ type: 'surveyReport', source: 'generated' }))).toBe('surveyReport');
    expect(knownType(entry({ type: 'damagePhotos', source: 'photo', relPath: 'Damage Photos/Damage Photos 1.jpg' }))).toBe('damagePhotos');
  });
  it('field uploads are known when named like saveDocuments names them', () => {
    expect(knownType(entry({ type: 'rc', relPath: 'RC Book.pdf' }))).toBe('rc');
    expect(knownType(entry({ type: 'rc', relPath: 'RC Book 2.pdf' }))).toBe('rc');
  });
  it('a hand-named upload is not known', () => {
    expect(knownType(entry({ type: 'rc', relPath: 'my rc.pdf' }))).toBeNull();
    expect(knownType(entry({ type: 'other', relPath: 'Other.pdf' }))).toBeNull();
  });
});

describe('labelEntry', () => {
  it('generated file is known and confirmed', () => {
    const out = labelEntry(entry({ type: 'feeBill', source: 'generated', pageCount: 2 }), null);
    expect(out.pages).toEqual({
      1: { type: 'feeBill', by: 'known', confirmed: true },
      2: { type: 'feeBill', by: 'known', confirmed: true },
    });
  });

  it('keeps existing labels', () => {
    const mine = { type: 'pan' as const, by: 'surveyor' as const, confirmed: true };
    const out = labelEntry(entry({ pageCount: 2, pages: { 1: mine } }), ['Registration Certificate', 'Registration Certificate']);
    expect(out.pages?.[1]).toBe(mine);
    expect(out.pages?.[2]).toEqual({ type: 'rc', by: 'text', confirmed: false });
  });

  it('html is never labelled', () => {
    const e = entry({ type: 'surveyReport', source: 'generated', mime: 'text/html', relPath: 'Final Survey Report.html' });
    expect(labelEntry(e, null)).toBe(e);
  });

  it('name applies only when no page got a text label', () => {
    const named = entry({ relPath: 'RC Book.pdf' });
    const withText = labelEntry(named, ['Registration Certificate', 'blank page']);
    expect(withText.pages?.[1]?.by).toBe('text');
    expect(withText.pages?.[2]).toBeUndefined();
    const noText = labelEntry(named, ['blank', 'blank']);
    expect(noText.pages?.[1]).toEqual({ type: 'rc', by: 'name', confirmed: false });
    expect(noText.pages?.[2]).toEqual({ type: 'rc', by: 'name', confirmed: false });
  });

  it('a single-page file takes its name', () => {
    const out = labelEntry(entry({ relPath: 'Aadhaar.jpg', mime: 'image/jpeg' }), null);
    expect(out.pages).toEqual({ 1: { type: 'aadhaar', by: 'name', confirmed: false } });
  });

  it('unrecognised pages stay unlabelled', () => {
    const e = entry({ relPath: 'scan.pdf' });
    expect(labelEntry(e, ['blank', 'blank'])).toBe(e);
  });
});
