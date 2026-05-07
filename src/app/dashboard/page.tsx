'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useClaimsLoader } from '@/hooks/useClaimsLoader';
import Dashboard from '@/components/layout/Dashboard';
import { DriveGateScreen } from '@/components/auth/DriveGateScreen';

export default function DashboardPage() {
  const { isAuthenticated, loading } = useAuthStore();
  const { isDriveConnected } = useUIStore();
  const router = useRouter();

  // Hydrate claims list and sync across tabs
  useClaimsLoader();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login/');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">
            Loading SurveyOS
          </span>
        </div>
      </div>
    );
  }

  // Router replace is in flight; render nothing to avoid flash
  if (!isAuthenticated) return null;

  if (!isDriveConnected) {
    return <DriveGateScreen />;
  }

  return <Dashboard />;
}
