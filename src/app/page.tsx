'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Root route — pure redirect gate.
 * Authenticated  → /dashboard
 * Unauthenticated → /landing
 */
export default function Home() {
  const { isAuthenticated, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(isAuthenticated ? '/dashboard' : '/landing');
  }, [isAuthenticated, loading, router]);

  // Neutral splash while auth resolves.
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
