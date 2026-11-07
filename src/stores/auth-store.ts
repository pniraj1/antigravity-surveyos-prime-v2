// ═══════════════════════════════════════════════════════════
// AUTH STORE
// Manages Firebase Authentication state in Zustand
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { type User } from 'firebase/auth';

/** Set when login is blocked because another device holds the live session. */
export interface SessionConflict {
  deviceHint: string;
}

export interface TeamAffiliation {
  firmOwnerUid: string;
  firmName: string;
  firmLicence: string;
  hideEarnings: boolean;
  ownerEmail: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  sessionConflict: SessionConflict | null;
  activeWorkspaceUid: string | null;
  isTeamMember: boolean;
  teamAffiliation: TeamAffiliation | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSessionConflict: (conflict: SessionConflict | null) => void;
  setWorkspace: (workspaceUid: string | null, isTeamMember: boolean, affiliation?: TeamAffiliation | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAuthenticated: false,
  sessionConflict: null,
  activeWorkspaceUid: null,
  isTeamMember: false,
  teamAffiliation: null,

  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
    loading: false
  }),

  setLoading: (loading) => set({ loading }),

  setSessionConflict: (conflict) => set({ sessionConflict: conflict }),

  setWorkspace: (workspaceUid, isTeamMember, affiliation = null) => set({
    activeWorkspaceUid: workspaceUid,
    isTeamMember,
    teamAffiliation: affiliation ?? null,
  }),
}));
