import { describe, it, expect } from 'vitest';
import { getAt, setAt } from '../path';

describe('getAt / setAt', () => {
  it('reads nested values and missing paths', () => {
    expect(getAt({ a: { b: 'x' } }, 'a.b')).toBe('x');
    expect(getAt({ a: {} }, 'a.b.c')).toBeUndefined();
  });

  it('sets nested values without mutating the input', () => {
    const src = { a: { b: 'x', keep: 1 }, other: { z: 2 } };
    const out = setAt(src, 'a.b', 'y');
    expect(out).toEqual({ a: { b: 'y', keep: 1 }, other: { z: 2 } });
    expect(src.a.b).toBe('x');
    expect(out.other).toBe(src.other);
  });
});
