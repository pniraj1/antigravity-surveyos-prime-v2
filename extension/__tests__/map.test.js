// extension/__tests__/map.test.js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { mapId } from '../src/lib/fill-core.js';

const KINDS = ['text', 'money', 'radio', 'select', 'dateRadioOrOthers', 'file'];
const bundled = import.meta.glob('../maps/*.json', { eager: true, import: 'default' });
const hosted = import.meta.glob('../../public/portal-maps/*.json', { eager: true, import: 'default' });
const fileId = (p) => p.split('/').pop().replace(/\.json$/, '');

describe('field maps', () => {
  it('at least one map is bundled', () => {
    expect(Object.keys(bundled).length).toBeGreaterThan(0);
  });

  for (const [path, map] of Object.entries(bundled)) {
    const id = fileId(path);
    describe(id, () => {
      it('has the header the filler and panel need', () => {
        for (const k of ['portal', 'flow', 'version', 'host', 'route', 'modelRoot', 'claimNoPath']) {
          expect(map[k], k).toBeTruthy();
        }
        expect(mapId(map)).toBe(id);
      });
      it('every field has a modelPath under its root, a known kind and an empty value', () => {
        for (const [k, f] of Object.entries(map.fields)) {
          expect(f.modelPath.startsWith(map.modelRoot), k).toBe(true);
          expect(KINDS, k).toContain(f.kind);
          expect('empty' in f, k).toBe(true);
        }
      });
      it('every field has a surveyor label and the map has a next-step hint', () => {
        expect(typeof map.doneHint).toBe('string');
        expect(map.doneHint.length).toBeGreaterThan(10);
        for (const [k, f] of Object.entries(map.fields)) expect(f.label, k).toMatch(/^[A-Z][^]*\S$/);
      });
      it('hosted copy is identical', () => {
        const copy = Object.entries(hosted).find(([p]) => fileId(p) === id);
        expect(copy, 'hosted copy missing').toBeTruthy();
        expect(copy[1]).toEqual(map);
      });
    });
  }
});

describe('flow lists agree', () => {
  // background.js registers listeners and reads storage at load: stub chrome first.
  const listener = { addListener() {} };
  globalThis.chrome = {
    // every map "stored": no refresh at load
    storage: { local: { get: async () => ({ maps: new Proxy({}, { get: () => ({}) }) }) }, onChanged: listener },
    runtime: { getURL: (p) => p, onInstalled: listener, onStartup: listener },
    alarms: { create() {}, onAlarm: listener },
  };
  const { MAP_IDS } = createRequire(import.meta.url)('../src/background.js');
  const { KNOWN_FLOWS } = createRequire(import.meta.url)('../src/lib/packet-validate.js');
  const manifest = createRequire(import.meta.url)('../manifest.json');
  const hostOf = (pattern) => new URL(pattern.replace('*', '')).host;
  const panelScript = manifest.content_scripts.find((c) => c.js.includes('src/panel.js'));

  for (const map of Object.values(bundled)) {
    it(`${mapId(map)} is listed everywhere`, () => {
      expect(MAP_IDS).toContain(mapId(map));
      expect(KNOWN_FLOWS[map.portal]).toContain(map.flow);
      expect(manifest.host_permissions.map(hostOf)).toContain(map.host);
      expect(panelScript.matches.map(hostOf)).toContain(map.host);
    });
  }
  it('MAP_IDS lists no map that is not bundled', () => {
    expect([...MAP_IDS].sort()).toEqual(Object.values(bundled).map(mapId).sort());
  });
});
