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
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)] transition-all disabled:opacity-40"
      >
        <Plus size={10} /> Extend
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1 bg-[var(--color-neutral-100)]">
      <input
        type="number"
        min={1}
        max={365}
        value={days}
        onChange={e => setDays(Math.max(1, Math.min(365, Number(e.target.value))))}
        className="w-10 text-xs font-medium text-center border-none focus:ring-0 p-0 bg-transparent text-foreground"
        autoFocus
      />
      <span className="text-[10px] text-muted-foreground">d</span>
      <button
        onClick={() => { onExtend(uid, days); setOpen(false); }}
        className="text-[10px] font-medium text-foreground hover:text-foreground ml-1"
      >
        ✓
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[10px] text-muted-foreground hover:text-foreground"
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
        <p className="text-sm font-medium text-muted-foreground">Loading Surveyor Registry...</p>
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
            className={`px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
              activeFilter === key
                ? 'bg-[var(--color-neutral-900)] text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--color-neutral-50)] border-b border-border">
              <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Surveyor / Digital ID</th>
              <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Platform ID</th>
              <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Licence</th>
              <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Subscription</th>
              <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Days Left</th>
              <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Expiry Date</th>
              <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((surveyor) => {
              const expiry = getExpiry(surveyor);
              const expiring = isExpiringSoon(surveyor);
              const expired = isExpiredDate(surveyor);
              const days = getDaysRemaining(expiry);
              const rowBg = expiring ? 'bg-[var(--color-status-warning-tint)]' : '';
              const isProcessing = processingId === surveyor.id;

              return (
                <React.Fragment key={surveyor.id}>
                <tr
                  className={`hover:bg-[var(--color-neutral-50)] transition-colors group cursor-pointer ${rowBg}`}
                  onClick={() => setExpandedId(prev => prev === surveyor.id ? null : surveyor.id)}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {expandedId === surveyor.id
                          ? <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
                          : <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
                        }
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-neutral-200)] flex items-center justify-center font-medium text-foreground text-lg">
                          {surveyor.name.charAt(0)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="text-sm font-medium text-foreground bg-transparent border-b border-dashed border-transparent hover:border-border focus:border-primary focus:ring-0 focus:outline-none p-0 w-40"
                            value={surveyor.name}
                            onChange={e => onUpdateName(surveyor.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            disabled={isProcessing}
                          />
                          {surveyor.isAdmin && <ShieldCheck size={14} className="text-primary flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                          <Mail size={10} /> {surveyor.email}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                          <IdCard size={10} /> {surveyor.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <input
                      type="text"
                      placeholder="ASSIGN ID..."
                      className="bg-transparent border-b border-dashed border-border focus:border-primary focus:ring-0 text-sm p-0 w-24 font-medium uppercase tracking-tight"
                      value={surveyor.surveyorId}
                      onChange={(e) => onUpdateId(surveyor.id, e.target.value.toUpperCase())}
                      onClick={e => e.stopPropagation()}
                      disabled={isProcessing}
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium text-foreground">{surveyor.licenceNumber}</div>
                    <div className="text-[10px] text-muted-foreground">{surveyor.mobileNumber}</div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wider border ${
                      surveyor.subscriptionStatus === 'active'
                        ? 'bg-[var(--color-status-success-tint)] text-[var(--color-status-success)] border-[var(--color-status-success)]'
                        : surveyor.subscriptionStatus === 'trial'
                        ? 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] border-[var(--color-neutral-200)]'
                        : surveyor.subscriptionStatus === 'suspended'
                        ? 'bg-[var(--color-status-danger-tint)] text-[var(--color-status-danger)] border-[var(--color-status-danger)]'
                        : surveyor.subscriptionStatus === 'pending'
                        ? 'bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)] border-[var(--color-status-warning)]'
                        : surveyor.subscriptionStatus === 'readonly'
                        ? 'bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)] border-[var(--color-status-warning)]'
                        : 'bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)] border-[var(--color-status-warning)]'
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
                      <span className="text-[10px] text-muted-foreground">—</span>
                    ) : (
                      <span className={`text-xs font-medium ${
                        expired ? 'text-[var(--color-status-danger)]' : days <= 5 ? 'text-[var(--color-status-warning)]' : days <= 10 ? 'text-[var(--color-status-warning)]' : 'text-[var(--color-status-success)]'
                      }`}>
                        {days <= 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d`}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Calendar size={14} className="text-muted-foreground" />
                      <input
                        type="date"
                        className={`bg-transparent border-none focus:ring-0 text-sm p-0 w-32 cursor-pointer ${expired ? 'text-[var(--color-status-danger)]' : ''}`}
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
                          className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-[var(--color-status-success-tint)] text-[var(--color-status-success)] hover:bg-[var(--color-status-success-tint)] transition-all disabled:opacity-40"
                        >
                          Activate
                        </button>
                      )}
                      {(surveyor.subscriptionStatus === 'trial' || surveyor.subscriptionStatus === 'active' || surveyor.subscriptionStatus === 'readonly') && (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'suspended')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-[var(--color-status-danger-tint)] text-[var(--color-status-danger)] hover:bg-[var(--color-status-danger-tint)] transition-all disabled:opacity-40"
                        >
                          Suspend
                        </button>
                      )}
                      {(surveyor.subscriptionStatus === 'trial' || surveyor.subscriptionStatus === 'active' || surveyor.subscriptionStatus === 'suspended') && (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'readonly')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)] hover:bg-[var(--color-status-warning-tint)] transition-all disabled:opacity-40"
                        >
                          Read-Only
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => onDeleteAccount(surveyor)}
                        title="Delete this account permanently"
                        className="p-1.5 rounded-lg text-[10px] font-medium bg-[var(--color-status-danger-tint)] text-[var(--color-status-danger)] hover:bg-[var(--color-status-danger-tint)] transition-all"
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
                        style={{ background: 'var(--color-neutral-50)', borderTop: '2px dashed var(--color-neutral-200)' }}
                      >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Email</div>
                            {surveyor.email && surveyor.email !== 'N/A' ? (
                              <a href={`mailto:${surveyor.email}`} className="text-xs font-medium text-primary hover:underline">
                                {surveyor.email}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">&mdash;</span>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Mobile</div>
                            {surveyor.mobile ? (
                              <a href={`tel:${surveyor.mobile}`} className="text-xs font-medium text-foreground hover:underline flex items-center gap-1">
                                <Phone size={10} className="text-muted-foreground" />
                                {surveyor.mobile}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">&mdash;</span>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">IRDAI Licence</div>
                            <span className="text-xs font-medium text-foreground">
                              {surveyor.irdaiLicence || <span className="text-muted-foreground">&mdash;</span>}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">City</div>
                            <span className="text-xs font-medium text-foreground flex items-center gap-1">
                              {surveyor.city ? (
                                <><MapPin size={10} className="text-muted-foreground" /> {surveyor.city}</>
                              ) : (
                                <span className="text-muted-foreground">&mdash;</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">State</div>
                            <span className="text-xs font-medium text-foreground">
                              {surveyor.state || <span className="text-muted-foreground">&mdash;</span>}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Qualifications</div>
                            <span className="text-xs font-medium text-foreground flex items-center gap-1">
                              {surveyor.qualifications ? (
                                <><Award size={10} className="text-muted-foreground" /> {surveyor.qualifications}</>
                              ) : (
                                <span className="text-muted-foreground">&mdash;</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Referral Code</div>
                            <span className="text-xs font-mono font-medium text-foreground flex items-center gap-1">
                              {surveyor.referralCode ? (
                                <><Link2 size={10} className="text-muted-foreground" /> {surveyor.referralCode}</>
                              ) : (
                                <span className="text-muted-foreground">&mdash;</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Referred By</div>
                            <span className="text-xs font-mono font-medium text-foreground">
                              {surveyor.referredBy || <span className="text-muted-foreground">&mdash;</span>}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Join Date</div>
                            <span className="text-xs font-medium text-foreground">
                              {surveyor.createdAt && typeof surveyor.createdAt === 'object' && 'toDate' in (surveyor.createdAt as Record<string, unknown>)
                                ? (surveyor.createdAt as { toDate: () => Date }).toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : surveyor.createdAt
                                ? String(surveyor.createdAt)
                                : <span className="text-muted-foreground">&mdash;</span>
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
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-neutral-100)] flex items-center justify-center mx-auto mb-4">
              <UserX size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground">No surveyors found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search criteria.</p>
          </div>
        )}
      </div>
    </>
  );
}
