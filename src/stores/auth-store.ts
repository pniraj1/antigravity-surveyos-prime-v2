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

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  sessionConflict: SessionConflict | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSessionConflict: (conflict: SessionConflict | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAuthenticated: false,
  sessionConflict: null,

  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
    loading: false
  }),

  setLoading: (loading) => set({ loading }),

  setSessionConflict: (conflict) => set({ sessionConflict: conflict }),
}));
