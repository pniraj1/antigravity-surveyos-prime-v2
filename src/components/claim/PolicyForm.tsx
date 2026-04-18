'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFieldEvidence } from '@/hooks/useFieldEvidence';
import { Eye } from 'lucide-react';

const S = () => <span className="ml-1 inline-block w-2 h-2 rounded-full bg-green-500 align-middle" title="Used in Spot Report" />;

function EvidenceDot({ has }: { has: boolean }) {
  if (!has) return null;
  return <span title="Click field to view source document"><Eye size={10} className="inline ml-1 opacity-50 text-blue-400" /></span>;
}

export function PolicyDetailsForm() {
  const { currentClaim, updatePolicy } = useClaimStore();
  const { triggerField, hasEvidence } = useFieldEvidence();

  if (!currentClaim) return null;
  const p = currentClaim.policy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-teal">Policy &amp; Insured Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="p-ins">Insurer Name<S /><EvidenceDot has={hasEvidence('insurerName')} /></Label>
            <Input
              id="p-ins"
              value={p?.insurerName || ''}
              onChange={(e) => updatePolicy({ insurerName: e.target.value })}
              onFocus={() => triggerField('insurerName')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-polno">Policy No.<S /><EvidenceDot has={hasEvidence('policyNumber')} /></Label>
            <Input
              id="p-polno"
              value={p?.policyNumber || ''}
              onChange={(e) => updatePolicy({ policyNumber: e.target.value })}
              onFocus={() => triggerField('policyNumber')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-claimno">Claim No.<S /><EvidenceDot has={hasEvidence('claimNumber')} /></Label>
            <Input
              id="p-claimno"
              value={p?.claimNumber || ''}
              onChange={(e) => updatePolicy({ claimNumber: e.target.value })}
              onFocus={() => triggerField('claimNumber')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-type">Policy Type<S /><EvidenceDot has={hasEvidence('policyType')} /></Label>
            <select
              id="p-type"
              value={p?.policyType || ''}
              onChange={(e) => updatePolicy({ policyType: e.target.value })}
              onFocus={() => triggerField('policyType')}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Type</option>
              {['Comprehensive', 'Third Party', 'Standalone OD', 'Package', 'Commercial Comprehensive', 'Commercial TP'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-from">Valid From<S /><EvidenceDot has={hasEvidence('periodFrom')} /></Label>
            <Input
              id="p-from"
              type="date"
              value={p?.periodFrom || ''}
              onChange={(e) => updatePolicy({ periodFrom: e.target.value })}
              onFocus={() => triggerField('periodFrom')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-to">Valid To<S /><EvidenceDot has={hasEvidence('periodTo')} /></Label>
            <Input
              id="p-to"
              type="date"
              value={p?.periodTo || ''}
              onChange={(e) => updatePolicy({ periodTo: e.target.value })}
              onFocus={() => triggerField('periodTo')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-idv">Insured Declared Value (IDV)<S /><EvidenceDot has={hasEvidence('idv')} /></Label>
            <Input
              id="p-idv"
              type="number"
              value={p?.idv || ''}
              onChange={(e) => updatePolicy({ idv: e.target.value })}
              onFocus={() => triggerField('idv')}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-name">Insured Name<S /><EvidenceDot has={hasEvidence('insuredName')} /></Label>
            <Input
              id="p-name"
              value={p?.insuredName || ''}
              onChange={(e) => updatePolicy({ insuredName: e.target.value })}
              onFocus={() => triggerField('insuredName')}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="p-addr">Insured Address<S /><EvidenceDot has={hasEvidence('insuredAddress')} /></Label>
            <Input
              id="p-addr"
              value={p?.insuredAddress || ''}
              onChange={(e) => updatePolicy({ insuredAddress: e.target.value })}
              onFocus={() => triggerField('insuredAddress')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-mob">Mobile<S /><EvidenceDot has={hasEvidence('insuredMobile')} /></Label>
            <Input
              id="p-mob"
              value={p?.insuredMobile || ''}
              onChange={(e) => updatePolicy({ insuredMobile: e.target.value })}
              onFocus={() => triggerField('insuredMobile')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-office">Issuing Office<S /><EvidenceDot has={hasEvidence('policyIssuingOffice')} /></Label>
            <Input
              id="p-office"
              value={p?.policyIssuingOffice || ''}
              onChange={(e) => updatePolicy({ policyIssuingOffice: e.target.value })}
              onFocus={() => triggerField('policyIssuingOffice')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-appoint">
              Appointing Office<S />
              {/* NOTE: This field is manual-only — no AI evidence dot shown */}
            </Label>
            <Input
              id="p-appoint"
              value={p?.appointingOffice || ''}
              onChange={(e) => updatePolicy({ appointingOffice: e.target.value })}
              placeholder="Enter manually"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-hpa">Hypothecation (HPA)<S /><EvidenceDot has={hasEvidence('hpaWith')} /></Label>
            <Input
              id="p-hpa"
              value={p?.hpaWith || p?.hpa || ''}
              onChange={(e) => updatePolicy({ hpaWith: e.target.value, hpa: e.target.value })}
              onFocus={() => triggerField('hpaWith')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
