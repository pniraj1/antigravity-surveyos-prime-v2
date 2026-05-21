'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useProfileStore } from '@/stores/profile-store';
import { useAuthStore } from '@/stores/auth-store';
import { Lock, Mail, Eye } from 'lucide-react';
import { calculateSubscriptionState, getDaysRemaining, isInWarningPeriod } from '@/lib/subscription/status';
import { TrialBadge } from '@/components/subscription/TrialBadge';
import { PaymentSubmissionForm } from '@/components/subscription/PaymentSubmissionForm';

const SANDBOX_MODE = process.env.NEXT_PUBLIC_SANDBOX_MODE === 'true';

function ExpiryWarningBanner({ daysLeft, label }: { daysLeft: number; label: string }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-amber-500/90 text-black text-center py-2 px-4 text-sm font-bold backdrop-blur-sm">
      ⚠️ Your {label} expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}. Please make a payment to continue uninterrupted access.
    </div>
  );
}

function ReadonlyOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[#0D1B2A] text-white">
      <div className="min-h-full flex flex-col items-center justify-start py-12 px-6">
        <div className="w-full max-w-lg space-y-8 animate-in fade-in zoom-in duration-500">

          {/* Header */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center">
              <Eye className="text-amber-500" size={40} />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Subscription Expired</h1>
            <p className="text-slate-400 font-medium">
              Your access period has ended. Submit your payment below to restore full access.
              Existing claims remain visible in read-only mode.
            </p>
          </div>

          {/* Status cards */}
          <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Account Status</span>
              <span className="font-bold text-amber-400 uppercase tracking-wider">Read-Only</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">UPI Payment ID</span>
              <span className="font-mono font-bold text-white">surveyosprime@upi</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Support</span>
              <a href="mailto:surveyosprime@gmail.com" className="font-bold text-[#D4AF37] hover:underline">
                surveyosprime@gmail.com
              </a>
            </div>
          </div>

          {/* Payment submission form */}
          <PaymentSubmissionForm />

          {/* Footer */}
          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              Already submitted? Click to refresh status
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

function SuspendedOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0D1B2A] text-white p-6 text-center">
      <div className="max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="mx-auto w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
          <Lock className="text-red-500" size={40} />
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-black tracking-tight">Access Suspended</h1>
          <p className="text-slate-400 font-medium">
            Your SurveyOS-Prime account has been suspended by the administrator.
            Please contact support for more information.
          </p>
        </div>

        <div className="grid gap-4">
          <a
            href="mailto:surveyosprime@gmail.com"
            className="flex items-center justify-center gap-2 w-full py-4 bg-[#D4AF37] text-[#0D1B2A] font-black rounded-xl hover:scale-105 transition-transform"
          >
            <Mail size={18} />
            Contact Admin
          </a>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useProfileStore();
  const { isAuthenticated } = useAuthStore();
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();

  const MASTER_ADMIN_UID = process.env.NEXT_PUBLIC_MASTER_ADMIN_UID;
  const isAdminUser = profile.isAdmin || (user && MASTER_ADMIN_UID && user.uid === MASTER_ADMIN_UID);

  const effectiveState = calculateSubscriptionState(profile);
  const isPending = effectiveState === 'pending';
  const onAccessRequest = pathname?.startsWith('/access-request');

  // Redirect pending users to /access-request so the URL reflects their state.
  // Skip if already there to avoid a redirect loop.
  useEffect(() => {
    if (!isAuthenticated || isAdminUser || !isPending || onAccessRequest) return;
    if (SANDBOX_MODE) return;
    router.replace('/access-request');
  }, [isAuthenticated, isAdminUser, isPending, onAccessRequest, router]);

  // Always pass through: sandbox, public routes, unauthenticated, admins,
  // and the /access-request page itself (rendered by its own page.tsx).
  if (
    SANDBOX_MODE ||
    pathname?.startsWith('/landing') ||
    pathname?.startsWith('/signup') ||
    onAccessRequest ||
    !isAuthenticated ||
    isAdminUser
  ) return <>{children}</>;

  // While redirect is in flight for pending users, render nothing.
  if (isPending) return null;

  if (effectiveState === 'suspended') {
    return <SuspendedOverlay />;
  }

  if (effectiveState === 'readonly') {
    return <ReadonlyOverlay />;
  }

  const expiryDate = effectiveState === 'trial' ? profile.trialEndDate : profile.subscriptionExpiry;
  const daysLeft = getDaysRemaining(expiryDate);
  const showWarning = isInWarningPeriod(expiryDate);

  return (
    <>
      {showWarning && (
        <ExpiryWarningBanner
          daysLeft={daysLeft}
          label={effectiveState === 'trial' ? 'free trial' : 'subscription'}
        />
      )}
      {effectiveState === 'trial' && <TrialBadge daysLeft={daysLeft} />}
      <div className={showWarning ? 'pt-10' : ''}>
        {children}
      </div>
    </>
  );
}
