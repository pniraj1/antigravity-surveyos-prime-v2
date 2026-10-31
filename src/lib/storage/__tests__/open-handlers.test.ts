import { describe, it, expect, vi } from 'vitest';

const h = vi.hoisted(() => ({ opts: null as any, db: { close: vi.fn() } }));
vi.mock('idb', () => ({ openDB: vi.fn((_n: string, _v: number, o: any) => { h.opts = o; return Promise.resolve(h.db); }) }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError } }));

import { initUserDB } from '../indexeddb';

describe('openDB version-change handlers', () => {
  it('blocking closes the db; blocked warns and toasts', async () => {
    await initUserDB('u1');
    h.opts.blocking();
    await Promise.resolve();
    expect(h.db.close).toHaveBeenCalled();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.opts.blocked();
    expect(warn).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });
});
