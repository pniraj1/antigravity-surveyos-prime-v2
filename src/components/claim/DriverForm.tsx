'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DLRelation, DLVerificationStatus } from '@/types';
import { useFieldEvidence } from '@/hooks/useFieldEvidence';
import { Eye } from 'lucide-react';

const S = () => <span className="ml-1 inline-block w-2 h-2 rounded-full bg-green-500 align-middle" title="Used in Spot Report" />;

function EvidenceDot({ has }: { has: boolean }) {
  if (!has) return null;
  return <span title="Click field to view source document"><Eye size={10} className="inline ml-1 opacity-50 text-blue-400" /></span>;
}

export function DriverDetailsForm() {
  const { currentClaim, updateDriver } = useClaimStore();
  const { triggerField, hasEvidence } = useFieldEvidence();

  if (!currentClaim) return null;
  const d = currentClaim.driver;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-amber">Driver &amp; Licence Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="d-name">Driver Name<S /><EvidenceDot has={hasEvidence('name')} /></Label>
            <Input
              id="d-name"
              value={d?.name || ''}
              onChange={(e) => updateDriver({ name: e.target.value })}
              onFocus={() => triggerField('name')}
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-rel">Relation<S /></Label>
            <select
              id="d-rel"
              value={d?.relationType || 'S/o'}
              onChange={(e) => updateDriver({ relationType: e.target.value as DLRelation })}
              onFocus={() => triggerField('relationType')}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="S/o">S/o (Son of)</option>
              <option value="D/o">D/o (Daughter of)</option>
              <option value="W/o">W/o (Wife of)</option>
            </select>
          </div>

          <div className="space-y-1 xl:col-span-2">
            <Label htmlFor="d-parent">Parent / Spouse Name<S /><EvidenceDot has={hasEvidence('parentName')} /></Label>
            <Input
              id="d-parent"
              value={d?.parentName || ''}
              onChange={(e) => updateDriver({ parentName: e.target.value })}
              onFocus={() => triggerField('parentName')}
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-dlno">Licence No.<S /><EvidenceDot has={hasEvidence('licenceNumber')} /></Label>
            <Input
              id="d-dlno"
              value={d?.licenceNumber || ''}
              onChange={(e) => updateDriver({ licenceNumber: e.target.value.toUpperCase() })}
              onFocus={() => triggerField('licenceNumber')}
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-dob">Date of Birth<S /><EvidenceDot has={hasEvidence('dateOfBirth')} /></Label>
            <Input
              id="d-dob"
              type="date"
              value={d?.dateOfBirth || ''}
              onChange={(e) => updateDriver({ dateOfBirth: e.target.value })}
              onFocus={() => triggerField('dateOfBirth')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-issue">Date of Issue<S /><EvidenceDot has={hasEvidence('dateOfIssue')} /></Label>
            <Input
              id="d-issue"
              type="date"
              value={d?.dateOfIssue || ''}
              onChange={(e) => updateDriver({ dateOfIssue: e.target.value })}
              onFocus={() => triggerField('dateOfIssue')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-auth">Issuing Authority<S /><EvidenceDot has={hasEvidence('issuingAuthority')} /></Label>
            <Input
              id="d-auth"
              value={d?.issuingAuthority || ''}
              onChange={(e) => updateDriver({ issuingAuthority: e.target.value.toUpperCase() })}
              onFocus={() => triggerField('issuingAuthority')}
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-class">Authorized Classes<S /><EvidenceDot has={hasEvidence('vehicleClasses')} /></Label>
            <Input
              id="d-class"
              value={d?.vehicleClasses || ''}
              onChange={(e) => updateDriver({ vehicleClasses: e.target.value })}
              onFocus={() => triggerField('vehicleClasses')}
              placeholder="e.g. LMV-NT, MCWG"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-validnt">Valid Non-Transport (NT)<S /><EvidenceDot has={hasEvidence('validityNonTransport')} /></Label>
            <Input
              id="d-validnt"
              type="date"
              value={d?.validityNonTransport || ''}
              onChange={(e) => updateDriver({ validityNonTransport: e.target.value })}
              onFocus={() => triggerField('validityNonTransport')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-validt">Valid Transport (T)<S /><EvidenceDot has={hasEvidence('validityTransport')} /></Label>
            <Input
              id="d-validt"
              type="date"
              value={d?.validityTransport || ''}
              onChange={(e) => updateDriver({ validityTransport: e.target.value })}
              onFocus={() => triggerField('validityTransport')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-badge">Badge Number</Label>
            <Input
              id="d-badge"
              value={d?.badgeNumber || ''}
              onChange={(e) => updateDriver({ badgeNumber: e.target.value.toUpperCase() })}
              placeholder="e.g. 123456"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-verifdate">Verification Date</Label>
            <Input
              id="d-verifdate"
              type="date"
              value={d?.verificationDate || ''}
              onChange={(e) => updateDriver({ verificationDate: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-verif">Verification Status<S /></Label>
            <select
              id="d-verif"
              value={d?.verificationStatus || 'photocopy'}
              onChange={(e) => updateDriver({ verificationStatus: e.target.value as DLVerificationStatus })}
              className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold
                ${d?.verificationStatus === 'verified' ? 'text-success' : d?.verificationStatus === 'not-available' ? 'text-danger' : 'text-amber'}
              `}
            >
              <option value="verified">Verified (Online)</option>
              <option value="photocopy">From Photocopy</option>
              <option value="not-available">Not Available</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
