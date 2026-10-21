import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType, PageLabel } from '@/types/documents';
import { recipeFor, RECIPES } from '../kit/recipes';
import type { Recipe } from '../kit/recipes';
import { checklist, missingMessage } from '../kit/checklist';

const DEV = 'PC1';
const confirmed = (type: DocType, over: Partial<PageLabel> = {}): PageLabel => ({ type, by: 'text', confirmed: true, ...over });

function doc(id: string, type: DocType, pages: Record<number, PageLabel> | undefined, over: Partial<ClaimDocument> = {}): ClaimDocument {
  return {
    id, type, relPath: `${id}.pdf`, mime: 'application/pdf', size: 1, addedAt: '2026-10-01T00:00:00Z',
    source: 'upload', devices: [DEV], ...(pages ? { pages } : {}), ...over,
  };
}

function claim(docs: ClaimDocument[], over: Partial<ClaimData> = {}): ClaimData {
  const c = createBlankClaim();
  return {
    ...c,
    policy: { ...c.policy, insurerName: 'The New India Assurance Co. Ltd.', claimNumber: 'CL/77' },
    vehicle: { ...c.vehicle, registrationNumber: 'MH-18-AB-1234' },
    documents: Object.fromEntries(docs.map((d) => [d.id, d])),
    ...(over.portalFlow ? { portalFlow: over.portalFlow } : {}),
    ...(over.notNeededBoxes ? { notNeededBoxes: over.notNeededBoxes } : {}),
  };
}

const nia = (): Recipe => RECIPES.find((r) => r.portal === 'nia' && r.flow === 'nontieup')!;
const run = (c: ClaimData, identity = {}) => checklist(nia(), c, { device: DEV, identity });
const state = (c: ClaimData, id: string, identity = {}) => run(c, identity).find((s) => s.box.id === id)!;

describe('recipeFor', () => {
  it('recipeFor picks nia non-tieup by default and kia when portalFlow is kia', () => {
    expect(recipeFor(claim([]))).toMatchObject({ portal: 'nia', flow: 'nontieup' });
    expect(recipeFor(claim([], { portalFlow: 'kia' }))).toMatchObject({ portal: 'nia', flow: 'kia', provisional: true });
    const uiic = claim([]);
    uiic.policy.insurerName = 'United India Insurance Company Limited';
    expect(recipeFor(uiic)).toMatchObject({ portal: 'uiic', flow: 'claimsurvey' });
  });

  it('recipeFor returns null for an insurer with no recipe', () => {
    const c = claim([]);
    c.policy.insurerName = 'HDFC ERGO General Insurance';
    expect(recipeFor(c)).toBeNull();
  });
});

