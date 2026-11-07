'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useClaimPresence, formatTimeAgo, type ClaimPresence } from '@/hooks/useClaimPresence';

export interface ClaimPresenceBannerViewProps {
  activePresence: ClaimPresence;
  timeAgo: string;
}

export function ClaimPresenceBannerView({ activePresence, timeAgo }: ClaimPresenceBannerViewProps) {
  const userName = activePresence.userName || 'Team Member';
  const emailPart = activePresence.userEmail ? ` (${activePresence.userEmail})` : '';

  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 sm:px-5 py-2.5 text-sm text-amber-900 dark:text-amber-200"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>
        {userName}{emailPart} is currently working on this claim ({timeAgo}). Coordinate before saving to prevent overwriting changes.
      </span>
    </div>
  );
}

export function ClaimPresenceBanner() {
  const claimId = useClaimStore((s) => s.currentClaim?.id);
  const { activePresence, isOtherUserActive } = useClaimPresence(claimId);

  if (!isOtherUserActive || !activePresence) {
    return null;
  }

  const timeAgo = formatTimeAgo(activePresence.updatedAt);

  return <ClaimPresenceBannerView activePresence={activePresence} timeAgo={timeAgo} />;
}
