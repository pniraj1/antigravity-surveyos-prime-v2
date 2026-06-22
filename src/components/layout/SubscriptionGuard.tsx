'use client';

import { useEffect } from 'react';
import { useProfileStore } from '@/stores/profile-store';
import { useAuthStore } from '@/stores/auth-store';
import { usePathname, useRouter } from 'next/navigation';
import { Lock, CreditCard, Mail, Eye } from 'lucide-react';
import { calculateSubscriptionState, getDaysRemaining, isInWarningPeriod } from '@/lib/subscription/status';
import { TrialBadge } from '@/components/subscription/TrialBadge';
import { PaymentSubmissionForm } from '@/components/subscription/PaymentSubmissionForm';

const SANDBOX_MODE = process.env.NEXT_PUBLIC_SANDBOX_MODE === 'true';

function ExpiryWarningBanner({ daysLeft, label }: { daysLeft: number; label: string }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-status-warning text-foreground text-center py-2 px-4 text-sm font-medium backdrop-blur-sm">
      ⚠️ Your {label} expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}. Please make a payment to continue uninterrupted access.
    </div>
  );
}

function ReadonlyOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-neutral-900 text-neutral-50">
      <div className="min-h-full flex flex-col items-center justify-start py-12 px-6">
        <div className="w-full max-w-lg space-y-8 animate-in fade-in zoom-in duration-500">

          {/* Header */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-status-warning-tint rounded-full flex items-center justify-center">
              <Eye className="text-status-warning" size={40} />
            </div>
            <h1 className="text-3xl font-medium tracking-tight">Subscription Expired</h1>
            <p className="text-neutral-400 font-medium">
              Your access period has ended. Submit your payment below to restore full access.
              Existing claims remain visible in read-only mode.
            </p>
          </div>

          {/* Status cards */}
          <div className="p-5 bg-neutral-800 rounded-2xl border border-neutral-700 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Account Status</span>
              <span className="font-medium text-status-warning uppercase tracking-wider">Read-Only</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">UPI Payment ID</span>
              <span className="font-mono font-medium text-neutral-50">surveyosprime@upi</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Support</span>
              <a href="mailto:surveyosprime@gmail.com" className="font-medium text-primary hover:underline">
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
              className="text-sm font-medium text-neutral-400 hover:text-neutral-50 transition-colors"
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-900 text-neutral-50 p-6 text-center">
      <div className="max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="mx-auto w-20 h-20 bg-status-danger-tint rounded-full flex items-center justify-center">
          <Lock className="text-status-danger" size={40} />
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-medium tracking-tight">Access Suspended</h1>
          <p className="text-neutral-400 font-medium">
            Your SurveyOS-Prime account has been suspended by the administrator.
            Please contact support for more information.
          </p>
        </div>

        <div className="grid gap-4">
          <a
            href="mailto:surveyosprime@gmail.com"
            className="flex items-center justify-center gap-2 w-full py-4 bg-primary text-primary-foreground font-medium rounded-xl hover:scale-105 transition-transform"
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
  const pathname = usePathname();
  const router = useRouter();

  const isAdminUser = profile.isAdmin;
  const effectiveState = calculateSubscriptionState(profile);
  const onAccessRequest = pathname?.startsWith('/access-request');

  // Redirect pending users to the split-panel /access-request page
  useEffect(() => {
    if (!isAuthenticated || isAdminUser || SANDBOX_MODE) return;
    if (effectiveState === 'pending' && !onAccessRequest) {
      router.replace('/access-request');
    }
  }, [isAuthenticated, isAdminUser, effectiveState, onAccessRequest, router]);

  if (SANDBOX_MODE || pathname?.startsWith('/landing') || onAccessRequest) return <>{children}</>;

  if (!isAuthenticated || isAdminUser) return <>{children}</>;

  // Still pending and redirect in flight — render nothing to avoid flash
  if (effectiveState === 'pending') return null;

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
