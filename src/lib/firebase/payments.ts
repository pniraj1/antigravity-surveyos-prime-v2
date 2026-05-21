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
  durationDays: number
): Promise<void> {
  const paymentRef = doc(db, 'users', userUid, 'payments', paymentId);
  await updateDoc(paymentRef, {
    status: 'verified',
    verifiedAt: new Date().toISOString(),
    verifiedBy: adminUid,
    durationGranted: durationDays,
  });

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
