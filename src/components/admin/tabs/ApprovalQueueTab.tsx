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
    <tr className="hover:bg-[#FAFBFC] transition-colors group">
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center font-bold text-yellow-700 text-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-[#0D1B2A]">{displayName}</div>
            <div className="text-xs text-[#8D99AE] mt-0.5">{signup.email}</div>
            <div className="text-[10px] text-[#8D99AE] font-mono mt-0.5 flex items-center gap-1">
              <IdCard size={10} /> {signup.uid}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        {!signup.accessRequestSubmitted ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
            <AlertCircle size={10} /> Awaiting form submission
          </span>
        ) : signup.profileIrdai ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(212,175,55,0.1)', color: '#856404', border: '1px solid rgba(212,175,55,0.25)' }}>
            {signup.profileIrdai}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-[#C3C9D4] italic">Not provided</span>
        )}
      </td>
      <td className="px-6 py-5">
        <div className="text-sm font-medium text-[#0D1B2A]">
          {signup.profileMobile || '—'}
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="text-sm font-medium text-[#0D1B2A]">
          {(signup.updatedAt ?? signup.signedUpAt)
            ? (signup.updatedAt ?? signup.signedUpAt).toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </div>
        <div className="text-[10px] text-[#8D99AE]">
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
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE] transition-all"
          >
            <Mail size={10} /> Email
          </button>
          {/* Per-row trial days input */}
          <div className="flex items-center gap-1 border border-[#E2E6EA] rounded-lg px-2 py-1 bg-white">
            <Calendar size={10} className="text-[#8D99AE]" />
            <input
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={e => setTrialDays(Math.max(1, Math.min(365, Number(e.target.value))))}
              className="w-10 text-xs font-bold text-center border-none focus:ring-0 p-0 text-[#0D1B2A]"
              title="Trial duration in days"
            />
            <span className="text-[10px] text-[#8D99AE]">d</span>
          </div>
          <button
            onClick={() => onApprove(signup, trialDays)}
            disabled={isApproving}
            title={`Approve with ${trialDays}-day trial`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isApproving
              ? <Loader2 size={10} className="animate-spin" />
              : <CheckCircle2 size={10} />}
            Approve
          </button>
          <button
            onClick={() => onDismiss(signup)}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] transition-all disabled:opacity-50"
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
          <p className="text-sm font-bold text-[#8D99AE]">Loading New Signups...</p>
        </div>
      ) : signups.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-[#E2E6EA]">
          <div className="w-16 h-16 rounded-2xl bg-[#F8F9FA] flex items-center justify-center mx-auto mb-4">
            <UserPlus size={32} className="text-[#8D99AE]" />
          </div>
          <h3 className="text-base font-bold text-[#0D1B2A]">No pending signups</h3>
          <p className="text-sm text-[#8D99AE] mt-1">New signups will appear here for approval.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFBFC] border-b border-[#E2E6EA]">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">User</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">IRDAI Licence</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Phone</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Submitted</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F5]">
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
