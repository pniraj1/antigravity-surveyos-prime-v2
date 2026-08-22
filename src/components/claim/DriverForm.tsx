'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DLRelation, DLVerificationStatus } from '@/types';
import { useFieldEvidence } from '@/hooks/useFieldEvidence';
import { ValidityAdvisory } from '@/components/claim/ValidityAdvisory';
import { checkValidityOnAccidentDate } from '@/lib/claims/validity-advisory';
import { Eye, AlertTriangle } from 'lucide-react';

const S = () => <span className="ml-1 inline-block w-2 h-2 rounded-full bg-success align-middle" title="Used in Spot Report" />;

function EvidenceDot({ has }: { has: boolean }) {
  if (!has) return null;
  return <span title="Click field to view source document"><Eye size={10} className="inline ml-1 opacity-50 text-primary" /></span>;
}

const r = (v: any) => !v ? 'border-danger' : '';

export function DriverDetailsForm() {
  const { currentClaim, updateDriver } = useClaimStore();
  const { triggerField, hasEvidence } = useFieldEvidence();

  if (!currentClaim) return null;
  const d = currentClaim.driver;

  // ── DL expiry, judged on the ACCIDENT DATE ──────────────────────────────
  // This used to compare against `today`, which is the wrong reference for a
  // claim: a licence that had lapsed at the time of the accident but has since
  // been renewed read as perfectly valid. Surfaced as advice, never a verdict
  // — see ValidityAdvisory.
  const accidentDate = currentClaim.accident?.dateAndTime;
  const ntExpired = !!checkValidityOnAccidentDate(d?.validityNonTransport, accidentDate);
  const tExpired  = !!checkValidityOnAccidentDate(d?.validityTransport, accidentDate);
  const anyExpired = ntExpired || tExpired;

  const expiredLabels = [
    ntExpired ? 'Non-Transport (NT)' : null,
    tExpired  ? 'Transport (T)'      : null,
  ].filter(Boolean).join(' & ');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-amber">Driver &amp; Licence Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="d-name">Driver Name<S /><EvidenceDot has={hasEvidence('name')} /></Label>
            <Input
              id="d-name"
              value={d?.name || ''}
              onChange={(e) => updateDriver({ name: e.target.value })}
              onFocus={() => triggerField('name')}
              className={`uppercase ${r(d?.name)}`}
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
              className={`uppercase ${r(d?.parentName)}`}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-dlno">Licence No.<S /><EvidenceDot has={hasEvidence('licenceNumber')} /></Label>
            <Input
              id="d-dlno"
              value={d?.licenceNumber || ''}
              onChange={(e) => updateDriver({ licenceNumber: e.target.value.toUpperCase() })}
              onFocus={() => triggerField('licenceNumber')}
              className={`uppercase ${r(d?.licenceNumber)}`}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-dltype">Licence Type</Label>
            <Input
              id="d-dltype"
              value={d?.licenceType || ''}
              onChange={(e) => updateDriver({ licenceType: e.target.value.toUpperCase() })}
              placeholder="e.g. MCWG, LMV-TR"
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
              className={r(d?.dateOfBirth)}
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
              className={r(d?.dateOfIssue)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-auth">Issuing Authority<S /><EvidenceDot has={hasEvidence('issuingAuthority')} /></Label>
            <Input
              id="d-auth"
              value={d?.issuingAuthority || ''}
              onChange={(e) => updateDriver({ issuingAuthority: e.target.value.toUpperCase() })}
              onFocus={() => triggerField('issuingAuthority')}
              className={`uppercase ${r(d?.issuingAuthority)}`}
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
              className={r(d?.vehicleClasses)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-authorised">Authorised to Drive This Vehicle?</Label>
            <select
              id="d-authorised"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={d?.authorisedToDrive || ''}
              onChange={(e) => updateDriver({ authorisedToDrive: e.target.value })}
            >
              <option value="">—</option>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-validnt">Valid Non-Transport (NT)<S /><EvidenceDot has={hasEvidence('validityNonTransport')} /></Label>
            <Input
              id="d-validnt"
              type="date"
              value={d?.validityNonTransport || ''}
              onChange={(e) => updateDriver({ validityNonTransport: e.target.value })}
              onFocus={() => triggerField('validityNonTransport')}
              className={r(d?.validityNonTransport)}
            />
            <ValidityAdvisory
              id="dl-non-transport"
              label="Non-transport validity"
              expiryDate={d?.validityNonTransport}
              existingRemarks={d?.invalidRemarks ?? ''}
              onRecord={(merged) => updateDriver({ invalidRemarks: merged })}
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
              className={r(d?.validityTransport)}
            />
            <ValidityAdvisory
              id="dl-transport"
              label="Transport validity"
              expiryDate={d?.validityTransport}
              existingRemarks={d?.invalidRemarks ?? ''}
              onRecord={(merged) => updateDriver({ invalidRemarks: merged })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-badge">Badge Number</Label>
            <Input
              id="d-badge"
              value={d?.badgeNumber || ''}
              onChange={(e) => updateDriver({ badgeNumber: e.target.value.toUpperCase() })}
              placeholder="e.g. 123456"
              className={r(d?.badgeNumber)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-hazard">Hazardous Goods Endorsement</Label>
            <select
              id="d-hazard"
              value={d?.hazardousEndorsement || ''}
              onChange={(e) => updateDriver({ hazardousEndorsement: e.target.value as 'yes' | 'no' | '' })}
              className={`w-full h-9 rounded-md border px-3 text-sm ${r(d?.hazardousEndorsement)}`}
            >
              <option value="">Not applicable</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          {d?.hazardousEndorsement === 'yes' && (
            <div className="space-y-1">
              <Label htmlFor="d-hazard-note">Hazardous Endorsement Note</Label>
              <Input
                id="d-hazard-note"
                value={d?.hazardousEndorsementNote || ''}
                onChange={(e) => updateDriver({ hazardousEndorsementNote: e.target.value })}
                placeholder="e.g. valid up to 2027, endorsement code visible"
                className={r(d?.hazardousEndorsementNote)}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="d-verifdate">Verification Date</Label>
            <Input
              id="d-verifdate"
              type="date"
              value={d?.verificationDate || ''}
              onChange={(e) => updateDriver({ verificationDate: e.target.value })}
              className={r(d?.verificationDate)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="d-verif">Verification Status<S /></Label>
            <select
              id="d-verif"
              value={d?.verificationStatus || 'photocopy'}
              onChange={(e) => updateDriver({ verificationStatus: e.target.value as DLVerificationStatus })}
              className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-medium
                ${d?.verificationStatus === 'verified' ? 'text-success' : d?.verificationStatus === 'not-available' ? 'text-danger' : 'text-amber'}
              `}
            >
              <option value="verified">Verified (Online)</option>
              <option value="photocopy">From Photocopy</option>
              <option value="not-available">Not Available</option>
            </select>
          </div>
        </div>

        {/* ── DL Expiry Warning Banner ──────────────────────────────────────── */}
        {anyExpired && (
          <div
            className="mt-4 flex items-start gap-3 rounded-lg px-4 py-3"
            style={{
              background: 'var(--color-status-danger-tint)',
              border: '1px solid var(--color-status-danger)',
            }}
          >
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-danger" />
            <div>
              <p className="text-sm font-medium text-danger">
                Driving Licence Validity Expired — {expiredLabels}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This is a notice for the surveyor only. The expiry remark will{' '}
                <strong>not</strong> appear in the official report unless you change the{' '}
                <strong>Verification Status</strong> above to reflect this finding.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
