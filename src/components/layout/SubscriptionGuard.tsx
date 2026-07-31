'use client';

import { useEffect, useState } from 'react';
import { useProfileStore } from '@/stores/profile-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { usePathname, useRouter } from 'next/navigation';
import { Lock, Mail, Eye, Clock } from 'lucide-react';
import { calculateSubscriptionState, getDaysRemaining, isInWarningPeriod } from '@/lib/subscription/status';
import { TrialBadge } from '@/components/subscription/TrialBadge';
import { PaymentSubmissionForm } from '@/components/subscription/PaymentSubmissionForm';
import { getUserPayments } from '@/lib/firebase/payments';
import { UPI_ID } from '@/lib/subscription/plans';
import type { PaymentRecord } from '@/types/payment';

const SANDBOX_MODE = process.env.NEXT_PUBLIC_SANDBOX_MODE === 'true';

function ExpiryWarningBanner({ daysLeft, label }: { daysLeft: number; label: string }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-status-warning text-foreground text-center py-2 px-4 text-sm font-medium backdrop-blur-sm">
      ⚠️ Your {label} expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}.{' '}
      {/* Same setter the sidebar uses — the renewal form lives in Profile. */}
      <button
        onClick={() => useUIStore.getState().setActiveTab('profile')}
        className="underline font-semibold hover:opacity-80"
      >
        Renew now →
      </button>
    </div>
  );
}

function ReadonlyOverlay() {
  const uid = useAuthStore((s) => s.user?.uid);
  const [pending, setPending] = useState<PaymentRecord | null>(null);
  const [checked, setChecked] = useState(false);

  // A user who already paid must not be greeted by "submit your payment" —
  // that reads as "your money vanished". Lead with the under-review state.
  useEffect(() => {
    if (!uid) { setChecked(true); return; }
    getUserPayments(uid)
      .then((all) => setPending(all.find((p) => p.status === 'pending') ?? null))
      .catch(() => setPending(null))
      .finally(() => setChecked(true));
  }, [uid]);

  if (!checked) return <div className="fixed inset-0 z-[9999] bg-neutral-900" />;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-neutral-900 text-neutral-50">
      <div className="min-h-full flex flex-col items-center justify-start py-12 px-6">
        <div className="w-full max-w-lg space-y-8 animate-in fade-in zoom-in duration-500">

          {/* Header — differs when a payment is awaiting verification */}
          {pending ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-20 h-20 bg-status-warning-tint rounded-full flex items-center justify-center">
                <Clock className="text-status-warning" size={40} />
              </div>
              <h1 className="text-3xl font-medium tracking-tight">Payment Under Review</h1>
              <p className="text-neutral-400 font-medium">
                We received your payment of{' '}
                <span className="text-neutral-50 font-semibold">₹{pending.amount}</span>{' '}
                (Txn {pending.transactionId}) submitted on{' '}
                {new Date(pending.submittedAt).toLocaleDateString('en-IN')}.
                Your access will be restored as soon as it is verified — usually within a few hours.
              </p>
            </div>
          ) : (
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
          )}

          {/* Status cards */}
          <div className="p-5 bg-neutral-800 rounded-2xl border border-neutral-700 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Account Status</span>
              <span className="font-medium text-status-warning uppercase tracking-wider">Read-Only</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">UPI Payment ID</span>
              <span className="font-mono font-medium text-neutral-50">{UPI_ID}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Support</span>
              <a href="mailto:surveyosprime@gmail.com" className="font-medium text-primary hover:underline">
                surveyosprime@gmail.com
              </a>
            </div>
          </div>

          {/* Payment submission form — hidden behind the review notice once a
              payment is pending, so nobody pays twice by reflex */}
          {pending ? (
            <details className="group">
              <summary className="cursor-pointer text-center text-sm font-medium text-neutral-400 hover:text-neutral-50 transition-colors list-none">
                Paid a different amount or need to submit another payment?
              </summary>
              <div className="mt-4">
                <PaymentSubmissionForm />
              </div>
            </details>
          ) : (
            <PaymentSubmissionForm />
          )}

          {/* Footer */}
          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-medium text-neutral-400 hover:text-neutral-50 transition-colors"
            >
              {pending ? 'Verified already? Click to refresh access' : 'Already submitted? Click to refresh status'}
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
