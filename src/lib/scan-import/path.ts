/** Reads `a.b.c` from an object; undefined when any step is missing. */
export function getAt(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (cur, key) => (cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

/** Returns a copy of `obj` with `a.b.c` set. Untouched branches are shared, never mutated. */
export function setAt<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const src = (obj ?? {}) as Record<string, unknown>;
  return { ...src, [head]: rest.length ? setAt(src[head], rest.join('.'), value) : value } as T;
}
