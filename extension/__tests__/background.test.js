import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
import bundled from '../maps/nia-nontieup.json';
const bundledAll = import.meta.glob('../maps/*.json', { eager: true, import: 'default' });

const require = createRequire(import.meta.url);

/** Minimal chrome.* stand-in: a real in-memory storage, listeners ignored. */
function installChrome(initial = {}) {
  const store = { ...initial };
  const listener = { addListener() {} };
  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, store[k]])),
        set: async (o) => { Object.assign(store, o); },
        remove: async (keys) => { for (const k of [].concat(keys)) delete store[k]; },
      },
      onChanged: listener,
    },
    runtime: { getURL: (p) => `ext://${p}`, onInstalled: listener, onStartup: listener },
    alarms: { create() {}, onAlarm: listener },
  };
  return store;
}

/** ext:// → bundled map; our hosting → `remote` (or a network failure). */
function installFetch(remote) {
  globalThis.fetch = vi.fn(async (url) => {
    const own = bundledAll[`../${url.replace('ext://', '')}`];
    if (own) return { ok: true, json: async () => own };
    if (remote === undefined) throw new Error('offline');
    return { ok: true, json: async () => remote };
  });
}

function load() {
  delete require.cache[require.resolve('../src/background.js')];
  return require('../src/background.js');
}

describe('refreshMaps', () => {
  beforeEach(() => { delete globalThis.chrome; });

  it('keeps the bundled map when offline', async () => {
    const store = installChrome();
    installFetch(undefined);
    await load().refreshMaps();
    expect(store.maps['nia-nontieup'].version).toBe(bundled.version);
  });

  it('remote wins only when newer and its id matches', async () => {
    let store = installChrome();
    installFetch({ ...bundled, version: bundled.version + 1 });
    await load().refreshMaps();
    expect(store.maps['nia-nontieup'].version).toBe(bundled.version + 1);

    store = installChrome();
    installFetch({ ...bundled, flow: 'maruti', version: bundled.version + 5 });
    await load().refreshMaps();
    expect(store.maps['nia-nontieup'].flow).toBe('nontieup');
    expect(store.maps['nia-nontieup'].version).toBe(bundled.version);
  });

  it('loads maps on worker start when none are stored (onInstalled may not fire)', async () => {
    const store = installChrome({ map: { portal: 'nia', flow: 'nontieup', version: 1 } });
    installFetch(undefined);
    load();
    await vi.waitFor(() => expect(store.maps?.['nia-nontieup']).toBeTruthy());
  });

  it('ignores a newer remote map missing host, route or fields', async () => {
    for (const drop of ['host', 'route', 'fields']) {
      const store = installChrome();
      const { [drop]: _gone, ...broken } = { ...bundled, version: bundled.version + 1 };
      installFetch(broken);
      await load().refreshMaps();
      expect(store.maps['nia-nontieup'].version, drop).toBe(bundled.version);
    }
  });

  it('migrates the v0.1.0 key', async () => {
    const { host: _h, modelRoot: _r, ...v1 } = { ...bundled, version: 1 };
    const store = installChrome({ map: v1 });
    installFetch(undefined);
    await load().refreshMaps();
    expect(store.maps['nia-nontieup']).toEqual(bundled);
    expect('map' in store).toBe(false);
  });
});
