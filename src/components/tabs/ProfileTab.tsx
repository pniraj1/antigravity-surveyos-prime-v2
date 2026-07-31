'use client';

import { useProfileStore } from '@/stores/profile-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { linkGoogleDrive } from '@/lib/drive';
import { getUserPayments } from '@/lib/firebase/payments';
import { calculateSubscriptionState, getDaysRemaining } from '@/lib/subscription/status';
import { PaymentSubmissionForm } from '@/components/subscription/PaymentSubmissionForm';
import { UPI_ID } from '@/lib/subscription/plans';
import { useState, useRef, useEffect } from 'react';
import type { PaymentRecord } from '@/types/payment';
import {
  User, Shield, CreditCard,
  Landmark, Sparkles, Camera, RefreshCw, CheckCircle2,
  AlertCircle, Upload, Trash2, Cpu, ExternalLink, Cloud, CloudOff, Link,
  ShieldCheck, Plus, Eye, EyeOff, Lock,
  Calendar, Copy, Gift, Clock, BadgeCheck, XCircle, Hourglass, Plane,
} from 'lucide-react';
import { ConnectSyncDialog } from '@/components/sync-bridge/ConnectSyncDialog';
import { FeeScheduleSection } from '@/components/profile/FeeScheduleSection';

// ─── Section Wrapper ─────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      <div className="px-6 py-4 flex items-center gap-2 border-b border-border" style={{ background: 'var(--color-neutral-100)' }}>
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}

