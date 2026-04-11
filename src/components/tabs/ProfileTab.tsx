'use client';

import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { linkGoogleDrive } from '@/lib/drive';
import { useState, useRef } from 'react';
import {
  User, Shield, Phone, Mail, MapPin, CreditCard, Building2,
  Landmark, Sparkles, Camera, Stamp, Key, RefreshCw, CheckCircle2,
  AlertCircle, Upload, Trash2, Cpu, ExternalLink, Cloud, CloudOff, Link,
  LayoutDashboard, ShieldCheck, Plus, Eye, EyeOff
} from 'lucide-react';

// ─── Section Wrapper ─────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
      <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
        <span style={{ color: '#D4AF37' }}>{icon}</span>
        <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>{title}</span>
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
      <label className="block mb-1.5 text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: '#8D99AE' }}>
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
          border: '1px solid #E2E6EA',
          background: readOnly ? '#F0F2F5' : '#FAFAFA',
          color: '#0D1B2A',
          fontWeight: 600,
        }}
        onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = '#D4AF37'; }}
        onBlur={e => { e.currentTarget.style.borderColor = '#E2E6EA'; }}
      />
      {hint && <p className="mt-1 text-[9px] font-bold" style={{ color: '#8D99AE' }}>{hint}</p>}
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
          <div className="flex-1 flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid #E2E6EA', background: '#FAFAFA' }}>
            <input
              type={visible[i] ? 'text' : 'password'}
              value={k}
              onChange={e => updateKey(i, e.target.value)}
              placeholder={i === 0 ? placeholder : `Backup key ${i + 1} (optional)`}
              className="flex-1 px-3 py-2 text-sm bg-transparent outline-none"
              style={{ color: '#0D1B2A', fontWeight: 600 }}
              onFocus={e => (e.currentTarget.parentElement!.style.borderColor = accentColor)}
              onBlur={e => (e.currentTarget.parentElement!.style.borderColor = '#E2E6EA')}
            />
            <button
              type="button"
              onClick={() => setVisible(prev => ({ ...prev, [i]: !prev[i] }))}
              className="px-2 py-2 flex-shrink-0"
              style={{ color: '#8D99AE' }}
            >
              {visible[i] ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {(keys.length > 1 || (keys.length === 1 && keys[0])) && (
            <button
              type="button"
              onClick={() => removeKey(i)}
              className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-red-50"
              style={{ color: '#ef4444' }}
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
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide transition-opacity hover:opacity-70"
          style={{ color: accentColor }}
        >
          <Plus size={11} /> Add backup key
        </button>
      )}
      <p className="text-[9px] font-bold" style={{ color: '#8D99AE' }}>
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
      <label className="block mb-1.5 text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: '#8D99AE' }}>
        {label}
      </label>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {dataUrl ? (
        <div
          className="relative flex items-center gap-4 p-3 rounded-xl"
          style={{ background: '#F8F9FA', border: '1px solid #E2E6EA' }}
        >
          <img
            src={dataUrl}
            alt={label}
            className="h-16 w-auto object-contain rounded-lg"
            style={{ background: '#FFFFFF', border: '1px solid #E2E6EA', padding: 4 }}
          />
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>{label} uploaded</div>
            <div className="text-xs" style={{ color: '#8D99AE' }}>{hint}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => ref.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
            >
              <RefreshCw size={11} /> Replace
            </button>
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}
            >
              <Trash2 size={11} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
          style={{ background: '#F8F9FA', border: '1.5px dashed #C3C9D4' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.background = 'rgba(212,175,55,0.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#C3C9D4'; e.currentTarget.style.background = '#F8F9FA'; }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
            <Upload size={15} />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>Upload {label}</div>
            <div className="text-xs" style={{ color: '#8D99AE' }}>{hint}</div>
          </div>
        </button>
      )}
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
    <div className="h-full overflow-y-auto" style={{ background: '#F8F9FA' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="px-8 py-8 lg:px-12"
        style={{ background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)' }}
      >
        <div className="max-w-4xl mx-auto flex items-start justify-between gap-6">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-4"
              style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
            >
              <Shield size={11} />
              Surveyor Identity
            </div>
            <h1 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
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
            {profile.isAdmin && (
              <button
                onClick={() => useUIStore.getState().setActiveTab('admin')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #f0d870)', color: '#0D1B2A' }}
              >
                <ShieldCheck size={14} />
                Regulator Dashboard
              </button>
            )}
            <div
              className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl font-black"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#F8F9FA', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              {profile.name ? profile.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'SP'}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-12 py-8 max-w-4xl mx-auto space-y-5">

        {/* ── Personal ──────────────────────────────────── */}
        <Section title="Personal Details" icon={<User size={14} />}>
          <Field label="Full Name" value={profile.name} onChange={set('name')} placeholder="e.g. Niraj P." />
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
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
          <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
            <Camera size={14} style={{ color: '#D4AF37' }} />
            <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>Signature & Stamp</span>
            <span className="ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37' }}>
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

        {/* ── AI Config ─────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
          <div className="px-6 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: '#D4AF37' }} />
              <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>AI & Documents Intelligence</span>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#F0F2F5' }}>
              <button
                onClick={() => updateProfile({ aiProvider: 'gemini' })}
                className="px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all"
                style={{
                  background: profile.aiProvider === 'gemini' ? '#FFFFFF' : 'transparent',
                  color: profile.aiProvider === 'gemini' ? '#D4AF37' : '#8D99AE',
                  boxShadow: profile.aiProvider === 'gemini' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                Google Gemini
              </button>
              <button
                onClick={() => updateProfile({ aiProvider: 'groq' })}
                className="px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all"
                style={{
                  background: profile.aiProvider === 'groq' ? '#FFFFFF' : 'transparent',
                  color: profile.aiProvider === 'groq' ? '#D4AF37' : '#8D99AE',
                  boxShadow: profile.aiProvider === 'groq' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                Groq (Speed)
              </button>
            </div>
          </div>
          <div className="p-5 space-y-6">

            {/* Gemini Section */}
            {profile.aiProvider === 'gemini' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(66,133,244,0.05)', border: '1px solid rgba(66,133,244,0.1)' }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white shadow-sm">
                      <Cpu size={18} style={{ color: '#4285F4' }} />
                    </div>
                    <div>
                      <div className="text-xs font-black" style={{ color: '#0D1B2A' }}>Google Gemini AI</div>
                      <div className="text-[10px] font-bold" style={{ color: '#8D99AE' }}>Auto-selects best model · Add up to 3 keys for rate-limit resilience</div>
                    </div>
                  </div>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all hover:opacity-80" style={{ background: '#4285F4', color: '#FFFFFF' }}>
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
            )}

            {/* Groq Section */}
            {profile.aiProvider === 'groq' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(242,102,57,0.05)', border: '1px solid rgba(242,102,57,0.1)' }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white shadow-sm">
                      <Cpu size={18} style={{ color: '#F26639' }} />
                    </div>
                    <div>
                      <div className="text-xs font-black" style={{ color: '#0D1B2A' }}>Groq LPQ Intelligence</div>
                      <div className="text-[10px] font-bold" style={{ color: '#8D99AE' }}>Fastest Inference Engine · Add up to 3 keys for rate-limit resilience</div>
                    </div>
                  </div>
                  <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all hover:opacity-80" style={{ background: '#F26639', color: '#FFFFFF' }}>
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
            )}
          </div>
        </div>

        {/* ── Google Drive ───────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
          <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
            <Cloud size={14} style={{ color: isDriveConnected ? '#22c55e' : '#D4AF37' }} />
            <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>Google Drive Sync</span>
            {isDriveConnected && (
              <span className="ml-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>Linked</span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {/* Status banner */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: isDriveConnected ? 'rgba(34,197,94,0.07)' : 'rgba(212,175,55,0.07)',
                border: `1px solid ${isDriveConnected ? 'rgba(34,197,94,0.2)' : 'rgba(212,175,55,0.2)'}`
              }}
            >
              {isDriveConnected
                ? <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                : <CloudOff size={16} style={{ color: '#D4AF37', flexShrink: 0 }} />}
              <div>
                <div className="text-xs font-black" style={{ color: '#0D1B2A' }}>
                  {isDriveConnected ? `Linked as ${driveEmail}` : 'Google Drive is not linked'}
                </div>
                <div className="text-[10px] font-bold" style={{ color: '#8D99AE' }}>
                  {isDriveConnected
                    ? 'Your reports and documents will automatically sync to your Google Drive folder: SurveyOS/'
                    : 'Click the button below to grant SurveyOS permission to upload files to your Google Drive.'}
                </div>
              </div>
            </div>

            {/* Error */}
            {driveError && (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <AlertCircle size={13} style={{ color: '#dc2626', flexShrink: 0 }} />
                <span className="text-xs font-bold" style={{ color: '#dc2626' }}>{driveError}</span>
              </div>
            )}

            {/* Button */}
            <button
              onClick={handleLinkDrive}
              disabled={driveLinking}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all"
              style={{
                background: isDriveConnected
                  ? 'linear-gradient(135deg, #059669, #34d399)'
                  : 'linear-gradient(135deg, #4285F4, #1967d2)',
                color: '#FFFFFF',
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

        {/* ── Save ──────────────────────────────────────── */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-black text-sm transition-all shadow-lg"
            style={{
              background: saved ? 'linear-gradient(135deg, #059669, #34d399)' : 'linear-gradient(135deg, #D4AF37, #f0d870)',
              color: '#0D1B2A',
            }}
          >
            {saved ? <CheckCircle2 size={15} /> : <CheckCircle2 size={15} />}
            {saved ? 'Saved Successfully!' : 'Update Profile & Settings'}
          </button>
        </div>

        {/* Info card */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl mb-4"
          style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)' }}
        >
          <AlertCircle size={15} style={{ color: '#D4AF37', flexShrink: 0, marginTop: 1 }} />
          <div className="text-xs space-y-2" style={{ color: '#4A4E69', lineHeight: 1.6 }}>
            <p>
              Profile data and API keys are <strong>saved locally on this device</strong> (localStorage).
              Your identity details and signatures will automatically appear on generated PDFs.
            </p>
            <p className="font-bold">
              AI Future-Proofing: By using your own API keys, your SurveyOS remains free forever. You can update the Model ID anytime to use the latest AI releases from Google or Groq.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
