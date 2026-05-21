'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import LandingPage from '@/app/landing/page';
import { Shield } from 'lucide-react';

/**
 * AuthGate — blocks access to the entire app until the user is authenticated.
 * Shows a loading spinner while Firebase resolves the auth state,
 * then either renders the app or the sign-in screen.
 */
const SANDBOX_MODE = process.env.NEXT_PUBLIC_SANDBOX_MODE === 'true';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuthStore();
  const pathname = usePathname();

  // ── Sandbox & Public Route bypass: skip auth entirely ──
  if (SANDBOX_MODE || pathname?.startsWith('/landing') || pathname?.startsWith('/signup')) return <>{children}</>;

  // Firebase is still checking the session — show a silent loader
  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center gap-4"
        style={{ background: '#F8F9FA' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse shadow-md"
          style={{ background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)' }}
        >
          <Shield size={22} style={{ color: '#D4AF37' }} />
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#8D99AE]">
          Initialising SurveyOS...
        </p>
      </div>
    );
  }

  // Not signed in — show the landing page (which has login buttons)
  if (!isAuthenticated) {
    // We import this dynamically or just use the root redirect logic.
    // However, since AuthGate is a wrapper, returning the LandingPage here is a robust fallback.
    return <LandingPage />;
  }

  // Authenticated — render the full application
  return <>{children}</>;
}
