// ═══════════════════════════════════════════════════════════
// WORKSPACE RESOLVER
// Resolves active workspace UID and team membership for a user.
// ═══════════════════════════════════════════════════════════

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { TeamAffiliation } from '@/stores/auth-store';
import { logger } from '@/lib/utils/logger';

export interface WorkspaceResolution {
  workspaceUid: string;
  isTeamMember: boolean;
  affiliation: TeamAffiliation | null;
}

/**
 * Resolves whether a logged-in user belongs to a senior surveyor's team workspace.
 *
 * If the user's email exists in the `team_members` collection, their effective workspace
 * is mapped to the senior surveyor's firmOwnerUid, allowing them to collaborate on
 * the firm's claims and inherit firm profile credentials for reports.
 *
 * Otherwise, the user operates in their own independent solo workspace.
 */
export async function resolveWorkspace(
  user: { uid: string; email?: string | null } | null | undefined
): Promise<WorkspaceResolution> {
  if (!user || !user.email) {
    return {
      workspaceUid: user?.uid ?? '',
      isTeamMember: false,
      affiliation: null,
    };
  }

  try {
    const memberDocRef = doc(db, 'team_members', user.email.trim().toLowerCase());
    const snap = await getDoc(memberDocRef);

    if (snap.exists()) {
      const data = snap.data() as TeamAffiliation;
      if (data?.firmOwnerUid) {
        return {
          workspaceUid: data.firmOwnerUid,
          isTeamMember: true,
          affiliation: data,
        };
      }
    }
  } catch (err) {
    logger.error('[workspace-resolver] Failed to resolve team workspace:', err);
  }

  return {
    workspaceUid: user.uid,
    isTeamMember: false,
    affiliation: null,
  };
}
