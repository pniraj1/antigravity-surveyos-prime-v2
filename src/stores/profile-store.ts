// ═══════════════════════════════════════════════════════════
// SURVEYOR PROFILE STORE — Zustand + localStorage persistence
// Replaces: loadProfile() / saveProfile() from legacy
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SurveyorProfile } from '@/types';

interface ProfileState {
  profile: SurveyorProfile;
  updateProfile: (updates: Partial<SurveyorProfile>) => void;
  getInitials: () => string;
  /** Sequentially allocates and returns the next spot report number */
  getNextSpotNumber: () => string;
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
  email: '',
  address: '',
  gstNumber: '',
  bankName: '',
  bankAccount: '',
  bankIFSC: '',
  panNumber: '',
  aiProvider: 'gemini',
  groqApiKey: '',
  groqModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  googleClientId: '',
  surveyorId: '',
  subscriptionStatus: 'active',
  subscriptionExpiry: '2099-12-31',
  isAdmin: false,
  signatureDataUrl: null,
  stampDataUrl: null,
  spotSequence: 1,
  feeSequence: 1,
  reportYear: new Date().getFullYear(),
};

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

        // Update sequence for next time
        set((state) => ({
          profile: {
            ...state.profile,
            spotSequence: seq + 1,
            reportYear: year
          }
        }));

        return reportNo;
      },
    }),
    {
      name: 'surveyos-profile',
    }
  )
);
