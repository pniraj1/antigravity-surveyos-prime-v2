import { InsurerSenderConfig } from '@/types/payment-reconciliation';

export const STORAGE_KEY = 'surveyos_payment_senders';

export const DEFAULT_INSURER_SENDERS: InsurerSenderConfig[] = [
  {
    email: 'NIAHO@newindia.co.in',
    insurerName: 'The New India Assurance',
    subjectKeywords: ['Payment', 'Released', 'NEFT', 'Invoice'],
  },
  {
    email: 'policy.noreply@service.uiic.co.in',
    insurerName: 'United India Insurance',
    subjectKeywords: ['payment', 'disbursed', 'claim', 'settlement'],
  },
  {
    email: 'Straight2axis@axis.bank.in',
    insurerName: 'Axis Bank CMS (UIIC / OIC Remittances)',
    subjectKeywords: ['Payment Advice', 'NEFT', 'UNITED INDIA', 'ORIENTAL'],
  },
  {
    email: 'payments@newindia.co.in',
    insurerName: 'The New India Assurance',
    subjectKeywords: ['Payment', 'Advice', 'Surveyor', 'NEFT'],
  },
  {
    email: 'disbursements@uiic.co.in',
    insurerName: 'United India Insurance',
    subjectKeywords: ['Disbursement', 'Payment', 'Claim'],
  },
  {
    email: 'claims.settlement@orientalinsurance.co.in',
    insurerName: 'The Oriental Insurance',
    subjectKeywords: ['Settlement', 'Advice', 'Survey Fee'],
  },
  {
    email: 'surveyor.payment@nic.co.in',
    insurerName: 'National Insurance',
    subjectKeywords: ['Surveyor Payment', 'NEFT Advice'],
  },
  {
    email: 'paymentadvice@icicilombard.com',
    insurerName: 'ICICI Lombard GIC',
    subjectKeywords: ['Payment Advice', 'Surveyor Fee'],
  },
  {
    email: 'claims@bajajallianz.co.in',
    insurerName: 'Bajaj Allianz GIC',
    subjectKeywords: ['Claim Payment Advice', 'NEFT'],
  },
  {
    email: 'cms.neft@sbi.co.in',
    insurerName: 'SBI CMS Payment Gateway',
    subjectKeywords: ['CMS NEFT', 'Payment Advice', 'Credit Advice'],
  },
];

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

export function loadSavedSenders(): InsurerSenderConfig[] {
  const storage = getStorage();
  if (!storage) {
    return [...DEFAULT_INSURER_SENDERS];
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_INSURER_SENDERS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [...DEFAULT_INSURER_SENDERS];
  } catch {
    return [...DEFAULT_INSURER_SENDERS];
  }
}

export function saveSender(sender: InsurerSenderConfig): InsurerSenderConfig[] {
  const senders = loadSavedSenders();
  const existingIndex = senders.findIndex(
    s => s.email.toLowerCase() === sender.email.toLowerCase()
  );
  let updated: InsurerSenderConfig[];
  if (existingIndex >= 0) {
    updated = [...senders];
    updated[existingIndex] = { ...updated[existingIndex], ...sender };
  } else {
    updated = [...senders, sender];
  }

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors or quota issues
    }
  }

  return updated;
}

export function removeSender(email: string): InsurerSenderConfig[] {
  const senders = loadSavedSenders();
  const normalizedEmail = email.toLowerCase();
  const filtered = senders.filter(
    s => s.email.toLowerCase() !== normalizedEmail
  );

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore storage errors or quota issues
    }
  }

  return filtered;
}

export function resetSendersToDefault(): InsurerSenderConfig[] {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_INSURER_SENDERS));
    } catch {
      // Ignore storage errors or quota issues
    }
  }

  return [...DEFAULT_INSURER_SENDERS];
}
