import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types';
import { initUserDB, saveClaim, getClaim } from '@/lib/storage/indexeddb';
import { buildConsentRecord } from '@/lib/legal/versions';

export function isSandbox(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = window.location.hostname || '';
  const search = window.location.search || '';
  return (
    process.env.NEXT_PUBLIC_SANDBOX_MODE === 'true' ||
    host.includes('sandbox') ||
    host.includes('surveyos-v2-antigravity-in') ||
    search.includes('sandbox=true')
  );
}

export async function initSandboxSession() {
  if (typeof window === 'undefined') return;

  // 1. Authenticate anonymously with Firebase so backend Cloud Functions (e.g. aiProxy for Ollama/NVIDIA)
  // receive a valid Firebase Auth token without requiring Google OAuth or any login popups.
  let firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    try {
      const cred = await signInAnonymously(auth);
      firebaseUser = cred.user;
    } catch (err) {
      console.warn('[Sandbox] Anonymous sign-in fallback:', err);
    }
  }

  const effectiveUid = firebaseUser?.uid || 'sandbox-surveyor';

  try {
    await initUserDB(effectiveUid);
  } catch (err) {
    console.warn('[Sandbox] initUserDB fallback:', err);
  }

  // 2. Set user in auth store with valid authentication
  useAuthStore.getState().setUser(
    firebaseUser ||
    ({
      uid: effectiveUid,
      email: 'sandbox@surveyos.internal',
      displayName: 'Sandbox Surveyor',
      isAnonymous: true,
    } as any)
  );

  // 3. Mark Drive connected and switch active tab to 'assessment'
  useUIStore.getState().setDriveConnected(true, 'sandbox-drive@surveyos.internal');
  useUIStore.getState().setActiveTab('assessment');

  // 4. Set Profile active & compliant
  useProfileStore.getState().updateProfile({
    subscriptionStatus: 'active',
    isAdmin: true,
    consent: buildConsentRecord(),
  });

  // 5. Seed an isolated working claim if none active
  const claimStore = useClaimStore.getState();
  if (!claimStore.currentClaim) {
    let blank = null;
    try {
      blank = await getClaim('SANDBOX-TEST-01');
    } catch { /* ignore */ }

    if (!blank) {
      const base = createBlankClaim('final', 'comm-goods');
      blank = {
        ...base,
        id: 'SANDBOX-TEST-01',
        reportNo: 'SANDBOX / 2026-27 / 001',
        vehicle: {
          ...base.vehicle,
          registrationNumber: 'MH-12-AB-1234',
          make: 'TATA MOTORS',
          model: 'LPT 1613',
        },
        policy: {
          ...base.policy,
          claimNumber: 'SANDBOX-TEST-01',
          insuredName: 'Sandbox Workshop Test (Pawar Brothers)',
        },
      };
      try {
        await saveClaim(blank);
      } catch (e) {
        console.warn('[Sandbox] saveClaim fallback:', e);
      }
    }
    claimStore.loadClaim(blank);
    useUIStore.getState().setCurrentClaimId(blank.id);
  } else {
    useUIStore.getState().setCurrentClaimId(claimStore.currentClaim.id);
  }
}
