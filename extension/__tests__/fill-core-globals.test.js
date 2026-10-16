import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// fill-core runs as a classic MAIN-world script: it must not add global
// lexical bindings a portal page could collide with.
describe('fill-core in a page that already declares its names', () => {
  it('loads without a redeclaration error', () => {
    const src = readFileSync(new URL('../src/lib/fill-core.js', import.meta.url), 'utf8');
    const ctx = vm.createContext({});
    vm.runInContext('const transforms = 1; const API = 2; const NS = 3;', ctx);
    expect(() => vm.runInContext(src, ctx)).not.toThrow();
    expect(typeof ctx.SxFill.pickMap).toBe('function');
  });
});
