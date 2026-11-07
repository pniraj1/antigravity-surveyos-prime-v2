import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const overrides = {
    useEffect: vi.fn(),
    useCallback: <T,>(fn: T) => fn,
    useDebugValue: () => {},
    useSyncExternalStore: <T,>(_sub: unknown, getSnapshot: () => T) => getSnapshot(),
    useState: <T,>(init: T) => [typeof init === 'function' ? (init as () => T)() : init, vi.fn()],
  };
  return { ...actual, ...overrides, default: { ...actual, ...overrides } };
});

import {
  isRecentPresence,
  formatTimeAgo,
  useClaimPresence,
  type ClaimPresence,
} from '../useClaimPresence';
import { useAuthStore } from '@/stores/auth-store';
import * as sandboxModule from '@/lib/sandbox';

describe('useClaimPresence', () => {
  describe('isRecentPresence', () => {
    const now = 1_700_000_000_000;
    const currentUid = 'user-me';

    it('returns true for recent presence from another user within 5 minutes', () => {
      const presence: ClaimPresence = {
        userUid: 'user-other',
        userEmail: 'colleague@example.com',
        userName: 'Colleague',
        updatedAt: now - 60_000, // 1 min ago
      };

      expect(isRecentPresence(presence, currentUid, now)).toBe(true);
    });

    it('returns false for own presence even if updated 1 second ago', () => {
      const presence: ClaimPresence = {
        userUid: currentUid,
        userEmail: 'me@example.com',
        userName: 'Me',
        updatedAt: now - 1_000,
      };

      expect(isRecentPresence(presence, currentUid, now)).toBe(false);
    });

    it('returns false for expired presence older than 5 minutes (> 300,000 ms)', () => {
      const presence: ClaimPresence = {
        userUid: 'user-other',
        userEmail: 'colleague@example.com',
        userName: 'Colleague',
        updatedAt: now - (5 * 60 * 1000 + 1000), // 5 min 1 sec ago
      };

      expect(isRecentPresence(presence, currentUid, now)).toBe(false);
    });

    it('returns false exactly at the 5 minute threshold (boundary condition)', () => {
      const presence: ClaimPresence = {
        userUid: 'user-other',
        userEmail: 'colleague@example.com',
        userName: 'Colleague',
        updatedAt: now - 5 * 60 * 1000,
      };

      expect(isRecentPresence(presence, currentUid, now)).toBe(false);
    });

    it('returns false for future presence (clock skew / now < updatedAt)', () => {
      const presence: ClaimPresence = {
        userUid: 'user-other',
        userEmail: 'colleague@example.com',
        userName: 'Colleague',
        updatedAt: now + 5_000, // in future
      };

      expect(isRecentPresence(presence, currentUid, now)).toBe(false);
    });

    it('returns false for null or undefined presence', () => {
      expect(isRecentPresence(null, currentUid, now)).toBe(false);
      expect(isRecentPresence(undefined, currentUid, now)).toBe(false);
    });

    it('returns false if userUid or updatedAt is missing or invalid', () => {
      const noUid = {
        userUid: '',
        userEmail: 'test@example.com',
        userName: 'Test',
        updatedAt: now - 1000,
      } as ClaimPresence;
      const noTimestamp = {
        userUid: 'user-other',
        userEmail: 'test@example.com',
        userName: 'Test',
        updatedAt: 0,
      } as ClaimPresence;

      expect(isRecentPresence(noUid, currentUid, now)).toBe(false);
      expect(isRecentPresence(noTimestamp, currentUid, now)).toBe(false);
    });

    it('supports custom thresholdMs parameter', () => {
      const presence: ClaimPresence = {
        userUid: 'user-other',
        userEmail: 'colleague@example.com',
        userName: 'Colleague',
        updatedAt: now - 30_000, // 30 sec ago
      };

      // 20s threshold -> expired
      expect(isRecentPresence(presence, currentUid, now, 20_000)).toBe(false);
      // 40s threshold -> recent
      expect(isRecentPresence(presence, currentUid, now, 40_000)).toBe(true);
    });
  });

  describe('formatTimeAgo', () => {
    const now = 1_700_000_000_000;

    it('returns "just now" for timestamps less than 60 seconds ago', () => {
      expect(formatTimeAgo(now, now)).toBe('just now');
      expect(formatTimeAgo(now - 10_000, now)).toBe('just now');
      expect(formatTimeAgo(now - 59_000, now)).toBe('just now');
      expect(formatTimeAgo(now - 59_999, now)).toBe('just now');
    });

    it('returns "just now" if timestamp is in the future (diffSec is clamped to 0)', () => {
      expect(formatTimeAgo(now + 10_000, now)).toBe('just now');
    });

    it('returns "1 min ago" for timestamps between 60 and 119 seconds ago', () => {
      expect(formatTimeAgo(now - 60_000, now)).toBe('1 min ago');
      expect(formatTimeAgo(now - 90_000, now)).toBe('1 min ago');
      expect(formatTimeAgo(now - 119_000, now)).toBe('1 min ago');
    });

    it('returns "X mins ago" for timestamps 2 or more minutes ago', () => {
      expect(formatTimeAgo(now - 120_000, now)).toBe('2 mins ago');
      expect(formatTimeAgo(now - 180_000, now)).toBe('3 mins ago');
      expect(formatTimeAgo(now - 300_000, now)).toBe('5 mins ago');
      expect(formatTimeAgo(now - 3_600_000, now)).toBe('60 mins ago');
    });
  });

  describe('useClaimPresence hook guard states', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: null,
        activeWorkspaceUid: null,
      });
      vi.restoreAllMocks();
    });

    it('returns null presence and false active status when claimId is undefined', () => {
      const res = useClaimPresence(undefined);
      expect(res.activePresence).toBeNull();
      expect(res.isOtherUserActive).toBe(false);
    });

    it('returns null presence and false active status when user is not logged in', () => {
      const res = useClaimPresence('claim-123');
      expect(res.activePresence).toBeNull();
      expect(res.isOtherUserActive).toBe(false);
    });

    it('returns null presence and false active status in sandbox mode', () => {
      vi.spyOn(sandboxModule, 'isSandbox').mockReturnValue(true);
      useAuthStore.setState({
        user: { uid: 'u1', email: 'u1@example.com' } as any,
        activeWorkspaceUid: 'w1',
      });

      const res = useClaimPresence('claim-123');
      expect(res.activePresence).toBeNull();
      expect(res.isOtherUserActive).toBe(false);
    });
  });
});
