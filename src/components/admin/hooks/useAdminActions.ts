'use client';

import { useState, useCallback } from 'react';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  sendEmail,
  buildApprovalEmail,
  buildDismissalEmail,
  buildCustomEmail,
} from '@/lib/email/sendEmail';
import { generateReferralCode, calculateTrialEndDate } from '@/lib/subscription/status';
import type { NewSignup, SurveyorAdminProfile } from '../types';

interface UseAdminActionsParams {
  fetchAllProfiles: () => Promise<void>;
  fetchSignups: () => Promise<void>;
  setSurveyors: React.Dispatch<React.SetStateAction<SurveyorAdminProfile[]>>;
  setSignups: React.Dispatch<React.SetStateAction<NewSignup[]>>;
}

interface UseAdminActionsReturn {
  processingId: string | null;
  handleApprove: (signup: NewSignup) => Promise<void>;
  handleDismissConfirm: (uid: string, email: string, name: string, reason: string, sendEmailFlag: boolean) => Promise<void>;
  handleSendCustomEmail: (email: string, name: string, subject: string, body: string) => Promise<void>;
  handleUpdateStatus: (uid: string, status: 'active' | 'suspended' | 'expired') => Promise<void>;
  handleUpdateExpiry: (uid: string, date: string) => Promise<void>;
  handleUpdateId: (uid: string, idStr: string) => Promise<void>;
  handleUpdateName: (uid: string, name: string) => Promise<void>;
  handleDeleteAccount: (uid: string, onDone: () => void) => Promise<void>;
}

