'use client';

// ═══════════════════════════════════════════════════════════
// SESSION CONFLICT DIALOG
//
// Shown when login is blocked because another device holds the live
// single-session lock (auth-store.sessionConflict is set by useAuth).
// Offers "Force Sign In Anyway" — which sets a one-shot localStorage
// flag, then re-authenticates; useAuth skips the conflict check once
// and claims the session, kicking the other device.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { MonitorSmartphone, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { logger } from '@/lib/utils/logger';

const FORCE_SESSION_KEY = 'surveyos_force_session';

export function SessionConflictDialog() {
  const sessionConflict = useAuthStore(s => s.sessionConflict);
  const setSessionConflict = useAuthStore(s => s.setSessionConflict);
  const [forcing, setForcing] = useState(false);

  if (!sessionConflict) return null;

  const handleForce = async () => {
    setForcing(true);
    try {
      localStorage.setItem(FORCE_SESSION_KEY, 'true');
    } catch {
      /* localStorage unavailable — force flow can't proceed reliably */
    }
    setSessionConflict(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      logger.error('[SessionConflictDialog] Force sign-in failed:', error);
      setForcing(false);
    }
  };

  const handleCancel = () => {
    setSessionConflict(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-8 text-center">
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)]">
          <MonitorSmartphone size={28} />
        </div>
        <h2 className="text-xl font-medium text-foreground mb-2">
          Already open on another device
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          SurveyOS is currently running on <span className="font-medium text-foreground">{sessionConflict.deviceHint}</span>.
          To avoid clashing edits, please close it there before signing in here — or force sign-in to take over.
          The other device will be signed out and any unsynced work there stays safe on that device.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleForce}
            disabled={forcing}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[var(--color-status-warning)] text-white hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          >
            {forcing ? <Loader2 size={16} className="animate-spin" /> : <MonitorSmartphone size={16} />}
            Force Sign In Anyway
          </button>
          <button
            onClick={handleCancel}
            disabled={forcing}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-[var(--color-neutral-50)] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
