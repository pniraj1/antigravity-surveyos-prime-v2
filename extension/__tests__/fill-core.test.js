import { describe, it, expect } from 'vitest';
import { normaliseClaimNo, transforms, isEmptyValue, decide, planFill, mapId, pickMap, scopeAnchors, selectMatched } from '../src/lib/fill-core.js';
import map from '../maps/nia-nontieup.json';

describe('normaliseClaimNo', () => {
  it('uppercases and strips everything but letters and digits', () => {
    expect(normaliseClaimNo(' 3101/00312/24-c ')).toBe('31010031224C');
    expect(normaliseClaimNo('3101 00312 24C')).toBe('31010031224C');
  });
});

describe('transforms', () => {
  it('ddmmyyyy accepts ISO, ISO datetime and already-dmy', () => {
    expect(transforms.ddmmyyyy('2026-09-18')).toBe('18/09/2026');
    expect(transforms.ddmmyyyy('2026-09-18T14:30:00Z')).toBe('18/09/2026');
    expect(transforms.ddmmyyyy('18/09/2026')).toBe('18/09/2026');
  });
  it('hhmm pads and strips seconds', () => {
    expect(transforms.hhmm('9:05')).toBe('09:05');
    expect(transforms.hhmm('14:30:00')).toBe('14:30');
  });
  it('money2dp', () => {
    expect(transforms.money2dp(1234.5)).toBe('1234.50');
    expect(transforms.money2dp('0')).toBe('0.00');
  });
  it('yn maps truthy strings', () => {
    expect(transforms.yn('Y')).toBe('Y');
    expect(transforms.yn(true)).toBe('Y');
    expect(transforms.yn('N')).toBe('N');
  });
});

describe('isEmptyValue / decide (E4)', () => {
  it('portal defaults count as empty', () => {
    expect(isEmptyValue('', '')).toBe(true);
    expect(isEmptyValue(null, '')).toBe(true);
    expect(isEmptyValue(undefined, null)).toBe(true);
    expect(isEmptyValue('N', 'N')).toBe(true);
    expect(isEmptyValue(0, '')).toBe(true);
    expect(isEmptyValue('0', '')).toBe(true);
  });
  it('a human-set value is not empty', () => {
    expect(isEmptyValue('Pune', '')).toBe(false);
    expect(isEmptyValue('Y', 'N')).toBe(false);
    expect(isEmptyValue(1500, '')).toBe(false);
  });
  it('decide', () => {
    expect(decide('', '', 'Pune')).toBe('fill');
    expect(decide('Nashik', '', 'Pune')).toBe('kept');
    expect(decide('Pune', '', 'Pune')).toBe('same');
    expect(decide(new Date('2026-09-18'), null, '18/09/2026')).toBe('kept');
  });
});

describe('planFill', () => {
  const packet = {
    v: 1, portal: 'nia', flow: 'nontieup', claimNo: '1', builtAt: '',
    fields: { surveyDate: '2026-09-18', surveyPlace: 'Pune', netSalvage: 300, paintingAssessed: 2000, paintingEstimate: 2000, feeGstApplicable: 'Y', noOfInvoices: '1' },
    files: [],
  };
  const read = (current = {}, radios = {}) => ({
    current: (p) => current[p],
    radioValues: (p) => radios[p] ?? [],
  });

  it('fills empty fields with transformed values, in map order', () => {
    const steps = planFill(map, packet, read({}, { [map.fields.surveyDateRadio.modelPath]: ['16/09/2026', '17/09/2026', '18/09/2026', 'Others'] }));
    const by = Object.fromEntries(steps.map((s) => [s.name, s]));
    expect(by.surveyPlace).toMatchObject({ action: 'fill', value: 'Pune' });
    expect(by.netSalvage).toMatchObject({ action: 'fill', value: '300.00' });
    expect(by.surveyDate).toMatchObject({ action: 'fill', value: '18/09/2026' });
    expect(by.feeGstApplicable).toMatchObject({ action: 'fill', value: 'Y' });
    expect(steps.findIndex((s) => s.name === 'surveyDateRadio')).toBeLessThan(steps.findIndex((s) => s.name === 'surveyDate'));
  });

  it('fills the invoice count before any invoice field', () => {
    const steps = planFill(map, packet, read());
    const i = steps.findIndex((s) => s.name === 'noOfInvoices');
    const j = steps.findIndex((s) => s.modelPath.includes('multiInvoice['));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(j);
  });

  it('dateRadioOrOthers picks the matching radio, else Others', () => {
    const radios = { [map.fields.surveyDateRadio.modelPath]: ['16/09/2026', '17/09/2026', '18/09/2026', 'Others'] };
    const a = planFill(map, packet, read({}, radios)).find((s) => s.name === 'surveyDateRadio');
    expect(a).toMatchObject({ action: 'fill', value: '18/09/2026' });
    const old = { ...packet, fields: { ...packet.fields, surveyDate: '2026-01-01' } };
    const b = planFill(map, old, read({}, radios)).find((s) => s.name === 'surveyDateRadio');
    expect(b).toMatchObject({ action: 'fill', value: 'Others' });
  });

  it('constant fields fire only when onlyIf is present', () => {
    const withPaint = planFill(map, packet, read()).find((s) => s.name === 'paintingWork');
    expect(withPaint).toMatchObject({ action: 'fill', value: 'CONSOLIDATED' });
    const noPaint = { ...packet, fields: { surveyPlace: 'Pune' } };
    const without = planFill(map, noPaint, read()).find((s) => s.name === 'paintingWork');
    expect(without).toMatchObject({ action: 'skip' });
  });

  it('keeps human-set values and marks same', () => {
    const cur = { [map.fields.surveyPlace.modelPath]: 'Nashik', [map.fields.netSalvage.modelPath]: '300' };
    const steps = planFill(map, packet, read(cur));
    expect(steps.find((s) => s.name === 'surveyPlace')).toMatchObject({ action: 'kept', current: 'Nashik' });
    expect(steps.find((s) => s.name === 'netSalvage')).toMatchObject({ action: 'same' });
  });

  it('skips fields absent from the packet and truncates to maxLen', () => {
    const steps = planFill(map, { ...packet, fields: { surveyPlace: 'x'.repeat(150) } }, read());
    expect(steps.find((s) => s.name === 'surveyPlace').value).toHaveLength(100);
    expect(steps.find((s) => s.name === 'claimantMobile')).toMatchObject({ action: 'skip' });
  });
});

