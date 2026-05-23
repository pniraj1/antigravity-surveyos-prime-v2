'use client';

import React, { useState } from 'react';
import {
  Loader2, UserX, Mail, IdCard, ShieldCheck,
  Calendar, CheckCircle2, XCircle, Clock, Eye, Trash2,
} from 'lucide-react';
import { getDaysRemaining } from '@/lib/subscription/status';
import type { SurveyorAdminProfile, SurveyorFilter } from '../types';

const FILTERS: { key: SurveyorFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'trial', label: 'Trial' },
  { key: 'active', label: 'Active' },
  { key: 'readonly', label: 'Read-Only' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'expiring', label: 'Expiring Soon' },
];

function isExpiringSoon(surveyor: SurveyorAdminProfile): boolean {
  const expiry = surveyor.subscriptionStatus === 'trial'
    ? surveyor.trialEndDate
    : surveyor.subscriptionExpiry;
  if (!expiry) return false;
  const days = getDaysRemaining(expiry);
  return days > 0 && days <= 7;
}

function isExpired(surveyor: SurveyorAdminProfile): boolean {
  const expiry = surveyor.subscriptionStatus === 'trial'
    ? surveyor.trialEndDate
    : surveyor.subscriptionExpiry;
  if (!expiry) return false;
  return getDaysRemaining(expiry) <= 0;
}

interface SurveyorsTabProps {
  surveyors: SurveyorAdminProfile[];
  loading: boolean;
  processingId: string | null;
  searchQuery: string;
  onUpdateStatus: (uid: string, status: 'active' | 'suspended' | 'expired') => void;
  onUpdateExpiry: (uid: string, date: string) => void;
  onUpdateId: (uid: string, idStr: string) => void;
  onUpdateName: (uid: string, name: string) => void;
  onDeleteAccount: (surveyor: SurveyorAdminProfile) => void;
}

export function SurveyorsTab({
  surveyors,
  loading,
  processingId,
  searchQuery,
  onUpdateStatus,
  onUpdateExpiry,
  onUpdateId,
  onUpdateName,
  onDeleteAccount,
}: SurveyorsTabProps) {
  const [activeFilter, setActiveFilter] = useState<SurveyorFilter>('all');

  const filtered = surveyors
    .filter(s => s.subscriptionStatus !== 'pending')
    .filter(s => {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    })
    .filter(s => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'expiring') return isExpiringSoon(s);
      if (activeFilter === 'readonly') return s.subscriptionStatus === 'readonly';
      return s.subscriptionStatus === activeFilter;
    });

  if (loading && surveyors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={40} className="animate-spin text-primary opacity-20 mb-4" />
        <p className="text-sm font-bold text-[#8D99AE]">Loading Surveyor Registry...</p>
      </div>
    );
  }

  return (
    <>
      {/* Filter pills */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeFilter === key
                ? 'bg-[#0D1B2A] text-white'
                : 'bg-white border border-[#E2E6EA] text-[#8D99AE] hover:text-[#0D1B2A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#FAFBFC] border-b border-[#E2E6EA]">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Surveyor / Digital ID</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Platform ID</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Licence</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Subscription</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Days Left</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Expiry Date</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F2F5]">
            {filtered.map((surveyor) => {
              const expiring = isExpiringSoon(surveyor);
              const expired = isExpired(surveyor);
              const rowBg = expiring ? 'bg-amber-50' : '';

              return (
                <tr key={surveyor.id} className={`hover:bg-[#FAFBFC] transition-colors group ${rowBg}`}>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F0F2F5] flex items-center justify-center font-bold text-[#0D1B2A] text-lg">
                        {surveyor.name.charAt(0)}
                      </div>
                      <div>
                        {/* Inline name editing */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="text-sm font-bold text-[#0D1B2A] bg-transparent border-b border-dashed border-transparent hover:border-[#E2E6EA] focus:border-primary focus:ring-0 focus:outline-none p-0 w-40"
                            value={surveyor.name}
                            onChange={e => onUpdateName(surveyor.id, e.target.value)}
                            disabled={processingId === surveyor.id}
                          />
                          {surveyor.isAdmin && <ShieldCheck size={14} className="text-primary flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-[#8D99AE] font-mono mt-0.5 flex items-center gap-1">
                          <Mail size={10} /> {surveyor.email}
                        </div>
                        <div className="text-xs text-[#8D99AE] font-mono mt-0.5 flex items-center gap-1">
                          <IdCard size={10} /> {surveyor.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <input
                      type="text"
                      placeholder="ASSIGN ID..."
                      className="bg-transparent border-b border-dashed border-[#E2E6EA] focus:border-primary focus:ring-0 text-sm p-0 w-24 font-black uppercase tracking-tight"
                      value={surveyor.surveyorId}
                      onChange={(e) => onUpdateId(surveyor.id, e.target.value.toUpperCase())}
                      disabled={processingId === surveyor.id}
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium text-[#0D1B2A]">{surveyor.licenceNumber}</div>
                    <div className="text-[10px] text-[#8D99AE]">{surveyor.mobileNumber}</div>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                        surveyor.subscriptionStatus === 'active'
                          ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
                          : surveyor.subscriptionStatus === 'trial'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : surveyor.subscriptionStatus === 'suspended'
                          ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
                          : surveyor.subscriptionStatus === 'pending'
                          ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                          : surveyor.subscriptionStatus === 'readonly'
                          ? 'bg-orange-50 text-orange-800 border-orange-200'
                          : 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                      }`}
                    >
                      {surveyor.subscriptionStatus === 'active'
                        ? <CheckCircle2 size={10} />
                        : surveyor.subscriptionStatus === 'trial'
                        ? <Eye size={10} />
                        : surveyor.subscriptionStatus === 'pending'
                        ? <Clock size={10} />
                        : <XCircle size={10} />}
                      {surveyor.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {(() => {
                      const expiry = surveyor.subscriptionStatus === 'trial' ? surveyor.trialEndDate : surveyor.subscriptionExpiry;
                      const days = getDaysRemaining(expiry || null);
                      if (!expiry) return <span className="text-[10px] text-[#C3C9D4]">—</span>;
                      return (
                        <span className={`text-xs font-black ${
                          expired ? 'text-red-600' : days <= 5 ? 'text-amber-600' : days <= 10 ? 'text-yellow-600' : 'text-emerald-600'
                        }`}>
                          {days <= 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d`}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0D1B2A]">
                      <Calendar size={14} className="text-[#8D99AE]" />
                      <input
                        type="date"
                        className={`bg-transparent border-none focus:ring-0 text-sm p-0 w-32 cursor-pointer ${expired ? 'text-red-600' : ''}`}
                        value={surveyor.subscriptionExpiry}
                        onChange={(e) => onUpdateExpiry(surveyor.id, e.target.value)}
                        disabled={processingId === surveyor.id}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {surveyor.subscriptionStatus === 'suspended' || surveyor.subscriptionStatus === 'pending' ? (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'active')}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] transition-all"
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'suspended')}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] transition-all"
                        >
                          Suspend
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteAccount(surveyor)}
                        title="Delete this account permanently"
                        className="p-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F8F9FA] flex items-center justify-center mx-auto mb-4">
              <UserX size={32} className="text-[#8D99AE]" />
            </div>
            <h3 className="text-base font-bold text-[#0D1B2A]">No surveyors found</h3>
            <p className="text-sm text-[#8D99AE] mt-1">Try adjusting your search criteria.</p>
          </div>
        )}
      </div>
    </>
  );
}
