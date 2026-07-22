import type { Timestamp } from 'firebase/firestore';
import type { PaymentRecord } from '@/types/payment';

export interface SurveyorAdminProfile {
  id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  licenceNumber?: string;
  subscriptionStatus: 'active' | 'suspended' | 'pending' | 'trial' | 'readonly';
  subscriptionExpiry: string;
  surveyorId: string;
  lastSync?: unknown;
  isAdmin?: boolean;
  trialStartDate?: string;
  trialEndDate?: string;
  lastPaymentDate?: string;
  // Detail card fields — visible when row is expanded
  mobile?: string;
  irdaiLicence?: string;
  city?: string;
  state?: string;
  qualifications?: string;
  referralCode?: string;
  referredBy?: string | null;
  createdAt?: unknown;
}

export interface NewSignup {
  uid: string;
  email: string;
  displayName: string;
  name: string;
  irdaiLicence: string;
  mobile: string;
  signedUpAt: Timestamp;
  updatedAt?: Timestamp;
  status: string;
  // Enriched from profile/current — authoritative values
  profileName: string;
  profileIrdai: string;
  profileMobile: string;
  accessRequestSubmitted: boolean;
  profileCity: string;
  profileState: string;
}

export type AdminTab = 'surveyors' | 'signups' | 'payments' | 'dev-notes' | 'ai-models' | 'fee-schedule' | 'announcements';
export type PaymentFilter = 'all' | 'pending' | 'verified' | 'rejected';
export type SurveyorFilter = 'all' | 'trial' | 'active' | 'readonly' | 'suspended' | 'expiring';

// Re-export so consumers can import from one place
export type { PaymentRecord };
