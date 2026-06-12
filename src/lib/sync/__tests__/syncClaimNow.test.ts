import { describe, it, expect, vi } from 'vitest';
import { syncClaimNow, type SyncClaimDeps } from '@/lib/sync/syncClaimNow';
import type { ClaimData } from '@/types';

const claim = { id: 'claim-1', updatedAt: '2026-06-12T10:00:00.000Z' } as unknown as ClaimData;

function deps(over: Partial<SyncClaimDeps> = {}): SyncClaimDeps {
  return {
    pushClaimToCloud: vi.fn().mockResolvedValue(undefined),
    flushDriveQueue: vi.fn().mockResolvedValue(3),
    isOnline: () => true,
    ...over,
  };
}

describe('syncClaimNow', () => {
  it('does not push when offline and reports offline', async () => {
    const d = deps({ isOnline: () => false });
    const r = await syncClaimNow(claim, 'uid-1', d);
    expect(r).toEqual({ ok: false, pushedToVault: false, driveFilesSynced: 0, error: 'offline' });
    expect(d.pushClaimToCloud).not.toHaveBeenCalled();
  });

  it('pushes the full claim to the vault and flushes Drive on success', async () => {
    const d = deps();
    const r = await syncClaimNow(claim, 'uid-1', d);
    expect(d.pushClaimToCloud).toHaveBeenCalledWith('uid-1', claim);
    expect(r.ok).toBe(true);
    expect(r.pushedToVault).toBe(true);
    expect(r.driveFilesSynced).toBe(3);
  });

  it('fails when the vault push throws (the cross-device data did not save)', async () => {
    const d = deps({ pushClaimToCloud: vi.fn().mockRejectedValue(new Error('permission-denied')) });
    const r = await syncClaimNow(claim, 'uid-1', d);
    expect(r.ok).toBe(false);
    expect(r.pushedToVault).toBe(false);
    expect(r.error).toContain('permission-denied');
  });

  it('still succeeds when only Drive fails (vault is the source of truth for assessment data)', async () => {
    const d = deps({ flushDriveQueue: vi.fn().mockRejectedValue(new Error('drive down')) });
    const r = await syncClaimNow(claim, 'uid-1', d);
    expect(r.ok).toBe(true);
    expect(r.pushedToVault).toBe(true);
    expect(r.driveFilesSynced).toBe(0);
  });
});
