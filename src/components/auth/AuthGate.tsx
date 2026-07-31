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
  // Every marketing and legal page must be here. A page missing from this list
  // still serves its correct static HTML, then React swaps it for the landing
  // page on hydration — so a logged-out prospect sees the right page flash and
  // vanish. Add new public routes here at the same time you create them.
  const publicRoutes = [
    '/landing', '/blog', '/products', '/screenshots',
    '/features', '/pricing', '/about', '/faq', '/contact',
    '/privacy', '/terms', '/refund',
  ];
  if (SANDBOX_MODE || publicRoutes.some((r) => pathname?.startsWith(r))) return <>{children}</>;

  // Firebase is still checking the session — show a silent loader
  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-neutral-50"
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse shadow-md bg-neutral-900"
        >
          <Shield size={22} className="text-primary" />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
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
