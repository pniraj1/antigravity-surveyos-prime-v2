# Admin Panel Data Integrity & Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 admin panel validation issues: enriched Approval Queue from profile/current, unified expiry model, configurable 30-day trial, Read-Only + Extend controls, and payment tab connection.

**Architecture:** Client-side enrichment cross-references newSignups UIDs with already-fetched profile data. Single `subscriptionExpiry` field is the source of truth for all statuses. New `handleExtendSubscription` action and Read-Only status button added to Surveyors tab. No new Firestore collections or rules changes needed.

**Tech Stack:** Next.js 16, TypeScript, Firebase Firestore, Zustand, Tailwind CSS, Lucide icons.

---

## File Map

| File | Action | Summary |
|---|---|---|
| `src/lib/subscription/status.ts` | Modify | `TRIAL_DURATION_DAYS` 60 → 30 |
| `src/components/admin/types.ts` | Modify | Enriched `NewSignup` fields; status union update |
| `src/components/admin/hooks/useAdminData.ts` | Modify | Enrich signups with profile data after fetch |
| `src/components/admin/hooks/useAdminActions.ts` | Modify | `handleApprove` takes `trialDays`; add `handleExtendSubscription`; update `handleUpdateStatus` |
| `src/components/admin/tabs/ApprovalQueueTab.tsx` | Modify | Per-row trial days input; enriched IRDAI/phone/name display |
| `src/components/admin/tabs/SurveyorsTab.tsx` | Modify | Unified expiry; Read-Only button; Extend inline control; context-dependent actions |
| `src/components/admin/AdminDashboard.tsx` | Modify | Pass `trialDays` to approve; fix verify modal await order |

---

## Task 1: Change trial duration default from 60 to 30 days

**Files:**
- Modify: `src/lib/subscription/status.ts` line 4

- [ ] **Step 1: Update the constant**

In `src/lib/subscription/status.ts`, change line 4:

```typescript
const TRIAL_DURATION_DAYS = 30;
```

- [ ] **Step 2: Verify build**

```bash
cd "C:/Users/Manasi/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2"
npm run build 2>&1 | tail -5
```

Expected: build succeeds, no errors about `TRIAL_DURATION_DAYS`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/subscription/status.ts
git commit -m "fix: change default trial duration from 60 to 30 days"
```

---

## Task 2: Update types — enriched NewSignup + status union

**Files:**
- Modify: `src/components/admin/types.ts`

- [ ] **Step 1: Replace the entire types.ts file**

```typescript
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
}

export type AdminTab = 'surveyors' | 'signups' | 'payments' | 'dev-notes';
export type PaymentFilter = 'all' | 'pending' | 'verified' | 'rejected';
export type SurveyorFilter = 'all' | 'trial' | 'active' | 'readonly' | 'suspended' | 'expiring';

// Re-export so consumers can import from one place
export type { PaymentRecord };
```

Key changes:
- `SurveyorAdminProfile.subscriptionStatus` drops `'expired'` (use `'readonly'` consistently)
- `NewSignup` gains `profileName`, `profileIrdai`, `profileMobile`, `accessRequestSubmitted`

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expect: TypeScript errors from callers that still pass `'expired'` to `handleUpdateStatus`. Note them — fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/types.ts
git commit -m "refactor: enrich NewSignup type + remove 'expired' status in favour of 'readonly'"
```

---

## Task 3: Enrich signups in useAdminData

**Files:**
- Modify: `src/components/admin/hooks/useAdminData.ts`

The enrichment runs AFTER both `fetchAllProfiles` and `fetchSignups` complete. We cross-reference by UID — no extra Firestore reads.

- [ ] **Step 1: Replace useAdminData.ts with enriched version**

```typescript
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
    fetchAllProfiles();
    fetchSignups();
    fetchPayments();
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
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/hooks/useAdminData.ts
git commit -m "fix: enrich approval queue signups with authoritative profile/current data"
```

---

## Task 4: Update useAdminActions — trialDays param, handleExtendSubscription, readonly status

**Files:**
- Modify: `src/components/admin/hooks/useAdminActions.ts`

- [ ] **Step 1: Replace useAdminActions.ts**