describe('checklist', () => {
  it('checklist: ready when all confirmed', () => {
    const s = state(claim([doc('d1', 'rc', { 1: confirmed('rc'), 2: confirmed('rc') })]), 'rc');
    expect(s).toMatchObject({ status: 'ready', parts: [{ docId: 'd1', pages: [1, 2] }], reasons: [], alternatives: 0 });
  });

  it('checklist: guess makes check with reason', () => {
    const s = state(claim([doc('d1', 'rc', { 1: confirmed('rc', { confirmed: false, by: 'name' }) })]), 'rc');
    expect(s.status).toBe('check');
    expect(s.reasons).toEqual(['RC Book is a guess. Confirm it in Pages.']);
  });

  it('checklist: merge box missing mandatory parts', () => {
    const s = state(claim([doc('d1', 'cancelledCheque', { 1: confirmed('cancelledCheque') })]), 'claimRelatedDocs');
    expect(s.status).toBe('missing');
    expect(s.missingTypes).toEqual(['aadhaar', 'policy']);
    expect(s.parts).toEqual([{ docId: 'd1', pages: [1] }]);
  });

  it('checklist: merge box ready when mandatory parts present, in accepts order', () => {
    const s = state(claim([
      doc('a', 'aadhaar', { 1: confirmed('aadhaar') }, { addedAt: '2026-10-01T00:00:00Z' }),
      doc('p', 'policy', { 1: confirmed('policy'), 3: confirmed('policy') }, { addedAt: '2026-10-02T00:00:00Z' }),
    ]), 'claimRelatedDocs');
    expect(s.status).toBe('ready');
    expect(s.missingTypes).toEqual([]);
    expect(s.parts).toEqual([{ docId: 'p', pages: [1, 3] }, { docId: 'a', pages: [1] }]);
  });

  it('checklist: html-only report is check with File the PDF', () => {
    const html = doc('r', 'surveyReport', undefined, { mime: 'text/html', relPath: 'Final Survey Report.html', source: 'generated' });
    const s = state(claim([html]), 'others');
    expect(s.status).toBe('check');
    expect(s.reasons).toContain('File the PDF of this report.');
    expect(s.parts).toEqual([{ docId: 'r', pages: [] }]);
  });

  it('checklist: a real PDF beats the html placeholder', () => {
    const html = doc('r', 'surveyReport', undefined, { mime: 'text/html', relPath: 'Final Survey Report.html' });
    const pdf = doc('r2', 'surveyReport', { 1: confirmed('surveyReport') }, { addedAt: '2026-09-01T00:00:00Z' });
    expect(state(claim([html, pdf]), 'others')).toMatchObject({ status: 'ready', parts: [{ docId: 'r2', pages: [1] }] });
  });

  it('checklist: not needed box', () => {
    const c = claim([], { notNeededBoxes: { 'nia-nontieup': ['dl'] } });
    expect(state(c, 'dl').status).toBe('notNeeded');
    expect(state(c, 'rc').status).toBe('missing');
    expect(state(c, 'puc').status).toBe('empty');
  });

  it('checklist: newest wins and alternatives counted', () => {
    const c = claim([
      doc('old', 'rc', { 1: confirmed('rc') }, { addedAt: '2026-10-01T00:00:00Z' }),
      doc('new', 'rc', { 2: confirmed('rc') }, { addedAt: '2026-10-05T00:00:00Z' }),
      doc('mid', 'rc', { 1: confirmed('rc') }, { addedAt: '2026-10-03T00:00:00Z' }),
    ]);
    expect(state(c, 'rc')).toMatchObject({ parts: [{ docId: 'new', pages: [2] }], alternatives: 2 });
  });

  it('checklist: a single box takes the newest confirmed file over a newer guess', () => {
    const c = claim([
      doc('old', 'rc', { 1: confirmed('rc') }, { addedAt: '2026-10-01T00:00:00Z' }),
      doc('new', 'rc', { 1: confirmed('rc', { confirmed: false }) }, { addedAt: '2026-10-05T00:00:00Z' }),
    ]);
    expect(state(c, 'rc')).toMatchObject({ status: 'ready', parts: [{ docId: 'old', pages: [1] }], alternatives: 1 });
  });

  it('checklist: with no confirmed file the newest guess is picked and needs a check', () => {
    const c = claim([
      doc('old', 'rc', { 1: confirmed('rc', { confirmed: false }) }, { addedAt: '2026-10-01T00:00:00Z' }),
      doc('new', 'rc', { 1: confirmed('rc', { confirmed: false }) }, { addedAt: '2026-10-05T00:00:00Z' }),
    ]);
    expect(state(c, 'rc')).toMatchObject({ status: 'check', parts: [{ docId: 'new', pages: [1] }] });
  });

  it('checklist: a merge names a Word file only when no PDF or image of that type was picked', () => {
    const docx = doc('w', 'surveyReport', undefined, { mime: 'application/msword', relPath: 'Report.docx' });
    const pdf = doc('p', 'surveyReport', { 1: confirmed('surveyReport') });
    expect(state(claim([docx, pdf]), 'others')).toMatchObject({ status: 'ready', reasons: [], parts: [{ docId: 'p', pages: [1] }] });
  });

  it('checklist: entries not on this device are ignored', () => {
    const c = claim([doc('d1', 'rc', { 1: confirmed('rc') }, { devices: ['PC2'] })]);
    expect(state(c, 'rc').status).toBe('missing');
  });

  it('checklist: mismatch without override is check', () => {
    const c = claim([doc('d1', 'rc', { 1: confirmed('rc') })]);
    const s = state(c, 'rc', { d1: { 1: { status: 'mismatch', found: 'MH12XY9999', expected: 'MH18AB1234' } } });
    expect(s.status).toBe('check');
    expect(s.reasons).toEqual(["RC Book doesn't match this claim."]);
    const overridden = claim([doc('d1', 'rc', { 1: confirmed('rc', { overrideAt: '2026-10-02T00:00:00Z' }) })]);
    expect(state(overridden, 'rc', { d1: { 1: { status: 'mismatch' } } })).toMatchObject({ status: 'ready', reasons: [] });
  });

  it('checklist: word and excel allowed in single boxes that list the extension, dropped from merges', () => {
    const xlsx = doc('x', 'estimate', undefined, { mime: 'application/vnd.ms-excel', relPath: 'NIA Estimate.xlsx' });
    const recipe: Recipe = {
      portal: 'nia', flow: 'nontieup', title: 't',
      boxes: [
        { id: 'xl', label: 'Excel', mandatory: true, accepts: ['estimate'], combine: 'single', formats: ['.xlsx'] },
        { id: 'pdfOnly', label: 'PDF', mandatory: true, accepts: ['estimate'], combine: 'single', formats: ['.pdf'] },
      ],
    };
    const [xl, pdfOnly] = checklist(recipe, claim([xlsx]), { device: DEV, identity: {} });
    expect(xl).toMatchObject({ status: 'ready', parts: [{ docId: 'x', pages: [] }] });
    expect(pdfOnly).toMatchObject({ status: 'missing', parts: [] });
    const docx = doc('w', 'surveyReport', undefined, { mime: 'application/msword', relPath: 'Report.docx' });
    const s = state(claim([docx]), 'others');
    expect(s.parts).toEqual([]);
    expect(s.reasons).toEqual(["Report.docx can't be merged (Word/Excel)."]);
    // with another part present, the box needs a look rather than silently leaving the Word file out
    const fee = doc('f', 'feeBill', { 1: confirmed('feeBill') });
    expect(state(claim([docx, fee]), 'others')).toMatchObject({ status: 'check', parts: [{ docId: 'f', pages: [1] }] });
  });
});

