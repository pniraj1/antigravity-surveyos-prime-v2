// extension/__tests__/map.test.js
import { describe, it, expect } from 'vitest';
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
      it('hosted copy is identical', () => {
        const copy = Object.entries(hosted).find(([p]) => fileId(p) === id);
        expect(copy, 'hosted copy missing').toBeTruthy();
        expect(copy[1]).toEqual(map);
      });
    });
  }
});
