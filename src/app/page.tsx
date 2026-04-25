'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useClaimsLoader } from '@/hooks/useClaimsLoader';
import LandingPage from './landing/page';
import Dashboard from '@/components/layout/Dashboard';
import { DriveGateScreen } from '@/components/auth/DriveGateScreen';

/**
 * SurveyOS Root Router
 * 
 * Decides whether to show the Marketing Landing Page or the 
 * Application Dashboard based on the user's authentication state.
 */
export default function Home() {
  const { isAuthenticated, loading } = useAuthStore();

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
  const { isDriveConnected } = useUIStore();
  
  // Hydrate claims list and sync across tabs
  useClaimsLoader();

  // If we are still checking firebase auth state, we show nothing (or a splash)
  // to avoid flickering the landing page before the dashboard.
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

  // Guest users see the marketing splash
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Drive must be linked before accessing the dashboard
  if (!isDriveConnected) {
    return <DriveGateScreen />;
  }

  // Authenticated + Drive linked — enter the main app
  return <Dashboard />;
}
