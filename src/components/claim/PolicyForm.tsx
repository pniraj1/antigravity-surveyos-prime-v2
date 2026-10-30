'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFieldEvidence } from '@/hooks/useFieldEvidence';
import { cn } from '@/lib/utils';
import { DocSection, EvidenceDot, req, selectCls } from '@/components/claim/form-bits';

export function PolicyDetailsForm({ scan }: { scan?: React.ReactNode }) {
  const { currentClaim, updatePolicy, updateVehicle } = useClaimStore();
  const { triggerField, hasEvidence } = useFieldEvidence();

  if (!currentClaim) return null;
  const p = currentClaim.policy;

  const dates = (
    <>
      <div className="space-y-1">
        <Label htmlFor="p-from">Valid From<EvidenceDot has={hasEvidence('periodFrom')} /></Label>
        <Input
          id="p-from"
          type="date"
          value={p?.periodFrom || ''}
          onChange={(e) => updatePolicy({ periodFrom: e.target.value })}
          onFocus={() => triggerField('periodFrom')}
          className={req(p?.periodFrom)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="p-to">Valid To<EvidenceDot has={hasEvidence('periodTo')} /></Label>
        <Input
          id="p-to"
          type="date"
          value={p?.periodTo || ''}
          onChange={(e) => updatePolicy({ periodTo: e.target.value })}
          onFocus={() => triggerField('periodTo')}
          className={req(p?.periodTo)}
        />
      </div>
    </>
  );

  return (
    <DocSection title="Policy & Insured" action={scan} dates={dates}>
      <div className="space-y-1">
        <Label htmlFor="p-polno">Policy No.<EvidenceDot has={hasEvidence('policyNumber')} /></Label>
        <Input
          id="p-polno"
          value={p?.policyNumber || ''}
          onChange={(e) => updatePolicy({ policyNumber: e.target.value })}
          onFocus={() => triggerField('policyNumber')}
          className={req(p?.policyNumber)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="p-type">Policy Type<EvidenceDot has={hasEvidence('policyType')} /></Label>
        <select
          id="p-type"
          value={p?.policyType || ''}
          onChange={(e) => updatePolicy({ policyType: e.target.value })}
          onFocus={() => triggerField('policyType')}
          className={cn(selectCls, req(p?.policyType))}
        >
          <option value="">Select Type</option>
          {['Comprehensive', 'Third Party', 'Standalone OD', 'Package', 'Commercial Comprehensive', 'Commercial TP'].map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="p-idv">Insured Declared Value (IDV)<EvidenceDot has={hasEvidence('idv')} /></Label>
        <Input
          id="p-idv"
          type="number"
          value={p?.idv || ''}
          onChange={(e) => updatePolicy({ idv: e.target.value })}
          onFocus={() => triggerField('idv')}
          placeholder="0.00"
          className={req(p?.idv)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="p-office">Issuing Office<EvidenceDot has={hasEvidence('policyIssuingOffice')} /></Label>
        <Input
          id="p-office"
          value={p?.policyIssuingOffice || ''}
          onChange={(e) => updatePolicy({ policyIssuingOffice: e.target.value })}
          onFocus={() => triggerField('policyIssuingOffice')}
        />
      </div>

      <div className="space-y-1 @md:col-span-2">
        <Label htmlFor="p-hpa">Hypothecation (HPA)<EvidenceDot has={hasEvidence('hpaWith')} /></Label>
        <Input
          id="p-hpa"
          value={p?.hpaWith || currentClaim.vehicle?.hypothecation || currentClaim.vehicle?.rcEndorsement || ''}
          onChange={(e) => {
            updatePolicy({ hpaWith: e.target.value });
            updateVehicle({ hypothecation: e.target.value.toUpperCase(), rcEndorsement: e.target.value.toUpperCase() });
          }}
          onFocus={() => triggerField('hpaWith')}
          placeholder="Financier name, or NIL"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="p-name">Insured Name<EvidenceDot has={hasEvidence('insuredName')} /></Label>
        <Input
          id="p-name"
          value={p?.insuredName || ''}
          onChange={(e) => updatePolicy({ insuredName: e.target.value })}
          onFocus={() => triggerField('insuredName')}
          className={req(p?.insuredName)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="p-mob">Mobile<EvidenceDot has={hasEvidence('insuredMobile')} /></Label>
        <Input
          id="p-mob"
          value={p?.insuredMobile || ''}
          onChange={(e) => updatePolicy({ insuredMobile: e.target.value })}
          onFocus={() => triggerField('insuredMobile')}
        />
      </div>

      <div className="space-y-1 col-span-full">
        <Label htmlFor="p-addr">Insured Address<EvidenceDot has={hasEvidence('insuredAddress')} /></Label>
        <Input
          id="p-addr"
          value={p?.insuredAddress || ''}
          onChange={(e) => updatePolicy({ insuredAddress: e.target.value })}
          onFocus={() => triggerField('insuredAddress')}
        />
      </div>
    </DocSection>
  );
}
