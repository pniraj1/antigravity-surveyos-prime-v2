'use client';

import React, { useState } from 'react';
import { Calendar, Loader2, UserPlus, IdCard, Mail, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { NewSignup } from '../types';

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
  const [trialDays, setTrialDays] = useState(30);
  const displayName = signup.profileName || signup.name || signup.displayName || '—';
  const isApproving = approvingId === signup.uid;

  return (
    <tr className="hover:bg-neutral-50 transition-colors group">
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-medium text-primary text-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">{displayName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{signup.email}</div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
              <IdCard size={10} /> {signup.uid}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        {!signup.accessRequestSubmitted ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
            <AlertCircle size={10} /> Awaiting form submission
          </span>
        ) : signup.profileIrdai ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-status-warning-tint)', color: 'var(--color-status-warning)', border: '1px solid var(--color-status-warning)' }}>
            {signup.profileIrdai}
          </span>
        ) : (
          <span className="text-[10px] font-medium text-muted-foreground italic">Not provided</span>
        )}
      </td>
      <td className="px-6 py-5">
        <div className="text-sm font-medium text-foreground">
          {signup.profileMobile || '—'}
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="text-sm font-medium text-foreground">
          {signup.profileCity && signup.profileState
            ? `${signup.profileCity}, ${signup.profileState}`
            : signup.profileCity || signup.profileState || '—'}
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="text-sm font-medium text-foreground">
          {(signup.updatedAt ?? signup.signedUpAt)
            ? (signup.updatedAt ?? signup.signedUpAt).toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {(signup.updatedAt ?? signup.signedUpAt)
            ? (signup.updatedAt ?? signup.signedUpAt).toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : ''}
        </div>
      </td>
      <td className="px-6 py-5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEmail(signup.email, displayName)}
            title="Send a custom email to this surveyor"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-all"
          >
            <Mail size={10} /> Email
          </button>
          {/* Per-row trial days input */}
          <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1 bg-card">
            <Calendar size={10} className="text-muted-foreground" />
            <input
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={e => setTrialDays(Math.max(1, Math.min(365, Number(e.target.value))))}
              className="w-10 text-xs font-medium text-center border-none focus:ring-0 p-0 text-foreground"
              title="Trial duration in days"
            />
            <span className="text-[10px] text-muted-foreground">d</span>
          </div>
          <button
            onClick={() => onApprove(signup, trialDays)}
            disabled={isApproving}
            title={`Approve with ${trialDays}-day trial`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-[var(--color-status-success-tint)] text-[var(--color-status-success)] hover:opacity-80 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isApproving
              ? <Loader2 size={10} className="animate-spin" />
              : <CheckCircle2 size={10} />}
            Approve
          </button>
          <button
            onClick={() => onDismiss(signup)}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-[var(--color-status-danger-tint)] text-[var(--color-status-danger)] hover:opacity-80 transition-all disabled:opacity-50"
          >
            <XCircle size={10} />
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
          <h3 className="text-base font-medium text-foreground">No pending signups</h3>
          <p className="text-sm text-muted-foreground mt-1">New signups will appear here for approval.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-border">
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">User</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">IRDAI Licence</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Phone</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Location</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Submitted</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-right">Actions</th>
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
