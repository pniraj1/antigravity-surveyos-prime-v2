'use client';

import React, { useState } from 'react';
import {
  Loader2, UserX, Mail, IdCard, ShieldCheck,
  Calendar, CheckCircle2, XCircle, Clock, Eye, Trash2, Plus,
  Phone, MapPin, ChevronDown, ChevronRight, FileText, CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { getDaysRemaining } from '@/lib/subscription/status';
import type { SurveyorAdminProfile, SurveyorFilter } from '../types';
import type { PaymentRecord } from '@/types/payment';
import { SurveyorAIKeys } from '../SurveyorAIKeys';
import { getSurveyorOnboardingProgress } from '@/lib/onboarding/admin-progress';
import { getSurveyorClaimCount } from '@/lib/firebase/claims-count';
import { ExtendSubscriptionModal } from '../modals/ExtendSubscriptionModal';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

const FILTERS: { key: SurveyorFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'trial', label: 'Trial' },
  { key: 'active', label: 'Active' },
  { key: 'readonly', label: 'Read-Only' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'expiring', label: 'Expiring Soon' },
];

function getExpiry(surveyor: SurveyorAdminProfile): string | null {
  return surveyor.subscriptionExpiry || null;
}

function isExpiringSoon(surveyor: SurveyorAdminProfile): boolean {
  const expiry = getExpiry(surveyor);
  if (!expiry) return false;
  const days = getDaysRemaining(expiry);
  return days > 0 && days <= 7;
}

function formatExpiryDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (!isNaN(year) && monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
      return `${String(day).padStart(2, '0')} ${months[monthIdx]} ${year}`;
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }
  } catch {
    // fallback to original string
  }
  return dateStr;
}

