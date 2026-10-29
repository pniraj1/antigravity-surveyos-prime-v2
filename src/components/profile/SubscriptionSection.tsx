'use client';

import { useState, useEffect } from 'react';
import type { PaymentRecord } from '@/types/payment';
import type { SurveyorProfile } from '@/types';
import { getUserPayments } from '@/lib/firebase/payments';
import { calculateSubscriptionState, getDaysRemaining } from '@/lib/subscription/status';
import { PaymentSubmissionForm } from '@/components/subscription/PaymentSubmissionForm';
import { UPI_ID } from '@/lib/subscription/plans';
import {
  CreditCard, Calendar, Gift, Copy, CheckCircle2,
  RefreshCw, Clock, BadgeCheck, Hourglass, XCircle,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ReactNode }> = {
  trial:    { label: 'Free Trial',  badgeClass: 'bg-status-warning-tint text-status-warning',   icon: <Clock size={11} /> },
  active:   { label: 'Active',      badgeClass: 'bg-status-success-tint text-status-success',   icon: <BadgeCheck size={11} /> },
  pending:  { label: 'Pending',     badgeClass: 'bg-status-warning-tint text-status-warning',   icon: <Hourglass size={11} /> },
  readonly: { label: 'Expired',     badgeClass: 'bg-status-danger-tint text-status-danger',     icon: <XCircle size={11} /> },
  suspended:{ label: 'Suspended',   badgeClass: 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-600)]', icon: <XCircle size={11} /> },
};

