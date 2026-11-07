// ─── Environment Mocks MUST come before imports ──────────────
const storageMap = new Map<string, string>();
const mockStorage = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => { storageMap.set(k, String(v)); },
  removeItem: (k: string) => { storageMap.delete(k); },
  clear: () => { storageMap.clear(); },
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  configurable: true,
  writable: true,
});

const windowListeners: Record<string, Function[]> = {};
const documentListeners: Record<string, Function[]> = {};

Object.defineProperty(globalThis, 'window', {
  value: {
    addEventListener: (event: string, cb: Function) => {
      (windowListeners[event] = windowListeners[event] || []).push(cb);
    },
    removeEventListener: (event: string, cb: Function) => {
      windowListeners[event] = (windowListeners[event] || []).filter(fn => fn !== cb);
    },
    localStorage: mockStorage,
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(globalThis, 'document', {
  value: {
    visibilityState: 'visible',
    addEventListener: (event: string, cb: Function) => {
      (documentListeners[event] = documentListeners[event] || []).push(cb);
    },
    removeEventListener: (event: string, cb: Function) => {
      documentListeners[event] = (documentListeners[event] || []).filter(fn => fn !== cb);
    },
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(globalThis, 'navigator', {
  value: {
    onLine: true,
  },
  configurable: true,
  writable: true,
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── React Mock & Test Harness ─────────────────────────────
type EffectRecord = {
  fn: () => void | (() => void);
  deps?: any[];
  hasRun: boolean;
  prevDeps?: any[];
  cleanup?: void | (() => void);
};

let currentRefs: any[] = [];
let refIndex = 0;
let currentEffects: EffectRecord[] = [];
let effectIndex = 0;

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const mockReact = {
    ...actual,
    useRef: (initialValue: any) => {
      if (refIndex >= currentRefs.length) {
        currentRefs.push({ current: initialValue });
      }
      return currentRefs[refIndex++];
    },
    useEffect: (fn: any, deps?: any[]) => {
      if (effectIndex >= currentEffects.length) {
        currentEffects.push({ fn, deps, hasRun: false });
      } else {
        currentEffects[effectIndex].fn = fn;
        currentEffects[effectIndex].deps = deps;
      }
      effectIndex++;
    },
    useCallback: <T,>(fn: T) => fn,
    useMemo: <T,>(fn: () => T) => fn(),
    useDebugValue: () => {},
    useSyncExternalStore: <T,>(_sub: unknown, getSnapshot: () => T) => getSnapshot(),
  };
  return { ...mockReact, default: mockReact };
});

// ─── Mocks for Firebase & Storage ───────────────────────────
const mockPushClaimToCloud = vi.fn().mockResolvedValue(undefined);
const mockAddToSyncQueue = vi.fn().mockResolvedValue(undefined);
let mockPushedAt: string | null = null;

vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('@/lib/sandbox', () => ({ isSandbox: () => false }));
vi.mock('@/lib/utils/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/firebase/sync', () => ({
  pushClaimToCloud: (...args: any[]) => mockPushClaimToCloud(...args),
  pullClaimsFromCloud: vi.fn().mockResolvedValue([]),
  syncDeltaToCloud: vi.fn().mockResolvedValue(undefined),
  syncTombstones: vi.fn().mockResolvedValue(undefined),
  pullProfileFromCloud: vi.fn().mockResolvedValue(null),
  pushProfileToCloud: vi.fn().mockResolvedValue(undefined),
  getLastSyncTimestamp: vi.fn().mockReturnValue(null),
  setLastSyncTimestamp: vi.fn(),
}));

vi.mock('@/lib/firebase/sync-secrets', () => ({
  pullSecretsFromCloud: vi.fn().mockResolvedValue(null),
  pushSecretsToCloud: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/storage/indexeddb', () => ({
  addToSyncQueue: (...args: any[]) => mockAddToSyncQueue(...args),
  getSyncQueue: vi.fn().mockResolvedValue([]),
  removeSyncItem: vi.fn().mockResolvedValue(undefined),
  getClaim: vi.fn().mockResolvedValue(null),
  getPushedAt: vi.fn(async () => mockPushedAt),
}));

vi.mock('@/lib/drive', () => ({
  flushDriveQueue: vi.fn().mockResolvedValue(undefined),
  silentlyRestoreDriveToken: vi.fn().mockResolvedValue(false),
  backupProfileToDrive: vi.fn().mockResolvedValue(undefined),
  restoreProfileFromDrive: vi.fn().mockResolvedValue(null),
  getDriveToken: vi.fn().mockReturnValue(null),
}));

import { useCloudSync, TAB_SWITCH_COALESCE_MS } from '../useCloudSync';
import { useAuthStore } from '@/stores/auth-store';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import type { ClaimData } from '@/types';

function renderHook(hook: () => void) {
  currentRefs = [];
  currentEffects = [];
  refIndex = 0;
  effectIndex = 0;

  const runEffects = () => {
    for (const eff of currentEffects) {
      if (eff.deps === undefined) {
        if (eff.cleanup) eff.cleanup();
        eff.cleanup = eff.fn();
      } else if (!eff.hasRun) {
        eff.hasRun = true;
        eff.cleanup = eff.fn();
        eff.prevDeps = [...eff.deps];
      } else {
        const changed = !eff.prevDeps || eff.deps.some((d, idx) => !Object.is(d, eff.prevDeps![idx]));
        if (changed) {
          if (eff.cleanup) eff.cleanup();
          eff.cleanup = eff.fn();
          eff.prevDeps = [...eff.deps];
        }
      }
    }
  };

  const execute = () => {
    refIndex = 0;
    effectIndex = 0;
    hook();
    runEffects();
  };

  execute();

  return {
    rerender: () => {
      execute();
    },
    unmount: () => {
      for (const eff of currentEffects) {
        if (eff.cleanup) {
          eff.cleanup();
          eff.cleanup = undefined;
        }
      }
    },
  };
}

describe('useCloudSync — Tab-Switch Coalescing (Firestore Quota Optimization)', () => {
  let activeHook: ReturnType<typeof renderHook> | null = null;

  const fakeClaim1: ClaimData = {
    id: 'claim-1',
    claimNumber: 'CLM-001',
    vehicle: { registrationNumber: 'MH01AB1234' },
    updatedAt: new Date(2026, 10, 7, 10, 0, 0).toISOString(),
  } as any;

  const fakeClaim2: ClaimData = {
    id: 'claim-2',
    claimNumber: 'CLM-002',
    vehicle: { registrationNumber: 'DL02CD5678' },
    updatedAt: new Date(2026, 10, 7, 10, 0, 0).toISOString(),
  } as any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockPushClaimToCloud.mockClear();
    mockAddToSyncQueue.mockClear();
    mockPushedAt = null; // Always dirty so pushClaimToCloud is attempted

    for (const k in windowListeners) delete windowListeners[k];
    for (const k in documentListeners) delete documentListeners[k];

    // Set authenticated surveyor and initial claim
    useAuthStore.setState({
      user: { uid: 'surveyor-123', email: 's@example.com' } as any,
      isAuthenticated: true,
    });
    useClaimStore.setState({ currentClaim: fakeClaim1 });
    useUIStore.setState({ activeTab: 'general', isOnline: true });
    (document as any).visibilityState = 'visible';
  });

  afterEach(() => {
    if (activeHook) {
      activeHook.unmount();
      activeHook = null;
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('exports TAB_SWITCH_COALESCE_MS equal to 15,000ms', () => {
    expect(TAB_SWITCH_COALESCE_MS).toBe(15_000);
  });

  it('coalesces rapid tab switches within 15 seconds into a single cloud write', async () => {
    activeHook = renderHook(() => useCloudSync());

    // Switch from general -> policy (t = 0s)
    useUIStore.setState({ activeTab: 'policy' });
    activeHook.rerender();

    // Advance 5s (t = 5s) — should not have pushed yet
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mockPushClaimToCloud).not.toHaveBeenCalled();

    // Switch policy -> vehicle (t = 5s)
    useUIStore.setState({ activeTab: 'vehicle' });
    activeHook.rerender();

    // Advance 5s (t = 10s) — still quiet window reset
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mockPushClaimToCloud).not.toHaveBeenCalled();

    // Switch vehicle -> cause (t = 10s)
    useUIStore.setState({ activeTab: 'cause' });
    activeHook.rerender();

    // Advance 14.9s after last switch (t = 24.9s)
    await vi.advanceTimersByTimeAsync(14_900);
    expect(mockPushClaimToCloud).not.toHaveBeenCalled();

    // Settle past the 15s quiet window (t = 25.1s)
    await vi.advanceTimersByTimeAsync(200);

    // Exactly 1 write occurred for all 3 tab transitions
    expect(mockPushClaimToCloud).toHaveBeenCalledTimes(1);
    expect(mockPushClaimToCloud).toHaveBeenCalledWith('surveyor-123', fakeClaim1, undefined);
  });

  it('flushes immediately if surveyor switches claim before 15 seconds', async () => {
    activeHook = renderHook(() => useCloudSync());

    // Switch tab on Claim 1 (starts debounce timer)
    useUIStore.setState({ activeTab: 'policy' });
    activeHook.rerender();

    // Wait 3 seconds
    await vi.advanceTimersByTimeAsync(3_000);
    expect(mockPushClaimToCloud).not.toHaveBeenCalled();

    // Surveyor opens Claim 2 (Milestone 2b)
    useClaimStore.setState({ currentClaim: fakeClaim2 });
    activeHook.rerender();

    // Flush microtasks for the async push
    await vi.waitFor(() => {
      expect(mockPushClaimToCloud).toHaveBeenCalledTimes(1);
    });
    expect(mockPushClaimToCloud).toHaveBeenCalledWith('surveyor-123', fakeClaim1, undefined);

    // Advance past the original 15s timer
    await vi.advanceTimersByTimeAsync(15_000);

    // Ensure no duplicate push was triggered
    expect(mockPushClaimToCloud).toHaveBeenCalledTimes(1);
  });

  it('flushes immediately if page visibility becomes hidden during quiet window', async () => {
    activeHook = renderHook(() => useCloudSync());

    // Switch tab on Claim 1 (starts debounce timer)
    useUIStore.setState({ activeTab: 'policy' });
    activeHook.rerender();

    // Wait 4 seconds
    await vi.advanceTimersByTimeAsync(4_000);
    expect(mockPushClaimToCloud).not.toHaveBeenCalled();

    // Surveyor minimizes or backgrounds tab
    (document as any).visibilityState = 'hidden';
    documentListeners['visibilitychange']?.forEach(fn => fn());

    // Immediately pushed
    await vi.waitFor(() => {
      expect(mockPushClaimToCloud).toHaveBeenCalledTimes(1);
    });
    expect(mockPushClaimToCloud).toHaveBeenCalledWith('surveyor-123', fakeClaim1, undefined);

    // Advance 15s — no duplicate push
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockPushClaimToCloud).toHaveBeenCalledTimes(1);
  });

  it('flushes immediately if page unloads (beforeunload) during quiet window', async () => {
    activeHook = renderHook(() => useCloudSync());

    // Switch tab on Claim 1 (starts debounce timer)
    useUIStore.setState({ activeTab: 'policy' });
    activeHook.rerender();

    // Wait 2 seconds
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mockPushClaimToCloud).not.toHaveBeenCalled();

    // Window unloads
    windowListeners['beforeunload']?.forEach(fn => fn());

    // Pending push flushed immediately
    await vi.waitFor(() => {
      expect(mockPushClaimToCloud).toHaveBeenCalledTimes(1);
    });
    expect(mockPushClaimToCloud).toHaveBeenCalledWith('surveyor-123', fakeClaim1, undefined);

    // Advance 15s — no duplicate push
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockPushClaimToCloud).toHaveBeenCalledTimes(1);
  });

  it('clears debounce timer on unmount without pushing', async () => {
    activeHook = renderHook(() => useCloudSync());

    // Switch tab (starts debounce timer)
    useUIStore.setState({ activeTab: 'policy' });
    activeHook.rerender();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(mockPushClaimToCloud).not.toHaveBeenCalled();

    // Hook unmounts
    activeHook.unmount();
    activeHook = null;

    // Advance time past the 15s mark
    await vi.advanceTimersByTimeAsync(20_000);

    // Should NOT have pushed after unmount
    expect(mockPushClaimToCloud).not.toHaveBeenCalled();
  });
});
