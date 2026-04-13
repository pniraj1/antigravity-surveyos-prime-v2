import { useEffect } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { getAllClaims } from '@/lib/storage/indexeddb';
import { calculateFeeSummary } from '@/lib/calculations/fees';

export function useClaimsLoader() {
  const { setClaimsList } = useClaimStore();

  useEffect(() => {
    async function load() {
      try {
        const claims = await getAllClaims();
        
        // Sort descending by date
        claims.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        const list = claims.map(c => {
          let stage: 'spot' | 'final' | 'reinspection' | 'bill-check' = 'spot';
          // Simple logic to detect stage
          if (c.billCheck?.billTotal > 0) stage = 'bill-check';
          else if (c.reinspection?.parts?.length > 0) stage = 'reinspection';
          else if (c.surveyType === 'final') stage = 'final';

          return {
            id: c.id,
            label: c.vehicle?.registrationNumber || 'Draft Claim',
            updatedAt: c.updatedAt,
            surveyType: c.surveyType,
            reportNo: c.reportNo,
            vehicleNo: c.vehicle?.registrationNumber || '',
            insurerName: c.policy?.insurerName || '',
            insuredName: c.policy?.insuredName || '',
            stage,
            isCompleted: c.isCompleted || false,
            feePaid: c.feeBill?.feePaid || false,
            feeTotal: c.feeBill ? calculateFeeSummary(c.feeBill).grandTotal : 0,
            isActive: c.isActive !== false,
            gDriveFolderId: c.gDriveFolderId ?? null,
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
    
    return () => channel.close();
  }, [setClaimsList]);
}
