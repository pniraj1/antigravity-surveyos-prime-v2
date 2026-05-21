'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ArrowRight, CheckCircle2, Loader2, ChevronLeft } from 'lucide-react';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';

// ─── Trust signals shown below the CTA ───────────────────────────────────────
const TRUST_SIGNALS = [
  'IRDAI-verified surveyor access',
  'All reports backed up to your Google Drive',
  'No credit card required',
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function SignupPage() {
  const { isAuthenticated, loading: authLoading } = useAuthStore();
  const [signingUp, setSigningUp] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Redirect authenticated + approved users straight to the app
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSignUp = async () => {
    setSigningUp(true);
    setError('');
    try {
      await signInWithGoogle();
      // After OAuth, useAuth → SubscriptionGuard handles routing:
      //   new user    → AccessRequestForm
      //   approved user → DriveGate → Dashboard
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sign-up failed. Please try again.';
      // Ignore popup-closed errors (user dismissed the popup intentionally)
      if (!message.includes('popup-closed') && !message.includes('cancelled')) {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSigningUp(false);
    }
  };

  const handleSignIn = async () => {
    setSigningUp(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.includes('popup-closed') && !message.includes('cancelled')) {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSigningUp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0D1B2A] p-4 overflow-y-auto">
      <div className="w-full max-w-md my-8 animate-in fade-in zoom-in-95 duration-300">

        {/* ── Back link ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold transition-colors"
            style={{ color: 'rgba(232,236,240,0.45)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(232,236,240,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(232,236,240,0.45)')}
          >
            <ChevronLeft size={14} />
            Back to website
          </a>
        </div>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.08))',
              border: '1px solid rgba(212,175,55,0.35)',
            }}
          >
            <Shield size={28} style={{ color: '#D4AF37' }} />
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white mb-2">
            Join SurveyOS
          </h1>
          <p className="text-sm font-medium" style={{ color: 'rgba(232,236,240,0.55)' }}>
            Start your <span style={{ color: '#D4AF37' }}>30-day free trial</span> — no credit card needed.
          </p>
        </div>

        {/* ── Card ───────────────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {/* Trust signals */}
          <ul className="space-y-3">
            {TRUST_SIGNALS.map(signal => (
              <li key={signal} className="flex items-center gap-3">
                <CheckCircle2 size={15} style={{ color: '#D4AF37', flexShrink: 0 }} />
                <span className="text-sm font-medium" style={{ color: 'rgba(232,236,240,0.75)' }}>
                  {signal}
                </span>
              </li>
            ))}
          </ul>

          <div
            className="border-t"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          />

          {/* Error */}
          {error && (
            <p className="text-xs font-semibold text-red-400 text-center">{error}</p>
          )}

          {/* Primary CTA */}
          <button
            onClick={handleSignUp}
            disabled={signingUp}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-40"
            style={{
              background: signingUp ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #D4AF37, #f0d870)',
              color: signingUp ? 'rgba(232,236,240,0.4)' : '#0D1B2A',
              cursor: signingUp ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!signingUp) (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            {signingUp ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              // Google icon (inline SVG for zero dependency)
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {signingUp ? 'Signing up…' : 'Continue with Google'}
            {!signingUp && <ArrowRight size={15} />}
          </button>

          <p
            className="text-center text-[10px] font-semibold"
            style={{ color: 'rgba(232,236,240,0.3)' }}
          >
            One Google account → One SurveyOS profile.
            <br />Your IRDAI credentials are verified by our team before activation.
          </p>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="mt-6 text-center">
          <p className="text-sm font-medium" style={{ color: 'rgba(232,236,240,0.4)' }}>
            Already have an account?{' '}
            <button
              onClick={handleSignIn}
              disabled={signingUp}
              className="font-bold transition-colors disabled:opacity-50"
              style={{ color: '#D4AF37' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f0d870')}
              onMouseLeave={e => (e.currentTarget.style.color = '#D4AF37')}
            >
              Sign In
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
