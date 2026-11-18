'use client';

// ═══════════════════════════════════════════════════════════
// TEAM INVITATION DIALOG
//
// Shown when a team member (assistant surveyor) has status 'invited'
// — i.e. they have been added to a firm workspace but have not yet
// formally accepted. For the current iteration Viraj already has
// status: 'active', so this targets future assistants who sign in
// before accepting.
//
// On Accept  → Firestore team_members/{email}: status = 'active'
//            → store teamAffiliation.status updated to 'active'
// On Decline → Firestore team_members/{email}: status = 'declined'
//            → store reverted to solo workspace (setWorkspace)
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Building2, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';
import { initUserDB } from '@/lib/storage/indexeddb';
import { logger } from '@/lib/utils/logger';

export function TeamInvitationDialog() {
  const user = useAuthStore((s) => s.user);
  const isTeamMember = useAuthStore((s) => s.isTeamMember);
  const teamAffiliation = useAuthStore((s) => s.teamAffiliation);
  const setTeamAffiliationStatus = useAuthStore((s) => s.setTeamAffiliationStatus);
  const setWorkspace = useAuthStore((s) => s.setWorkspace);

  const [busy, setBusy] = useState(false);

  // Only render when the assistant is in 'invited' (pending acceptance) state.
  if (!isTeamMember || teamAffiliation?.status !== 'invited' || !user) {
    return null;
  }

  const email = user.email?.trim().toLowerCase() ?? '';
  const { firmName, firmLicence } = teamAffiliation;

  const handleAccept = async () => {
    if (!email) return;
    setBusy(true);
    try {
      const memberRef = doc(db, 'team_members', email);
      await setDoc(
        memberRef,
        {
          status: 'active',
          acceptedAt: new Date().toISOString(),
          assistantUid: user.uid,
        },
        { merge: true }
      );
      // Update store — workspace is already resolved to firm, claims load immediately.
      setTeamAffiliationStatus('active');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('surveyos_claims_updated'));
      }
    } catch (err) {
      logger.error('[TeamInvitationDialog] Accept failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!email) return;
    setBusy(true);
    try {
      const memberRef = doc(db, 'team_members', email);
      await setDoc(memberRef, { status: 'declined', declinedAt: new Date().toISOString() }, { merge: true });
      // Revert to solo workspace.
      await initUserDB(user.uid);
      setWorkspace(user.uid, false, null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('surveyos_claims_updated'));
      }
    } catch (err) {
      logger.error('[TeamInvitationDialog] Decline failed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-8 text-center">
        {/* Icon */}
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center bg-indigo-50 text-indigo-600">
          <Building2 size={28} />
        </div>

        {/* Heading */}
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Firm Workspace Invitation
        </h2>

        {/* Body */}
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          You have been invited to join{' '}
          <span className="font-semibold text-foreground">{firmName}</span>{' '}
          (Licence:{' '}
          <span className="font-mono font-medium text-foreground">{firmLicence}</span>
          ) as an Assistant Surveyor.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleAccept}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
            Accept &amp; Join Firm Workspace
          </button>

          <button
            onClick={handleDecline}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-neutral-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Decline &amp; Continue Solo
          </button>
        </div>
      </div>
    </div>
  );
}
