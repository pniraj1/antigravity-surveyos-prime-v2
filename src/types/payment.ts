export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export interface PaymentRecord {
  id?: string;
  amount: number;
  transactionId: string;
  paymentDate: string;
  submittedAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  status: PaymentStatus;
  durationGranted: number | null;
  notes: string;
  screenshotUrl: string | null;
  userUid?: string;
  userName?: string;
  userEmail?: string;
}

export type SubscriptionState =
  | 'pending'
  | 'trial'
  | 'active'
  | 'readonly'
  | 'expired'
  | 'suspended';