export function useAdminActions({
  fetchAllProfiles,
  fetchSignups,
  setSurveyors,
  setSignups,
}: UseAdminActionsParams): UseAdminActionsReturn {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = useCallback(async (signup: NewSignup) => {
    setProcessingId(signup.uid);
    try {
      const profileRef = doc(db, 'users', signup.uid, 'profile', 'current');
      const profileSnap = await getDoc(profileRef);
      const profileData = profileSnap.exists() ? profileSnap.data() : {};
      const authorName = profileData.name || signup.name || signup.displayName || 'USER';
      const authorEmail = profileData.email || signup.email;

      const trialStart = new Date().toISOString();
      const trialEnd = calculateTrialEndDate(trialStart);
      const refCode = generateReferralCode(authorName);
      await setDoc(profileRef, {
        subscriptionStatus: 'trial',
        subscriptionExpiry: trialEnd,
        trialStartDate: trialStart,
        trialEndDate: trialEnd,
        referralCode: refCode,
        isAdmin: false,
        email: authorEmail,
        displayName: signup.displayName || profileData.displayName || '',
        updatedAt: Timestamp.now(),
      }, { merge: true });
      await deleteDoc(doc(db, 'newSignups', signup.uid));

      try {
        const emailContent = buildApprovalEmail(authorName);
        sendEmail({ to: authorEmail, ...emailContent });
      } catch { /* non-fatal */ }

      setSignups(prev => prev.filter(s => s.uid !== signup.uid));
      await fetchAllProfiles();
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('Approval failed. Check console.');
    } finally {
      setProcessingId(null);
    }
  }, [fetchAllProfiles, setSignups]);

  const handleDismissConfirm = useCallback(async (
    uid: string,
    email: string,
    name: string,
    reason: string,
    sendEmailFlag: boolean,
  ) => {
    setProcessingId(uid);
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'current');
      await setDoc(profileRef, {
        accessRequestSubmitted: false,
        dismissReason: reason.trim() || 'Please resubmit with corrected details.',
        updatedAt: Timestamp.now(),
      }, { merge: true });
      await deleteDoc(doc(db, 'newSignups', uid));

      if (sendEmailFlag) {
        try {
          const resolvedReason = reason.trim() || 'Please resubmit your registration details.';
          const emailContent = buildDismissalEmail(name, resolvedReason);
          sendEmail({ to: email, ...emailContent });
        } catch { /* non-fatal */ }
      }

      setSignups(prev => prev.filter(s => s.uid !== uid));
    } catch (error) {
      console.error('Failed to dismiss:', error);
    } finally {
      setProcessingId(null);
    }
  }, [setSignups]);

  const handleSendCustomEmail = useCallback(async (
    email: string,
    name: string,
    subject: string,
    body: string,
  ) => {
    const emailContent = buildCustomEmail(name, subject.trim(), body.trim());
    sendEmail({ to: email, ...emailContent });
    alert('Your email client was opened. Please hit "Send" from surveyosprime@gmail.com.');
  }, []);

  const handleUpdateStatus = useCallback(async (uid: string, status: 'active' | 'suspended' | 'expired') => {
    setProcessingId(uid);
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'current');
      await updateDoc(profileRef, { subscriptionStatus: status, updatedAt: Timestamp.now() });
      setSurveyors(prev => prev.map(s => s.id === uid ? { ...s, subscriptionStatus: status } : s));
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Check console.');
    } finally {
      setProcessingId(null);
    }
  }, [setSurveyors]);

  const handleUpdateExpiry = useCallback(async (uid: string, date: string) => {
    setProcessingId(uid);
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'current');
      await updateDoc(profileRef, { subscriptionExpiry: date, updatedAt: Timestamp.now() });
      setSurveyors(prev => prev.map(s => s.id === uid ? { ...s, subscriptionExpiry: date } : s));
    } catch (error) {
      console.error('Failed to update expiry:', error);
      alert('Failed to update expiry. Check console.');
    } finally {
      setProcessingId(null);
    }
  }, [setSurveyors]);

  const handleUpdateId = useCallback(async (uid: string, idStr: string) => {
    setProcessingId(uid);
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'current');
      await updateDoc(profileRef, { surveyorId: idStr, updatedAt: Timestamp.now() });
      setSurveyors(prev => prev.map(s => s.id === uid ? { ...s, surveyorId: idStr } : s));
    } catch (error) {
      console.error('Failed to update ID:', error);
    } finally {
      setProcessingId(null);
    }
  }, [setSurveyors]);

  const handleUpdateName = useCallback(async (uid: string, name: string) => {
    setProcessingId(uid);
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'current');
      await updateDoc(profileRef, { name, updatedAt: Timestamp.now() });
      setSurveyors(prev => prev.map(s => s.id === uid ? { ...s, name } : s));
    } catch (error) {
      console.error('Failed to update name:', error);
    } finally {
      setProcessingId(null);
    }
  }, [setSurveyors]);

  const handleDeleteAccount = useCallback(async (uid: string, onDone: () => void) => {
    setProcessingId(uid);
    try {
      // Delete claims in chunks of 499 to respect writeBatch limit
      const claimsSnap = await getDocs(collection(db, 'users', uid, 'claims'));
      const claimDocs = claimsSnap.docs;
      for (let i = 0; i < claimDocs.length; i += 499) {
        const batch = writeBatch(db);
        claimDocs.slice(i, i + 499).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Delete payments in chunks of 499
      const paymentsSnap = await getDocs(collection(db, 'users', uid, 'payments'));
      const paymentDocs = paymentsSnap.docs;
      for (let i = 0; i < paymentDocs.length; i += 499) {
        const batch = writeBatch(db);
        paymentDocs.slice(i, i + 499).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Delete profile
      const profileBatch = writeBatch(db);
      profileBatch.delete(doc(db, 'users', uid, 'profile', 'current'));
      await profileBatch.commit();

      // Delete newSignups entry if it exists
      try { await deleteDoc(doc(db, 'newSignups', uid)); } catch { /* may not exist */ }

      onDone();
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Account deletion failed. Check console.');
    } finally {
      setProcessingId(null);
    }
  }, []);

  return {
    processingId,
    handleApprove,
    handleDismissConfirm,
    handleSendCustomEmail,
    handleUpdateStatus,
    handleUpdateExpiry,
    handleUpdateId,
    handleUpdateName,
    handleDeleteAccount,
  };
}
