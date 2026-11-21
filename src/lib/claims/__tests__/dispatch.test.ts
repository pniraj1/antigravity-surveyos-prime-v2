import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBlankClaim } from '@/types/claim';

const store = new Map<string, unknown>();
const saveClaim = vi.fn(async (c: { id: string }) => { store.set(c.id, c); });
vi.mock('@/lib/storage/indexeddb', () => ({
  getClaim: async (id: string) => store.get(id),
  saveClaim: (c: { id: string }) => saveClaim(c),
}));
const post = vi.fn();
const close = vi.fn();
vi.stubGlobal('BroadcastChannel', class { postMessage = post; close = close; });

import { useClaimStore } from '@/stores/claim-store';
import { withCourieredAt, withPortalUploaded, withHeldNote, progressSummary, applyToClaims } from '../dispatch';

describe('dispatch helpers', () => {
  beforeEach(() => { store.clear(); saveClaim.mockClear(); post.mockClear(); close.mockClear(); });

  it("withCourieredAt('') removes courieredAt", () => {
    const c = { ...createBlankClaim('final'), courieredAt: '2026-11-01' };
    expect('courieredAt' in withCourieredAt(c, '')).toBe(false);
  });
  it('withCourieredAt sets the date and keeps other fields', () => {
    const c = createBlankClaim('final');
    const r = withCourieredAt(c, '2026-11-02');
    expect(r.courieredAt).toBe('2026-11-02');
    expect(r.id).toBe(c.id);
  });
  it('withPortalUploaded(false) removes the field', () => {
    const c = createBlankClaim('final');
    const on = withPortalUploaded(c, true, '2026-11-03T00:00:00.000Z');
    expect(on.portalUploadedAt).toBe('2026-11-03T00:00:00.000Z');
    expect('portalUploadedAt' in withPortalUploaded(on, false, 'x')).toBe(false);
  });
  it("withHeldNote trims and '' removes", () => {
    const c = createBlankClaim('final');
    expect(withHeldNote(c, '  wait for RC ').heldNote).toBe('wait for RC');
    expect('heldNote' in withHeldNote({ ...c, heldNote: 'a' }, '   ')).toBe(false);
  });
  it("progressSummary of a blank final claim → label 'Waiting: Documents verified', 0 of 11", () => {
    const s = progressSummary(createBlankClaim('final'));
    expect(s.label).toBe('Waiting: Documents verified');
    expect(s.done).toBe(0);
    expect(s.total).toBe(11);
    expect(s.nextTab).toBe('details');
  });
  it('applyToClaims saves every id (saveClaim broadcasts itself)', async () => {
    const a = createBlankClaim('final'); const b = createBlankClaim('final');
    store.set(a.id, a); store.set(b.id, b);
    const n = await applyToClaims([a.id, b.id, 'missing'], (c) => withCourieredAt(c, '2026-11-02'));
    expect(n).toBe(2);
    expect(saveClaim).toHaveBeenCalledTimes(2);
    expect((store.get(a.id) as { courieredAt: string }).courieredAt).toBe('2026-11-02');
    expect(post).not.toHaveBeenCalled();
  });
  it('applyToClaims returns 0 and saves nothing when no id is found', async () => {
    expect(await applyToClaims(['nope'], (c) => c)).toBe(0);
    expect(saveClaim).not.toHaveBeenCalled();
  });
  it('applyToClaims removes a field on the open claim and keeps its unsaved edits', async () => {
    const stored = { ...createBlankClaim('final'), courieredAt: '2026-11-01' };
    store.set(stored.id, stored);
    useClaimStore.setState({ currentClaim: { ...stored, reportNo: 'UNSAVED' } });
    await applyToClaims([stored.id], (c) => withCourieredAt(c, ''));
    const cur = useClaimStore.getState().currentClaim!;
    expect(cur.courieredAt).toBeUndefined();
    expect(cur.reportNo).toBe('UNSAVED');
    useClaimStore.setState({ currentClaim: null });
  });
});
