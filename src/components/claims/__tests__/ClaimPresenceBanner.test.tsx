import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ClaimPresenceBanner,
  ClaimPresenceBannerView,
} from '../ClaimPresenceBanner';
import * as presenceHookModule from '@/hooks/useClaimPresence';
import { useClaimStore } from '@/stores/claim-store';

describe('ClaimPresenceBanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when no other user is active', () => {
    vi.spyOn(presenceHookModule, 'useClaimPresence').mockReturnValue({
      activePresence: null,
      isOtherUserActive: false,
    });

    const html = renderToStaticMarkup(<ClaimPresenceBanner />);
    expect(html).toBe('');
  });

  it('renders null when presence exists but belongs to current user (isOtherUserActive is false)', () => {
    vi.spyOn(presenceHookModule, 'useClaimPresence').mockReturnValue({
      activePresence: {
        userUid: 'my-uid',
        userEmail: 'me@surveyfirm.in',
        userName: 'Myself',
        updatedAt: Date.now(),
      },
      isOtherUserActive: false,
    });

    const html = renderToStaticMarkup(<ClaimPresenceBanner />);
    expect(html).toBe('');
  });

  it('renders alert banner with amber styling and warning message when another user is active', () => {
    const fixedNow = 1_700_000_000_000;
    vi.spyOn(presenceHookModule, 'useClaimPresence').mockReturnValue({
      activePresence: {
        userUid: 'other-uid',
        userEmail: 'rajesh@surveyfirm.in',
        userName: 'Rajesh Sharma',
        updatedAt: fixedNow - 30_000,
      },
      isOtherUserActive: true,
    });
    vi.spyOn(presenceHookModule, 'formatTimeAgo').mockReturnValue('just now');

    const html = renderToStaticMarkup(<ClaimPresenceBanner />);

    // Content check
    expect(html).toContain('Rajesh Sharma (rajesh@surveyfirm.in) is currently working on this claim (just now). Coordinate before saving to prevent overwriting changes.');
    // Amber styling check
    expect(html).toContain('bg-amber-500/10');
    expect(html).toContain('border-amber-500/30');
    expect(html).toContain('text-amber-900');
    expect(html).toContain('dark:text-amber-200');
    // Role check
    expect(html).toContain('role="alert"');
  });

  it('renders correctly when active colleague has no email', () => {
    vi.spyOn(presenceHookModule, 'useClaimPresence').mockReturnValue({
      activePresence: {
        userUid: 'other-uid',
        userEmail: '',
        userName: 'Vikram Patel',
        updatedAt: Date.now(),
      },
      isOtherUserActive: true,
    });
    vi.spyOn(presenceHookModule, 'formatTimeAgo').mockReturnValue('2 mins ago');

    const html = renderToStaticMarkup(<ClaimPresenceBanner />);

    expect(html).toContain('Vikram Patel is currently working on this claim (2 mins ago). Coordinate before saving to prevent overwriting changes.');
    expect(html).not.toContain('()');
  });

  describe('ClaimPresenceBannerView', () => {
    it('renders pure view component with provided activePresence and timeAgo', () => {
      const activePresence: presenceHookModule.ClaimPresence = {
        userUid: 'other-uid-2',
        userEmail: 'anita@firm.in',
        userName: 'Anita Rao',
        updatedAt: 1_700_000_000_000,
      };

      const html = renderToStaticMarkup(
        <ClaimPresenceBannerView activePresence={activePresence} timeAgo="3 mins ago" />
      );

      expect(html).toContain('Anita Rao (anita@firm.in) is currently working on this claim (3 mins ago). Coordinate before saving to prevent overwriting changes.');
      expect(html).toContain('role="alert"');
      expect(html).toContain('bg-amber-500/10');
    });
  });
});
