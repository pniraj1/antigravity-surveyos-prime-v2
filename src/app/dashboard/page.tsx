'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { useClaimsLoader } from '@/hooks/useClaimsLoader';
import Dashboard from '@/components/layout/Dashboard';
import { DriveGateScreen } from '@/components/auth/DriveGateScreen';

/**
 * /dashboard — authenticated app shell.
 * AuthGate (in layout.tsx) guarantees only authenticated users reach here.
 * SubscriptionGuard handles pending/suspended overlays before this renders.
 */
export default function DashboardPage() {
  const { isAuthenticated, loading } = useAuthStore();
  const { isDriveConnected } = useUIStore();
  const subscriptionStatus = useProfileStore((s) => s.profile.subscriptionStatus);

  // Prevent search engines from indexing the authenticated dashboard.
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"][data-dynamic]');
    if (isAuthenticated && !loading) {
      if (!existing) {
        const el = document.createElement('meta');
        el.setAttribute('name', 'robots');
        el.setAttribute('content', 'noindex, nofollow');
        el.setAttribute('data-dynamic', 'true');
        document.head.appendChild(el);
      }
    } else {
      existing?.remove();
    }
    return () => {
      document.querySelector('meta[name="robots"][data-dynamic]')?.remove();
    };
  }, [isAuthenticated, loading]);

  // Hydrate claims list and sync across tabs.
  useClaimsLoader();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">Loading SurveyOS</span>
        </div>
      </div>
    );
  }

  // ── Drive gate: only for approved subscription tiers ──────────────────────
  const APPROVED_TIERS = new Set(['active', 'trial', 'readonly']);
  if (APPROVED_TIERS.has(subscriptionStatus) && !isDriveConnected) {
    return <DriveGateScreen />;
  }

  return <Dashboard />;
}
