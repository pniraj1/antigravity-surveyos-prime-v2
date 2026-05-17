'use client';

import { useProfileStore } from '@/stores/profile-store';
import { useAuthStore } from '@/stores/auth-store';
import { usePathname } from 'next/navigation';
import { Lock, CreditCard, Mail, Eye } from 'lucide-react';
import { AccessRequestForm, AccessRequestConfirmation } from './AccessRequestForm';
import { calculateSubscriptionState, getDaysRemaining, isInWarningPeriod } from '@/lib/subscription/status';
import { TrialBadge } from '@/components/subscription/TrialBadge';

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0D1B2A] text-white p-6 text-center">
      <div className="max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="mx-auto w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center">
          <Eye className="text-amber-500" size={40} />
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-black tracking-tight">Subscription Expired</h1>
          <p className="text-slate-400 font-medium">
            Your access period has ended. You can still view your existing claims in read-only mode,
            but creating new claims and AI tools are disabled until payment is made.
          </p>
        </div>

        <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Account Status:</span>
            <span className="font-bold text-amber-400 uppercase tracking-wider">Read-Only</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Action Required:</span>
            <span className="font-bold text-white">Complete Payment</span>
          </div>
        </div>

        <div className="p-4 bg-emerald-900/30 rounded-xl border border-emerald-700/40 space-y-2">
          <p className="text-xs text-emerald-300 font-bold uppercase tracking-wider">Payment Details</p>
          <p className="text-sm text-slate-300">
            UPI: <span className="font-mono font-bold text-white">surveyosprime@upi</span>
          </p>
          <p className="text-xs text-slate-400">
            After payment, enter your Transaction ID below or email us at surveyosprime@gmail.com
          </p>
        </div>

        <div className="grid gap-4">
          <a
            href="mailto:surveyosprime@gmail.com?subject=Payment%20for%20SurveyOS%20Prime"
            className="flex items-center justify-center gap-2 w-full py-4 bg-[#D4AF37] text-[#0D1B2A] font-black rounded-xl hover:scale-105 transition-transform"
          >
            <CreditCard size={18} />
            Contact Admin for Payment
          </a>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-bold text-slate-400 hover:text-white transition-colors"
          >
            I have paid — Check again
          </button>
        </div>

        <div className="pt-8 border-t border-slate-800">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Mail size={12} />
            Contact admin: surveyosprime@gmail.com
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

  if (SANDBOX_MODE || pathname === '/' || pathname?.startsWith('/landing')) return <>{children}</>;

  const MASTER_ADMIN_UID = process.env.NEXT_PUBLIC_MASTER_ADMIN_UID;
  const isAdminUser = profile.isAdmin || (user && MASTER_ADMIN_UID && user.uid === MASTER_ADMIN_UID);

  if (!isAuthenticated || isAdminUser) return <>{children}</>;

  const effectiveState = calculateSubscriptionState(profile);

  if (effectiveState === 'pending') {
    if (!profile.accessRequestSubmitted) {
      return <AccessRequestForm />;
    }
    return <AccessRequestConfirmation />;
  }

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