describe('missingMessage', () => {
  it('missingMessage exact text', () => {
    const recipe: Recipe = {
      portal: 'nia', flow: 'nontieup', title: 't',
      boxes: [
        { id: 'rc', label: 'RC', mandatory: true, accepts: ['rc'], combine: 'single', formats: [] },
        { id: 'chassisPhoto', label: 'Chassis', mandatory: true, accepts: ['chassisPhoto'], combine: 'single', formats: [] },
        { id: 'pan', label: 'PAN', mandatory: true, accepts: ['pan'], combine: 'single', formats: [] },
      ],
    };
    const c = claim([doc('d1', 'rc', { 1: confirmed('rc') })]);
    const states = checklist(recipe, c, { device: DEV, identity: {} });
    expect(missingMessage(c, states)).toBe(
      'Claim CL/77 (MH-18-AB-1234): please send the following documents: Chassis Number Photo, PAN Card.',
    );
  });

  it('missingMessage lists merge missing types and is empty when nothing is missing', () => {
    const c = claim([doc('d1', 'cancelledCheque', { 1: confirmed('cancelledCheque') })]);
    expect(missingMessage(c, run(c))).toBe(
      'Claim CL/77 (MH-18-AB-1234): please send the following documents: Driving Licence, RC Book, Claim Form, Chassis Number Photo, Odometer Photo, Aadhaar Card, Policy Schedule.',
    );
    expect(missingMessage(c, [])).toBe('');
  });

  it('missingMessage leaves out an empty claim number or registration without a double space', () => {
    const c = claim([]);
    const states = run(c).filter((s) => s.box.id === 'rc');
    expect(missingMessage({ ...c, policy: { ...c.policy, claimNumber: '' } }, states))
      .toBe('Claim (MH-18-AB-1234): please send the following documents: RC Book.');
    expect(missingMessage({ ...c, vehicle: { ...c.vehicle, registrationNumber: ' ' } }, states))
      .toBe('Claim CL/77: please send the following documents: RC Book.');
    expect(missingMessage({ ...c, policy: { ...c.policy, claimNumber: '' }, vehicle: { ...c.vehicle, registrationNumber: '' } }, states))
      .toBe('Claim: please send the following documents: RC Book.');
  });
});