```typescript
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
import { generateReferralCode, addDaysToDate } from '@/lib/subscription/status';
import type { NewSignup, SurveyorAdminProfile } from '../types';

interface UseAdminActionsParams {
  fetchAllProfiles: () => Promise<void>;
  fetchSignups: () => Promise<void>;
  setSurveyors: React.Dispatch<React.SetStateAction<SurveyorAdminProfile[]>>;
  setSignups: React.Dispatch<React.SetStateAction<NewSignup[]>>;
}

interface UseAdminActionsReturn {
  processingId: string | null;
  handleApprove: (signup: NewSignup, trialDays: number) => Promise<void>;
  handleDismissConfirm: (uid: string, email: string, name: string, reason: string, sendEmailFlag: boolean) => Promise<void>;
  handleSendCustomEmail: (email: string, name: string, subject: string, body: string) => Promise<void>;
  handleUpdateStatus: (uid: string, status: 'active' | 'suspended' | 'readonly') => Promise<void>;
  handleUpdateExpiry: (uid: string, date: string) => Promise<void>;
  handleUpdateId: (uid: string, idStr: string) => Promise<void>;
  handleUpdateName: (uid: string, name: string) => Promise<void>;
  handleExtendSubscription: (uid: string, days: number) => Promise<void>;
  handleDeleteAccount: (uid: string, onDone: () => void) => Promise<void>;
}

export function useAdminActions({
  fetchAllProfiles,
  fetchSignups,
  setSurveyors,
  setSignups,
}: UseAdminActionsParams): UseAdminActionsReturn {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = useCallback(async (signup: NewSignup, trialDays: number) => {
    setProcessingId(signup.uid);
    try {
      const profileRef = doc(db, 'users', signup.uid, 'profile', 'current');
      const profileSnap = await getDoc(profileRef);
      const profileData = profileSnap.exists() ? profileSnap.data() : {};
      const authorName = profileData.name || signup.profileName || signup.name || signup.displayName || 'USER';
      const authorEmail = profileData.email || signup.email;

      const trialStart = new Date().toISOString();
      const trialEnd = addDaysToDate(trialStart, trialDays);
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

  const handleUpdateStatus = useCallback(async (uid: string, status: 'active' | 'suspended' | 'readonly') => {
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

  const handleExtendSubscription = useCallback(async (uid: string, days: number) => {
    setProcessingId(uid);
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'current');
      const profileSnap = await getDoc(profileRef);
      const data = profileSnap.exists() ? profileSnap.data() : {};
      const currentExpiry = data.subscriptionExpiry || null;
      const currentStatus: string = data.subscriptionStatus || 'readonly';

      // Extend from current expiry if in future, otherwise from today
      const newExpiry = addDaysToDate(
        currentExpiry && new Date(currentExpiry) > new Date() ? currentExpiry : null,
        days,
      );
      // Promote readonly/trial to active on extension; keep suspended as-is
      const newStatus = (currentStatus === 'readonly' || currentStatus === 'trial') ? 'active' : currentStatus;

      await updateDoc(profileRef, {
        subscriptionExpiry: newExpiry,
        subscriptionStatus: newStatus,
        updatedAt: Timestamp.now(),
      });
      setSurveyors(prev => prev.map(s =>
        s.id === uid
          ? { ...s, subscriptionExpiry: newExpiry, subscriptionStatus: newStatus as SurveyorAdminProfile['subscriptionStatus'] }
          : s,
      ));
    } catch (error) {
      console.error('Failed to extend subscription:', error);
      alert('Extension failed. Check console.');
    } finally {
      setProcessingId(null);
    }
  }, [setSurveyors]);

  const handleDeleteAccount = useCallback(async (uid: string, onDone: () => void) => {
    setProcessingId(uid);
    try {
      const claimsSnap = await getDocs(collection(db, 'users', uid, 'claims'));
      const claimDocs = claimsSnap.docs;
      for (let i = 0; i < claimDocs.length; i += 499) {
        const batch = writeBatch(db);
        claimDocs.slice(i, i + 499).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      const paymentsSnap = await getDocs(collection(db, 'users', uid, 'payments'));
      const paymentDocs = paymentsSnap.docs;
      for (let i = 0; i < paymentDocs.length; i += 499) {
        const batch = writeBatch(db);
        paymentDocs.slice(i, i + 499).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      const profileBatch = writeBatch(db);
      profileBatch.delete(doc(db, 'users', uid, 'profile', 'current'));
      await profileBatch.commit();

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
    handleExtendSubscription,
    handleDeleteAccount,
  };
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expect errors in `AdminDashboard.tsx` (passes wrong types) and `SurveyorsTab.tsx` (old status types). Fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/hooks/useAdminActions.ts
git commit -m "feat: handleApprove takes trialDays, add handleExtendSubscription, update status types to readonly"
```

---

## Task 5: Update ApprovalQueueTab — enriched data + per-row trial days input

