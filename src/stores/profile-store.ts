// ═══════════════════════════════════════════════════════════
// SURVEYOR PROFILE STORE — Zustand + localStorage persistence
// Replaces: loadProfile() / saveProfile() from legacy
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SurveyorProfile, SurveyType } from '@/types';

interface ProfileState {
  profile: SurveyorProfile;
  updateProfile: (updates: Partial<SurveyorProfile>) => void;
  getInitials: () => string;
  /** Sequentially allocates and returns the next spot report number: SPO/YYYY/NNN */
  getNextSpotNumber: () => string;
  /** Sequentially allocates and returns the next final survey report number: FIN/YYYY/NNN */
  getNextFinalNumber: () => string;
  /** Convenience wrapper — picks the right allocator by survey type */
  getNextReportNumber: (surveyType: SurveyType) => string;
  /**
   * Wipes all profile data on logout.
   * Called by resetAllState() in src/lib/auth/resetAllState.ts.
   * Clears both Zustand state and the persisted localStorage key so
   * the next surveyor who logs in sees a blank profile, not the previous
   * surveyor's name, signature, API keys, or bank details.
   */
  resetProfile: () => void;
}

const DEFAULT_PROFILE: SurveyorProfile = {
  name: '',
  qualifications: '',
  licenceNumber: '',
  licenceExpiry: '',
  iiislaNumber: '',
  code: '',
  categories: 'MOTOR',
  mobile: '',
  city: '',
  state: '',
  email: '',
  address: '',
  gstNumber: '',
  bankName: '',
  bankAccount: '',
  bankIFSC: '',
  panNumber: '',
  aiProvider: 'gemini',
  // Multi-key arrays
  geminiApiKeys: [],
  groqApiKeys: [],
  nvidiaApiKeys: [],
  // Deprecated single-key fields (kept for migration)
  geminiApiKey: '',
  groqApiKey: '',
  googleClientId: '',
  surveyorId: '',
  subscriptionStatus: 'pending',
  subscriptionExpiry: null,
  isAdmin: false,
  signatureDataUrl: null,
  stampDataUrl: null,
  accessRequestSubmitted: false,
  irdaiLicence: '',
  spotSequence: 1,
  finalSequence: 1,
  feeSequence: 1,
  reportYear: new Date().getFullYear(),
};

/**
 * Migrates legacy single groqApiKey/geminiApiKey fields to the new arrays.
 * Called once when the store loads a persisted profile.
 */
function migrateProfile(profile: SurveyorProfile): SurveyorProfile {
  let updated = { ...profile };

  // Ensure arrays exist (profiles persisted before this version won't have them)
  if (!Array.isArray(updated.geminiApiKeys)) updated.geminiApiKeys = [];
  if (!Array.isArray(updated.groqApiKeys)) updated.groqApiKeys = [];
  if (!Array.isArray(updated.nvidiaApiKeys)) updated.nvidiaApiKeys = [];

  // Migrate single key → array if array is empty
  if (updated.geminiApiKey && updated.geminiApiKeys.length === 0) {
    updated.geminiApiKeys = [updated.geminiApiKey];
  }
  if (updated.groqApiKey && updated.groqApiKeys.length === 0) {
    updated.groqApiKeys = [updated.groqApiKey];
  }

  return updated;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: { ...DEFAULT_PROFILE },

      updateProfile: (updates) => {
        set((state) => ({
          profile: { ...state.profile, ...updates },
        }));
      },

      getInitials: () => {
        const name = get().profile.name;
        return (
          name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'SP'
        );
      },

      getNextSpotNumber: () => {
        const { profile } = get();
        const currentYear = new Date().getFullYear();
        let seq = profile.spotSequence || 1;
        let year = profile.reportYear || currentYear;

        // Reset sequence if year changed
        if (year !== currentYear) {
          seq = 1;
          year = currentYear;
        }

        const formattedSeq = seq.toString().padStart(3, '0');
        const reportNo = `SPO/${year}/${formattedSeq}`;

        set((state) => ({
          profile: {
            ...state.profile,
            spotSequence: seq + 1,
            reportYear: year,
          },
        }));

        return reportNo;
      },

      getNextFinalNumber: () => {
        const { profile } = get();
        const currentYear = new Date().getFullYear();
        let seq = profile.finalSequence || 1;
        let year = profile.reportYear || currentYear;

        // Reset sequence if year changed
        if (year !== currentYear) {
          seq = 1;
          year = currentYear;
        }

        const formattedSeq = seq.toString().padStart(3, '0');
        const reportNo = `FIN/${year}/${formattedSeq}`;

        set((state) => ({
          profile: {
            ...state.profile,
            finalSequence: seq + 1,
            reportYear: year,
          },
        }));

        return reportNo;
      },

      getNextReportNumber: (surveyType) => {
        if (surveyType === 'spot') return get().getNextSpotNumber();
        return get().getNextFinalNumber();
      },

      resetProfile: () => {
        // Reset in-memory Zustand state to blank defaults
        set({ profile: { ...DEFAULT_PROFILE } });
        // Also wipe the persisted localStorage key so the next user
        // who opens the app doesn't inherit this surveyor's data
        try {
          localStorage.removeItem('surveyos-profile');
        } catch { /* ignore in SSR/test environments */ }
      },
    }),
    {
      name: 'surveyos-profile',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.profile = migrateProfile(state.profile);
        }
      },
    }
  )
);
