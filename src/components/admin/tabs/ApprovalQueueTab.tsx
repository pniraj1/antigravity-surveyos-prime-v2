'use client';

import React from 'react';
import { Calendar, Loader2, UserPlus, IdCard, Mail, CheckCircle2, XCircle } from 'lucide-react';
import type { NewSignup } from '../types';

interface ApprovalQueueTabProps {
  signups: NewSignup[];
  loading: boolean;
  defaultExpiry: string;
  setDefaultExpiry: (v: string) => void;
  approvingId: string | null;
  onApprove: (signup: NewSignup) => void;
  onDismiss: (signup: NewSignup) => void;
  onEmail: (email: string, name: string) => void;
}

export function ApprovalQueueTab({
  signups,
  loading,
  defaultExpiry,
  setDefaultExpiry,
  approvingId,
  onApprove,
  onDismiss,
  onEmail,
}: ApprovalQueueTabProps) {
  return (
    <>
      <div className="mb-4 flex items-center gap-3 bg-white border border-[#E2E6EA] rounded-xl px-5 py-3 w-fit">
        <Calendar size={14} className="text-[#8D99AE]" />
        <span className="text-xs font-bold text-[#8D99AE] uppercase tracking-wider">Default Expiry for Approvals:</span>
        <input
          type="date"
          value={defaultExpiry}
          onChange={e => setDefaultExpiry(e.target.value)}
          className="text-sm font-bold border-none focus:ring-0 p-0 cursor-pointer text-[#0D1B2A]"
        />
      </div>

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
                <tr key={signup.uid} className="hover:bg-[#FAFBFC] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center font-bold text-yellow-700 text-lg">
                        {(signup.name || signup.displayName || signup.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#0D1B2A]">
                          {signup.name || signup.displayName || '—'}
                        </div>
                        <div className="text-xs text-[#8D99AE] mt-0.5">{signup.email}</div>
                        <div className="text-[10px] text-[#8D99AE] font-mono mt-0.5 flex items-center gap-1">
                          <IdCard size={10} /> {signup.uid}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {signup.irdaiLicence ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(212,175,55,0.1)', color: '#856404', border: '1px solid rgba(212,175,55,0.25)' }}>
                        {signup.irdaiLicence}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#C3C9D4] italic">Not submitted yet</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium text-[#0D1B2A]">{signup.mobile || '—'}</div>
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
                        onClick={() => onEmail(signup.email, signup.name || signup.displayName)}
                        title="Send a custom email to this surveyor"
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE] transition-all"
                      >
                        <Mail size={10} /> Email
                      </button>
                      <button
                        onClick={() => onApprove(signup)}
                        disabled={approvingId === signup.uid}
                        title="Approve this surveyor and start their 60-day trial"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {approvingId === signup.uid
                          ? <Loader2 size={10} className="animate-spin" />
                          : <CheckCircle2 size={10} />}
                        Approve
                      </button>
                      <button
                        onClick={() => onDismiss(signup)}
                        disabled={approvingId === signup.uid}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] transition-all disabled:opacity-50"
                      >
                        <XCircle size={10} />
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
