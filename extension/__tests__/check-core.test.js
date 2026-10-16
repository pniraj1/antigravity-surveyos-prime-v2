import { describe, it, expect } from 'vitest';
import { planCheck, CHECK_STATUS } from '../src/lib/fill-core.js';
import nia from '../maps/nia-nontieup.json';
import uiic from '../maps/uiic-claimsurvey.json';

const OK = { found: true, bound: true, disabled: false, options: null, current: undefined };
/** fake read from { [modelPath]: partial lookup }; unlisted paths are found+bound. */
function fakeRead(table = {}) {
  const calls = [];
  const get = (p) => ({ ...OK, ...(table[p] ?? {}) });
  return {
    calls,
    lookup: (p) => { calls.push(p); return get(p); },
    current: (p) => get(p).current,
    radioValues: (p) => get(p).options ?? [],
  };
}
const niaPacket = (fields = {}, claimNo = '3101/1') => ({ v: 1, portal: nia.portal, flow: nia.flow, claimNo, builtAt: 0, fields, files: [] });
const byName = (r, n) => r.fields.find((f) => f.name === n);
const firstOfKind = (map, kind) => Object.entries(map.fields).find(([, f]) => f.kind === kind)?.[0];

describe('planCheck', () => {
  it('structure mode with no packet', () => {
    const r = planCheck(nia, null, '3101/1', fakeRead());
    expect(r.mode).toBe('structure');
    expect(CHECK_STATUS).toContain('ready?');
    for (const f of r.fields) {
      expect(f.status).toBe(f.kind === 'text' || f.kind === 'money' ? 'ready?' : 'ready');
      expect(f.label).toBe(nia.fields[f.name].label ?? f.name);
    }
  });

  it('packet for another portal is structure mode', () => {
    const p = { ...niaPacket(), portal: uiic.portal, flow: uiic.flow };
    expect(planCheck(nia, p, '3101/1', fakeRead()).mode).toBe('structure');
  });

  it('wrong claim mode still plans values', () => {
    const r = planCheck(uiic, { ...niaPacket({ surveyTime: '9:05' }, '3101/1'), portal: uiic.portal, flow: uiic.flow }, '3101/2', fakeRead());
    expect(r.mode).toBe('wrongClaim');
    expect(byName(r, 'surveyTimeHours').planned).toBe('09');
  });

  it('status precedence', () => {
    const [a, b, c] = Object.keys(nia.fields).filter((n) => n !== 'surveyPlace');
    const d = 'surveyPlace';
    const p = (n) => nia.fields[n].modelPath;
    const read = fakeRead({
      [p(a)]: { found: false, bound: false },
      [p(b)]: { bound: false, disabled: true },
      [p(c)]: { disabled: true },
      [p(d)]: { current: 'Nashik' },
    });
    const r = planCheck(nia, null, '', read);
    expect(byName(r, a).status).toBe('notFound');
    expect(byName(r, b).status).toBe('notBound');
    expect(byName(r, c).status).toBe('disabled');
    expect(byName(r, d).status).toBe('hasValue');
  });

  it('hasValue when current is non-empty', () => {
    const read = fakeRead({ [nia.fields.surveyPlace.modelPath]: { current: 'Nashik' } });
    expect(byName(planCheck(nia, null, '', read), 'surveyPlace').status).toBe('hasValue');
  });

  it('noOption shows planned and live codes', () => {
    const path = uiic.fields.surveyTimeHours.modelPath;
    const read = fakeRead({ [path]: { options: ['9', '10'] } });
    const p = { v: 1, portal: uiic.portal, flow: uiic.flow, claimNo: '1', builtAt: 0, fields: { surveyTime: '9:05' }, files: [] };
    const f = byName(planCheck(uiic, p, '1', read), 'surveyTimeHours');
    expect(f).toMatchObject({ status: 'noOption', planned: '09', liveOptions: ['9', '10'] });
  });

  it('text fields never carry planned', () => {
    const p = niaPacket({ surveyPlace: 'Nashik' });
    const f = byName(planCheck(nia, p, '3101/1', fakeRead()), 'surveyPlace');
    expect(f).not.toHaveProperty('planned');
    expect(f.status).toBe('ready?');
  });

  it('skip when the packet has no value', () => {
    expect(byName(planCheck(nia, niaPacket(), '3101/1', fakeRead()), 'surveyPlace').status).toBe('skip');
  });

  it('uses the first element of a repeated path', () => {
    const read = fakeRead();
    planCheck(nia, null, '', read);
    const paths = Object.values(nia.fields).map((f) => f.modelPath).concat(Object.values(nia.files).map((f) => f.modelPath));
    expect(read.calls.sort()).toEqual(paths.sort());
  });

  it('file slots', () => {
    const path = nia.files.assessmentExcel.modelPath;
    expect(planCheck(nia, null, '', fakeRead()).files[0]).toEqual({ slot: 'assessmentExcel', status: 'found' });
    expect(planCheck(nia, null, '', fakeRead({ [path]: { disabled: true } })).files[0].status).toBe('disabled');
    expect(planCheck(nia, null, '', fakeRead({ [path]: { found: false } })).files[0].status).toBe('notFound');
  });
});
