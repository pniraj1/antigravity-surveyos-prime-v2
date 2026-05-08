'use client';

import { useProfileStore } from '@/stores/profile-store';
import { useAuthStore } from '@/stores/auth-store';
import { Lock, CreditCard, Mail } from 'lucide-react';
import { AccessRequestForm } from './AccessRequestForm';


const SANDBOX_MODE = process.env.NEXT_PUBLIC_SANDBOX_MODE === 'true';

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useProfileStore();
  const { isAuthenticated } = useAuthStore();

  const user = useAuthStore((s) => s.user);
  
  // ── Sandbox bypass: skip subscription check in preview channel builds ──
  if (SANDBOX_MODE) return <>{children}</>;

  const MASTER_ADMIN_UID = process.env.NEXT_PUBLIC_MASTER_ADMIN_UID;
  const isAdminUser = profile.isAdmin || (user && MASTER_ADMIN_UID && user.uid === MASTER_ADMIN_UID);

  if (!isAuthenticated || isAdminUser) return <>{children}</>;

  const isPending = profile.subscriptionStatus === 'pending';
  const isExpired = profile.subscriptionStatus === 'expired';
  const isSuspended = profile.subscriptionStatus === 'suspended';
  const expiryDate = profile.subscriptionExpiry ? new Date(profile.subscriptionExpiry) : null;
  const isDateExpired = expiryDate && expiryDate < new Date();

  // Pending — new user waiting for admin approval
  if (isPending) {
    // Not yet submitted the registration form → show form
    if (!profile.accessRequestSubmitted) {
      return <AccessRequestForm />;
    }
    // Submitted but not yet approved: render children (read-only dashboard).
    // PendingApprovalBanner is injected above the layout by AuthGate.
    return <>{children}</>;
  }


  // Expired or suspended
  const showBlock = isExpired || isSuspended || isDateExpired;

  if (showBlock) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0D1B2A] text-white p-6 text-center">
        <div className="max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="mx-auto w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
            <Lock className="text-red-500" size={40} />
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-black tracking-tight">Access Suspended</h1>
            <p className="text-slate-400 font-medium">
              Your SurveyOS-Prime subscription has {isExpired || isDateExpired ? 'expired' : 'been suspended'}.
              Please complete your monthly payment to restore full access to your claims and AI tools.
            </p>
          </div>

          <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Account Status:</span>
              <span className="font-bold text-red-400 uppercase tracking-wider">
                {isExpired || isDateExpired ? 'Expired' : 'Suspended'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Validity End:</span>
              <span className="font-bold">{expiryDate ? expiryDate.toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>

          <div className="grid gap-4">
            <a
              href="mailto:surveyosprime@gmail.com"
              className="flex items-center justify-center gap-2 w-full py-4 bg-[#D4AF37] text-[#0D1B2A] font-black rounded-xl hover:scale-105 transition-transform"
            >
              <CreditCard size={18} />
              Renew Subscription
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

  return <>{children}</>;
}
