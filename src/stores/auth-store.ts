// ═══════════════════════════════════════════════════════════
// AUTH STORE
// Manages Firebase Authentication state in Zustand
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { type User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAuthenticated: false,

  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    loading: false 
  }),
  
  setLoading: (loading) => set({ loading }),
}));