function formatJoinDate(createdAt: unknown): string {
  if (!createdAt) return '—';
  if (typeof createdAt === 'object' && createdAt !== null && 'toDate' in (createdAt as Record<string, unknown>)) {
    const d = (createdAt as { toDate: () => Date }).toDate();
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (typeof createdAt === 'string') {
    return formatExpiryDate(createdAt);
  }
  return String(createdAt);
}

function getInitials(name: string): string {
  if (!name) return 'S';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface SurveyorsTabProps {
  surveyors: SurveyorAdminProfile[];
  payments?: PaymentRecord[];
  loading: boolean;
  processingId: string | null;
  searchQuery: string;
  onUpdateStatus: (uid: string, status: 'active' | 'suspended' | 'readonly') => void;
  onUpdateExpiry: (uid: string, date: string) => void;
  onUpdateId: (uid: string, idStr: string) => void;
  onUpdateName: (uid: string, name: string) => void;
  onExtend: (uid: string, days: number) => void;
  onDeleteAccount: (surveyor: SurveyorAdminProfile) => void;
  onUpdateTeamSeats?: (surveyorId: string, seats: number) => Promise<void> | void;
  onViewWorkspace?: (surveyor: SurveyorAdminProfile) => void;
  getClaimCountFn?: (uid: string) => Promise<number>;
  initialClaimsCountMap?: Record<string, number | 'loading' | 'error'>;
  initialExpandedId?: string | null;
}



export function TeamSeatsControl({
  surveyorId,
  maxTeamSeats = 0,
  disabled,
  onUpdateTeamSeats,
}: {
  surveyorId: string;
  maxTeamSeats?: number;
  disabled?: boolean;
  onUpdateTeamSeats?: (id: string, seats: number) => Promise<void> | void;
}) {
  const currentSeats = maxTeamSeats || 0;

  const handleSeatsChange = (seats: number) => {
    const clamped = Math.max(0, Math.min(50, seats));
    if (clamped !== currentSeats) {
      onUpdateTeamSeats?.(surveyorId, clamped);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLDivElement>) => {
    const target = e.target as HTMLInputElement;
    if (target && target.value !== undefined) {
      const val = parseInt(target.value, 10);
      const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(50, val));
      target.value = String(clamped);
      if (clamped !== currentSeats) {
        onUpdateTeamSeats?.(surveyorId, clamped);
      }
    }
  };

  return (
    <div
      className="inline-flex items-center gap-1 border border-border rounded-lg p-1 bg-card shadow-sm"
      onBlur={handleBlur}
    >
      <button
        type="button"
        disabled={disabled || currentSeats <= 0}
        onClick={(e) => {
          e.stopPropagation();
          handleSeatsChange(currentSeats - 1);
        }}
        aria-label="Decrease team seats"
        className="w-7 h-7 flex items-center justify-center rounded text-xs font-bold text-foreground hover:bg-muted disabled:opacity-40 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
      >
        -
      </button>
      <input
        id={`seats-${surveyorId}`}
        type="number"
        min="0"
        max="50"
        disabled={disabled}
        defaultValue={currentSeats}
        key={currentSeats}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-12 px-1 py-0.5 text-xs font-semibold text-center rounded border-0 bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Allowed Team Seats"
      />
      <button
        type="button"
        disabled={disabled || currentSeats >= 50}
        onClick={(e) => {
          e.stopPropagation();
          handleSeatsChange(currentSeats + 1);
        }}
        aria-label="Increase team seats"
        className="w-7 h-7 flex items-center justify-center rounded text-xs font-bold text-foreground hover:bg-muted disabled:opacity-40 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
      >
        +
      </button>
    </div>
  );
}

export function IdentityEditorCard({
  surveyor,
  isProcessing,
  onUpdateName,
  onUpdateId,
  onViewWorkspace,
  claimsCount,
}: {
  surveyor: SurveyorAdminProfile;
  isProcessing: boolean;
  onUpdateName: (uid: string, name: string) => void;
  onUpdateId: (uid: string, idStr: string) => void;
  onViewWorkspace?: (surveyor: SurveyorAdminProfile) => void;
  claimsCount?: number | 'loading' | 'error';
}) {
  const [name, setName] = useState(surveyor.name);
  const [platformId, setPlatformId] = useState(surveyor.surveyorId || '');

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedId = platformId.trim().toUpperCase();

    let updated = false;
    if (trimmedName && trimmedName !== surveyor.name) {
      onUpdateName(surveyor.id, trimmedName);
      updated = true;
    }
    if (trimmedId !== (surveyor.surveyorId || '')) {
      onUpdateId(surveyor.id, trimmedId);
      updated = true;
    }

    if (updated) {
      toast.success('Identity changes saved successfully');
    } else {
      toast.info('No identity changes to save');
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
          <IdCard size={16} className="text-primary" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Identity &amp; Licence Editor
          </h4>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor={`surveyor-name-${surveyor.id}`}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-1"
            >
              Full Name
            </label>
            <input
              id={`surveyor-name-${surveyor.id}`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isProcessing}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="Surveyor Full Name"
            />
          </div>

          <div>
            <label
              htmlFor={`surveyor-id-${surveyor.id}`}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-1"
            >
              Platform ID
            </label>
            <input
              id={`surveyor-id-${surveyor.id}`}
              type="text"
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
              disabled={isProcessing}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="ASSIGN ID..."
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            aria-label="Save Identity Changes"
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <CheckCircle2 size={14} /> Save Identity Changes
          </button>
          {onViewWorkspace && (
            <button
              type="button"
              onClick={() => onViewWorkspace(surveyor)}
              aria-label={`View workspace for ${surveyor.name}`}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-all flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              <Eye size={14} /> View Workspace
            </button>
          )}
        </div>

        {/* Metadata display */}
        <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">IRDAI Licence</div>
            <span className="font-medium text-foreground">{surveyor.licenceNumber || surveyor.irdaiLicence || '—'}</span>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">City / State</div>
            <span className="font-medium text-foreground">
              {[surveyor.city, surveyor.state].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Qualifications</div>
            <span className="font-medium text-foreground">{surveyor.qualifications || '—'}</span>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Referral Code</div>
            <span className="font-mono font-medium text-foreground">{surveyor.referralCode || '—'}</span>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Referred By</div>
            <span className="font-mono font-medium text-foreground">{surveyor.referredBy || '—'}</span>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Join Date</div>
            <span className="font-medium text-foreground">{formatJoinDate(surveyor.createdAt)}</span>
          </div>
          <div className="col-span-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Claims Created</div>
            {claimsCount === 'loading' ? (
              <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            ) : claimsCount === 'error' ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : typeof claimsCount === 'number' ? (
              <div className="flex items-center gap-1.5">
                <FileText size={14} className="text-muted-foreground" />
                {claimsCount === 0 ? (
                  surveyor.subscriptionStatus === 'trial' ? (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      0 (Untested)
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">0 claims</span>
                  )
                ) : (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {claimsCount} {claimsCount === 1 ? 'claim' : 'claims'}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FirmTeamSeatsCard({
  surveyor,
  isProcessing,
  onUpdateTeamSeats,
}: {
  surveyor: SurveyorAdminProfile;
  isProcessing: boolean;
  onUpdateTeamSeats?: (surveyorId: string, seats: number) => Promise<void> | void;
}) {
  const teamEmails = surveyor.teamEmails || [];
  const maxSeats = surveyor.maxTeamSeats || 0;

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Firm Team &amp; Seats
            </h4>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border">
            ({teamEmails.length} of {maxSeats} seats used)
          </span>
        </div>

        {/* Stepper control for maxTeamSeats */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <label htmlFor={`seats-${surveyor.id}`} className="text-xs font-medium text-foreground">
              Allowed Team Seats:
            </label>
            <TeamSeatsControl
              surveyorId={surveyor.id}
              maxTeamSeats={surveyor.maxTeamSeats}
              disabled={isProcessing}
              onUpdateTeamSeats={onUpdateTeamSeats}
            />
          </div>
        </div>

        {/* Privacy Status Badge */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/60 text-muted-foreground border border-border">
            <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>Fee bills &amp; earnings hidden from team</span>
          </div>
        </div>

        {/* Roster of registered assistant emails */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Registered Assistants ({teamEmails.length})
          </div>
          {teamEmails.length > 0 ? (
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
              {teamEmails.map((email, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-muted text-foreground border border-border"
                >
                  <Mail size={12} className="text-muted-foreground" />
                  <span>{email}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No assistants registered yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PaymentLedgerCard({
  surveyor,
  payments,
  isProcessing,
  onUpdateExpiry,
}: {
  surveyor: SurveyorAdminProfile;
  payments?: PaymentRecord[];
  isProcessing: boolean;
  onUpdateExpiry: (uid: string, date: string) => void;
}) {
  const surveyorPayments = payments?.filter(p => p.userUid === surveyor.id) || [];
  const totalLifetimeRevenue = surveyorPayments
    .filter(p => p.status === 'verified')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Payment History &amp; Notes
            </h4>
          </div>
          {surveyorPayments.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border">
              ({surveyorPayments.length} recorded)
            </span>
          )}
        </div>

        {/* Current status & expiry date */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Current Status</span>
              <span className="font-semibold uppercase tracking-wide text-foreground">
                {surveyor.subscriptionStatus}
              </span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground block text-[11px]">Subscription Expiry</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar size={14} className="text-muted-foreground" />
                <input
                  type="date"
                  aria-label="Update Expiry Date"
                  className="bg-transparent border border-border rounded px-2 py-0.5 text-xs text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
                  value={surveyor.subscriptionExpiry || ''}
                  onChange={(e) => onUpdateExpiry(surveyor.id, e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            </div>
          </div>

          {/* Total lifetime revenue sum */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
            <span className="font-medium text-foreground">Total Lifetime Revenue</span>
            <span className="font-bold text-foreground text-sm">
              ₹{totalLifetimeRevenue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Recent payments list */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Recent Payments
          </div>
          {surveyorPayments.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-border rounded-lg bg-muted/20">
              <p className="text-xs text-muted-foreground italic">No payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {surveyorPayments.map((p) => (
                <div
                  key={p.id || p.transactionId}
                  className="p-3 rounded-lg border border-border bg-card text-xs space-y-1 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">₹{p.amount}</span>
                    <span className="text-muted-foreground text-[11px]">
                      {p.paymentDate || (p.submittedAt ? new Date(p.submittedAt).toLocaleDateString('en-IN') : '—')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {p.transactionId}
                    </span>
                    {p.paymentMode && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        {p.paymentMode}
                      </span>
                    )}
                    {p.planName && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {p.planName}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${
                      p.status === 'verified'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : p.status === 'rejected'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    }`}>
                      {p.status === 'verified' ? <CheckCircle2 size={10} /> : p.status === 'rejected' ? <XCircle size={10} /> : <Clock size={10} />}
                      {p.status}
                      {p.durationGranted ? ` (+${p.durationGranted}d)` : ''}
                    </span>
                  </div>
                  {p.adminNotes && (
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">Admin Note:</span> {p.adminNotes}
                    </div>
                  )}
                  {p.notes && p.notes !== p.adminNotes && (
                    <div className="text-[11px] text-muted-foreground italic">
                      {p.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SurveyorsTab({
  surveyors,
  payments,
  loading,
  processingId,
  searchQuery,
  onUpdateStatus,
  onUpdateExpiry,
  onUpdateId,
  onUpdateName,
  onExtend,
  onDeleteAccount,
  onUpdateTeamSeats,
  onViewWorkspace,
  getClaimCountFn,
  initialClaimsCountMap,
  initialExpandedId,
}: SurveyorsTabProps) {
  const [activeFilter, setActiveFilter] = useState<SurveyorFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? null);
  const [claimsCountMap, setClaimsCountMap] = useState<Record<string, number | 'loading' | 'error'>>(
    initialClaimsCountMap || {}
  );
  const [extendModalSurveyor, setExtendModalSurveyor] = useState<{
    id: string;
    name: string;
    subscriptionExpiry: string;
  } | null>(null);

  const countFetcher = getClaimCountFn || getSurveyorClaimCount;

  const handleViewWorkspace = (s: SurveyorAdminProfile) => {
    if (onViewWorkspace) {
      onViewWorkspace(s);
    } else {
      useAuthStore.getState().setViewAsSurveyor({
        uid: s.id,
        name: s.name || 'Surveyor',
        licence: s.licenceNumber || s.irdaiLicence || '',
        email: s.email,
      });
      useUIStore.getState().setActiveTab('dashboard');
      toast.info(`Entered read-only Support Mode for ${s.name || 'Surveyor'}`);
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId(prev => {
      const next = prev === id ? null : id;
      if (next && claimsCountMap[next] === undefined) {
        setClaimsCountMap(old => ({ ...old, [next]: 'loading' }));
        countFetcher(next)
          .then(count => {
            setClaimsCountMap(old => ({ ...old, [next]: count }));
          })
          .catch(err => {
            console.error('Failed to load surveyor claim count:', next, err);
            setClaimsCountMap(old => ({ ...old, [next]: 'error' }));
          });
      }
      return next;
    });
  };

  const filtered = surveyors
    .filter(s => s.subscriptionStatus !== 'pending')
    .filter(s => {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.teamEmails?.some(e => e.toLowerCase().includes(q))
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
            type="button"
            onClick={() => setActiveFilter(key)}
            className={`px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all focus-visible:ring-2 focus-visible:ring-primary ${
              activeFilter === key
                ? 'bg-foreground text-background'
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
            <tr className="bg-muted/50 border-b border-border">
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left">
                Surveyor &amp; Identity
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Licence &amp; Platform ID
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status &amp; Plan
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Claims &amp; Onboarding
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Expiry
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((surveyor) => {
              const expiry = getExpiry(surveyor);
              const expiring = isExpiringSoon(surveyor);
              const days = getDaysRemaining(expiry);
              const rowBg = expiring ? 'bg-amber-500/10' : '';
              const isProcessing = processingId === surveyor.id;
              const onboardingSummary = getSurveyorOnboardingProgress(surveyor);

              return (
                <React.Fragment key={surveyor.id}>
                  <tr
                    className={`hover:bg-muted/50 transition-colors group cursor-pointer ${rowBg}`}
                    onClick={() => handleToggleExpand(surveyor.id)}
                  >
                    {/* Column 1: Surveyor & Identity */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0">
                          {getInitials(surveyor.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate">
                            <span>{surveyor.name}</span>
                            {surveyor.isAdmin && (
                              <span title="Admin" className="inline-flex">
                                <ShieldCheck size={14} className="text-primary flex-shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                            <Mail size={12} className="flex-shrink-0" />
                            <span>{surveyor.email || '—'}</span>
                          </div>
                          {(surveyor.mobile || surveyor.mobileNumber) && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                              <Phone size={12} className="flex-shrink-0" />
                              <span>{surveyor.mobile || surveyor.mobileNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Licence & Platform ID */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">
                        {surveyor.licenceNumber || surveyor.irdaiLicence || '—'}
                      </div>
                      <div className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground inline-block mt-0.5">
                        {surveyor.surveyorId || 'Unassigned'}
                      </div>
                      {(surveyor.city || surveyor.state) && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin size={12} className="flex-shrink-0" />
                          <span>{[surveyor.city, surveyor.state].filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                    </td>

                    {/* Column 3: Status & Plan */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium uppercase tracking-wider border ${
                          surveyor.subscriptionStatus === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : surveyor.subscriptionStatus === 'trial'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : surveyor.subscriptionStatus === 'suspended'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                            : surveyor.subscriptionStatus === 'readonly'
                            ? 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {surveyor.subscriptionStatus === 'active' ? <CheckCircle2 size={12} />
                            : surveyor.subscriptionStatus === 'trial' ? <Eye size={12} />
                            : surveyor.subscriptionStatus === 'suspended' ? <XCircle size={12} />
                            : <Clock size={12} />}
                          {surveyor.subscriptionStatus}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {(surveyor.maxTeamSeats || 0) > 0
                            ? `👥 Firm (${surveyor.teamEmails?.length || 0}/${surveyor.maxTeamSeats} Seats)`
                            : '👤 Solo'}
                        </span>
                      </div>
                    </td>

                    {/* Column 4: Claims & Onboarding */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {claimsCountMap[surveyor.id] === 'loading' ? (
                          <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                        ) : claimsCountMap[surveyor.id] === 'error' ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText size={12} /> —
                          </span>
                        ) : typeof claimsCountMap[surveyor.id] === 'number' ? (
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <FileText size={12} className="text-muted-foreground" />
                            {claimsCountMap[surveyor.id] === 0 ? (
                              surveyor.subscriptionStatus === 'trial' ? (
                                <span className="text-amber-600 dark:text-amber-400">0 (Untested)</span>
                              ) : (
                                <span className="text-muted-foreground">0 claims</span>
                              )
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {claimsCountMap[surveyor.id]} {claimsCountMap[surveyor.id] === 1 ? 'claim' : 'claims'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <FileText size={12} /> —
                          </div>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
                            onboardingSummary.badgeStatus === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : onboardingSummary.badgeStatus === 'in_progress'
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                          title={onboardingSummary.milestones.map(m => `${m.label}: ${m.done ? 'Done' : 'Pending'}`).join(' | ')}
                        >
                          {onboardingSummary.badgeStatus === 'completed' ? (
                            <CheckCircle2 size={12} />
                          ) : onboardingSummary.badgeStatus === 'in_progress' ? (
                            <Clock size={12} />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                          )}
                          {onboardingSummary.badgeText}
                        </span>
                        {onboardingSummary.tipsSeenCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {onboardingSummary.tipsSeenCount} tips seen
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 5: Expiry */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Calendar size={14} className="text-muted-foreground" />
                          <span>{formatExpiryDate(expiry)}</span>
                        </div>
                        {expiry ? (
                          days <= 0 ? (
                            <span className="text-xs font-medium text-red-600 dark:text-red-400 block mt-0.5">
                              Expired {Math.abs(days)}d ago
                            </span>
                          ) : (
                            <span className={`text-xs font-medium block mt-0.5 ${
                              days <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              ({days}d left)
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground block mt-0.5">—</span>
                        )}
                      </div>
                    </td>

                    {/* Column 6: Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExtendModalSurveyor({
                              id: surveyor.id,
                              name: surveyor.name,
                              subscriptionExpiry: surveyor.subscriptionExpiry || '',
                            });
                          }}
                          disabled={isProcessing}
                          aria-label="Extend subscription"
                          title="Extend subscription"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Plus size={14} /> Extend
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewWorkspace(surveyor);
                          }}
                          aria-label={`View workspace for ${surveyor.name}`}
                          title="Inspect this surveyor's claims & workspace in read-only mode"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-all focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                        >
                          <Eye size={14} />
                          <span>View Workspace</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleExpand(surveyor.id)}
                          aria-expanded={expandedId === surveyor.id}
                          aria-label="Manage surveyor details"
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary ${
                            expandedId === surveyor.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80 text-foreground'
                          }`}
                        >
                          <span>Manage</span>
                          {expandedId === surveyor.id ? (
                            <ChevronDown size={14} className="flex-shrink-0" />
                          ) : (
                            <ChevronRight size={14} className="flex-shrink-0" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Drawer Bento Grid */}
                  {expandedId === surveyor.id && (
                    <tr>
                      <td colSpan={6} className="px-6 py-0">
                        <div
                          className="py-6 px-6 mb-4 rounded-2xl bg-muted/30 border border-border animate-in fade-in slide-in-from-top-2 duration-200"
                        >
                          {/* 3-Column Bento Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Card 1: Identity & Licence Editor */}
                            <IdentityEditorCard
                              surveyor={surveyor}
                              isProcessing={isProcessing}
                              onUpdateName={onUpdateName}
                              onUpdateId={onUpdateId}
                              onViewWorkspace={handleViewWorkspace}
                              claimsCount={claimsCountMap[surveyor.id]}
                            />

                            {/* Card 2: Firm Team & Seats */}
                            <FirmTeamSeatsCard
                              surveyor={surveyor}
                              isProcessing={isProcessing}
                              onUpdateTeamSeats={onUpdateTeamSeats}
                            />

                            {/* Card 3: Subscription & Payment Ledger */}
                            <PaymentLedgerCard
                              surveyor={surveyor}
                              payments={payments}
                              isProcessing={isProcessing}
                              onUpdateExpiry={onUpdateExpiry}
                            />
                          </div>

                          {/* Trial Onboarding Progress */}
                          <div className="mt-6 pt-4 border-t border-border">
                            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                              Trial Onboarding Progress ({onboardingSummary.percentage}%)
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                              {onboardingSummary.milestones.map((m) => (
                                <div
                                  key={m.key}
                                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                                    m.done
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-foreground'
                                      : 'bg-card border-border text-muted-foreground'
                                  }`}
                                >
                                  {m.done ? (
                                    <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                                  ) : (
                                    <XCircle size={14} className="text-muted-foreground/50 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-medium text-xs truncate">{m.label}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {m.done ? 'Completed' : 'Pending'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Surveyor AI Keys */}
                          <div className="mt-6 pt-4 border-t border-border">
                            <SurveyorAIKeys uid={surveyor.id} />
                          </div>

                          {/* Footer / Danger Zone */}
                          <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                                Status:
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(surveyor.id, 'active')}
                                disabled={isProcessing || surveyor.subscriptionStatus === 'active'}
                                aria-label="Set status to Active"
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                Active
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(surveyor.id, 'suspended')}
                                disabled={isProcessing || surveyor.subscriptionStatus === 'suspended'}
                                aria-label="Set status to Suspended"
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                Suspend
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(surveyor.id, 'readonly')}
                                disabled={isProcessing || surveyor.subscriptionStatus === 'readonly'}
                                aria-label="Set status to Read-Only"
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                Read-Only
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => onDeleteAccount(surveyor)}
                              disabled={isProcessing}
                              aria-label="Delete account permanently"
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <Trash2 size={14} /> ⚠️ Delete Account
                            </button>
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
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <UserX size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground">No surveyors found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search criteria.</p>
          </div>
        )}
      </div>

      <ExtendSubscriptionModal
        isOpen={Boolean(extendModalSurveyor)}
        surveyor={extendModalSurveyor}
        onConfirm={(uid, days) => {
          onExtend(uid, days);
          setExtendModalSurveyor(null);
        }}
        onClose={() => setExtendModalSurveyor(null)}
      />
    </>
  );
}
