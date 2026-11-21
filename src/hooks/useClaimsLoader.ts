import { useEffect } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useAuthStore } from '@/stores/auth-store';
import { getAllClaims } from '@/lib/storage/indexeddb';
import { calculateFeeSummary } from '@/lib/calculations/fees';
import { claimSurveyDate } from '@/lib/claims/survey-date';

export function useClaimsLoader() {
  const { setClaimsList } = useClaimStore();
  const user = useAuthStore(s => s.user);
  const activeWorkspaceUid = useAuthStore(s => s.activeWorkspaceUid);

  useEffect(() => {
    // Wait until Firebase auth completes and initUserDB(uid) has been called.
    // useAuth.ts calls setUser() only AFTER initUserDB resolves, so a non-null
    // user here guarantees the IndexedDB connection is ready.
    if (!user) return;

    async function load() {
      try {
        const claims = await getAllClaims();
        
        // Sort descending by date
        claims.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        const list = claims.map(c => {
          let stage: 'spot' | 'final' | 'reinspection' | 'bill-check' | 'valuation' = 'spot';
          // Simple logic to detect stage
          if (c.surveyType === 'valuation') stage = 'valuation';
          else if (c.billCheck?.billTotal > 0) stage = 'bill-check';
          else if (c.reinspection?.parts?.length > 0) stage = 'reinspection';
          else if (c.surveyType === 'final') stage = 'final';

          return {
            id: c.id,
            label: c.vehicle?.registrationNumber || 'Draft Claim',
            updatedAt: c.updatedAt,
            surveyDate: claimSurveyDate(c),
            surveyType: c.surveyType,
            reportNo: c.reportNo,
            vehicleNo: c.vehicle?.registrationNumber || '',
            insurerName: c.policy?.insurerName || '',
            insuredName: c.policy?.insuredName || '',
            stage,
            isCompleted: c.isCompleted || !!c.completedAt,
            feePaid: c.feeBill?.feePaid || false,
            feeTotal: c.feeBill ? calculateFeeSummary(c.feeBill).grandTotal : 0,
            isActive: c.isActive !== false,
            gDriveFolderId: c.gDriveFolderId ?? null,
            hasDocuments:
              Object.keys(c.documents ?? {}).length > 0 ||
              Object.keys(c.extractedData ?? {}).length > 0,
            claimNo: c.policy?.claimNumber || '',
            billDate: c.feeBill?.billDate || '',
            paymentStatus: c.feeBill?.paymentStatus || (c.feeBill?.feePaid ? 'paid' : 'unpaid'),
            amountReceived: c.feeBill?.amountReceived,
            tdsDeducted: c.feeBill?.tdsDeducted,
            utrNumber: c.feeBill?.utrNumber,
            paymentDate: c.feeBill?.paymentDate,
          };
        });

        setClaimsList(list);
      } catch (err) {
        console.error('[useClaimsLoader] Failed to load claims:', err);
      }
    }

    load();
    
    // Set up a broadcast channel to listen for saves in other tabs (optional but good)
    const channel = new BroadcastChannel('surveyos_claims_sync');
    channel.onmessage = (e) => {
      if (e.data === 'CLAIMS_UPDATED') {
        load();
      }
    };

    // Also listen for same-tab updates (e.g. cloud pull completion)
    const handleClaimsUpdated = () => {
      load();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('surveyos_claims_updated', handleClaimsUpdated);
    }
    
    return () => {
      channel.close();
      if (typeof window !== 'undefined') {
        window.removeEventListener('surveyos_claims_updated', handleClaimsUpdated);
      }
    };
  }, [setClaimsList, user, activeWorkspaceUid]);
}
