import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const { extractFields } = createRequire(import.meta.url)('../../scripts/portal-map/live-extract.js');

const el = (attrs, extra = {}) => ({ tag: 'input', attrs, hidden: false, ...extra });

describe('live-extract', () => {
  it('groups by model parent', () => {
    const r = extractFields([
      el({ name: 'x', type: 'text', 'ng-model': 'a.b.x' }),
      el({ name: 'y', type: 'text', 'data-ng-model': 'a.b.y' }),
      el({ name: 'z', type: 'text' }),
    ]);
    expect(r.groups['a.b']).toHaveLength(2);
    expect(r.groups['(no-model)']).toHaveLength(1);
    expect(r.total).toBe(3);
  });

  it('never emits values', () => {
    const r = extractFields([
      el({ name: 'v', type: 'text', 'ng-model': 'a.v', value: 'MH12AB1234', placeholder: 'Name' }),
      el({ name: 'r', type: 'radio', 'ng-model': 'a.r', value: 'Y' }),
    ]);
    const s = JSON.stringify(r);
    expect(s).not.toContain('MH12AB1234');
    expect(s).not.toContain('Name');
    expect(r.groups.a.find((f) => f.name === 'r').value).toBe('Y');
    expect(r.groups.a.find((f) => f.name === 'v').value).toBeUndefined();
  });

  it('select options are codes only', () => {
    const r = extractFields([{ tag: 'select', attrs: { name: 's', 'ng-model': 'a.s' }, options: ['', 'Y', 'N'], hidden: false }]);
    expect(r.groups.a[0].options).toEqual(['', 'Y', 'N']);
    expect(r.groups.a[0].type).toBe('select');
  });

  it('hidden flag', () => {
    const r = extractFields([el({ name: 'h', type: 'text', 'ng-model': 'a.h' }, { hidden: true })]);
    expect(r.groups.a[0].hidden).toBe(true);
  });
});
