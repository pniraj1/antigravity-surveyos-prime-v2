// ═══════════════════════════════════════════════════════════
// UI STATE STORE — Zustand
// Tab navigation, sidebar, and global UI state
// Replaces: switchTab(), sidebar toggle from legacy
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppTab =
  | 'dashboard'
  | 'documents'
  | 'review'
  | 'details'
  | 'assessment'
  | 'reports'
  | 'insured-report'
  | 'bill-check'
  | 'photos'
  | 'fees'
  | 'reinspection'
  | 'valuation'
  | 'profile'
  | 'learning'
  | 'admin'
  | 'cloud-vault';

interface UIState {
  // ─── Navigation ─────────────────────────────────────
  activeTab: AppTab;
  previousTab: AppTab | null;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  currentClaimId: string | null;

  // ─── Workspace ──────────────────────────────────────
  isNewClaimDialogOpen: boolean;
  isClaimsListOpen: boolean;

  // ─── Connection Status ──────────────────────────────
  isOnline: boolean;
  isDriveConnected: boolean;
  driveEmail: string;

  // ─── Save Status ────────────────────────────────────
  saveStatus: 'idle' | 'saving' | 'saved' | 'queued';

  // ─── AI Provider Health ──────────────────────────────
  aiProviderHealth: {
    gemini: 'ok' | 'rate-limited' | 'error' | 'unknown';
    groq:   'ok' | 'rate-limited' | 'error' | 'unknown';
  };
  // Live model list fetched from Gemini API — null = not fetched yet
  availableGeminiModels: Array<{ id: string; label: string; note: string }> | null;

  // ─── Actions ────────────────────────────────────────
  setActiveTab: (tab: AppTab) => void;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;
  setNewClaimDialogOpen: (open: boolean) => void;
  setClaimsListOpen: (open: boolean) => void;
  setOnline: (online: boolean) => void;
  setDriveConnected: (connected: boolean, email?: string) => void;
  setSaveStatus: (status: UIState['saveStatus']) => void;
  setCurrentClaimId: (id: string | null) => void;
  setAIProviderHealth: (provider: 'gemini' | 'groq', status: 'ok' | 'rate-limited' | 'error' | 'unknown') => void;
  setAvailableGeminiModels: (models: Array<{ id: string; label: string; note: string }>) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: 'dashboard',
      previousTab: null,
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      currentClaimId: null,
      isNewClaimDialogOpen: false,
      isClaimsListOpen: false,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isDriveConnected: false,
      driveEmail: '',
      saveStatus: 'idle',
      aiProviderHealth: { gemini: 'unknown', groq: 'unknown' },
      availableGeminiModels: null,

      setActiveTab: (tab) => {
        set((state) => ({
          activeTab: tab,
          previousTab: state.activeTab,
          sidebarMobileOpen: false, // auto-close on mobile
        }));
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),

      setNewClaimDialogOpen: (open) => set({ isNewClaimDialogOpen: open }),

      setClaimsListOpen: (open) => set({ isClaimsListOpen: open }),

      setOnline: (online) => set({ isOnline: online }),

      setDriveConnected: (connected, email = '') => {
        set({ isDriveConnected: connected, driveEmail: email });
      },

      setSaveStatus: (status) => set({ saveStatus: status }),

      setCurrentClaimId: (id) => set({ currentClaimId: id }),

      setAIProviderHealth: (provider, status) =>
        set((state) => ({
          aiProviderHealth: { ...state.aiProviderHealth, [provider]: status },
        })),

      setAvailableGeminiModels: (models) => set({ availableGeminiModels: models }),
    }),
    {
      name: 'surveyos-ui-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist navigation, workspace metadata, and Drive connection state
      partialize: (state) => ({
        activeTab: state.activeTab,
        sidebarCollapsed: state.sidebarCollapsed,
        currentClaimId: state.currentClaimId,
        isDriveConnected: state.isDriveConnected,
        driveEmail: state.driveEmail,
      }),
    }
  )
);