describe('pickMap', () => {
  const nontieup = { portal: 'nia', flow: 'nontieup', host: 'web.newindia.co.in', route: '#/WorklistSurveyNew' };
  const maruti   = { portal: 'nia', flow: 'maruti',   host: 'web.newindia.co.in', route: '#/WorklistSurvey' };
  const uiic     = { portal: 'uiic', flow: 'claimsurvey', host: 'portal.uiic.in', route: '#/SurveyorClaimSurvey' };
  const maps = { 'nia-maruti': maruti, 'nia-nontieup': nontieup, 'uiic-claimsurvey': uiic };
  it('exact route wins over a prefix', () => {
    expect(pickMap(maps, 'web.newindia.co.in', '#/WorklistSurveyNew')).toBe(nontieup);
    expect(pickMap(maps, 'web.newindia.co.in', '#/WorklistSurvey')).toBe(maruti);
  });
  it('ignores a query or sub-path after the route', () => {
    expect(pickMap(maps, 'web.newindia.co.in', '#/WorklistSurveyNew?id=4')).toBe(nontieup);
    expect(pickMap(maps, 'portal.uiic.in', '#/SurveyorClaimSurvey/2')).toBe(uiic);
  });
  it('host must match', () => {
    expect(pickMap(maps, 'portal.uiic.in', '#/WorklistSurveyNew')).toBeNull();
  });
  it('a file:// fixture (empty host) matches on route alone', () => {
    expect(pickMap(maps, '', '#/WorklistSurveyNew')).toBe(nontieup);
  });
  it('unknown route is null', () => {
    expect(pickMap(maps, 'web.newindia.co.in', '#/Worklist')).toBeNull();
  });
});
it('mapId', () => expect(mapId({ portal: 'nia', flow: 'nontieup' })).toBe('nia-nontieup'));

describe('scopeAnchors', () => {
  it('claim-number path first, then every mapped field, without duplicates', () => {
    const m = { claimNoPath: 'a.claimNumber', fields: { x: { modelPath: 'a.x' }, y: { modelPath: 'a.claimNumber' } } };
    expect(scopeAnchors(m)).toEqual(['a.claimNumber', 'a.x']);
  });
  it('skips a sessionStorage claim path, which no element carries', () => {
    const m = { claimNoPath: 'sessionStorage:k', fields: { x: { modelPath: 'a.x' } } };
    expect(scopeAnchors(m)).toEqual(['a.x']);
  });
});

describe('UIIC transforms', () => {
  it('uiicText keeps only letters, digits, dot and space', () => {
    expect(transforms.uiicText('Plot 4, MIDC-Nashik (W)')).toBe('Plot 4 MIDCNashik W');
  });
  it('uiicText collapses spaces, trims and cuts to 500', () => {
    expect(transforms.uiicText('  a   b  ')).toBe('a b');
    expect(transforms.uiicText('a'.repeat(600))).toHaveLength(500);
  });
  it('uiicText takes non-strings via String(v ?? "")', () => {
    expect(transforms.uiicText(null)).toBe('');
    expect(transforms.uiicText(42)).toBe('42');
  });
  it('hour and minute split H:MM and H:MM:SS', () => {
    expect(transforms.hour('9:05')).toBe('09');   expect(transforms.minute('9:05')).toBe('05');
    expect(transforms.hour('14:30:00')).toBe('14'); expect(transforms.minute('14:30:00')).toBe('30');
  });
  it('hour and minute are empty when unparseable', () => {
    expect(transforms.hour('')).toBe('');
    expect(transforms.minute('soon')).toBe('');
  });
});

describe('planFill from', () => {
  it('any field with from reads fields[from] instead of fields[name]', () => {
    const m = { fields: { surveyTimeHours: { modelPath: 'a.h', kind: 'select', from: 'surveyTime', transform: 'hour', empty: '' } } };
    const steps = planFill(m, { fields: { surveyTime: '9:05' } }, { current: () => undefined, radioValues: () => [] });
    expect(steps[0]).toMatchObject({ action: 'fill', value: '09' });
  });
});

describe('selectMatched', () => {
  it('is false for an unknown-option render, true for a real option (even empty)', () => {
    expect(selectMatched('09')).toBe(true);
    expect(selectMatched('? string:09 ?')).toBe(false);
    expect(selectMatched(undefined)).toBe(false);
    expect(selectMatched(null)).toBe(false);
    expect(selectMatched('')).toBe(true);
  });
});
