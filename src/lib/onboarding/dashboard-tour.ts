import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useProfileStore } from '@/stores/profile-store';
import { canShowOnboarding } from './rules';
import type { SurveyorProfile } from '@/types/vehicle';

export function isTourEligibleViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < 1024) return false; // Desktop only
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false;
  return true;
}

export function shouldStartDashboardTour(
  profile: SurveyorProfile,
  loginSyncDone: boolean,
  setupStep: unknown,
  activeTab: string,
  isViewportEligible: () => boolean = isTourEligibleViewport,
): boolean {
  if (!isViewportEligible()) return false;
  if (activeTab !== 'dashboard') return false;
  if (setupStep !== null && setupStep !== undefined) return false;
  if (!canShowOnboarding(profile, loginSyncDone)) return false;
  return !profile.onboarding?.tourDoneAt;
}

export function markTourDone(): void {
  const { profile, updateProfile } = useProfileStore.getState();
  const current = profile.onboarding ?? {};
  if (current.tourDoneAt) return;
  updateProfile({
    onboarding: {
      ...current,
      tourDoneAt: new Date().toISOString(),
    },
  });
}

export function startDashboardTour(onComplete?: () => void): Driver | null {
  if (typeof window === 'undefined') return null;

  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: 'rgba(13, 27, 42, 0.75)',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Done',
    onDestroyStarted: () => {
      markTourDone();
      onComplete?.();
      driverObj.destroy();
    },
    steps: [
      {
        element: '[data-tour="new-claim-btn"]',
        popover: {
          title: 'Start a New Claim',
          description: 'Create a Spot Survey, Final Survey, or Pre-Insurance Valuation claim with one click.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="open-saved-btn"]',
        popover: {
          title: 'Open Saved Work',
          description: 'Jump straight to your recent active claims table below.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="claims-table"]',
        popover: {
          title: 'Claims Registry',
          description: 'Filter between active and archived claims, search by registration number or insurer, and see live completion status.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-tour="nav-profile"]',
        popover: {
          title: 'Surveyor Profile & Credentials',
          description: 'Configure your IRDAI licence, signature, rubber stamp, fee schedule, and AI key so your reports print complete.',
          side: 'right',
          align: 'center',
        },
      },
    ],
  });

  driverObj.drive();
  return driverObj;
}
