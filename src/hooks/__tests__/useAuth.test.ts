// ═══════════════════════════════════════════════════════════
// Regression test: a failing post-login bootstrap must NOT block auth.
//
// The bug: setUser() is the only thing that flips isAuthenticated and
// clears `loading` (nothing calls setLoading). It used to sit at the end
// of an unguarded chain of Firestore calls, so one transient failure —
// classically an `unavailable` while the Firestore connection is still
// being established on the very first request — rejected the
// onAuthStateChanged callback, Firebase swallowed it, and setUser()
// never ran. The user was signed in to Firebase but stayed on the
// landing page with no error, and had to click Sign In two or three
// times before a warm connection let the chain complete.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** The onAuthStateChanged listener useAuth registers; the test drives it. */
let authCallback: ((user: unknown) => Promise<void>) | null = null;

/** Flipped per-test to simulate Firestore being reachable or not. */
let firestoreFails = false;

// Run hooks outside a renderer so useAuth() can be called as a plain function
// (no DOM / testing-library in this project — the suite runs in node).
// useEffect fires immediately; the rest are the primitives zustand's useStore
// needs to read a snapshot without a React render context.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const overrides = {
    useEffect: (fn: () => void) => { fn(); },
    useCallback: <T,>(fn: T) => fn,
    useDebugValue: () => {},
    useSyncExternalStore: <T,>(_sub: unknown, getSnapshot: () => T) => getSnapshot(),
  };
  // zustand reads these off the DEFAULT export, so both shapes need patching.
  return { ...actual, ...overrides, default: { ...actual, ...overrides } };
});

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => Promise<void>) => {
    authCallback = cb;
    return () => {};
  },
  signOut: vi.fn(async () => {}),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => {
    if (firestoreFails) throw new Error('unavailable: backend cannot be reached');
    return { exists: () => true, data: () => ({ subscriptionStatus: 'active', isAdmin: false }) };
  }),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  Timestamp: { now: () => 0 },
}));

vi.mock('@/lib/storage/indexeddb', () => ({
  initUserDB: vi.fn(async () => {}),
  closeUserDB: vi.fn(async () => {}),
}));

vi.mock('@/lib/firebase/sync', () => ({
  pullProfileFromCloud: vi.fn(async () => null),
  flushAllPendingToCloud: vi.fn(async () => ({ pushed: 0, failed: 0, skipped: false })),
}));

vi.mock('@/lib/firebase/session', () => ({
  readActiveSession: vi.fn(async () => null),
  claimSession: vi.fn(async () => {}),
  releaseSession: vi.fn(async () => {}),
  isSessionFresh: () => false,
  isSessionMine: () => true,
}));

vi.mock('@/lib/auth/resetAllState', () => ({ resetAllState: vi.fn() }));
vi.mock('@/lib/subscription/status', () => ({ isExpired: () => false }));

import { useAuth } from '../useAuth';
import { useAuthStore } from '@/stores/auth-store';

const FAKE_USER = { uid: 'uid-1', email: 's@example.com', displayName: 'Surveyor' };

describe('useAuth — post-login bootstrap', () => {
  beforeEach(() => {
    authCallback = null;
    firestoreFails = false;
    useAuthStore.setState({ user: null, isAuthenticated: false, loading: true, sessionConflict: null });
    // The bootstrap logs the swallowed failure; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('authenticates on the happy path', async () => {
    useAuth();
    await authCallback!(FAKE_USER);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('still authenticates when the Firestore bootstrap throws', async () => {
    firestoreFails = true;

    useAuth();
    await authCallback!(FAKE_USER);

    // Before the fix both of these were false/true respectively — the user was
    // signed in to Firebase but the UI never left the landing page.
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().loading).toBe(false);
  });
});
