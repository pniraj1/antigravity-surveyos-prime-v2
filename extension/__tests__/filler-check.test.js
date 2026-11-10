// Page-script `check` handler, run in a vm with a fake AngularJS page. Every fake
// records writes, so "read-only" is asserted rather than assumed.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(__dirname, '..');
const map = require('../maps/nia-nontieup.json');
const WRITE_APIS = ['$setViewValue', '$render', '$apply', '$evalAsync', '$digest', 'dispatchEvent'];

function harness({ scopeAvailable = true, angularPresent = true, dup = null, selectOptions = ['Y', 'N'] } = {}) {
  const writes = [];
  const sent = [];
  let onMessage;
  /** Proxy: any property set, or any call to a write API, is recorded. */
  const rec = (name, target) => new Proxy(target, {
    set(t, k, v) { writes.push(`${name}.${String(k)}=`); t[k] = v; return true; },
    get(t, k) {
      if (WRITE_APIS.includes(k)) return () => { writes.push(`${name}.${k}()`); };
      return t[k];
    },
  });

  const claimPath = map.claimNoPath;
  const values = { [claimPath]: 'CLM-1', [map.invoiceCountPath]: [{}] };
  const scope = rec('scope', { $root: {} });
  const ctrls = new Map();
  const elsByPath = new Map();
  const paths = [...Object.values(map.fields).map((f) => f.modelPath), ...Object.values(map.files).map((f) => f.modelPath)];
  for (const p of paths) {
    const f = Object.values(map.fields).find((x) => x.modelPath === p);
    const mk = (extra) => {
      const el = rec(`el(${p})`, { tagName: 'INPUT', type: 'text', value: '', disabled: false, style: rec(`style(${p})`, {}), ...extra });
      ctrls.set(el, rec(`ctrl(${p})`, { $modelValue: undefined, $error: {} }));
      return el;
    };
    if (f?.kind === 'select') elsByPath.set(p, [mk({ tagName: 'SELECT', options: selectOptions.map((value) => ({ value })) })]);
    else if (f?.kind === 'dateRadioOrOthers') elsByPath.set(p, [mk({ type: 'radio', value: 'Others' }), mk({ type: 'radio', value: '01/01/2026' })]);
    else elsByPath.set(p, [mk({})]);
  }
  if (dup) elsByPath.set(dup.path, dup.els.map((extra) => {
    const el = rec('dup', { tagName: 'INPUT', type: 'text', value: '', disabled: false, style: rec('style(dup)', {}), ...extra });
    ctrls.set(el, rec('dupctrl', { $modelValue: undefined, $error: {} }));
    return el;
  }));

  const ctx = vm.createContext({
    sessionStorage: { getItem: () => null },
    Event: class {}, DataTransfer: class {}, File: class {},
    document: {
      body: {},
      querySelector: () => ({}),
      querySelectorAll: (sel) => elsByPath.get(/ng-model="([^"]+)"/.exec(sel)?.[1]) ?? [],
    },
    angular: {},
  });
  ctx.angular.element = (el) => ({
    scope: () => (scopeAvailable ? scope : undefined),
    controller: () => ctrls.get(el) ?? null,
    injector: () => ({ get: () => (p) => () => values[p] }),
  });
  ctx.window = {
    addEventListener: (t, h) => { if (t === 'message') onMessage = h; },
    postMessage: (m) => sent.push(m),
  };
  ctx.globalThis = ctx;
  if (!angularPresent) ctx.angular = undefined;
  for (const f of ['src/lib/fill-core.js', 'src/filler.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const send = (data) => { onMessage({ source: ctx.window, data: { sx: 's1', ...data } }); return sent.at(-1); };
  return { send, writes };
}

describe('filler check', () => {
  it('check touches no write API', () => {
    const { send, writes } = harness();
    const r = send({ type: 'check', map, packet: null });
    expect(r.type).toBe('check:result');
    expect(r.ok).toBe(true);
    expect(r.claimNo).toBe('CLM-1');
    expect(r.fields).toHaveLength(Object.keys(map.fields).length);
    expect(writes).toEqual([]);
  });

  it('check with a matching packet touches no write API', () => {
    const { send, writes } = harness();
    const packet = { v: 1, portal: 'nia', flow: 'nontieup', claimNo: 'CLM-1', builtAt: '2026-10-17T00:00:00Z', fields: { surveyPlace: 'Nashik', gstApplicable: 'Y', netSalvage: 300 }, files: [] };
    const r = send({ type: 'check', map, packet });
    expect(r.mode).toBe('value');
    expect(writes).toEqual([]);
  });

  it('ng-options type prefixes do not cause a false noOption', () => {
    const { send } = harness({ selectOptions: ['?', 'string:Y', 'string:N'] });
    const packet = { v: 1, portal: 'nia', flow: 'nontieup', claimNo: 'CLM-1', builtAt: '2026-10-17T00:00:00Z', fields: { gstApplicable: 'Y' }, files: [] };
    const r = send({ type: 'check', map, packet });
    expect(r.fields.find((f) => f.name === 'gstApplicable').status).not.toBe('noOption');
  });

  it('check reports first element of a repeated path', () => {
    const p = map.fields.vendorInvoiceNo.modelPath;
    const { send } = harness({ dup: { path: p, els: [{ disabled: true }, {}] } });
    const r = send({ type: 'check', map, packet: null });
    expect(r.fields.find((f) => f.name === 'vendorInvoiceNo').status).toBe('disabled');
  });

  it('scope unavailable', () => {
    const { send } = harness({ scopeAvailable: false });
    const r = send({ type: 'check', map, packet: null });
    expect(r).toMatchObject({ type: 'check:result', ok: false, reason: 'Page fields not found. The portal may have changed.' });
  });

  it('fill still refuses a mismatched claim', () => {
    const { send } = harness();
    const r = send({ type: 'fill', map, packet: { claimNo: 'OTHER-9', portal: map.portal, flow: map.flow, files: [] } });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/claim mismatch/);
  });

  it('probe failures use surveyor copy', () => {
    expect(harness({ angularPresent: false }).send({ type: 'probe', map }))
      .toMatchObject({ ok: false, reason: "This page didn't load fully. Reload it and try again." });
    const missing = 'Page fields not found. The portal may have changed.';
    expect(harness({ scopeAvailable: false }).send({ type: 'probe', map })).toMatchObject({ ok: false, reason: missing });
    expect(harness({ scopeAvailable: false }).send({ type: 'probe', map: { ...map, controller: undefined } })).toMatchObject({ ok: false, reason: missing });
  });
});

