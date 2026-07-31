import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('/features', () => {
  test('route exists', () => {
    expect(existsSync('src/app/features/page.tsx')).toBe(true);
  });

  test('every referenced image is present in public/images', () => {
    const text = readFileSync('src/app/features/page.tsx', 'utf8');
    // Paths are built as `/images/${f.image}`, so match the declared filenames
    // in the FEATURES array rather than a literal src string.
    const refs = [...text.matchAll(/image:\s*'([a-z0-9-]+\.png)'/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const file of refs) {
      expect(existsSync(`public/images/${file}`)).toBe(true);
    }
  });
});