**Files:**
- Modify: `src/components/admin/tabs/ApprovalQueueTab.tsx`

- [ ] **Step 1: Replace ApprovalQueueTab.tsx**

```typescript
'use client';

import React, { useState } from 'react';
import { Calendar, Loader2, UserPlus, IdCard, Mail, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { NewSignup } from '../types';

interface ApprovalQueueTabProps {
  signups: NewSignup[];
  loading: boolean;
  approvingId: string | null;
  onApprove: (signup: NewSignup, trialDays: number) => void;
  onDismiss: (signup: NewSignup) => void;
  onEmail: (email: string, name: string) => void;
}

function SignupRow({
  signup,
  approvingId,
  onApprove,
  onDismiss,
  onEmail,
}: {
  signup: NewSignup;
  approvingId: string | null;
  onApprove: (signup: NewSignup, trialDays: number) => void;
  onDismiss: (signup: NewSignup) => void;
  onEmail: (email: string, name: string) => void;
}) {
  const [trialDays, setTrialDays] = useState(30);
  const displayName = signup.profileName || signup.name || signup.displayName || '—';
  const isApproving = approvingId === signup.uid;

  return (
    <tr className="hover:bg-[#FAFBFC] transition-colors group">
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center font-bold text-yellow-700 text-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-[#0D1B2A]">{displayName}</div>
            <div className="text-xs text-[#8D99AE] mt-0.5">{signup.email}</div>
            <div className="text-[10px] text-[#8D99AE] font-mono mt-0.5 flex items-center gap-1">
              <IdCard size={10} /> {signup.uid}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        {!signup.accessRequestSubmitted ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
            <AlertCircle size={10} /> Awaiting form submission
          </span>
        ) : signup.profileIrdai ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(212,175,55,0.1)', color: '#856404', border: '1px solid rgba(212,175,55,0.25)' }}>
            {signup.profileIrdai}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-[#C3C9D4] italic">Not provided</span>
        )}
      </td>
      <td className="px-6 py-5">
        <div className="text-sm font-medium text-[#0D1B2A]">
          {signup.profileMobile || '—'}
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="text-sm font-medium text-[#0D1B2A]">
          {(signup.updatedAt ?? signup.signedUpAt)
            ? (signup.updatedAt ?? signup.signedUpAt).toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </div>
        <div className="text-[10px] text-[#8D99AE]">
          {(signup.updatedAt ?? signup.signedUpAt)
            ? (signup.updatedAt ?? signup.signedUpAt).toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : ''}
        </div>
      </td>
      <td className="px-6 py-5 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEmail(signup.email, displayName)}
            title="Send a custom email to this surveyor"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE] transition-all"
          >
            <Mail size={10} /> Email
          </button>
          {/* Per-row trial days input */}
          <div className="flex items-center gap-1 border border-[#E2E6EA] rounded-lg px-2 py-1 bg-white">
            <Calendar size={10} className="text-[#8D99AE]" />
            <input
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={e => setTrialDays(Math.max(1, Math.min(365, Number(e.target.value))))}
              className="w-10 text-xs font-bold text-center border-none focus:ring-0 p-0 text-[#0D1B2A]"
              title="Trial duration in days"
            />
            <span className="text-[10px] text-[#8D99AE]">d</span>
          </div>
          <button
            onClick={() => onApprove(signup, trialDays)}
            disabled={isApproving}
            title={`Approve with ${trialDays}-day trial`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isApproving
              ? <Loader2 size={10} className="animate-spin" />
              : <CheckCircle2 size={10} />}
            Approve
          </button>
          <button
            onClick={() => onDismiss(signup)}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] transition-all disabled:opacity-50"
          >
            <XCircle size={10} />
            Dismiss
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ApprovalQueueTab({
  signups,
  loading,
  approvingId,
  onApprove,
  onDismiss,
  onEmail,
}: ApprovalQueueTabProps) {
  return (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary opacity-20 mb-4" />
          <p className="text-sm font-bold text-[#8D99AE]">Loading New Signups...</p>
        </div>
      ) : signups.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-[#E2E6EA]">
          <div className="w-16 h-16 rounded-2xl bg-[#F8F9FA] flex items-center justify-center mx-auto mb-4">
            <UserPlus size={32} className="text-[#8D99AE]" />
          </div>
          <h3 className="text-base font-bold text-[#0D1B2A]">No pending signups</h3>
          <p className="text-sm text-[#8D99AE] mt-1">New signups will appear here for approval.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFBFC] border-b border-[#E2E6EA]">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">User</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">IRDAI Licence</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Phone</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Submitted</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F5]">
              {signups.map((signup) => (
                <SignupRow
                  key={signup.uid}
                  signup={signup}
                  approvingId={approvingId}
                  onApprove={onApprove}
                  onDismiss={onDismiss}
                  onEmail={onEmail}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
```

