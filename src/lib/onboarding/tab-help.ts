import type { AppTab } from '@/stores/ui-store';
import type { SurveyType } from '@/types/report';
import type { SurveyorProfile } from '@/types/vehicle';
import { useProfileStore } from '@/stores/profile-store';
import { isNavItemVisible } from '@/lib/navigation/visible-nav';
import { canShowOnboarding } from './rules';

export interface TabHelpInfo {
  title: string;
  what: string;
  tip: string;
  isClaimTab?: boolean;
}

export const TAB_HELP: Record<AppTab, TabHelpInfo> = {
  documents: {
    title: 'Documents',
    what: 'Upload RC, Driving Licence, Insurance Policy, Estimate, and other survey papers.',
    tip: 'Ask the garage to WhatsApp or email the original computer-generated Estimate PDF directly from their billing software. Digital PDFs read instantly with 100% accuracy, whereas photos or scanned paper estimates can miss faint lines.',
    isClaimTab: true,
  },
  review: {
    title: 'AI Review',
    what: 'Check and reconcile information extracted from your documents.',
    tip: 'AI drafts the details, but you decide. Clear any mismatches between documents before proceeding to the report.',
    isClaimTab: true,
  },
  details: {
    title: 'Claim Details',
    what: 'Core claim details that print on all your survey reports.',
    tip: 'Review accident particulars, dates, policy details, and vehicle specifications. Anything corrected here updates on your final reports.',
    isClaimTab: true,
  },
  valuation: {
    title: 'Valuation',
    what: 'Vehicle pre-insurance inspection and fair market valuation schedule.',
    tip: 'Record vehicle condition, tyre wear, accessories, and overall valuation rating for pre-insurance or break-in cases.',
    isClaimTab: true,
  },
  assessment: {
    title: 'Assessment',
    what: 'Parts, labour, paint, and depreciation schedule.',
    tip: 'Your parts allowances, labour charges, and depreciation decisions. Every figure is yours. If estimate items were missed from a paper scan, upload the garage\'s digital PDF instead.',
    isClaimTab: true,
  },
  'bill-check': {
    title: 'Bill Check',
    what: 'Match the workshop final tax invoice against your survey assessment.',
    tip: 'Ask the garage for their digital Tax Invoice PDF. Digital invoices match your assessed items line-by-line automatically with zero manual typing.',
    isClaimTab: true,
  },
  reports: {
    title: 'Report Center',
    what: 'Preview, generate, and print formal survey reports.',
    tip: 'Preview your finished survey report (Standard, UIIC, or Spot format) and download PDF or Word copies ready for submission.',
    isClaimTab: true,
  },
  photos: {
    title: 'Photo Sheet',
    what: 'Arrange and caption inspection photographs for the survey dossier.',
    tip: 'Select, arrange, and add captions to vehicle damage, chassis, and odometer photos for the printed photo sheet.',
    isClaimTab: true,
  },
  fees: {
    title: 'Survey Fees Bill',
    what: 'Professional fee bill and expense voucher for the survey allotment.',
    tip: 'Generate your professional fee bill. If your Bank details, GSTIN, or PAN are missing, update them in Profile to print them on the bill.',
    isClaimTab: true,
  },
  reinspection: {
    title: 'Reinspection',
    what: 'Post-repair inspection record and salvage verification.',
    tip: 'Record post-repair physical verification and salvage handover. Standard conclusion remarks are pre-filled and can be edited.',
    isClaimTab: true,
  },
  dashboard: {
    title: 'Dashboard',
    what: 'Your active and completed claims overview.',
    tip: 'Start a new claim or pick up saved work. Track your progress with the Getting Started checklist.',
    isClaimTab: false,
  },
  profile: {
    title: 'Profile',
    what: 'Your surveyor credentials, IRDAI licence, signature, stamp, bank particulars, and AI key.',
    tip: 'Add your signature, stamp, and bank details here so they print on your survey reports and fee bills.',
    isClaimTab: false,
  },
  'cloud-vault': {
    title: 'Cloud Vault',
    what: 'Direct file browser for claim folders and scans saved in your linked Google Drive.',
    tip: 'Access documents and photos backed up to your Google Drive folder.',
    isClaimTab: false,
  },
  'recovered-claims': {
    title: 'Recovered Claims',
    what: 'Safeguard archive of claims recovered from local browser storage.',
    tip: 'View and restore claims saved in local device storage.',
    isClaimTab: false,
  },
  admin: {
    title: 'Admin Panel',
    what: 'Surveyor account management and platform settings.',
    tip: 'Manage surveyor accounts and review system health.',
    isClaimTab: false,
  },
  'insured-report': {
    title: 'Insured Report',
    what: 'Plain-language accident damage explanation for the insured vehicle owner.',
    tip: 'Draft a clear damage explanation for the policyholder (admin feature).',
    isClaimTab: false,
  },
  learning: {
    title: 'Learning',
    what: 'Survey knowledge and guides.',
    tip: 'Reference materials for motor surveying.',
    isClaimTab: false,
  },
};

/** Master ordered sequence of claim tabs. */
export const CLAIM_TAB_ORDER: readonly AppTab[] = [
  'documents',
  'review',
  'details',
  'valuation',
  'assessment',
  'bill-check',
  'reinspection',
  'reports',
  'photos',
  'fees',
];

/** Return next visible tab in the survey workflow, or null if last tab or not a claim tab. */
export function getNextClaimTab(currentTab: AppTab, surveyType: SurveyType | undefined): AppTab | null {
  if (!surveyType) return null;
  const visibleTabs = CLAIM_TAB_ORDER.filter((tab) => isNavItemVisible(tab, surveyType));
  const currentIndex = visibleTabs.indexOf(currentTab);
  if (currentIndex === -1 || currentIndex >= visibleTabs.length - 1) {
    return null;
  }
  return visibleTabs[currentIndex + 1];
}

export function getTabLabel(tab: AppTab): string {
  return TAB_HELP[tab]?.title ?? tab;
}

/** Record that a surveyor dismissed or acknowledged a tab tip. Safe for Firestore deep-merge. */
export function markTipSeen(tab: AppTab): void {
  const { profile, updateProfile } = useProfileStore.getState();
  const current = profile.onboarding ?? {};
  const tipsSeen = current.tipsSeen ?? {};
  if (tipsSeen[tab]) return;
  updateProfile({
    onboarding: {
      ...current,
      tipsSeen: {
        ...tipsSeen,
        [tab]: new Date().toISOString(),
      },
    },
  });
}

/** First-visit tips show for eligible surveyors on unacknowledged tabs. */
export function shouldShowTip(tab: AppTab, profile: SurveyorProfile, loginSyncDone: boolean): boolean {
  if (!canShowOnboarding(profile, loginSyncDone)) return false;
  // Dashboard already has the Getting Started checklist; admin is admin-only
  if (tab === 'dashboard' || tab === 'admin') return false;
  return !profile.onboarding?.tipsSeen?.[tab];
}
