'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { useClaimsLoader } from '@/hooks/useClaimsLoader';
import LandingPage from './landing/page';
import Dashboard from '@/components/layout/Dashboard';
import { DriveGateScreen } from '@/components/auth/DriveGateScreen';

/**
 * SurveyOS Root Router
 *
 * Routing priority (evaluated top-to-bottom):
 * 1. Auth still loading  → neutral splash (never flash DriveGateScreen)
 * 2. Not authenticated   → LandingPage
 * 3. Subscription not approved (pending/suspended/etc.) → Dashboard (let it handle the paywall)
 * 4. Drive not connected → DriveGateScreen
 * 5. All clear           → Dashboard
 *
 * DriveGateScreen is ONLY shown when ALL of the following are true:
 *   - loading === false  (Firebase auth resolved)
 *   - isAuthenticated === true
 *   - subscriptionStatus is an approved tier (active | trial | readonly)
 *   - isDriveConnected === false  (trusted only after auth confirmed)
 */
export default function Home() {
  const { isAuthenticated, loading } = useAuthStore();
  const { isDriveConnected } = useUIStore();
  const subscriptionStatus = useProfileStore((s) => s.profile.subscriptionStatus);

  // Inject noindex for authenticated sessions — prevents app dashboard from being indexed.
  // Googlebot never has Firebase auth, so it always sees the landing page with index,follow.
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

  // Hydrate claims list and sync across tabs
  useClaimsLoader();

  // ── 1. Auth loading: show neutral splash — never flash DriveGateScreen ──
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

  // ── 2. Unauthenticated: always show landing, never DriveGateScreen ──
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // ── 3. Subscription gate: only show DriveGateScreen for approved tiers ──
  // pending / suspended users go straight to Dashboard which handles paywall UI.
  const APPROVED_TIERS = new Set(['active', 'trial', 'readonly']);
  const isApproved = APPROVED_TIERS.has(subscriptionStatus);

  if (!isApproved) {
    return <Dashboard />;
  }

  // ── 4. Drive not connected: only trust isDriveConnected AFTER auth confirmed ──
  if (!isDriveConnected) {
    return <DriveGateScreen />;
  }

  // ── 5. Authenticated + approved subscription + Drive linked ──
  return <Dashboard />;
}
