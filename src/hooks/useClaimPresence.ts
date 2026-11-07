'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';
import { isSandbox } from '@/lib/sandbox';
import { logger } from '@/lib/utils/logger';

export interface ClaimPresence {
  userUid: string;
  userEmail: string;
  userName: string;
  updatedAt: number; // Date.now()
}

export function isRecentPresence(
  presence: ClaimPresence | null | undefined,
  currentUid: string,
  now: number = Date.now(),
  thresholdMs: number = 5 * 60 * 1000 // 5 minutes
): boolean {
  if (!presence || !presence.userUid || !presence.updatedAt) return false;
  if (presence.userUid === currentUid) return false; // Own presence
  return now - presence.updatedAt < thresholdMs && now >= presence.updatedAt;
}

export function formatTimeAgo(timestamp: number, now: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return '1 min ago';
  return `${diffMin} mins ago`;
}

export interface UseClaimPresenceReturn {
  activePresence: ClaimPresence | null;
  isOtherUserActive: boolean;
}

export function useClaimPresence(claimId?: string | null): UseClaimPresenceReturn {
  const { user, activeWorkspaceUid } = useAuthStore();
  const [activePresence, setActivePresence] = useState<ClaimPresence | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const workspaceUid = activeWorkspaceUid || user?.uid;
  const disabled = !claimId || !user || !workspaceUid || isSandbox();

  useEffect(() => {
    if (disabled) {
      setActivePresence(null);
      return;
    }

    const presenceRef = doc(db, 'users', workspaceUid, 'claim_presence', claimId);

    const writeHeartbeat = async () => {
      try {
        await setDoc(presenceRef, {
          userUid: user.uid,
          userEmail: user.email || '',
          userName: user.displayName || user.email?.split('@')[0] || 'Team Member',
          updatedAt: Date.now(),
        });
      } catch (err) {
        logger.error('[useClaimPresence] heartbeat write failed:', err);
      }
    };

    void writeHeartbeat();

    const heartbeatInterval = setInterval(() => {
      void writeHeartbeat();
    }, 30_000);

    const unsubscribe = onSnapshot(
      presenceRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as ClaimPresence;
          setActivePresence(data);
        } else {
          setActivePresence(null);
        }
      },
      (err) => {
        logger.error('[useClaimPresence] snapshot listener error:', err);
      }
    );

    return () => {
      clearInterval(heartbeatInterval);
      unsubscribe();
    };
  }, [claimId, user?.uid, user?.email, user?.displayName, workspaceUid, disabled]);

  useEffect(() => {
    if (disabled) return;
    const tickInterval = setInterval(() => {
      setNow(Date.now());
    }, 10_000);
    return () => clearInterval(tickInterval);
  }, [disabled]);

  if (disabled) {
    return { activePresence: null, isOtherUserActive: false };
  }

  const isOtherUserActive = isRecentPresence(activePresence, user.uid, now);

  return {
    activePresence,
    isOtherUserActive,
  };
}