Key changes:
- Removed `defaultExpiry` / `setDefaultExpiry` props (no longer needed)
- Each row has its own `trialDays` state (default 30), passed to `onApprove`
- Renders `profileName`, `profileIrdai`, `profileMobile` (enriched)
- Shows "Awaiting form submission" badge when `accessRequestSubmitted === false`

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expect errors in `AdminDashboard.tsx` (still passes `defaultExpiry`, old `onApprove` signature). Fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/tabs/ApprovalQueueTab.tsx
git commit -m "feat: approval queue shows enriched profile data + per-row configurable trial days"
```

---

## Task 6: Update SurveyorsTab — unified expiry, Read-Only + Extend buttons

**Files:**
- Modify: `src/components/admin/tabs/SurveyorsTab.tsx`

- [ ] **Step 1: Replace SurveyorsTab.tsx**

```typescript
'use client';

import React, { useState } from 'react';
import {
  Loader2, UserX, Mail, IdCard, ShieldCheck,
  Calendar, CheckCircle2, XCircle, Clock, Eye, Trash2, Plus,
} from 'lucide-react';
import { getDaysRemaining } from '@/lib/subscription/status';
import type { SurveyorAdminProfile, SurveyorFilter } from '../types';

const FILTERS: { key: SurveyorFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'trial', label: 'Trial' },
  { key: 'active', label: 'Active' },
  { key: 'readonly', label: 'Read-Only' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'expiring', label: 'Expiring Soon' },
];

// Single source of truth: always use subscriptionExpiry
function getExpiry(surveyor: SurveyorAdminProfile): string | null {
  return surveyor.subscriptionExpiry || null;
}

function isExpiringSoon(surveyor: SurveyorAdminProfile): boolean {
  const expiry = getExpiry(surveyor);
  if (!expiry) return false;
  const days = getDaysRemaining(expiry);
  return days > 0 && days <= 7;
}

function isExpiredDate(surveyor: SurveyorAdminProfile): boolean {
  const expiry = getExpiry(surveyor);
  if (!expiry) return false;
  return getDaysRemaining(expiry) <= 0;
}

interface SurveyorsTabProps {
  surveyors: SurveyorAdminProfile[];
  loading: boolean;
  processingId: string | null;
  searchQuery: string;
  onUpdateStatus: (uid: string, status: 'active' | 'suspended' | 'readonly') => void;
  onUpdateExpiry: (uid: string, date: string) => void;
  onUpdateId: (uid: string, idStr: string) => void;
  onUpdateName: (uid: string, name: string) => void;
  onExtend: (uid: string, days: number) => void;
  onDeleteAccount: (surveyor: SurveyorAdminProfile) => void;
}

function ExtendControl({ uid, onExtend, disabled }: { uid: string; onExtend: (uid: string, days: number) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="Extend subscription"
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-40"
      >
        <Plus size={10} /> Extend
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 border border-blue-200 rounded-lg px-2 py-1 bg-blue-50">
      <input
        type="number"
        min={1}
        max={365}
        value={days}
        onChange={e => setDays(Math.max(1, Math.min(365, Number(e.target.value))))}
        className="w-10 text-xs font-bold text-center border-none focus:ring-0 p-0 bg-transparent text-blue-800"
        autoFocus
      />
      <span className="text-[10px] text-blue-500">d</span>
      <button
        onClick={() => { onExtend(uid, days); setOpen(false); }}
        className="text-[10px] font-black text-blue-700 hover:text-blue-900 ml-1"
      >
        ✓
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[10px] text-blue-400 hover:text-blue-600"
      >
        ✕
      </button>
    </div>
  );
}

