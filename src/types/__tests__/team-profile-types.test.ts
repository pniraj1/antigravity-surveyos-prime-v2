import { describe, it, expect } from 'vitest';
import { useProfileStore, DEFAULT_PROFILE } from '@/stores/profile-store';
import type { SurveyorProfile } from '@/types/vehicle';
import type { SurveyorAdminProfile } from '@/components/admin/types';

describe('Team Profile Types & Defaults', () => {
  it('verifies maxTeamSeats, teamEmails, and hideEarningsFromTeam default values', () => {
    expect(DEFAULT_PROFILE.maxTeamSeats).toBe(0);
    expect(DEFAULT_PROFILE.teamEmails).toEqual([]);
    expect(DEFAULT_PROFILE.hideEarningsFromTeam).toBe(true);

    const profile = useProfileStore.getState().profile;
    expect(profile.maxTeamSeats).toBe(0);
    expect(profile.teamEmails).toEqual([]);
    expect(profile.hideEarningsFromTeam).toBe(true);
  });

  it('allows valid team fields on SurveyorProfile and SurveyorAdminProfile', () => {
    const profile: Partial<SurveyorProfile> = {
      maxTeamSeats: 3,
      teamEmails: ['assistant1@example.com', 'assistant2@example.com'],
      hideEarningsFromTeam: false,
    };
    expect(profile.maxTeamSeats).toBe(3);
    expect(profile.teamEmails).toEqual(['assistant1@example.com', 'assistant2@example.com']);
    expect(profile.hideEarningsFromTeam).toBe(false);

    const adminProfile: SurveyorAdminProfile = {
      id: 'admin-prof-1',
      name: 'Lead Surveyor',
      subscriptionStatus: 'active',
      subscriptionExpiry: '2026-12-31',
      surveyorId: 'SUS-1001',
      maxTeamSeats: 5,
      teamEmails: ['staff@example.com'],
    };
    expect(adminProfile.maxTeamSeats).toBe(5);
    expect(adminProfile.teamEmails).toEqual(['staff@example.com']);
  });
});
