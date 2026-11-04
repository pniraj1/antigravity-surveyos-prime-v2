'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { canShowOnboarding, shouldShowWelcome } from '@/lib/onboarding/rules';
import { profilePrefill } from '@/lib/onboarding/setup';
import { shouldStartDashboardTour, startDashboardTour } from '@/lib/onboarding/dashboard-tour';

// Lazy: SetupDialog pulls in ProfileTab code, which stays out of the main bundle.
const SetupDialog = dynamic(() => import('./SetupDialog').then((m) => ({ default: m.SetupDialog })), {
  ssr: false,
});

export function OnboardingGate() {
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const displayName = useAuthStore((s) => s.user?.displayName);
  const loginSyncDone = useUIStore((s) => s.loginSyncDone);
  const setupStep = useUIStore((s) => s.setupStep);
  const setSetupStep = useUIStore((s) => s.setSetupStep);
  const newClaimOpen = useUIStore((s) => s.isNewClaimDialogOpen);
  const activeTab = useUIStore((s) => s.activeTab);
  const opened = useRef(false);
  const prefilled = useRef(false);
  const tourStarted = useRef(false);

  // Once per mount, after sync: fill blank name and licence from what the account already has.
  useEffect(() => {
    if (prefilled.current || !canShowOnboarding(profile, loginSyncDone)) return;
    prefilled.current = true;
    const fill = profilePrefill(profile, displayName);
    if (Object.keys(fill).length > 0) updateProfile(fill);
  }, [profile, loginSyncDone, displayName, updateProfile]);

  useEffect(() => {
    if (opened.current || setupStep !== null || newClaimOpen) return;
    if (shouldShowWelcome(profile, loginSyncDone)) {
      opened.current = true;
      setSetupStep(0);
    }
  }, [profile, loginSyncDone, setupStep, setSetupStep, newClaimOpen]);

  useEffect(() => {
    if (tourStarted.current || opened.current || setupStep !== null || newClaimOpen) return;
    if (shouldStartDashboardTour(profile, loginSyncDone, setupStep, activeTab)) {
      tourStarted.current = true;
      const timer = setTimeout(() => {
        startDashboardTour();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile, loginSyncDone, setupStep, newClaimOpen, activeTab]);

  return setupStep !== null ? <SetupDialog /> : null;
}
