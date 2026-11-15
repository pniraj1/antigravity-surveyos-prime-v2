import { describe, it, expect } from 'vitest';
import { createFileGate } from '../file-gate';

const settled = async (p: Promise<void>) => {
  let done = false;
  void p.then(() => { done = true; });
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

describe('createFileGate', () => {
  it('stays closed until opened, and opening twice is harmless', async () => {
    const g = createFileGate();
    expect(await settled(g.whenOpen)).toBe(false);
    g.open();
    g.open();
    expect(await settled(g.whenOpen)).toBe(true);
  });
  it('can start open (uploads that were not asked)', async () => {
    expect(await settled(createFileGate(true).whenOpen)).toBe(true);
  });
});
