'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PolicyDetailsForm() {
  const { currentClaim, updatePolicy } = useClaimStore();

  if (!currentClaim) return null;
  const p = currentClaim.policy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-teal">Policy & Insured Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="p-ins">Insurer Name</Label>
            <Input
              id="p-ins"
              value={p?.insurerName || ''}
              onChange={(e) => updatePolicy({ insurerName: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-polno">Policy No.</Label>
            <Input
              id="p-polno"
              value={p?.policyNumber || ''}
              onChange={(e) => updatePolicy({ policyNumber: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-claimno">Claim No.</Label>
            <Input
              id="p-claimno"
              value={p?.claimNumber || ''}
              onChange={(e) => updatePolicy({ claimNumber: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-type">Policy Type</Label>
            <select
              id="p-type"
              value={p?.policyType || ''}
              onChange={(e) => updatePolicy({ policyType: e.target.value })}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Type</option>
              {['Comprehensive', 'Third Party', 'Standalone OD', 'Package', 'Commercial Comprehensive', 'Commercial TP'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-from">Valid From</Label>
            <Input
              id="p-from"
              type="date"
              value={p?.periodFrom || ''}
              onChange={(e) => updatePolicy({ periodFrom: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-to">Valid To</Label>
            <Input
              id="p-to"
              type="date"
              value={p?.periodTo || ''}
              onChange={(e) => updatePolicy({ periodTo: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-idv">Insured Declared Value (IDV)</Label>
            <Input
              id="p-idv"
              type="number"
              value={p?.idv || ''}
              onChange={(e) => updatePolicy({ idv: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-name">Insured Name</Label>
            <Input
              id="p-name"
              value={p?.insuredName || ''}
              onChange={(e) => updatePolicy({ insuredName: e.target.value })}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="p-addr">Insured Address</Label>
            <Input
              id="p-addr"
              value={p?.insuredAddress || ''}
              onChange={(e) => updatePolicy({ insuredAddress: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-mob">Mobile</Label>
            <Input
              id="p-mob"
              value={p?.insuredMobile || ''}
              onChange={(e) => updatePolicy({ insuredMobile: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-office">Issuing Office</Label>
            <Input
              id="p-office"
              value={p?.policyIssuingOffice || ''}
              onChange={(e) => updatePolicy({ policyIssuingOffice: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
