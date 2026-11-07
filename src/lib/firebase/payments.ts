import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  collectionGroup,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { REFERRALS_ENABLED } from '@/lib/subscription/plans';
import type { PaymentRecord } from '@/types/payment';
import { addDaysToDate } from '@/lib/subscription/status';

export async function submitPayment(
  uid: string,
  data: Omit<PaymentRecord, 'id' | 'verifiedAt' | 'verifiedBy' | 'status' | 'durationGranted' | 'submittedAt'>
): Promise<string> {
  const paymentsRef = collection(db, 'users', uid, 'payments');
  const docRef = await addDoc(paymentsRef, {
    ...data,
    submittedAt: new Date().toISOString(),
    verifiedAt: null,
    verifiedBy: null,
    status: 'pending',
    durationGranted: null,
  });
  return docRef.id;
}

export async function getUserPayments(uid: string): Promise<PaymentRecord[]> {
  const paymentsRef = collection(db, 'users', uid, 'payments');
  const q = query(paymentsRef, orderBy('submittedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord));
}

export async function getAllPendingPayments(): Promise<PaymentRecord[]> {
  const q = query(
    collectionGroup(db, 'payments'),
    where('status', '==', 'pending'),
    orderBy('submittedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const parentPath = d.ref.parent.parent?.id || '';
    return { id: d.id, userUid: parentPath, ...d.data() } as PaymentRecord;
  });
}

export async function getAllPayments(): Promise<PaymentRecord[]> {
  const q = query(
    collectionGroup(db, 'payments'),
    orderBy('submittedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const parentPath = d.ref.parent.parent?.id || '';
    return { id: d.id, userUid: parentPath, ...d.data() } as PaymentRecord;
  });
}

export async function verifyPayment(
  userUid: string,
  paymentId: string,
  adminUid: string,
  durationDays: number,
  adminNotes?: string
): Promise<void> {
  const paymentRef = doc(db, 'users', userUid, 'payments', paymentId);
  const updates: Record<string, unknown> = {
    status: 'verified',
    verifiedAt: new Date().toISOString(),
    verifiedBy: adminUid,
    durationGranted: durationDays,
  };
  if (adminNotes !== undefined) {
    updates.adminNotes = adminNotes;
  }
  await updateDoc(paymentRef, updates);

  const profileRef = doc(db, 'users', userUid, 'profile', 'current');
  const profileSnap = await getDoc(profileRef);
  const profileData = profileSnap.data();

  const currentExpiry = profileData?.subscriptionExpiry || null;
  const baseDate = currentExpiry && new Date(currentExpiry) > new Date()
    ? currentExpiry
    : new Date().toISOString();

  const newExpiry = addDaysToDate(baseDate, durationDays);

  await updateDoc(profileRef, {
    subscriptionStatus: 'active',
    subscriptionExpiry: newExpiry,
    lastPaymentDate: new Date().toISOString(),
  });

  await handleReferralReward(userUid);
}

export async function recordManualPayment(
  adminUid: string,
  userUid: string,
  data: {
    amount: number;
    transactionId?: string;
    durationDays: number;
    paymentMode?: string;
    adminNotes?: string;
    planName?: string;
  }
): Promise<string> {
  const paymentsRef = collection(db, 'users', userUid, 'payments');
  const now = new Date().toISOString();
  const docRef = await addDoc(paymentsRef, {
    amount: data.amount,
    transactionId: data.transactionId || `OFFLINE-${Date.now().toString().slice(-6)}`,
    paymentDate: now.split('T')[0],
    submittedAt: now,
    verifiedAt: now,
    verifiedBy: adminUid,
    status: 'verified',
    durationGranted: data.durationDays,
    notes: data.adminNotes || 'Recorded manually by Admin',
    adminNotes: data.adminNotes || '',
    paymentMode: data.paymentMode || 'Manual',
    planName: data.planName || '',
    screenshotUrl: null,
  });

  const profileRef = doc(db, 'users', userUid, 'profile', 'current');
  const profileSnap = await getDoc(profileRef);
  const profileData = profileSnap.data();

  const currentExpiry = profileData?.subscriptionExpiry || null;
  const baseDate = currentExpiry && new Date(currentExpiry) > new Date()
    ? currentExpiry
    : now;

  const newExpiry = addDaysToDate(baseDate, data.durationDays);

  await updateDoc(profileRef, {
    subscriptionStatus: 'active',
    subscriptionExpiry: newExpiry,
    lastPaymentDate: now,
  });

  return docRef.id;
}

export async function rejectPayment(
  userUid: string,
  paymentId: string,
  reason: string
): Promise<void> {
  const paymentRef = doc(db, 'users', userUid, 'payments', paymentId);
  await updateDoc(paymentRef, {
    status: 'rejected',
    notes: reason,
  });
}

async function handleReferralReward(referredUserUid: string): Promise<void> {
  if (!REFERRALS_ENABLED) return;
  const profileRef = doc(db, 'users', referredUserUid, 'profile', 'current');
  const profileSnap = await getDoc(profileRef);
  const profileData = profileSnap.data();

  if (!profileData?.referredBy) return;

  const paymentsRef = collection(db, 'users', referredUserUid, 'payments');
  const q = query(paymentsRef, where('status', '==', 'verified'));
  const verifiedPayments = await getDocs(q);

  if (verifiedPayments.size > 1) return;

  const referrerUid = profileData.referredBy;
  const referrerProfileRef = doc(db, 'users', referrerUid, 'profile', 'current');
  const referrerSnap = await getDoc(referrerProfileRef);
  const referrerData = referrerSnap.data();

  if (!referrerData) return;

  const currentExpiry = referrerData.subscriptionExpiry || null;
  const baseDate = currentExpiry && new Date(currentExpiry) > new Date()
    ? currentExpiry
    : new Date().toISOString();

  const newExpiry = addDaysToDate(baseDate, 30);

  await updateDoc(referrerProfileRef, {
    subscriptionExpiry: newExpiry,
    referralCount: (referrerData.referralCount || 0) + 1,
    referralBonusDays: (referrerData.referralBonusDays || 0) + 30,
  });
}
