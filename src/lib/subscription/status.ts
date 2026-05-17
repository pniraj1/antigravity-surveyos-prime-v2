import type { SurveyorProfile } from '@/types';
import type { SubscriptionState } from '@/types/payment';

const TRIAL_DURATION_DAYS = 60;
const WARNING_DAYS = 5;

export function calculateSubscriptionState(profile: SurveyorProfile): SubscriptionState {
  const { subscriptionStatus, trialEndDate, subscriptionExpiry } = profile;

  if (subscriptionStatus === 'suspended') return 'suspended';
  if (subscriptionStatus === 'pending') return 'pending';

  const now = new Date();

  if (subscriptionStatus === 'trial' || trialEndDate) {
    if (trialEndDate && new Date(trialEndDate) < now) {
      return 'readonly';
    }
    if (subscriptionStatus === 'trial') return 'trial';
  }

  if (subscriptionStatus === 'active') {
    if (subscriptionExpiry && new Date(subscriptionExpiry) < now) {
      return 'readonly';
    }
    return 'active';
  }

  if (subscriptionStatus === 'expired' || subscriptionStatus === 'readonly') {
    return 'readonly';
  }

  return 'pending';
}

export function getDaysRemaining(expiryDate: string | null): number {
  if (!expiryDate) return 0;
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isInWarningPeriod(expiryDate: string | null, warningDays = WARNING_DAYS): boolean {
  if (!expiryDate) return false;
  const remaining = getDaysRemaining(expiryDate);
  return remaining > 0 && remaining <= warningDays;
}

export function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

export function generateReferralCode(name: string): string {
  const firstName = name.trim().split(' ')[0]?.toUpperCase() || 'USER';
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `SUS-${firstName}-${suffix}`;
}

export function calculateTrialEndDate(trialStartDate: string): string {
  const start = new Date(trialStartDate);
  start.setDate(start.getDate() + TRIAL_DURATION_DAYS);
  return start.toISOString();
}

export function addDaysToDate(dateStr: string | null, days: number): string {
  const base = dateStr ? new Date(dateStr) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

export { TRIAL_DURATION_DAYS, WARNING_DAYS };
