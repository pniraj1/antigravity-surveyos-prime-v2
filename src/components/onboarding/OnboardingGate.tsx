'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { shouldShowWelcome } from '@/lib/onboarding/rules';

// Lazy: SetupDialog pulls in ProfileTab code, which stays out of the main bundle.
const SetupDialog = dynamic(() => import('./SetupDialog').then((m) => ({ default: m.SetupDialog })), {
  ssr: false,
});

export function OnboardingGate() {
  const profile = useProfileStore((s) => s.profile);
  const loginSyncDone = useUIStore((s) => s.loginSyncDone);
  const setupStep = useUIStore((s) => s.setupStep);
  const setSetupStep = useUIStore((s) => s.setSetupStep);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current || setupStep !== null) return;
    if (shouldShowWelcome(profile, loginSyncDone)) {
      opened.current = true;
      setSetupStep(0);
    }
  }, [profile, loginSyncDone, setupStep, setSetupStep]);

  return setupStep !== null ? <SetupDialog /> : null;
}
