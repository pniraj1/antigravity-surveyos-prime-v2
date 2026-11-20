export type PaymentStatus = 'unpaid' | 'paid' | 'partial';

export interface PaymentAdviceClaimItem {
  claimNumber: string;
  vehicleNumber?: string;
  policyNumber?: string;
  grossFee: number;
  conveyance?: number;
  tdsAmount?: number;
  netPaid: number;
  disallowedAmount?: number;
  remarks?: string;
}

export interface PaymentAdvice {
  id: string;
  insurerName: string;
  paymentDate: string;
  utrNumber: string;
  totalAmount: number;
  totalTds: number;
  netPaid: number;
  claims: PaymentAdviceClaimItem[];
  rawSource: string;
  createdAt?: string;
}

export type ExtractedPaymentAdvice = PaymentAdvice;

export type MatchConfidence = 'exact_claim_no' | 'exact_vehicle_no' | 'manual';

export interface PaymentMatchResult {
  id: string;
  adviceClaim: PaymentAdviceClaimItem;
  matchedClaimId?: string;
  vehicleNo?: string;
  reportNo?: string;
  billedTotal: number;
  status: 'matched' | 'unmatched';
  confidence?: MatchConfidence;
  utrNumber: string;
  paymentDate: string;
  insurerName: string;
  shortfall?: number;
  disallowed?: number;
}

export interface InsurerSenderConfig {
  email: string;
  insurerName: string;
  subjectKeywords?: string[];
  lastUsed?: string;
}
