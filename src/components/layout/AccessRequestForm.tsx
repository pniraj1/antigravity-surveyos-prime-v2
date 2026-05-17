'use client';

import { useState } from 'react';
import { doc, setDoc, Timestamp, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { signOutUser } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import {
  Shield, User, Phone, Mail, FileText, Loader2,
  CheckCircle2, Lock, ArrowRight, AlertCircle, Gift,
} from 'lucide-react';

// ─── Input Field ─────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, type = 'text', locked = false, hint = '', icon,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; locked?: boolean; hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: '#8D99AE' }}>
        {icon}
        {label}
        {locked && (
          <span className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
            <Lock size={8} /> Pre-filled
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        readOnly={locked}
        onChange={e => onChange?.(e.target.value)}
        placeholder={locked ? undefined : placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none transition-all"
        style={{
          background: locked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
          border: locked ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.15)',
          color: locked ? 'rgba(232,236,240,0.5)' : '#F8F9FA',
          cursor: locked ? 'not-allowed' : 'text',
        }}
        onFocus={e => { if (!locked) e.currentTarget.style.borderColor = '#D4AF37'; }}
        onBlur={e => { if (!locked) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
      />
      {hint && <p className="text-[9px] font-semibold" style={{ color: 'rgba(232,236,240,0.35)' }}>{hint}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AccessRequestForm() {
  const { user } = useAuthStore();
  const { updateProfile } = useProfileStore();

  const [name, setName]         = useState(user?.displayName ?? '');
  const [irdai, setIrdai]       = useState('');
  const [phone, setPhone]       = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referrerUid, setReferrerUid] = useState<string | null>(null);
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralValid(null);
      setReferrerUid(null);
      return;
    }
    try {
      const q = query(collectionGroup(db, 'profile'), where('referralCode', '==', code.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const refDoc = snap.docs[0];
        const uid = refDoc.ref.path.split('/')[1];
        setReferrerUid(uid);
        setReferralValid(true);
      } else {
        setReferrerUid(null);
        setReferralValid(false);
      }
    } catch {
      setReferralValid(null);
      setReferrerUid(null);
    }
  };

  const email = user?.email ?? '';
  const dismissReason = useProfileStore.getState().profile.dismissReason;

  const isValid = name.trim().length >= 2 && irdai.trim().length >= 3 && phone.trim().length >= 7;

  const handleSubmit = async () => {
    if (!user || !isValid) return;
    setSubmitting(true);
    setError('');
    try {
      const profileRef = doc(db, 'users', user.uid, 'profile', 'current');
      const signupRef  = doc(db, 'newSignups', user.uid);

      const payload: Record<string, unknown> = {
        name:                   name.trim(),
        irdaiLicence:           irdai.trim().toUpperCase(),
        mobile:                 phone.trim(),
        email,
        accessRequestSubmitted: true,
        updatedAt:              Timestamp.now(),
        ...(referrerUid ? { referredBy: referrerUid } : {}),
      };

      // Write to profile and newSignups simultaneously
      await Promise.all([
        setDoc(profileRef, payload, { merge: true }),
        setDoc(signupRef, {
          ...payload,
          displayName: name.trim(),
          status: 'pending',
        }, { merge: true }),
      ]);

      // Update local Zustand store immediately so SubscriptionGuard re-renders
      updateProfile({
        name:                   name.trim(),
        irdaiLicence:           irdai.trim().toUpperCase(),
        mobile:                 phone.trim(),
        email,
        accessRequestSubmitted: true,
      });
    } catch (e: any) {
      setError(e?.message || 'Submission failed. Please check your connection and try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0D1B2A] p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-8 animate-in fade-in zoom-in-95 duration-300">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.08))', border: '1px solid rgba(212,175,55,0.35)' }}
          >
            <Shield size={28} style={{ color: '#D4AF37' }} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold">
            <CheckCircle2 size={14} /> Account created! Just one final step.
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">
            Access Request
          </h1>
          <p className="text-sm font-medium" style={{ color: 'rgba(232,236,240,0.55)' }}>
            Complete your surveyor profile to request platform access.
            <br />Our team will personally verify your IRDAI credentials before activation.
          </p>
        </div>

        {/* ── Form Card ──────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {/* Dismiss reason banner — shown if admin dismissed a previous request */}
          {dismissReason && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-xl text-[11px] font-semibold leading-relaxed mb-1"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: 'rgba(232,236,240,0.75)' }}
            >
              <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong style={{ color: '#ef4444' }}>Previous request was dismissed.</strong>
                <br />Admin note: <em style={{ color: 'rgba(232,236,240,0.9)' }}>{dismissReason}</em>
                <br />Please correct the details below and resubmit.
              </span>
            </div>
          )}

          {/* Identity notice */}
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-xl text-[11px] font-semibold leading-relaxed"
            style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)', color: 'rgba(232,236,240,0.65)' }}
          >
            <AlertCircle size={14} style={{ color: '#D4AF37', flexShrink: 0, marginTop: 1 }} />
            <span>
              Your <strong style={{ color: '#D4AF37' }}>Full Name</strong> will be permanently linked to your Google account
              and printed on all survey reports. It can only be changed by an administrator.
            </span>
          </div>

          <Field
            label="Full Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Niraj Patil"
            icon={<User size={10} />}
            hint="Will appear on all survey reports. Admin permission required to change."
          />

          <Field
            label="IRDAI Licence Number"
            value={irdai}
            onChange={v => setIrdai(v.toUpperCase())}
            placeholder="e.g. SLA-MH-123456"
            icon={<FileText size={10} />}
            hint="Your active IRDAI surveyor licence number."
          />

          <Field
            label="Phone Number"
            value={phone}
            onChange={setPhone}
            placeholder="+91 98765 43210"
            type="tel"
            icon={<Phone size={10} />}
            hint="We will contact you on this number to verify your identity."
          />

          {/* Referral Code (optional) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: '#8D99AE' }}>
              <Gift size={10} />
              Referral Code
              <span className="ml-1 text-[8px] font-semibold normal-case tracking-normal" style={{ color: 'rgba(232,236,240,0.4)' }}>(optional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={referralCode}
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  setReferralCode(val);
                  if (val.length >= 5) validateReferralCode(val);
                  else { setReferralValid(null); setReferrerUid(null); }
                }}
                placeholder="e.g. SUS-NIRAJ-X2K"
                className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: referralValid === true ? '1px solid rgba(34,197,94,0.6)' : referralValid === false ? '1px solid rgba(220,38,38,0.5)' : '1px solid rgba(255,255,255,0.15)',
                  color: '#F8F9FA',
                }}
              />
              {referralValid === true && (
                <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />
              )}
            </div>
            {referralValid === false && (
              <p className="text-[9px] font-semibold text-red-400">Invalid referral code. Please check and try again.</p>
            )}
            {referralValid === true && (
              <p className="text-[9px] font-semibold text-green-400">Valid! You and the referrer will both benefit.</p>
            )}
            {!referralCode && (
              <p className="text-[9px] font-semibold" style={{ color: 'rgba(232,236,240,0.35)' }}>Got a referral code from a fellow surveyor? Enter it here for mutual benefits.</p>
            )}
          </div>

          <Field
            label="Email ID"
            value={email}
            icon={<Mail size={10} />}
            locked
            hint="Verified via your Google account — cannot be changed."
          />

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-40"
            style={{
              background: isValid && !submitting
                ? 'linear-gradient(135deg, #D4AF37, #f0d870)'
                : 'rgba(255,255,255,0.08)',
              color: isValid && !submitting ? '#0D1B2A' : 'rgba(232,236,240,0.4)',
              cursor: !isValid || submitting ? 'not-allowed' : 'pointer',
              transform: 'scale(1)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (isValid && !submitting) (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArrowRight size={16} />
            )}
            {submitting ? 'Submitting Request…' : 'Submit Access Request'}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col items-center gap-4">
          <p className="text-center text-[10px] font-semibold" style={{ color: 'rgba(232,236,240,0.3)' }}>
            One Google account → One SurveyOS profile. Sharing accounts is not permitted.
          </p>
          <div className="flex items-center gap-4 text-xs font-bold">
            <a href="/" className="text-gray-400 hover:text-white transition-colors">← Back to Website</a>
            <span className="text-gray-700">|</span>
            <button onClick={() => signOutUser()} className="text-gray-400 hover:text-white transition-colors">Log Out</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirmation screen (shown after submission) ─────────────────────────────
export function AccessRequestConfirmation() {
  const { profile } = useProfileStore();
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0D1B2A] text-white p-6 text-center">
      <div className="max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-400">

        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)' }}>
          <CheckCircle2 size={38} style={{ color: '#D4AF37' }} />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">Request Submitted!</h1>
          <p className="font-medium" style={{ color: 'rgba(232,236,240,0.6)' }}>
            Your access request has been sent to the admin for review.
            Our team will verify your IRDAI credentials and reach you at:
          </p>
        </div>

        <div className="p-5 rounded-2xl space-y-3 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {[
            { label: 'Name', value: profile.name },
            { label: 'IRDAI Licence', value: profile.irdaiLicence },
            { label: 'Phone', value: profile.mobile },
            { label: 'Email', value: profile.email },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center text-sm">
              <span style={{ color: 'rgba(232,236,240,0.45)' }}>{label}</span>
              <span className="font-bold" style={{ color: '#F8F9FA' }}>{value || '—'}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold" style={{ color: 'rgba(232,236,240,0.4)' }}>
            Typical approval time: 1–2 business days
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-bold transition-colors"
            style={{ color: 'rgba(212,175,55,0.7)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#D4AF37')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(212,175,55,0.7)')}
          >
            Already approved? Refresh →
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-4 text-xs font-bold">
          <a href="/" className="text-gray-400 hover:text-white transition-colors">← Back to Website</a>
          <span className="text-gray-700">|</span>
          <button onClick={() => signOutUser()} className="text-gray-400 hover:text-white transition-colors">Log Out</button>
        </div>
      </div>
    </div>
  );
}
