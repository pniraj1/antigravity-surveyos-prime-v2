'use client';

import { useState } from 'react';
import { signInWithGoogle } from '@/lib/firebase/auth';
import {
  Shield,
  Zap,
  Cloud,
  FileCheck,
  MapPin,
  Calculator,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const FEATURES = [
  { icon: <Zap size={16} />, text: 'AI-powered document extraction' },
  { icon: <Cloud size={16} />, text: 'Real-time cloud backup on every keystroke' },
  { icon: <FileCheck size={16} />, text: 'IRDAI-compliant report generation' },
  { icon: <MapPin size={16} />, text: 'Spot & final survey workflows' },
  { icon: <Calculator size={16} />, text: 'Depreciation & assessment calculator' },
];

export function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Auth state change handled by useAuth hook globally
    } catch (err: unknown) {
      console.error('[SignIn] Error:', err);
      setError('Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-stretch"
      style={{ background: '#F8F9FA' }}
    >
      {/* ── Left Panel: Branding ───────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, #0D1B2A 0%, #1a3a5c 60%, #0D1B2A 100%)',
        }}
      >
        {/* Decorative orbs */}
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: '#D4AF37' }}
        />
        <div
          className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: '#3b82f6' }}
        />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #f0d870)' }}
            >
              <Shield size={20} style={{ color: '#0D1B2A' }} />
            </div>
            <div>
              <div className="text-white font-black text-lg tracking-tight">SurveyOS</div>
              <div
                className="text-[10px] font-bold uppercase tracking-[0.25em]"
                style={{ color: '#D4AF37' }}
              >
                Prime V2
              </div>
            </div>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative space-y-8">
          <div>
            <h1
              className="text-4xl font-black leading-tight mb-4"
              style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}
            >
              The Professional
              <br />
              <span style={{ color: '#D4AF37' }}>Survey Platform</span>
              <br />
              for Loss Adjusters
            </h1>
            <p className="text-base font-medium" style={{ color: 'rgba(232,236,240,0.65)' }}>
              Motor insurance surveys — managed, automated, and backed up in real-time. Built for independent surveyors operating across India.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37' }}
                >
                  {f.icon}
                </div>
                <span className="text-sm font-medium" style={{ color: 'rgba(232,236,240,0.8)' }}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="relative text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'rgba(232,236,240,0.3)' }}
        >
          IRDAI Compliant · Offline-First · Spark Plan
        </div>
      </div>

      {/* ── Right Panel: Sign-In ───────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)' }}
            >
              <Shield size={20} style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <div className="font-black text-lg text-[#0D1B2A]">SurveyOS Prime</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#8D99AE]">V2</div>
            </div>
          </div>

          {/* Card */}
          <div
            className="rounded-3xl p-8 shadow-xl"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E6EA',
              boxShadow: '0 8px 40px rgba(13,27,42,0.08)',
            }}
          >
            <div className="mb-8">
              <h2 className="text-2xl font-black text-[#0D1B2A] mb-2">
                Welcome back
              </h2>
              <p className="text-sm text-[#8D99AE] font-medium leading-relaxed">
                Sign in with your Google account to access your surveys, reports, and cloud backup.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-3 p-4 rounded-xl mb-6 text-sm font-medium"
                style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
              >
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm transition-all relative overflow-hidden"
              style={{
                background: loading ? '#F0F2F5' : '#FFFFFF',
                border: '1.5px solid #E2E6EA',
                color: '#0D1B2A',
                boxShadow: loading ? 'none' : '0 2px 8px rgba(13,27,42,0.08)',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.borderColor = '#0D1B2A';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(13,27,42,0.12)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E2E6EA';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(13,27,42,0.08)';
              }}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} style={{ color: '#8D99AE' }} />
              ) : (
                /* Google SVG Logo */
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                  <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                </svg>
              )}
              <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
            </button>

            <div className="mt-6 pt-6 border-t border-[#F0F2F5]">
              <p className="text-[11px] text-center font-medium text-[#8D99AE] leading-relaxed">
                By signing in you agree to SurveyOS terms of use. Your data is stored securely in Google Cloud Firestore and never shared with third parties.
              </p>
            </div>
          </div>

          {/* Bottom wordmark */}
          <p className="text-center mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#C0C8D0]">
            SurveyOS Prime · Powered by Antigravity
          </p>
        </div>
      </div>
    </div>
  );
}