// ---- React (OIC) page: plain fake elements keyed by selector ----
const reactMap = {
  portal: 'oic', flow: 'assessment', framework: 'react',
  fields: {
    place: { modelPath: '#place', kind: 'text', empty: '', from: 'place' },
    make: { modelPath: '#make', kind: 'text', empty: '', from: 'make' },
    near: { modelPath: '#near1', kind: 'radioPick', empty: '', choices: { yes: '#near1', no: '#near2' }, constant: 'no' },
  },
};

function reactHarness({ claimSelect = 'C-1', saved = null, id = 'A', make = '', checked2 = false, extra = {}, claimSel = "select[name='claimNumber']" } = {}) {
  const store = new Map(Object.entries({ surveyAssessmentId: id, ...(saved ? { 'sx-oic-claim': JSON.stringify(saved) } : {}) }));
  const clicks = [];
  const input = (value) => ({ value, disabled: false, style: {}, dispatchEvent: () => {} });
  const radio = (sel) => ({ type: 'radio', value: 'on', checked: false, disabled: false, style: {}, click() { clicks.push(sel); this.checked = true; } });
  const els = { '#place': input(''), '#make': input(make), '#near1': radio('#near1'), '#near2': radio('#near2'), ...extra };
  els['#near2'].checked = checked2;
  if (claimSelect !== null) els[claimSel] = { value: claimSelect, textContent: claimSelect + claimSelect };
  const sent = [];
  let onMessage;
  const ctx = vm.createContext({
    sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
    Event: class { constructor(type) { this.type = type; } }, DataTransfer: class {}, File: class {},
    document: {
      querySelector: (s) => els[s] ?? null,
      querySelectorAll: (s) => (els[s] ? [els[s]] : []),
      getElementById: () => null,
    },
  });
  ctx.window = { addEventListener: (t, h) => { if (t === 'message') onMessage = h; }, postMessage: (m) => sent.push(m) };
  ctx.globalThis = ctx;
  for (const f of ['src/lib/fill-core.js', 'src/lib/react-write.js', 'src/filler.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const send = (data) => { onMessage({ source: ctx.window, data: { sx: 's1', ...data } }); return sent.at(-1); };
  return { send, store, els, clicks };
}

describe('filler on a React (OIC) page', () => {
  it('reads the claim number from the select value and saves it', () => {
    const { send, store } = reactHarness();
    expect(send({ type: 'probe', map: reactMap })).toMatchObject({ ok: true, claimNo: 'C-1' });
    expect(JSON.parse(store.get('sx-oic-claim'))).toEqual({ id: 'A', claimNo: 'C-1' });
  });

  it('without the select, uses the claim saved for this assessment', () => {
    const { send } = reactHarness({ claimSelect: null, saved: { id: 'A', claimNo: 'C-1' }, id: 'A' });
    expect(send({ type: 'probe', map: reactMap })).toMatchObject({ ok: true, claimNo: 'C-1' });
  });

  it('refuses a claim saved for another assessment', () => {
    const { send } = reactHarness({ claimSelect: null, saved: { id: 'A', claimNo: 'C-1' }, id: 'B' });
    expect(send({ type: 'probe', map: reactMap })).toMatchObject({ ok: false, reason: 'Open step 2 of this claim first.' });
    expect(send({ type: 'fill', map: reactMap, packet: { claimNo: 'C-1', fields: {}, files: [] } })).toMatchObject({ ok: false, reason: 'Open step 2 of this claim first.' });
  });

  it('fill writes text, clicks only the chosen radio and keeps a box with another value', () => {
    const { send, els, clicks } = reactHarness({ make: 'Old' });
    const r = send({ type: 'fill', map: reactMap, packet: { portal: 'oic', flow: 'assessment', claimNo: 'C-1', fields: { place: 'Nashik', make: 'New' }, files: [] } });
    expect(r.ok).toBe(true);
    expect(Object.fromEntries(r.steps.map((s) => [s.name, s.action]))).toEqual({ place: 'filled', make: 'kept', near: 'filled' });
    expect(els['#place'].value).toBe('Nashik');
    expect(els['#make'].value).toBe('Old');
    expect(clicks).toEqual(['#near2']);
    expect(send({ type: 'fill', map: reactMap, packet: { portal: 'oic', flow: 'assessment', claimNo: 'C-1', fields: {}, files: [] } })
      .steps.find((s) => s.name === 'near').action).toBe('same');
  });

  it('check reports fields without writing', () => {
    const { send, els, clicks } = reactHarness();
    const r = send({ type: 'check', map: reactMap, packet: null });
    expect(r).toMatchObject({ ok: true, claimNo: 'C-1' });
    expect(r.fields.map((f) => f.status)).toEqual(['ready?', 'ready?', 'ready?']);
    expect(els['#place'].value).toBe('');
    expect(clicks).toEqual([]);
  });

  it('radioPick on a non-radio element: manual, nothing clicked, and its checked is not an answer', () => {
    const clicks = [];
    const div = { checked: true, disabled: false, style: {}, click() { clicks.push('div'); } };
    const map = { ...reactMap, fields: { near: { modelPath: '#n', kind: 'radioPick', empty: '', choices: { yes: '#n', no: '#n2' }, constant: 'yes' } } };
    const { send } = reactHarness({ extra: { '#n': div } });
    const r = send({ type: 'fill', map, packet: { portal: 'oic', flow: 'assessment', claimNo: 'C-1', fields: {}, files: [] } });
    expect(r.steps[0]).toMatchObject({ action: 'manual', why: 'not a radio input' });
    expect(clicks).toEqual([]);
  });

  it('a disabled PrimeReact dropdown is manual and onChange never runs', () => {
    const calls = [];
    const mkDd = (extraProps, classList) => ({
      style: {}, classList: { contains: (c) => (classList ?? []).includes(c) },
      '__reactFiber$x': { memoizedProps: { options: ['LMV'], onChange: (e) => calls.push(e), ...extraProps }, return: null },
    });
    const map = { ...reactMap, fields: { lic: { modelPath: '#lic', kind: 'dropdown', empty: '', from: 'lic' } } };
    const packet = { portal: 'oic', flow: 'assessment', claimNo: 'C-1', fields: { lic: 'LMV' }, files: [] };
    for (const el of [mkDd({ disabled: true }), mkDd({}, ['p-disabled'])]) {
      const { send } = reactHarness({ extra: { '#lic': el } });
      expect(send({ type: 'fill', map, packet }).steps[0]).toMatchObject({ action: 'manual', why: 'disabled on the page' });
    }
    expect(calls).toEqual([]);
  });

  it('kept radioPick outlines the checked choice', () => {
    const { send, els } = reactHarness({ checked2: true });
    send({ type: 'fill', map: reactMap, packet: { portal: 'oic', flow: 'assessment', claimNo: 'C-1', fields: {}, files: [] } });
    // constant 'no' matches the checked #near2 (same); force a kept: constant yes vs checked no
    const map = { ...reactMap, fields: { near: { ...reactMap.fields.near, constant: 'yes' } } };
    const h = reactHarness({ checked2: true });
    h.send({ type: 'fill', map, packet: { portal: 'oic', flow: 'assessment', claimNo: 'C-1', fields: {}, files: [] } });
    expect(h.els['#near2'].style.outline).toBe('2px solid #f59e0b');
    expect(h.els['#near1'].style.outline).toBeUndefined();
    expect(els['#near1'].style.outline).toBeUndefined();
  });

  it('claim number comes from map.claimNoSelector', () => {
    const map = { ...reactMap, claimNoSelector: 'select#other' };
    const { send } = reactHarness({ claimSelect: 'Z-9', claimSel: 'select#other' });
    expect(send({ type: 'probe', map })).toMatchObject({ ok: true, claimNo: 'Z-9' });
  });

  it('check does not write sessionStorage', () => {
    const { send, store } = reactHarness();
    const before = JSON.stringify([...store]);
    expect(send({ type: 'check', map: reactMap, packet: null }).ok).toBe(true);
    expect(JSON.stringify([...store])).toBe(before);
  });
});
