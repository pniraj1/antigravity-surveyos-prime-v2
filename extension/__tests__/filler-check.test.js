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

function harness({ scopeAvailable = true, dup = null } = {}) {
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
      const el = rec(`el(${p})`, { tagName: 'INPUT', type: 'text', value: '', disabled: false, style: {}, ...extra });
      ctrls.set(el, rec(`ctrl(${p})`, { $modelValue: undefined, $error: {} }));
      return el;
    };
    if (f?.kind === 'select') elsByPath.set(p, [mk({ tagName: 'SELECT', options: [{ value: 'Y' }, { value: 'N' }] })]);
    else if (f?.kind === 'dateRadioOrOthers') elsByPath.set(p, [mk({ type: 'radio', value: 'Others' }), mk({ type: 'radio', value: '01/01/2026' })]);
    else elsByPath.set(p, [mk({})]);
  }
  if (dup) elsByPath.set(dup.path, dup.els.map((extra) => {
    const el = rec('dup', { tagName: 'INPUT', type: 'text', value: '', disabled: false, style: {}, ...extra });
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

  it('check reports first element of a repeated path', () => {
    const p = map.fields.vendorInvoiceNo.modelPath;
    const { send } = harness({ dup: { path: p, els: [{ disabled: true }, {}] } });
    const r = send({ type: 'check', map, packet: null });
    expect(r.fields.find((f) => f.name === 'vendorInvoiceNo').status).toBe('disabled');
  });

  it('scope unavailable', () => {
    const { send } = harness({ scopeAvailable: false });
    const r = send({ type: 'check', map, packet: null });
    expect(r).toMatchObject({ type: 'check:result', ok: false, reason: 'page fields not found. The portal may have changed.' });
  });

  it('fill still refuses a mismatched claim', () => {
    const { send } = harness();
    const r = send({ type: 'fill', map, packet: { claimNo: 'OTHER-9', portal: map.portal, flow: map.flow, files: [] } });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/claim mismatch/);
  });
});
