// ═══════════════════════════════════════════════════════════
// SESSION HEARTBEAT HOOK — keeps the single-session lock alive
//
// While the surveyor is authenticated this hook:
//   1. Refreshes users/{uid}/session/active.lastHeartbeat every 60s so
//      other devices can tell this session is still live.
//   2. Listens to that doc in real time. If the owning deviceId changes
//      to a DIFFERENT device, this tab was force-kicked — we sign out and
//      tell the surveyor why.
//
// Pairs with the login-time lock in useAuth.ts and the helpers in
// lib/firebase/session.ts.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';
import { signOutUser } from '@/lib/firebase/auth';
import { flushAllPendingToCloud } from '@/lib/firebase/sync';
import { getDeviceId } from '@/lib/firebase/session';
import type { ActiveSession } from '@/lib/firebase/session';
import { logger } from '@/lib/utils/logger';

const HEARTBEAT_INTERVAL_MS = 60_000;

export function useSessionHeartbeat() {
  const { user, isAuthenticated } = useAuthStore();
  const kickedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const uid = user.uid;
    const ref = doc(db, 'users', uid, 'session', 'active');
    kickedRef.current = false;

    // ── 1. Heartbeat ────────────────────────────────────────
    const beat = () => {
      updateDoc(ref, { lastHeartbeat: serverTimestamp() }).catch(err => {
        // Non-fatal: offline beats fail silently and resume on reconnect.
        logger.error('[useSessionHeartbeat] heartbeat failed:', err);
      });
    };
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    // ── 2. Kick detection ───────────────────────────────────
    const unsubscribe = onSnapshot(
      ref,
      snap => {
        if (!snap.exists()) return; // our own logout deletes it; ignore
        const session = snap.data() as ActiveSession;
        if (session.deviceId !== getDeviceId() && !kickedRef.current) {
          kickedRef.current = true;
          toast.error('You were signed out because SurveyOS was opened on another device.', {
            duration: 8000,
          });
          (async () => {
            if (user) {
              try { await flushAllPendingToCloud(user.uid); }
              catch (err) { logger.error('[useSessionHeartbeat] pre-kick flush failed:', err); }
            }
            signOutUser().catch(err =>
              logger.error('[useSessionHeartbeat] sign-out after kick failed:', err),
            );
          })();
        }
      },
      err => logger.error('[useSessionHeartbeat] snapshot listener failed:', err),
    );

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [isAuthenticated, user]);
}
