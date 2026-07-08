import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';

// ── Firestore mock ──────────────────────────────────────────
// session.ts pulls doc/getDoc/setDoc/deleteDoc/serverTimestamp from
// 'firebase/firestore' and `db` from './config'. We mock the network
// pieces but keep the real Timestamp class for isSessionFresh.
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn(() => ({})),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    serverTimestamp: vi.fn(() => 'server-ts'),
  };
});
vi.mock('@/lib/firebase/config', () => ({ db: {} }));

import {
  isSessionFresh,
  isSessionMine,
  releaseSession,
  FRESHNESS_WINDOW_MS,
  type ActiveSession,
} from '@/lib/firebase/session';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
  mockDeleteDoc.mockReset();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
});

function session(over: Partial<ActiveSession> = {}): ActiveSession {
  return {
    deviceId: 'device-A',
    deviceHint: 'Chrome on Windows',
    lastHeartbeat: Date.now(),
    claimedAt: Date.now(),
    ...over,
  };
}

describe('isSessionFresh', () => {
  const now = 1_000_000_000_000;

  it('is false for a null session', () => {
    expect(isSessionFresh(null, now)).toBe(false);
  });

  it('is true when the heartbeat is within the freshness window (millis)', () => {
    const s = session({ lastHeartbeat: now - (FRESHNESS_WINDOW_MS - 1) });
    expect(isSessionFresh(s, now)).toBe(true);
  });

  it('is false when the heartbeat is older than the freshness window', () => {
    const s = session({ lastHeartbeat: now - (FRESHNESS_WINDOW_MS + 1) });
    expect(isSessionFresh(s, now)).toBe(false);
  });

  it('handles a Firestore Timestamp heartbeat', () => {
    const fresh = session({ lastHeartbeat: Timestamp.fromMillis(now - 10_000) });
    expect(isSessionFresh(fresh, now)).toBe(true);
    const stale = session({ lastHeartbeat: Timestamp.fromMillis(now - FRESHNESS_WINDOW_MS - 10_000) });
    expect(isSessionFresh(stale, now)).toBe(false);
  });

  it('treats a null heartbeat (server write not yet resolved) as stale', () => {
    expect(isSessionFresh(session({ lastHeartbeat: null }), now)).toBe(false);
  });
});

describe('isSessionMine', () => {
  it('is false for a null session', () => {
    expect(isSessionMine(null)).toBe(false);
  });

  it('is true when the session deviceId matches this device', () => {
    store.set('surveyos_device_id', 'my-device');
    expect(isSessionMine(session({ deviceId: 'my-device' }))).toBe(true);
  });

  it('is false when another device owns the session', () => {
    store.set('surveyos_device_id', 'my-device');
    expect(isSessionMine(session({ deviceId: 'other-device' }))).toBe(false);
  });
});

describe('releaseSession guard', () => {
  it('deletes the session when this device still owns it', async () => {
    store.set('surveyos_device_id', 'my-device');
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => session({ deviceId: 'my-device' }) });

    await releaseSession('uid-1');

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('does NOT delete when another device has force-claimed the session', async () => {
    store.set('surveyos_device_id', 'my-device');
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => session({ deviceId: 'kicker-device' }) });

    await releaseSession('uid-1');

    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('never throws when the read fails (non-fatal on logout)', async () => {
    mockGetDoc.mockRejectedValue(new Error('offline'));
    await expect(releaseSession('uid-1')).resolves.toBeUndefined();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});
