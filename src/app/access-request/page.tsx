'use client';

import { useState } from 'react';
import { doc, setDoc, Timestamp, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { signOutUser } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import Logo from '@/components/ui/Logo';
import {
  Shield, User, Phone, Mail, FileText, Loader2,
  CheckCircle2, ArrowRight, AlertCircle, Gift, LogOut, ChevronLeft,
} from 'lucide-react';

// ─── Shared: split-panel wrapper ─────────────────────────────────────────────
// Left = dark branded panel, Right = light form panel.
// On mobile the left panel collapses to a compact dark header strip.

function SplitLayout({
  right,
}: {
  right: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── LEFT PANEL ── */}
      <div className="relative overflow-hidden md:w-[42%] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">

        {/* Ambient amber orbs */}
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full opacity-10 blur-3xl bg-amber-500 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-5 blur-2xl bg-amber-500 pointer-events-none" />

        {/* Mobile: compact strip */}
        <div className="relative md:hidden flex items-center justify-between px-6 py-5">
          <Logo variant="dark" size="sm" />
          <div className="flex items-center gap-4">
            <a href="/landing" className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={15} /> Website
            </a>
            <button
              onClick={() => signOutUser()}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              <LogOut size={15} /> Log Out
            </button>
          </div>
        </div>

        {/* Desktop: full panel content */}
        <div className="hidden md:flex flex-col flex-1 px-10 py-12 relative">

          {/* Top row: Logo left, nav links right */}
          <div className="flex items-center justify-between mb-10">
            <Logo variant="dark" size="lg" />
            <div className="flex items-center gap-5">
              <a href="/landing" className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors">
                <ChevronLeft size={15} /> Website
              </a>
              <button
                onClick={() => signOutUser()}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
              >
                <LogOut size={15} /> Log Out
              </button>
            </div>
          </div>

          {/* Shield icon */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
            style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)' }}>
            <Shield size={30} className="text-amber-400" />
          </div>

          {/* Headline */}
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight mb-3">
            Request Platform<br />Access
          </h1>
          <p className="text-sm font-medium text-slate-300 leading-relaxed mb-8">
            IRDAI-verified surveyor access. Our team reviews every application personally before activation.
          </p>

          {/* Divider */}
          <div className="border-t border-white/10 mb-8" />

          {/* Trust signals */}
          <ul className="space-y-4 flex-1">
            {[
              'IRDAI credential verification',
              '30-day free trial on approval',
              'All reports backed up to Google Drive',
            ].map(signal => (
              <li key={signal} className="flex items-center gap-3">
                <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-300">{signal}</span>
              </li>
            ))}
          </ul>

          {/* spacer so trust signals don't crowd the bottom */}
          <div className="mt-10" />
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 bg-[#F5F5F3] flex flex-col">
        <div className="flex-1 flex items-start justify-center px-6 py-10 md:py-16">
          <div className="w-full max-w-lg">
            {right}
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, type = 'text', locked = false, hint = '', icon,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; locked?: boolean; hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#8D99AE]">
        {icon}
        {label}
        {locked && (
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
            Pre-filled
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        readOnly={locked}
        onChange={e => onChange?.(e.target.value)}
        placeholder={locked ? undefined : placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all border"
        style={{
          background: locked ? '#F8F9FA' : '#fff',
          borderColor: locked ? '#E9ECEF' : '#DEE2E6',
          color: locked ? '#8D99AE' : '#0D1B2A',
          cursor: locked ? 'not-allowed' : 'text',
        }}
        onFocus={e => { if (!locked) e.currentTarget.style.borderColor = '#D4AF37'; }}
        onBlur={e => { if (!locked) e.currentTarget.style.borderColor = '#DEE2E6'; }}
      />
      {hint && <p className="text-xs font-medium text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── Confirmation ─────────────────────────────────────────────────────────────
function ConfirmationPanel() {
  const { profile } = useProfileStore();

  return (
    <SplitLayout right={
      <div className="animate-in fade-in zoom-in-95 duration-400 space-y-6">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-bold">
          <CheckCircle2 size={13} /> Request submitted
        </div>

        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#0D1B2A] mb-2">
            You&apos;re on the list!
          </h1>
          <p className="text-sm font-medium text-[#8D99AE] leading-relaxed">
            Your access request has been sent for admin review.
            Our team will verify your IRDAI credentials and reach you at the details below.
          </p>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          {[
            { label: 'Name',          value: profile.name },
            { label: 'IRDAI Licence', value: profile.irdaiLicence },
            { label: 'Phone',         value: profile.mobile },
            { label: 'Email',         value: profile.email },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-sm font-medium text-[#8D99AE]">{label}</span>
              <span className="text-sm font-bold text-[#0D1B2A]">{value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Approval time */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Typical approval time: 1–2 business days
        </div>

        <button
          onClick={() => window.location.reload()}
          className="block text-sm font-bold text-[#8D99AE] hover:text-[#0D1B2A] transition-colors"
        >
          Already approved? Refresh →
        </button>

        {/* Mobile footer */}
        <div className="flex md:hidden items-center gap-4 pt-2 text-xs font-bold text-[#8D99AE]">
          <a href="/landing" className="hover:text-[#0D1B2A] transition-colors flex items-center gap-1">
            <ChevronLeft size={12} /> Back to website
          </a>
          <span className="text-gray-300">|</span>
          <button onClick={() => signOutUser()} className="hover:text-[#0D1B2A] transition-colors flex items-center gap-1.5">
            <LogOut size={12} /> Log Out
          </button>
        </div>

      </div>
    } />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AccessRequestPage() {
  const { user } = useAuthStore();
  const { profile, updateProfile } = useProfileStore();

  const [name,          setName]          = useState(user?.displayName ?? '');
  const [irdai,         setIrdai]         = useState('');
  const [phone,         setPhone]         = useState('');
  const [referralCode,  setReferralCode]  = useState('');
  const [referrerUid,   setReferrerUid]   = useState<string | null>(null);
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');

  // Read & immediately clear the auth intent set before Google OAuth.
  const [isSignInIntent] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const intent = sessionStorage.getItem('surveyos_auth_intent');
    sessionStorage.removeItem('surveyos_auth_intent');
    return intent === 'signin';
  });

  const email       = user?.email ?? '';
  const dismissReason = profile.dismissReason;
  const isValid     = name.trim().length >= 2 && irdai.trim().length >= 3 && phone.trim().length >= 7;

  // Already submitted — show confirmation split-panel
  if (profile.accessRequestSubmitted) return <ConfirmationPanel />;

  const validateReferralCode = async (code: string) => {
    if (!code.trim()) { setReferralValid(null); setReferrerUid(null); return; }
    try {
      const q = query(collectionGroup(db, 'profile'), where('referralCode', '==', code.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setReferrerUid(snap.docs[0].ref.path.split('/')[1]);
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
      await Promise.all([
        setDoc(profileRef, payload, { merge: true }),
        setDoc(signupRef, { ...payload, displayName: name.trim(), status: 'pending' }, { merge: true }),
      ]);
      updateProfile({
        name:                   name.trim(),
        irdaiLicence:           irdai.trim().toUpperCase(),
        mobile:                 phone.trim(),
        email,
        accessRequestSubmitted: true,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed. Please check your connection and try again.');
      setSubmitting(false);
    }
  };

  const formPanel = (
    <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6">

      {/* Step badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-bold">
        <CheckCircle2 size={13} /> Account created · One final step
      </div>

      {/* Heading */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[#0D1B2A] mb-1.5">
          Access Request
        </h1>
        <p className="text-sm font-medium text-[#8D99AE] leading-relaxed">
          Complete your surveyor profile to request platform access.
          Our team verifies IRDAI credentials before activation.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* "No account found" banner */}
        {isSignInIntent && !dismissReason && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
            <AlertCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-blue-700 leading-relaxed">
              <strong className="font-bold">No existing account found.</strong>{' '}
              Complete the form below to register and start your{' '}
              <strong className="text-amber-600">30-day free trial</strong>.
            </p>
          </div>
        )}

        {/* Dismiss reason banner */}
        {dismissReason && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-700 leading-relaxed">
              <strong className="font-bold">Previous request was dismissed.</strong>
              <br />Admin note: <em className="text-red-600">{dismissReason}</em>
              <br />Please correct the details and resubmit.
            </p>
          </div>
        )}

        {/* Name is permanent notice */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#0D1B2A] border border-[#1e3a5f]">
          <AlertCircle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-slate-200 leading-relaxed">
            Your <strong className="font-bold text-white">Full Name</strong> will be permanently linked to your Google account
            and printed on all survey reports. It can only be changed by an administrator.
          </p>
        </div>

        {/* Fields */}
        <Field
          label="Full Name" value={name} onChange={setName}
          placeholder="e.g. Niraj Patil" icon={<User size={13} />}
          hint="Will appear on all survey reports."
        />
        <Field
          label="IRDAI Licence Number" value={irdai} onChange={v => setIrdai(v.toUpperCase())}
          placeholder="e.g. SLA-MH-123456" icon={<FileText size={13} />}
          hint="Your active IRDAI surveyor licence number."
        />
        <Field
          label="Phone Number" value={phone} onChange={setPhone}
          placeholder="+91 98765 43210" type="tel" icon={<Phone size={13} />}
          hint="We will contact you on this number to verify your identity."
        />

        {/* Referral code */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#8D99AE]">
            <Gift size={13} />
            Referral Code
            <span className="ml-1 text-xs font-semibold normal-case tracking-normal text-gray-400">(optional)</span>
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
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all border text-[#0D1B2A]"
              style={{
                background: '#fff',
                borderColor: referralValid === true ? '#22c55e' : referralValid === false ? '#ef4444' : '#DEE2E6',
              }}
            />
            {referralValid === true && (
              <CheckCircle2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
            )}
          </div>
          {referralValid === false && <p className="text-xs font-medium text-red-500">Invalid referral code. Please check and try again.</p>}
          {referralValid === true  && <p className="text-xs font-medium text-green-600">Valid! You and the referrer will both benefit.</p>}
          {!referralCode           && <p className="text-xs font-medium text-gray-400">Got a referral code from a fellow surveyor? Enter it here.</p>}
        </div>

        <Field
          label="Email ID" value={email} icon={<Mail size={13} />}
          locked hint="Verified via Google — cannot be changed."
        />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isValid && !submitting ? 'linear-gradient(135deg, #D4AF37, #f0d870)' : '#F0F2F5',
            color: isValid && !submitting ? '#0D1B2A' : '#8D99AE',
          }}
          onMouseEnter={e => { if (isValid && !submitting) (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          {submitting ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
          {submitting ? 'Submitting Request…' : 'Submit Access Request'}
        </button>
      </div>

      {/* Legal note */}
      <p className="text-xs font-medium text-gray-400 text-center">
        One Google account → One SurveyOS profile. Sharing accounts is not permitted.
      </p>

      {/* Mobile footer links */}
      <div className="flex md:hidden items-center justify-center gap-4 text-xs font-bold text-[#8D99AE]">
        <a href="/landing" className="hover:text-[#0D1B2A] transition-colors flex items-center gap-1">
          <ChevronLeft size={12} /> Back to website
        </a>
        <span className="text-gray-300">|</span>
        <button onClick={() => signOutUser()} className="hover:text-[#0D1B2A] transition-colors flex items-center gap-1.5">
          <LogOut size={12} /> Log Out
        </button>
      </div>

    </div>
  );

  return <SplitLayout right={formPanel} />;
}