export function SubscriptionSection({ uid, profile }: { uid: string; profile: SurveyorProfile }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const state = calculateSubscriptionState(profile);
  const cfg = STATUS_CONFIG[state] ?? STATUS_CONFIG.pending;

  const expiryDate = state === 'trial' ? profile.trialEndDate : profile.subscriptionExpiry;
  const daysLeft = getDaysRemaining(expiryDate);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    getUserPayments(uid)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [uid]);

  const handleCopyReferral = () => {
    if (!profile.referralCode) return;
    navigator.clipboard.writeText(profile.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-2 border-b border-border" style={{ background: 'var(--color-neutral-100)' }}>
        <span className="text-primary"><CreditCard size={14} /></span>
        <span className="text-sm font-medium text-foreground">Subscription &amp; Billing</span>
        {/* Status badge */}
        <span
          className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide ${cfg.badgeClass}`}
        >
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Expiry row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {/* Plan period */}
          <div className="rounded-xl p-3 border border-border" style={{ background: 'var(--color-neutral-50)' }}>
            <div className="text-[9px] font-medium uppercase tracking-[0.18em] mb-1 text-muted-foreground">
              {state === 'trial' ? 'Trial Ends' : 'Subscription Expires'}
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-primary" />
              <span className="text-sm font-medium text-foreground">{formatDate(expiryDate)}</span>
            </div>
          </div>

          {/* Days remaining */}
          {(state === 'trial' || state === 'active') && (
            <div
              className={`rounded-xl p-3 ${
                daysLeft <= 5
                  ? 'bg-status-danger-tint border border-status-danger/20'
                  : daysLeft <= 15
                  ? 'bg-status-warning-tint border border-status-warning/20'
                  : 'bg-status-success-tint border border-status-success/20'
              }`}
            >
              <div className="text-[9px] font-medium uppercase tracking-[0.18em] mb-1 text-muted-foreground">Days Remaining</div>
              <div className={`text-sm font-medium ${
                daysLeft <= 5 ? 'text-status-danger' : daysLeft <= 15 ? 'text-status-warning' : 'text-status-success'
              }`}>
                {daysLeft > 0 ? `${daysLeft} days` : 'Expired'}
              </div>
            </div>
          )}

          {/* Last payment */}
          {profile.lastPaymentDate && (
            <div className="rounded-xl p-3 border border-border" style={{ background: 'var(--color-neutral-50)' }}>
              <div className="text-[9px] font-medium uppercase tracking-[0.18em] mb-1 text-muted-foreground">Last Payment</div>
              <div className="text-sm font-medium text-foreground">{formatDate(profile.lastPaymentDate)}</div>
            </div>
          )}
        </div>

        {/* Trial start info */}
        {profile.trialStartDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock size={11} />
            <span>Trial started on <strong className="text-[var(--color-neutral-600)]">{formatDate(profile.trialStartDate)}</strong></span>
          </div>
        )}

        {/* Renew — the only pre-expiry payment path in the app. Without this,
            every renewal forces the surveyor through the expiry lockout first. */}
        {!profile.isAdmin && (
          <details className="rounded-xl border border-border overflow-hidden" open={daysLeft <= 15}>
            <summary className="cursor-pointer px-4 py-3 flex items-center gap-2 text-sm font-medium text-foreground list-none" style={{ background: 'var(--color-neutral-50)' }}>
              <CreditCard size={14} className="text-primary" />
              Renew subscription
              <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wide">
                Pay to UPI: <span className="font-mono normal-case">{UPI_ID}</span>
              </span>
            </summary>
            <div className="p-4">
              <PaymentSubmissionForm hideHistory />
            </div>
          </details>
        )}

        {/* Referral code */}
        {profile.referralCode && (
          <div className="rounded-xl p-4 bg-primary/5 border border-primary/20">
            {/* The mechanic was never stated anywhere in the app — surveyors had
                a code with no idea what it did. Say it plainly. */}
            <p className="text-xs text-muted-foreground mb-3">
              Share this code with a fellow surveyor. They get <strong className="text-foreground">14 extra trial days</strong>,
              and when their first payment is verified <strong className="text-foreground">you get 30 days free</strong> —
              both automatic.
            </p>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Gift size={13} className="text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-primary">Your Referral Code</span>
              </div>
              {profile.referralCount > 0 && (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {profile.referralCount} referral{profile.referralCount !== 1 ? 's' : ''} · +{profile.referralBonusDays} bonus days earned
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <code
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium tracking-widest bg-card border border-primary/30 text-foreground"
                style={{ letterSpacing: '0.1em' }}
              >
                {profile.referralCode}
              </code>
              <button
                onClick={handleCopyReferral}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  copied ? 'bg-status-success-tint text-status-success' : 'bg-primary/12 text-primary'
                }`}
              >
                {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `I use Motor SurveyOS for my survey reports — AI reads the RC/DL/policy and drafts the report in minutes. Use my referral code at signup and your free trial doubles from 14 to 28 days: https://motorsurveyos-in.web.app\n\nCode: ${profile.referralCode}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-status-success-tint text-status-success transition-all hover:opacity-80"
              >
                Share on WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Payment history */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] mb-3 text-muted-foreground">Payment History</div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw size={11} className="animate-spin" /> Loading…
            </div>
          ) : payments.length === 0 ? (
            <div className="text-xs font-medium text-[var(--color-neutral-400)]">No payments on record.</div>
          ) : (
            <div className="space-y-2">
              {payments.map((p, idx) => {
                const statusMap = {
                  verified: { icon: <CheckCircle2 size={11} />, iconClass: 'text-status-success', badgeClass: 'bg-status-success-tint text-status-success', label: 'Verified' },
                  pending:  { icon: <Hourglass size={11} />,    iconClass: 'text-status-warning',  badgeClass: 'bg-status-warning-tint text-status-warning',  label: 'Pending' },
                  rejected: { icon: <XCircle size={11} />,      iconClass: 'text-status-danger',   badgeClass: 'bg-status-danger-tint text-status-danger',    label: 'Rejected' },
                };
                const s = statusMap[p.status] ?? statusMap.pending;
                return (
                  <div
                    key={p.id ?? idx}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border"
                    style={{ background: 'var(--color-neutral-50)' }}
                  >
                    <span className={`${s.iconClass} flex-shrink-0`}>{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate text-foreground">
                        ₹{p.amount.toLocaleString('en-IN')}
                        {p.durationGranted ? <span className="ml-2 text-[10px] font-medium text-status-success">+{p.durationGranted} days</span> : null}
                      </div>
                      <div className="text-[10px] font-medium truncate text-muted-foreground">
                        Txn: {p.transactionId || '—'} · {formatDate(p.submittedAt)}
                      </div>
                    </div>
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium uppercase flex-shrink-0 ${s.badgeClass}`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
