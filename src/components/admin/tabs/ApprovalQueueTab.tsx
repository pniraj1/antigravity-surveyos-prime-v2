'use client';

import React, { useState } from 'react';
import { Calendar, Loader2, UserPlus, IdCard, Mail, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { NewSignup } from '../types';
import { TRIAL_DAYS } from '@/lib/subscription/plans';

interface ApprovalQueueTabProps {
  signups: NewSignup[];
  loading: boolean;
  approvingId: string | null;
  onApprove: (signup: NewSignup, trialDays: number) => void;
  onDismiss: (signup: NewSignup) => void;
  onEmail: (email: string, name: string) => void;
}

function SignupRow({
  signup,
  approvingId,
  onApprove,
  onDismiss,
  onEmail,
}: {
  signup: NewSignup;
  approvingId: string | null;
  onApprove: (signup: NewSignup, trialDays: number) => void;
  onDismiss: (signup: NewSignup) => void;
  onEmail: (email: string, name: string) => void;
}) {
  const [trialDays, setTrialDays] = useState(TRIAL_DAYS);
  const displayName = signup.profileName || signup.name || signup.displayName || '—';
  const isApproving = approvingId === signup.uid;

  return (
    <tr className="hover:bg-neutral-50/80 transition-colors group">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-semibold text-primary text-base shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{displayName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{signup.email}</div>
            <div className="text-xs text-muted-foreground/80 font-mono mt-0.5 flex items-center gap-1.5">
              <IdCard size={12} className="shrink-0" /> {signup.uid}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        {!signup.accessRequestSubmitted ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
            <AlertCircle size={12} /> Awaiting form submission
          </span>
        ) : signup.profileIrdai ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: 'var(--color-status-warning-tint)', color: 'var(--color-status-warning)', border: '1px solid var(--color-status-warning)' }}>
            {signup.profileIrdai}
          </span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground italic">Not provided</span>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-foreground">
          {signup.profileMobile || '—'}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-foreground">
          {signup.profileCity && signup.profileState
            ? `${signup.profileCity}, ${signup.profileState}`
            : signup.profileCity || signup.profileState || '—'}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-foreground">
          {(signup.updatedAt ?? signup.signedUpAt)
            ? (signup.updatedAt ?? signup.signedUpAt).toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {(signup.updatedAt ?? signup.signedUpAt)
            ? (signup.updatedAt ?? signup.signedUpAt).toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : ''}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEmail(signup.email, displayName)}
            title="Send a custom email to this surveyor"
            aria-label={`Email ${displayName}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-border/60 transition-all cursor-pointer"
          >
            <Mail size={13} /> Email
          </button>
          {/* Per-row trial days input */}
          <div className="flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1 bg-card shadow-xs">
            <Calendar size={13} className="text-muted-foreground shrink-0" />
            <input
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={e => setTrialDays(Math.max(1, Math.min(365, Number(e.target.value))))}
              className="w-10 text-xs font-semibold text-center border-none focus:ring-0 p-0 text-foreground"
              title="Trial duration in days"
              aria-label={`Trial duration in days for ${displayName}`}
            />
            <span className="text-xs text-muted-foreground font-medium">d</span>
          </div>
          <button
            onClick={() => onApprove(signup, trialDays)}
            disabled={isApproving}
            title={`Approve with ${trialDays}-day trial`}
            aria-label={`Approve ${displayName} with ${trialDays}-day trial`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-status-success-tint)] text-[var(--color-status-success)] border border-[var(--color-status-success)]/30 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
          >
            {isApproving
              ? <Loader2 size={13} className="animate-spin" />
              : <CheckCircle2 size={13} />}
            Approve ({trialDays}d)
          </button>
          <button
            onClick={() => onDismiss(signup)}
            disabled={isApproving}
            aria-label={`Dismiss ${displayName}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-status-danger-tint)] text-[var(--color-status-danger)] border border-[var(--color-status-danger)]/30 hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
          >
            <XCircle size={13} />
            Dismiss
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ApprovalQueueTab({
  signups,
  loading,
  approvingId,
  onApprove,
  onDismiss,
  onEmail,
}: ApprovalQueueTabProps) {
  return (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary opacity-20 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Loading New Signups...</p>
        </div>
      ) : signups.length === 0 ? (
        <div className="py-20 text-center bg-card rounded-2xl border border-border">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <UserPlus size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No pending signups</h3>
          <p className="text-sm text-muted-foreground mt-1">New signups will appear here for approval.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-border">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">IRDAI Licence</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {signups.map((signup) => (
                <SignupRow
                  key={signup.uid}
                  signup={signup}
                  approvingId={approvingId}
                  onApprove={onApprove}
                  onDismiss={onDismiss}
                  onEmail={onEmail}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
