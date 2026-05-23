'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collectionGroup,
  collection,
  getDocs,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getAllPayments } from '@/lib/firebase/payments';
import type { SurveyorAdminProfile, NewSignup } from '../types';
import type { PaymentRecord } from '@/types/payment';

interface UseAdminDataReturn {
  surveyors: SurveyorAdminProfile[];
  signups: NewSignup[];
  payments: PaymentRecord[];
  loading: boolean;
  signupsLoading: boolean;
  paymentsLoading: boolean;
  fetchAllProfiles: () => Promise<void>;
  fetchSignups: () => Promise<void>;
  fetchPayments: () => Promise<void>;
  refreshAll: () => void;
  setSurveyors: React.Dispatch<React.SetStateAction<SurveyorAdminProfile[]>>;
  setSignups: React.Dispatch<React.SetStateAction<NewSignup[]>>;
}

export function useAdminData(isAuthorized: boolean): UseAdminDataReturn {
  const [surveyors, setSurveyors] = useState<SurveyorAdminProfile[]>([]);
  const [signups, setSignups] = useState<NewSignup[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Keep a ref to the latest surveyors for enrichment without hook dependency issues
  const [surveyorMap, setSurveyorMap] = useState<Map<string, SurveyorAdminProfile>>(new Map());

  const fetchAllProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(query(collectionGroup(db, 'profile')));
      const seen = new Map<string, SurveyorAdminProfile>();
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const pathSegments = docSnap.ref.path.split('/');
        if (pathSegments.length !== 4 || pathSegments[0] !== 'users' || pathSegments[2] !== 'profile') return;
        const uid = pathSegments[1];
        if (seen.has(uid) && docSnap.id !== 'current') return;
        seen.set(uid, {
          id: uid,
          name: data.name || 'Unknown',
          email: data.email || 'N/A',
          mobileNumber: data.mobileNumber || data.mobile || 'N/A',
          licenceNumber: data.licenceNumber || data.irdaiLicence || 'N/A',
          subscriptionStatus: data.subscriptionStatus || 'pending',
          subscriptionExpiry: data.subscriptionExpiry || '',
          surveyorId: data.surveyorId || '',
          lastSync: data.lastSync,
          isAdmin: data.isAdmin || false,
          trialStartDate: data.trialStartDate || '',
          trialEndDate: data.trialEndDate || '',
          lastPaymentDate: data.lastPaymentDate || '',
        });
      });
      setSurveyorMap(seen);
      setSurveyors(Array.from(seen.values()));
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSignups = useCallback(async () => {
    setSignupsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'newSignups'));
      const results: NewSignup[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const uid = docSnap.id;
        // Enrich with authoritative profile data (already in memory)
        const profile = surveyorMap.get(uid);
        results.push({
          uid,
          email: data.email || '',
          displayName: data.displayName || data.name || '',
          name: data.name || data.displayName || '',
          irdaiLicence: data.irdaiLicence || '',
          mobile: data.mobile || '',
          signedUpAt: data.signedUpAt,
          updatedAt: data.updatedAt,
          status: data.status || 'pending',
          // Enriched from profile/current
          profileName: profile?.name && profile.name !== 'Unknown' ? profile.name : (data.name || data.displayName || ''),
          profileIrdai: profile?.licenceNumber && profile.licenceNumber !== 'N/A' ? profile.licenceNumber : '',
          profileMobile: profile?.mobileNumber && profile.mobileNumber !== 'N/A' ? profile.mobileNumber : '',
          accessRequestSubmitted: Boolean(profile) && profile?.licenceNumber !== 'N/A',
        });
      });
      results.sort((a, b) => (b.signedUpAt?.seconds ?? 0) - (a.signedUpAt?.seconds ?? 0));
      setSignups(results);
    } catch (error) {
      console.error('Error fetching signups:', error);
    } finally {
      setSignupsLoading(false);
    }
  }, [surveyorMap]);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const allPayments = await getAllPayments();
      setPayments(allPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    const run = async () => {
      await fetchAllProfiles();
      await fetchSignups();
      fetchPayments();
    };
    void run();
  }, [fetchAllProfiles, fetchSignups, fetchPayments]);

  // Initial load — profiles first so enrichment has data
  useEffect(() => {
    if (!isAuthorized) return;
    const init = async () => {
      await fetchAllProfiles();
      await fetchSignups();
      fetchPayments();
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  return {
    surveyors,
    signups,
    payments,
    loading,
    signupsLoading,
    paymentsLoading,
    fetchAllProfiles,
    fetchSignups,
    fetchPayments,
    refreshAll,
    setSurveyors,
    setSignups,
  };
}