// ─── Input Field ─────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder = '', type = 'text', fullWidth = false, readOnly = false, hint = ''
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; fullWidth?: boolean; readOnly?: boolean; hint?: string;
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label className="block mb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all"
        style={{
          border: '1px solid var(--color-neutral-200)',
          background: readOnly ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
          color: 'var(--color-neutral-900)',
          fontWeight: 600,
        }}
        onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-neutral-200)'; }}
      />
      {hint && <p className="mt-1 text-[9px] font-medium text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Multi-Key Input ─────────────────────────────────────────────────────────
function MultiKeyInput({
  keys, onChange, placeholder, accentColor,
}: {
  keys: string[]; onChange: (keys: string[]) => void; placeholder: string; accentColor: string;
}) {
  const [visible, setVisible] = useState<Record<number, boolean>>({});

  const updateKey = (i: number, v: string) => {
    const next = [...keys];
    next[i] = v;
    onChange(next);
  };

  const removeKey = (i: number) => {
    const next = keys.filter((_, idx) => idx !== i);
    onChange(next);
    setVisible(prev => {
      const updated: Record<number, boolean> = {};
      Object.keys(prev).forEach(k => {
        const ki = Number(k);
        if (ki < i) updated[ki] = prev[ki];
        else if (ki > i) updated[ki - 1] = prev[ki];
      });
      return updated;
    });
  };

  const addKey = () => {
    if (keys.length < 3) onChange([...keys, '']);
  };

  const displayKeys = keys.length > 0 ? keys : [''];

  return (
    <div className="space-y-2">
      {displayKeys.map((k, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1 flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-neutral-200)', background: 'var(--color-neutral-50)' }}>
            <input
              type={visible[i] ? 'text' : 'password'}
              value={k}
              onChange={e => updateKey(i, e.target.value)}
              placeholder={i === 0 ? placeholder : `Backup key ${i + 1} (optional)`}
              className="flex-1 px-3 py-2 text-sm bg-transparent outline-none"
              style={{ color: 'var(--color-neutral-900)', fontWeight: 600 }}
              onFocus={e => (e.currentTarget.parentElement!.style.borderColor = accentColor)}
              onBlur={e => (e.currentTarget.parentElement!.style.borderColor = 'var(--color-neutral-200)')}
            />
            <button
              type="button"
              onClick={() => setVisible(prev => ({ ...prev, [i]: !prev[i] }))}
              className="px-2 py-2 flex-shrink-0 text-muted-foreground"
            >
              {visible[i] ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {(keys.length > 1 || (keys.length === 1 && keys[0])) && (
            <button
              type="button"
              onClick={() => removeKey(i)}
              className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-status-danger-tint text-status-danger"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {keys.length < 3 && (
        <button
          type="button"
          onClick={addKey}
          className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide transition-opacity hover:opacity-70"
          style={{ color: accentColor }}
        >
          <Plus size={11} /> Add backup key
        </button>
      )}
      <p className="text-[9px] font-medium text-muted-foreground">
        Keys are used in order — if key 1 hits rate limit, key 2 is tried automatically.
      </p>
    </div>
  );
}

// ─── Image Upload Block ───────────────────────────────────────────────────────
function ImageUploader({
  label, dataUrl, onUpload, onClear, hint,
}: {
  label: string; dataUrl: string | null;
  onUpload: (dataUrl: string) => void; onClear: () => void; hint: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpload(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="sm:col-span-2">
      <label className="block mb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </label>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {dataUrl ? (
        <div
          className="relative flex items-center gap-4 p-3 rounded-xl border border-border"
          style={{ background: 'var(--color-neutral-50)' }}
        >
          <img
            src={dataUrl}
            alt={label}
            className="h-16 w-auto object-contain rounded-lg"
            style={{ background: 'white', border: '1px solid var(--color-neutral-200)', padding: 4 }}
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">{label} uploaded</div>
            <div className="text-xs text-muted-foreground">{hint}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => ref.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/30"
            >
              <RefreshCw size={11} /> Replace
            </button>
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-danger-tint text-status-danger border border-status-danger/20"
            >
              <Trash2 size={11} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
          style={{ background: 'var(--color-neutral-50)', border: '1.5px dashed var(--color-neutral-400)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgba(212,175,55,0.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-neutral-400)'; e.currentTarget.style.background = 'var(--color-neutral-50)'; }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
            <Upload size={15} />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">Upload {label}</div>
            <div className="text-xs text-muted-foreground">{hint}</div>
          </div>
        </button>
      )}
    </div>
  );
}

// ─── Subscription Section ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ReactNode }> = {
  trial:    { label: 'Free Trial',  badgeClass: 'bg-status-warning-tint text-status-warning',   icon: <Clock size={11} /> },
  active:   { label: 'Active',      badgeClass: 'bg-status-success-tint text-status-success',   icon: <BadgeCheck size={11} /> },
  pending:  { label: 'Pending',     badgeClass: 'bg-status-warning-tint text-status-warning',   icon: <Hourglass size={11} /> },
  readonly: { label: 'Expired',     badgeClass: 'bg-status-danger-tint text-status-danger',     icon: <XCircle size={11} /> },
  suspended:{ label: 'Suspended',   badgeClass: 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-600)]', icon: <XCircle size={11} /> },
};

function SubscriptionSection({ uid, profile }: { uid: string; profile: import('@/types').SurveyorProfile }) {
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
              Share this code with a fellow surveyor. When they subscribe and their first
              payment is verified, <strong className="text-foreground">you get 30 days free</strong> —
              automatically added to your subscription.
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
                  `I use Motor SurveyOS for my survey reports — AI reads the RC/DL/policy and drafts the report in minutes. 30-day free trial: https://motorsurveyos-in.web.app\n\nUse my referral code at signup: ${profile.referralCode}`
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

// ─── Main Component ───────────────────────────────────────────────────────────
export function ProfileTab() {
  const { profile, updateProfile } = useProfileStore();
  const { isDriveConnected, driveEmail } = useUIStore();
  const [saved, setSaved] = useState(false);
  const [driveLinking, setDriveLinking] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [connectSyncOpen, setConnectSyncOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isAdminUser = profile.isAdmin;

  const isNameLocked = !isAdminUser; // Only admins can rename

  const set = (key: string) => (v: string) => updateProfile({ [key]: v } as any);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // Cloud push is handled automatically by useCloudSync (section 4 effect)
    // which watches profile state changes and pushes to Firestore.
  };

  const handleLinkDrive = async () => {
    setDriveError('');
    setDriveLinking(true);
    try {
      await linkGoogleDrive();
    } catch (e: any) {
      const msg = e?.message || 'Drive linking failed. Please try again.';
      setDriveError(msg);
    } finally {
      setDriveLinking(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-neutral-50)' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="px-8 py-8 lg:px-12"
        style={{ background: 'var(--color-neutral-900)' }}
      >
        <div className="max-w-4xl mx-auto flex items-start justify-between gap-6">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.2em] mb-4 bg-primary/15 text-primary border border-primary/30"
            >
              <Shield size={11} />
              Surveyor Identity
            </div>
            <h1 className="text-2xl lg:text-3xl font-medium mb-2 text-white" style={{ letterSpacing: '-0.02em' }}>
              {profile.name || 'Your Profile'}
            </h1>
            <p className="text-sm" style={{ color: 'rgba(232,236,240,0.6)' }}>
              {profile.licenceNumber
                ? `Lic. No. ${profile.licenceNumber} · ${profile.categories}`
                : 'Fill in your surveyor details — they will appear on all generated reports.'}
            </p>
          </div>

          {/* Admin Button & Avatar */}
          <div className="flex flex-col items-center gap-4">
            {isAdminUser && (
              <button
                onClick={() => useUIStore.getState().setActiveTab('admin')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-lg bg-primary text-primary-foreground"
              >
                <ShieldCheck size={14} />
                Regulator Dashboard
              </button>
            )}
            <div
              className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl font-medium text-white"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              {profile.name ? profile.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'SP'}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-12 py-8 max-w-4xl mx-auto space-y-5">

        {/* ── Personal ──────────────────────────────────── */}
        <Section title="Personal Details" icon={<User size={14} />}>
          <div className={isNameLocked ? '' : ''}>
            <label className="flex items-center gap-1.5 mb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Full Name
              {isNameLocked && (
                <span
                  className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full text-[8px] font-medium uppercase bg-primary/12 text-primary"
                  title="Name is identity-locked. Contact an admin to change it."
                >
                  <Lock size={8} /> Identity-Locked
                </span>
              )}
            </label>
            <input
              type="text"
              value={profile.name}
              readOnly={isNameLocked}
              onChange={e => !isNameLocked && updateProfile({ name: e.target.value })}
              placeholder="e.g. Niraj P."
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all"
              style={{
                border: '1px solid var(--color-neutral-200)',
                background: isNameLocked ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
                color: 'var(--color-neutral-900)',
                fontWeight: 600,
                cursor: isNameLocked ? 'not-allowed' : 'text',
              }}
              onFocus={e => { if (!isNameLocked) e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-neutral-200)'; }}
            />
            {isNameLocked && (
              <p className="mt-1 text-[9px] font-medium text-muted-foreground">
                Contact an administrator to update your name.
              </p>
            )}
          </div>
          <Field label="Qualifications" value={profile.qualifications} onChange={set('qualifications')} placeholder="e.g. B.E. Mechanical, AMII" />
          <Field label="Mobile" value={profile.mobile} onChange={set('mobile')} placeholder="+91 98765 43210" type="tel" />
          <Field label="Email" value={profile.email} onChange={set('email')} placeholder="surveyor@example.com" type="email" />
          <Field label="Address" value={profile.address} onChange={set('address')} placeholder="Office / Home address" fullWidth />
        </Section>

        {/* ── Licence ───────────────────────────────────── */}
        <Section title="Surveyor Licence & Registration" icon={<Shield size={14} />}>
          <Field label="IRDAI Licence Number" value={profile.licenceNumber} onChange={set('licenceNumber')} placeholder="e.g. SLA-MH-123456" />
          <Field label="Licence Expiry" value={profile.licenceExpiry} onChange={set('licenceExpiry')} type="date" />
          <Field label="IIISLA Member Number" value={profile.iiislaNumber} onChange={set('iiislaNumber')} placeholder="e.g. MH-2024-001" />
          <Field label="Surveyor Code" value={profile.code} onChange={set('code')} placeholder="e.g. MH-SP-001" />
          <Field label="Licence Categories" value={profile.categories} onChange={set('categories')} placeholder="MOTOR, MARINE, FIRE…" fullWidth />
        </Section>

        {/* ── Financial ─────────────────────────────────── */}
        <Section title="Financial & Tax Details" icon={<Landmark size={14} />}>
          <Field label="GST Number" value={profile.gstNumber} onChange={set('gstNumber')} placeholder="e.g. 27AABCU9603R1ZX" />
          <Field label="PAN Number" value={profile.panNumber} onChange={set('panNumber')} placeholder="e.g. AABCU9603R" />
          <Field label="Bank Name" value={profile.bankName} onChange={set('bankName')} placeholder="e.g. State Bank of India" />
          <Field label="Account Number" value={profile.bankAccount} onChange={set('bankAccount')} placeholder="e.g. 1234567890" />
          <Field label="IFSC Code" value={profile.bankIFSC} onChange={set('bankIFSC')} placeholder="e.g. SBIN0001234" />
        </Section>

        {/* ── Signature & Stamp ─────────────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-card border border-border">
          <div className="px-6 py-4 flex items-center gap-2 border-b border-border" style={{ background: 'var(--color-neutral-100)' }}>
            <Camera size={14} className="text-primary" />
            <span className="text-sm font-medium text-foreground">Signature &amp; Stamp</span>
            <span className="ml-2 text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider bg-primary/12 text-primary">
              Printed on reports
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUploader
              label="Signature"
              dataUrl={profile.signatureDataUrl}
              onUpload={(url) => updateProfile({ signatureDataUrl: url })}
              onClear={() => updateProfile({ signatureDataUrl: null })}
              hint="Upload PNG/JPG — appears on Final Report & Fee Bill"
            />
            <ImageUploader
              label="Rubber Stamp"
              dataUrl={profile.stampDataUrl}
              onUpload={(url) => updateProfile({ stampDataUrl: url })}
              onClear={() => updateProfile({ stampDataUrl: null })}
              hint="Upload PNG/JPG — appears on signed documents"
            />
          </div>
        </div>

        {/* ── Fee Schedule (IISLA) ──────────────────────── */}
        <FeeScheduleSection />

        {/* ── AI Config ─────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-card border border-border">
          <div className="px-6 py-4 flex items-center justify-between gap-2 border-b border-border" style={{ background: 'var(--color-neutral-100)' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <span className="text-sm font-medium text-foreground">AI &amp; Documents Intelligence</span>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--color-neutral-100)' }}>
              <button
                onClick={() => updateProfile({ aiProvider: 'gemini' })}
                className="px-3 py-1 rounded-md text-[10px] font-medium uppercase transition-all"
                style={{
                  background: profile.aiProvider === 'gemini' ? 'white' : 'transparent',
                  color: profile.aiProvider === 'gemini' ? 'var(--color-primary)' : 'var(--color-neutral-400)',
                  boxShadow: profile.aiProvider === 'gemini' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                Google Gemini
              </button>
              <button
                onClick={() => updateProfile({ aiProvider: 'groq' })}
                className="px-3 py-1 rounded-md text-[10px] font-medium uppercase transition-all"
                style={{
                  background: profile.aiProvider === 'groq' ? 'white' : 'transparent',
                  color: profile.aiProvider === 'groq' ? 'var(--color-primary)' : 'var(--color-neutral-400)',
                  boxShadow: profile.aiProvider === 'groq' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                Groq (Speed)
              </button>
              <button
                onClick={() => updateProfile({ aiProvider: 'nvidia' })}
                className="px-3 py-1 rounded-md text-[10px] font-medium uppercase transition-all"
                style={{
                  background: profile.aiProvider === 'nvidia' ? 'white' : 'transparent',
                  color: profile.aiProvider === 'nvidia' ? '#76B900' : 'var(--color-neutral-400)',
                  boxShadow: profile.aiProvider === 'nvidia' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                NVIDIA
              </button>
            </div>
          </div>
          <div className="p-5 space-y-6">

            {/* Gemini Section — always visible */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(66,133,244,0.05)', border: `1px solid ${profile.aiProvider === 'gemini' ? 'rgba(66,133,244,0.5)' : 'rgba(66,133,244,0.1)'}` }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <Cpu size={18} style={{ color: '#4285F4' }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-foreground">Google Gemini AI</div>
                      {profile.aiProvider === 'gemini' && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#4285F4', color: '#fff' }}>PRIMARY</span>}
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground">Auto-selects best model · Add up to 3 keys for rate-limit resilience</div>
                  </div>
                </div>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-80" style={{ background: '#4285F4', color: '#FFFFFF' }}>
                  Get Key <ExternalLink size={10} />
                </a>
              </div>
              <MultiKeyInput
                keys={profile.geminiApiKeys || []}
                onChange={keys => updateProfile({ geminiApiKeys: keys })}
                placeholder="AIzaSy..."
                accentColor="#4285F4"
              />
            </div>

            {/* Groq Section — always visible */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(242,102,57,0.05)', border: `1px solid ${profile.aiProvider === 'groq' ? 'rgba(242,102,57,0.5)' : 'rgba(242,102,57,0.1)'}` }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <Cpu size={18} style={{ color: '#F26639' }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-foreground">Groq LPQ Intelligence</div>
                      {profile.aiProvider === 'groq' && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#F26639', color: '#fff' }}>PRIMARY</span>}
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground">Fastest Inference Engine · Add up to 3 keys for rate-limit resilience</div>
                  </div>
                </div>
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-80" style={{ background: '#F26639', color: '#FFFFFF' }}>
                  Get Key <ExternalLink size={10} />
                </a>
              </div>
              <MultiKeyInput
                keys={profile.groqApiKeys || []}
                onChange={keys => updateProfile({ groqApiKeys: keys })}
                placeholder="gsk_..."
                accentColor="#F26639"
              />
            </div>

            {/* NVIDIA NIM Section — always visible (also used as last-resort fallback) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(118,185,0,0.05)', border: `1px solid ${profile.aiProvider === 'nvidia' ? 'rgba(118,185,0,0.5)' : 'rgba(118,185,0,0.15)'}` }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <Cpu size={18} style={{ color: '#76B900' }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-foreground">NVIDIA NIM · Free Tier</div>
                      {profile.aiProvider === 'nvidia' && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#76B900', color: '#fff' }}>PRIMARY</span>}
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground">90B Vision Model · 40 req/min · No monthly cap · Fallback when Gemini &amp; Groq fail</div>
                  </div>
                </div>
                <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-80" style={{ background: '#76B900', color: '#FFFFFF' }}>
                  Get Key <ExternalLink size={10} />
                </a>
              </div>
              <MultiKeyInput
                keys={profile.nvidiaApiKeys || []}
                onChange={keys => updateProfile({ nvidiaApiKeys: keys })}
                placeholder="nvapi-..."
                accentColor="#76B900"
              />
            </div>
          </div>
        </div>

        {/* ── Google Drive ───────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-card border border-border">
          <div className="px-6 py-4 flex items-center gap-2 border-b border-border" style={{ background: 'var(--color-neutral-100)' }}>
            <Cloud size={14} className={isDriveConnected ? 'text-status-success' : 'text-primary'} />
            <span className="text-sm font-medium text-foreground">Google Drive Sync</span>
            {isDriveConnected && (
              <span className="ml-1 text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider bg-status-success-tint text-status-success">Linked</span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {/* Status banner */}
            <div
              className={`flex items-center gap-3 p-3 rounded-xl ${
                isDriveConnected
                  ? 'bg-status-success-tint border border-status-success/20'
                  : 'bg-status-warning-tint border border-status-warning/20'
              }`}
            >
              {isDriveConnected
                ? <CheckCircle2 size={16} className="text-status-success flex-shrink-0" />
                : <CloudOff size={16} className="text-status-warning flex-shrink-0" />}
              <div>
                <div className="text-xs font-medium text-foreground">
                  {isDriveConnected ? `Linked as ${driveEmail}` : 'Google Drive is not linked'}
                </div>
                <div className="text-[10px] font-medium text-muted-foreground">
                  {isDriveConnected
                    ? 'Your reports and documents will automatically sync to your Google Drive folder: SurveyOS/'
                    : 'Click the button below to grant SurveyOS permission to upload files to your Google Drive.'}
                </div>
              </div>
            </div>

            {/* Auto-Upload Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border" style={{ background: 'var(--color-neutral-50)' }}>
              <div>
                <div className="text-sm font-medium text-foreground">Auto Push Files</div>
                <div className="text-[10px] font-medium text-muted-foreground">Automatically upload photos and documents to Drive</div>
              </div>
              <button
                onClick={() => updateProfile({ autoUploadDrive: profile.autoUploadDrive === false ? true : false })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  profile.autoUploadDrive !== false ? 'bg-status-success' : 'bg-[var(--color-neutral-400)]'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  profile.autoUploadDrive !== false ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Error */}
            {driveError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-status-danger-tint border border-status-danger/15">
                <AlertCircle size={13} className="text-status-danger flex-shrink-0" />
                <span className="text-xs font-medium text-status-danger">{driveError}</span>
              </div>
            )}

            {/* Button */}
            <button
              onClick={handleLinkDrive}
              disabled={driveLinking}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all text-white"
              style={{
                background: isDriveConnected ? 'var(--color-status-success, #059669)' : '#4285F4',
                opacity: driveLinking ? 0.7 : 1,
                cursor: driveLinking ? 'not-allowed' : 'pointer',
              }}
            >
              {driveLinking ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : isDriveConnected ? (
                <CheckCircle2 size={14} />
              ) : (
                <Link size={14} />
              )}
              {driveLinking ? 'Linking…' : isDriveConnected ? 'Re-Link Drive Account' : 'Link Google Drive'}
            </button>
          </div>
        </div>

        {/* ── SurveyOS Sync Integration ─────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-card border border-border">
          <div className="px-6 py-4 flex items-center gap-2 border-b border-border" style={{ background: 'var(--color-neutral-100)' }}>
            <Plane size={14} className="text-primary" />
            <span className="text-sm font-medium text-foreground">SurveyOS Sync</span>
            {profile.syncConnectedAt && (
              <span className="ml-1 text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider bg-status-success-tint text-status-success">
                Connected
              </span>
            )}
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-foreground">Document Drive</div>
                <div className="text-[10px] font-medium mt-0.5 text-muted-foreground">
                  {profile.syncConnectedAt
                    ? `Connected ${new Date(profile.syncConnectedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    : 'Pull documents collected from insureds and garages via Telegram.'}
                </div>
              </div>
              {profile.syncConnectedAt ? (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="flex items-center gap-1 text-xs font-medium text-status-success">
                    <CheckCircle2 size={14} /> Connected
                  </span>
                  <button
                    onClick={() => updateProfile({ syncBridgeToken: '', syncConnectedAt: null })}
                    className="text-xs font-medium hover:underline text-status-danger"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConnectSyncOpen(true)}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium text-primary-foreground"
                  style={{ background: 'var(--color-neutral-900)' }}
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </div>

        <ConnectSyncDialog open={connectSyncOpen} onOpenChange={setConnectSyncOpen} />

        {/* ── Subscription & Billing ────────────────────── */}
        <SubscriptionSection uid={user?.uid ?? ''} profile={profile} />

        {/* ── Save ──────────────────────────────────────── */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-sm transition-all shadow-lg ${
              saved ? 'text-white' : 'bg-primary text-primary-foreground'
            }`}
            style={saved ? { background: 'var(--color-status-success, #059669)' } : {}}
          >
            {saved ? <CheckCircle2 size={15} /> : <CheckCircle2 size={15} />}
            {saved ? 'Saved Successfully!' : 'Update Profile & Settings'}
          </button>
        </div>

        {/* Info card */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl mb-4 bg-primary/5 border border-primary/20"
        >
          <AlertCircle size={15} className="text-primary flex-shrink-0" style={{ marginTop: 1 }} />
          <div className="text-xs space-y-2 text-[var(--color-neutral-600)]" style={{ lineHeight: 1.6 }}>
            <p>
              Profile data and API keys are <strong>saved locally on this device</strong> (localStorage).
              Your identity details and signatures will automatically appear on generated PDFs.
            </p>
            <p className="font-medium">
              AI Future-Proofing: By using your own API keys, your SurveyOS remains free forever. You can update the Model ID anytime to use the latest AI releases from Google or Groq.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
