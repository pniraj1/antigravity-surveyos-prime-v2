'use client';

import React, { useState } from 'react';
import {
  Loader2, UserX, Mail, IdCard, ShieldCheck,
  Calendar, CheckCircle2, XCircle, Clock, Eye, Trash2, Plus,
  Phone, MapPin, Award, ChevronDown, ChevronRight, Link2,
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

// Single source of truth: always use subscriptionExpiry
function getExpiry(surveyor: SurveyorAdminProfile): string | null {
  return surveyor.subscriptionExpiry || null;
}

function isExpiringSoon(surveyor: SurveyorAdminProfile): boolean {
  const expiry = getExpiry(surveyor);
  if (!expiry) return false;
  const days = getDaysRemaining(expiry);
  return days > 0 && days <= 7;
}

function isExpiredDate(surveyor: SurveyorAdminProfile): boolean {
  const expiry = getExpiry(surveyor);
  if (!expiry) return false;
  return getDaysRemaining(expiry) <= 0;
}

interface SurveyorsTabProps {
  surveyors: SurveyorAdminProfile[];
  loading: boolean;
  processingId: string | null;
  searchQuery: string;
  onUpdateStatus: (uid: string, status: 'active' | 'suspended' | 'readonly') => void;
  onUpdateExpiry: (uid: string, date: string) => void;
  onUpdateId: (uid: string, idStr: string) => void;
  onUpdateName: (uid: string, name: string) => void;
  onExtend: (uid: string, days: number) => void;
  onDeleteAccount: (surveyor: SurveyorAdminProfile) => void;
}

function ExtendControl({ uid, onExtend, disabled }: { uid: string; onExtend: (uid: string, days: number) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="Extend subscription"
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-40"
      >
        <Plus size={10} /> Extend
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 border border-blue-200 rounded-lg px-2 py-1 bg-blue-50">
      <input
        type="number"
        min={1}
        max={365}
        value={days}
        onChange={e => setDays(Math.max(1, Math.min(365, Number(e.target.value))))}
        className="w-10 text-xs font-bold text-center border-none focus:ring-0 p-0 bg-transparent text-blue-800"
        autoFocus
      />
      <span className="text-[10px] text-blue-500">d</span>
      <button
        onClick={() => { onExtend(uid, days); setOpen(false); }}
        className="text-[10px] font-black text-blue-700 hover:text-blue-900 ml-1"
      >
        ✓
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[10px] text-blue-400 hover:text-blue-600"
      >
        ✕
      </button>
    </div>
  );
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
  onExtend,
  onDeleteAccount,
}: SurveyorsTabProps) {
  const [activeFilter, setActiveFilter] = useState<SurveyorFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
              const expiry = getExpiry(surveyor);
              const expiring = isExpiringSoon(surveyor);
              const expired = isExpiredDate(surveyor);
              const days = getDaysRemaining(expiry);
              const rowBg = expiring ? 'bg-amber-50' : '';
              const isProcessing = processingId === surveyor.id;

              return (
                <React.Fragment key={surveyor.id}>
                <tr
                  className={`hover:bg-[#FAFBFC] transition-colors group cursor-pointer ${rowBg}`}
                  onClick={() => setExpandedId(prev => prev === surveyor.id ? null : surveyor.id)}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {expandedId === surveyor.id
                          ? <ChevronDown size={12} className="text-[#8D99AE] flex-shrink-0" />
                          : <ChevronRight size={12} className="text-[#8D99AE] flex-shrink-0" />
                        }
                        <div className="w-10 h-10 rounded-xl bg-[#F0F2F5] flex items-center justify-center font-bold text-[#0D1B2A] text-lg">
                          {surveyor.name.charAt(0)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="text-sm font-bold text-[#0D1B2A] bg-transparent border-b border-dashed border-transparent hover:border-[#E2E6EA] focus:border-primary focus:ring-0 focus:outline-none p-0 w-40"
                            value={surveyor.name}
                            onChange={e => onUpdateName(surveyor.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            disabled={isProcessing}
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
                      onClick={e => e.stopPropagation()}
                      disabled={isProcessing}
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium text-[#0D1B2A]">{surveyor.licenceNumber}</div>
                    <div className="text-[10px] text-[#8D99AE]">{surveyor.mobileNumber}</div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
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
                    }`}>
                      {surveyor.subscriptionStatus === 'active' ? <CheckCircle2 size={10} />
                        : surveyor.subscriptionStatus === 'trial' ? <Eye size={10} />
                        : surveyor.subscriptionStatus === 'pending' ? <Clock size={10} />
                        : <XCircle size={10} />}
                      {surveyor.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {!expiry ? (
                      <span className="text-[10px] text-[#C3C9D4]">—</span>
                    ) : (
                      <span className={`text-xs font-black ${
                        expired ? 'text-red-600' : days <= 5 ? 'text-amber-600' : days <= 10 ? 'text-yellow-600' : 'text-emerald-600'
                      }`}>
                        {days <= 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d`}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0D1B2A]">
                      <Calendar size={14} className="text-[#8D99AE]" />
                      <input
                        type="date"
                        className={`bg-transparent border-none focus:ring-0 text-sm p-0 w-32 cursor-pointer ${expired ? 'text-red-600' : ''}`}
                        value={surveyor.subscriptionExpiry}
                        onChange={(e) => onUpdateExpiry(surveyor.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        disabled={isProcessing}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      {/* Extend */}
                      <ExtendControl uid={surveyor.id} onExtend={onExtend} disabled={isProcessing} />

                      {/* Context-dependent status actions */}
                      {(surveyor.subscriptionStatus === 'readonly' || surveyor.subscriptionStatus === 'suspended') && (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'active')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] transition-all disabled:opacity-40"
                        >
                          Activate
                        </button>
                      )}
                      {(surveyor.subscriptionStatus === 'trial' || surveyor.subscriptionStatus === 'active' || surveyor.subscriptionStatus === 'readonly') && (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'suspended')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] transition-all disabled:opacity-40"
                        >
                          Suspend
                        </button>
                      )}
                      {(surveyor.subscriptionStatus === 'trial' || surveyor.subscriptionStatus === 'active' || surveyor.subscriptionStatus === 'suspended') && (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'readonly')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all disabled:opacity-40"
                        >
                          Read-Only
                        </button>
                      )}

                      {/* Delete */}
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
                {expandedId === surveyor.id && (
                  <tr>
                    <td colSpan={7} className="px-6 py-0">
                      <div
                        className="py-5 px-6 mb-4 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200"
                        style={{ background: '#FAFBFC', borderTop: '2px dashed #E2E6EA' }}
                      >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Email</div>
                            {surveyor.email && surveyor.email !== 'N/A' ? (
                              <a href={`mailto:${surveyor.email}`} className="text-xs font-medium text-[#D4AF37] hover:underline">
                                {surveyor.email}
                              </a>
                            ) : (
                              <span className="text-xs text-[#C3C9D4]">&mdash;</span>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Mobile</div>
                            {surveyor.mobile ? (
                              <a href={`tel:${surveyor.mobile}`} className="text-xs font-medium text-[#0D1B2A] hover:underline flex items-center gap-1">
                                <Phone size={10} className="text-[#8D99AE]" />
                                {surveyor.mobile}
                              </a>
                            ) : (
                              <span className="text-xs text-[#C3C9D4]">&mdash;</span>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">IRDAI Licence</div>
                            <span className="text-xs font-medium text-[#0D1B2A]">
                              {surveyor.irdaiLicence || <span className="text-[#C3C9D4]">&mdash;</span>}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">City</div>
                            <span className="text-xs font-medium text-[#0D1B2A] flex items-center gap-1">
                              {surveyor.city ? (
                                <><MapPin size={10} className="text-[#8D99AE]" /> {surveyor.city}</>
                              ) : (
                                <span className="text-[#C3C9D4]">&mdash;</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">State</div>
                            <span className="text-xs font-medium text-[#0D1B2A]">
                              {surveyor.state || <span className="text-[#C3C9D4]">&mdash;</span>}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Qualifications</div>
                            <span className="text-xs font-medium text-[#0D1B2A] flex items-center gap-1">
                              {surveyor.qualifications ? (
                                <><Award size={10} className="text-[#8D99AE]" /> {surveyor.qualifications}</>
                              ) : (
                                <span className="text-[#C3C9D4]">&mdash;</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Referral Code</div>
                            <span className="text-xs font-mono font-medium text-[#0D1B2A] flex items-center gap-1">
                              {surveyor.referralCode ? (
                                <><Link2 size={10} className="text-[#8D99AE]" /> {surveyor.referralCode}</>
                              ) : (
                                <span className="text-[#C3C9D4]">&mdash;</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Referred By</div>
                            <span className="text-xs font-mono font-medium text-[#0D1B2A]">
                              {surveyor.referredBy || <span className="text-[#C3C9D4]">&mdash;</span>}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Join Date</div>
                            <span className="text-xs font-medium text-[#0D1B2A]">
                              {surveyor.createdAt && typeof surveyor.createdAt === 'object' && 'toDate' in (surveyor.createdAt as Record<string, unknown>)
                                ? (surveyor.createdAt as { toDate: () => Date }).toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : surveyor.createdAt
                                ? String(surveyor.createdAt)
                                : <span className="text-[#C3C9D4]">&mdash;</span>
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
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