export function SurveyorsTab({
  surveyors,
  loading,
  processingId,
  searchQuery,
  onUpdateStatus,
  onUpdateExpiry,
  onUpdateId,
  onUpdateName,
  onExtend,
  onDeleteAccount,
}: SurveyorsTabProps) {
  const [activeFilter, setActiveFilter] = useState<SurveyorFilter>('all');

  const filtered = surveyors
    .filter(s => s.subscriptionStatus !== 'pending')
    .filter(s => {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q)
      );
    })
    .filter(s => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'expiring') return isExpiringSoon(s);
      if (activeFilter === 'readonly') return s.subscriptionStatus === 'readonly';
      return s.subscriptionStatus === activeFilter;
    });

  if (loading && surveyors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={40} className="animate-spin text-primary opacity-20 mb-4" />
        <p className="text-sm font-bold text-[#8D99AE]">Loading Surveyor Registry...</p>
      </div>
    );
  }

  return (
    <>
      {/* Filter pills */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeFilter === key
                ? 'bg-[#0D1B2A] text-white'
                : 'bg-white border border-[#E2E6EA] text-[#8D99AE] hover:text-[#0D1B2A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#FAFBFC] border-b border-[#E2E6EA]">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Surveyor / Digital ID</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Platform ID</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Licence</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Subscription</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Days Left</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Expiry Date</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F2F5]">
            {filtered.map((surveyor) => {
              const expiry = getExpiry(surveyor);
              const expiring = isExpiringSoon(surveyor);
              const expired = isExpiredDate(surveyor);
              const days = getDaysRemaining(expiry);
              const rowBg = expiring ? 'bg-amber-50' : '';
              const isProcessing = processingId === surveyor.id;

              return (
                <tr key={surveyor.id} className={`hover:bg-[#FAFBFC] transition-colors group ${rowBg}`}>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F0F2F5] flex items-center justify-center font-bold text-[#0D1B2A] text-lg">
                        {surveyor.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="text-sm font-bold text-[#0D1B2A] bg-transparent border-b border-dashed border-transparent hover:border-[#E2E6EA] focus:border-primary focus:ring-0 focus:outline-none p-0 w-40"
                            value={surveyor.name}
                            onChange={e => onUpdateName(surveyor.id, e.target.value)}
                            disabled={isProcessing}
                          />
                          {surveyor.isAdmin && <ShieldCheck size={14} className="text-primary flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-[#8D99AE] font-mono mt-0.5 flex items-center gap-1">
                          <Mail size={10} /> {surveyor.email}
                        </div>
                        <div className="text-xs text-[#8D99AE] font-mono mt-0.5 flex items-center gap-1">
                          <IdCard size={10} /> {surveyor.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <input
                      type="text"
                      placeholder="ASSIGN ID..."
                      className="bg-transparent border-b border-dashed border-[#E2E6EA] focus:border-primary focus:ring-0 text-sm p-0 w-24 font-black uppercase tracking-tight"
                      value={surveyor.surveyorId}
                      onChange={(e) => onUpdateId(surveyor.id, e.target.value.toUpperCase())}
                      disabled={isProcessing}
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium text-[#0D1B2A]">{surveyor.licenceNumber}</div>
                    <div className="text-[10px] text-[#8D99AE]">{surveyor.mobileNumber}</div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                      surveyor.subscriptionStatus === 'active'
                        ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
                        : surveyor.subscriptionStatus === 'trial'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : surveyor.subscriptionStatus === 'suspended'
                        ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
                        : surveyor.subscriptionStatus === 'pending'
                        ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                        : surveyor.subscriptionStatus === 'readonly'
                        ? 'bg-orange-50 text-orange-800 border-orange-200'
                        : 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                    }`}>
                      {surveyor.subscriptionStatus === 'active' ? <CheckCircle2 size={10} />
                        : surveyor.subscriptionStatus === 'trial' ? <Eye size={10} />
                        : surveyor.subscriptionStatus === 'pending' ? <Clock size={10} />
                        : <XCircle size={10} />}
                      {surveyor.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {!expiry ? (
                      <span className="text-[10px] text-[#C3C9D4]">—</span>
                    ) : (
                      <span className={`text-xs font-black ${
                        expired ? 'text-red-600' : days <= 5 ? 'text-amber-600' : days <= 10 ? 'text-yellow-600' : 'text-emerald-600'
                      }`}>
                        {days <= 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d`}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0D1B2A]">
                      <Calendar size={14} className="text-[#8D99AE]" />
                      <input
                        type="date"
                        className={`bg-transparent border-none focus:ring-0 text-sm p-0 w-32 cursor-pointer ${expired ? 'text-red-600' : ''}`}
                        value={surveyor.subscriptionExpiry}
                        onChange={(e) => onUpdateExpiry(surveyor.id, e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Extend */}
                      <ExtendControl uid={surveyor.id} onExtend={onExtend} disabled={isProcessing} />

                      {/* Context-dependent status actions */}
                      {(surveyor.subscriptionStatus === 'readonly' || surveyor.subscriptionStatus === 'suspended') && (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'active')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] transition-all disabled:opacity-40"
                        >
                          Activate
                        </button>
                      )}
                      {(surveyor.subscriptionStatus === 'trial' || surveyor.subscriptionStatus === 'active' || surveyor.subscriptionStatus === 'readonly') && (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'suspended')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] transition-all disabled:opacity-40"
                        >
                          Suspend
                        </button>
                      )}
                      {(surveyor.subscriptionStatus === 'trial' || surveyor.subscriptionStatus === 'active' || surveyor.subscriptionStatus === 'suspended') && (
                        <button
                          onClick={() => onUpdateStatus(surveyor.id, 'readonly')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all disabled:opacity-40"
                        >
                          Read-Only
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => onDeleteAccount(surveyor)}
                        title="Delete this account permanently"
                        className="p-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F8F9FA] flex items-center justify-center mx-auto mb-4">
              <UserX size={32} className="text-[#8D99AE]" />
            </div>
            <h3 className="text-base font-bold text-[#0D1B2A]">No surveyors found</h3>
            <p className="text-sm text-[#8D99AE] mt-1">Try adjusting your search criteria.</p>
          </div>
        )}
      </div>
    </>
  );
}
```

Key changes:
- `getExpiry()` always uses `subscriptionExpiry` (no more trial/active branch)
- `ExtendControl` inline component with open/close state + days input
- Action buttons context-dependent per status (see table in spec)
- `onUpdateStatus` type: `'active' | 'suspended' | 'readonly'`
- New `onExtend` prop

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expect errors in `AdminDashboard.tsx` (wrong props). Fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/tabs/SurveyorsTab.tsx
git commit -m "feat: unified expiry model, Read-Only button, Extend control in Surveyors tab"
```

---

## Task 7: Update AdminDashboard — wire new props, fix verify modal await

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`

- [ ] **Step 1: Replace AdminDashboard.tsx**

```typescript
'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Mail,
  RefreshCw,
  Users,
  Bell,
  CreditCard,
  Code2,
} from 'lucide-react';
import { verifyPayment, rejectPayment } from '@/lib/firebase/payments';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { getDaysRemaining } from '@/lib/subscription/status';

import { useAdminData } from './hooks/useAdminData';
import { useAdminActions } from './hooks/useAdminActions';

import { ApprovalQueueTab } from './tabs/ApprovalQueueTab';
import { SurveyorsTab } from './tabs/SurveyorsTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { DevNotesTab } from './tabs/DevNotesTab';

import { DismissModal } from './modals/DismissModal';
import { EmailComposerModal } from './modals/EmailComposerModal';
import { VerifyPaymentModal } from './modals/VerifyPaymentModal';
import { RejectPaymentModal } from './modals/RejectPaymentModal';
import { DeleteAccountModal } from './modals/DeleteAccountModal';

import type { AdminTab, PaymentFilter, NewSignup, SurveyorAdminProfile } from './types';
import type { PaymentRecord } from '@/types/payment';

export function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const isAuthorized = Boolean(user && profile?.isAdmin === true);

  const [activeTab, setActiveTab] = useState<AdminTab>('surveyors');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('pending');

  // Modal state
  const [dismissModal, setDismissModal] = useState<{ uid: string; email: string; name: string } | null>(null);
  const [emailModal, setEmailModal] = useState<{ email: string; name: string } | null>(null);
  const [verifyModal, setVerifyModal] = useState<{ payment: PaymentRecord } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ payment: PaymentRecord } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ surveyor: SurveyorAdminProfile } | null>(null);

  const {
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
  } = useAdminData(isAuthorized);

  const {
    processingId,
    handleApprove,
    handleDismissConfirm,
    handleSendCustomEmail,
    handleUpdateStatus,
    handleUpdateExpiry,
    handleUpdateId,
    handleUpdateName,
    handleExtendSubscription,
    handleDeleteAccount,
  } = useAdminActions({ fetchAllProfiles, fetchSignups, setSurveyors, setSignups });

  // Badge counts
  const expiringSoonCount = surveyors.filter(s => {
    const expiry = s.subscriptionExpiry;
    if (!expiry) return false;
    const days = getDaysRemaining(expiry);
    return days > 0 && days <= 7;
  }).length;

  const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;

  if (!isAuthorized) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#F8F9FA] p-8">
        <div className="max-w-md w-full bg-white border border-[#E2E6EA] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} className="text-red-600" />
          </div>
          <h2 className="text-lg font-black text-[#0D1B2A] mb-2">Not Authorized</h2>
          <p className="text-sm text-[#8D99AE] font-medium">
            The administrator dashboard is restricted to accounts with admin privileges.
            This attempt has been logged.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      {/* Header */}
      <div className="px-8 py-8 border-b bg-white border-[#E2E6EA]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ShieldCheck size={24} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-[#0D1B2A]">Regulator Dashboard</h1>
            </div>
            <p className="text-sm font-medium text-[#8D99AE]">
              Manage all active surveyors and their digital profile vaults.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'surveyors' && (
              <>
                <button
                  onClick={() => {
                    const emails = surveyors.map(s => s.email).filter(Boolean).join(', ');
                    navigator.clipboard.writeText(emails);
                    alert(`Copied ${surveyors.length} email addresses to clipboard!`);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-[#E2E6EA] text-[#0D1B2A] hover:bg-[#F8F9FA] transition-all font-bold text-xs flex items-center gap-2 shadow-sm"
                  title="Copy All Emails"
                >
                  <Mail size={16} className="text-primary" /> Copy All Emails
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8D99AE]" size={16} />
                  <input
                    type="text"
                    placeholder="Search by name or UID..."
                    className="pl-10 pr-4 py-2.5 rounded-xl border border-[#E2E6EA] text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </>
            )}
            <button
              onClick={refreshAll}
              className="p-2.5 rounded-xl border border-[#E2E6EA] text-[#0D1B2A] hover:bg-[#F8F9FA] transition-all"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={loading || signupsLoading || paymentsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto mt-6 flex gap-1 border-b border-[#E2E6EA]">
          <button
            onClick={() => setActiveTab('surveyors')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'surveyors'
                ? 'bg-white border border-b-white border-[#E2E6EA] text-primary -mb-px'
                : 'text-[#8D99AE] hover:text-[#0D1B2A]'
            }`}
          >
            <Users size={14} />
            All Surveyors
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-[#F0F2F5] text-[#0D1B2A] text-[9px]">
              {surveyors.length}
            </span>
            {expiringSoonCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[9px] font-black">
                {expiringSoonCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('signups')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'signups'
                ? 'bg-white border border-b-white border-[#E2E6EA] text-primary -mb-px'
                : 'text-[#8D99AE] hover:text-[#0D1B2A]'
            }`}
          >
            <Bell size={14} />
            New Signups
            {signups.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-yellow-100 text-yellow-800 text-[9px] font-black">
                {signups.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'payments'
                ? 'bg-white border border-b-white border-[#E2E6EA] text-primary -mb-px'
                : 'text-[#8D99AE] hover:text-[#0D1B2A]'
            }`}
          >
            <CreditCard size={14} />
            Payments
            {pendingPaymentsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black">
                {pendingPaymentsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('dev-notes')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'dev-notes'
                ? 'bg-white border border-b-white border-[#E2E6EA] text-primary -mb-px'
                : 'text-[#8D99AE] hover:text-[#0D1B2A]'
            }`}
          >
            <Code2 size={14} />
            Dev Notes
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'signups' && (
            <ApprovalQueueTab
              signups={signups}
              loading={signupsLoading}
              approvingId={processingId}
              onApprove={(signup: NewSignup, trialDays: number) => handleApprove(signup, trialDays)}
              onDismiss={(signup: NewSignup) =>
                setDismissModal({ uid: signup.uid, email: signup.email, name: signup.profileName || signup.name || signup.displayName })
              }
              onEmail={(email, name) => setEmailModal({ email, name })}
            />
          )}

          {activeTab === 'surveyors' && (
            <SurveyorsTab
              surveyors={surveyors}
              loading={loading}
              processingId={processingId}
              searchQuery={searchQuery}
              onUpdateStatus={handleUpdateStatus}
              onUpdateExpiry={handleUpdateExpiry}
              onUpdateId={handleUpdateId}
              onUpdateName={handleUpdateName}
              onExtend={handleExtendSubscription}
              onDeleteAccount={(surveyor) => setDeleteModal({ surveyor })}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsTab
              payments={payments}
              surveyors={surveyors}
              loading={paymentsLoading}
              paymentFilter={paymentFilter}
              setPaymentFilter={setPaymentFilter}
              onVerify={(payment) => setVerifyModal({ payment })}
              onReject={(payment) => setRejectModal({ payment })}
            />
          )}

          {activeTab === 'dev-notes' && <DevNotesTab />}
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t bg-white border-[#E2E6EA] text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8D99AE]">
          Motor SurveyOS • Digital Profile Sync Registry • Administrative Access Only
        </p>
      </div>

      {/* Modals */}
      {dismissModal && (
        <DismissModal
          uid={dismissModal.uid}
          email={dismissModal.email}
          name={dismissModal.name}
          onConfirm={(uid, email, name, reason, sendEmailFlag) => {
            setDismissModal(null);
            handleDismissConfirm(uid, email, name, reason, sendEmailFlag);
          }}
          onCancel={() => setDismissModal(null)}
        />
      )}

      {emailModal && (
        <EmailComposerModal
          email={emailModal.email}
          name={emailModal.name}
          onSend={async (email, name, subject, body) => {
            await handleSendCustomEmail(email, name, subject, body);
            setEmailModal(null);
          }}
          onCancel={() => setEmailModal(null)}
        />
      )}

      {verifyModal && (
        <VerifyPaymentModal
          payment={verifyModal.payment}
          onConfirm={async (payment, duration) => {
            if (!user) return;
            try {
              await verifyPayment(payment.userUid!, payment.id!, user.uid, duration);
              // Refresh both — order matters: profiles first so Surveyors tab is up to date
              await fetchPayments();
              await fetchAllProfiles();
            } catch (err) {
              console.error('Verify failed:', err);
              alert('Payment verification failed. Check console.');
            } finally {
              setVerifyModal(null);
            }
          }}
          onCancel={() => setVerifyModal(null)}
        />
      )}

      {rejectModal && (
        <RejectPaymentModal
          payment={rejectModal.payment}
          onConfirm={async (payment, reason) => {
            try {
              await rejectPayment(payment.userUid!, payment.id!, reason);
              await fetchPayments();
            } catch (err) {
              console.error('Reject failed:', err);
            } finally {
              setRejectModal(null);
            }
          }}
          onCancel={() => setRejectModal(null)}
        />
      )}

      {deleteModal && (
        <DeleteAccountModal
          surveyor={deleteModal.surveyor}
          processing={processingId === deleteModal.surveyor.id}
          onConfirm={() => {
            handleDeleteAccount(deleteModal.surveyor.id, () => {
              setDeleteModal(null);
              fetchAllProfiles();
            });
          }}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
```

Key changes:
- Removed `defaultExpiry` / `setDefaultExpiry` state (no longer needed)
- `onApprove` passes `trialDays` through
- `onExtend={handleExtendSubscription}` added to `SurveyorsTab`
- `expiringSoonCount` uses `subscriptionExpiry` only
- Verify modal: `setVerifyModal(null)` moved to `finally` so it always closes after refresh
- Reject modal: same pattern

- [ ] **Step 2: Full build — must be clean**

```bash
npm run build 2>&1 | tail -10
```

Expected: zero TypeScript errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminDashboard.tsx
git commit -m "fix: wire trialDays + onExtend props, fix verify/reject modal close timing"
```

---

## Task 8: Final build verification + staging deploy

- [ ] **Step 1: Clean build**

```bash
cd "C:/Users/Manasi/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2"
npm run build 2>&1 | tail -10
```

Expected: `○ (Static) prerendered as static content` — zero errors.

- [ ] **Step 2: Deploy to staging**

```bash
npx firebase hosting:channel:deploy staging --expires 7d 2>&1 | tail -10
```

Expected: `Channel URL (motorsurveyos): https://motorsurveyos--staging-48metw71.web.app`

- [ ] **Step 3: Smoke test checklist**

On staging as admin:

1. **Approval Queue — IRDAI visible:** Sign in as a new user, submit access request form with IRDAI licence and phone. Sign in as admin → New Signups tab → verify IRDAI and phone show from profile (not "Not submitted yet").

2. **Configurable trial days:** In the Approval Queue row, change trial days from 30 to 15. Click Approve. Go to Surveyors tab → find the user → verify Days Left shows ~15d.

3. **Unified expiry:** In Surveyors tab, the Days Left and Expiry Date for a trial user must agree (same `subscriptionExpiry` field).

4. **Read-Only button:** On a trial or active user, hover their row → click "Read-Only" → status badge changes to orange "readonly".

5. **Activate from Read-Only:** Hover a readonly user → click "Activate" → status changes to active.

6. **Extend control:** Hover any user → click "Extend" → enter 30 → click ✓ → Expiry Date extends by 30 days, status becomes active if was readonly/trial.

7. **Payment verify refreshes Surveyors:** Have a user submit a payment. Admin verifies it in Payments tab. Switch to Surveyors tab → verify expiry date updated without manual refresh.

- [ ] **Step 4: Final commit if any minor fixups needed**

```bash
git add -A
git commit -m "fix: post-smoke-test adjustments"
```
