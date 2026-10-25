'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DLRelation, DLVerificationStatus } from '@/types';
import { useFieldEvidence } from '@/hooks/useFieldEvidence';
import { ValidityAdvisory } from '@/components/claim/ValidityAdvisory';
import { checkValidityOnAccidentDate } from '@/lib/claims/validity-advisory';
import { cn } from '@/lib/utils';
import { DocSection, EvidenceDot, req, selectCls } from '@/components/claim/form-bits';
import { AlertTriangle } from 'lucide-react';

export function DriverDetailsForm({ scan }: { scan?: React.ReactNode }) {
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

  const dates = (
    <>
      <div className="space-y-1">
        <Label htmlFor="d-dob">Date of Birth<EvidenceDot has={hasEvidence('dateOfBirth')} /></Label>
        <Input
          id="d-dob"
          type="date"
          value={d?.dateOfBirth || ''}
          onChange={(e) => updateDriver({ dateOfBirth: e.target.value })}
          onFocus={() => triggerField('dateOfBirth')}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="d-issue">Date of Issue<EvidenceDot has={hasEvidence('dateOfIssue')} /></Label>
        <Input
          id="d-issue"
          type="date"
          value={d?.dateOfIssue || ''}
          onChange={(e) => updateDriver({ dateOfIssue: e.target.value })}
          onFocus={() => triggerField('dateOfIssue')}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="d-validnt">Valid Non-Transport (NT)<EvidenceDot has={hasEvidence('validityNonTransport')} /></Label>
        <Input
          id="d-validnt"
          type="date"
          value={d?.validityNonTransport || ''}
          onChange={(e) => updateDriver({ validityNonTransport: e.target.value })}
          onFocus={() => triggerField('validityNonTransport')}
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
        <Label htmlFor="d-validt">Valid Transport (T)<EvidenceDot has={hasEvidence('validityTransport')} /></Label>
        <Input
          id="d-validt"
          type="date"
          value={d?.validityTransport || ''}
          onChange={(e) => updateDriver({ validityTransport: e.target.value })}
          onFocus={() => triggerField('validityTransport')}
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
        <Label htmlFor="d-verifdate">Verification Date</Label>
        <Input
          id="d-verifdate"
          type="date"
          value={d?.verificationDate || ''}
          onChange={(e) => updateDriver({ verificationDate: e.target.value })}
        />
      </div>
    </>
  );

  // ── DL Expiry Warning Banner ──────────────────────────────────────────
  const footer = anyExpired && (
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
  );

  return (
    <DocSection title="Driving Licence" action={scan} dates={dates} footer={footer}>
      <div className="space-y-1">
        <Label htmlFor="d-name">Driver Name<EvidenceDot has={hasEvidence('name')} /></Label>
        <Input
          id="d-name"
          value={d?.name || ''}
          onChange={(e) => updateDriver({ name: e.target.value })}
          onFocus={() => triggerField('name')}
          className={`uppercase ${req(d?.name)}`}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="d-rel">Relation</Label>
        <select
          id="d-rel"
          value={d?.relationType || 'S/o'}
          onChange={(e) => updateDriver({ relationType: e.target.value as DLRelation })}
          onFocus={() => triggerField('relationType')}
          className={selectCls}
        >
          <option value="S/o">S/o (Son of)</option>
          <option value="D/o">D/o (Daughter of)</option>
          <option value="W/o">W/o (Wife of)</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="d-parent">Parent / Spouse Name<EvidenceDot has={hasEvidence('parentName')} /></Label>
        <Input
          id="d-parent"
          value={d?.parentName || ''}
          onChange={(e) => updateDriver({ parentName: e.target.value })}
          onFocus={() => triggerField('parentName')}
          className="uppercase"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="d-dlno">Licence No.<EvidenceDot has={hasEvidence('licenceNumber')} /></Label>
        <Input
          id="d-dlno"
          value={d?.licenceNumber || ''}
          onChange={(e) => updateDriver({ licenceNumber: e.target.value.toUpperCase() })}
          onFocus={() => triggerField('licenceNumber')}
          className={`uppercase ${req(d?.licenceNumber)}`}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="d-auth">Issuing Authority<EvidenceDot has={hasEvidence('issuingAuthority')} /></Label>
        <Input
          id="d-auth"
          value={d?.issuingAuthority || ''}
          onChange={(e) => updateDriver({ issuingAuthority: e.target.value.toUpperCase() })}
          onFocus={() => triggerField('issuingAuthority')}
          className="uppercase"
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
        <Label htmlFor="d-class">Authorized Classes<EvidenceDot has={hasEvidence('vehicleClasses')} /></Label>
        <Input
          id="d-class"
          value={d?.vehicleClasses || ''}
          onChange={(e) => updateDriver({ vehicleClasses: e.target.value })}
          onFocus={() => triggerField('vehicleClasses')}
          placeholder="e.g. LMV-NT, MCWG"
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
        <Label htmlFor="d-hazard">Hazardous Goods Endorsement</Label>
        <select
          id="d-hazard"
          value={d?.hazardousEndorsement || ''}
          onChange={(e) => updateDriver({ hazardousEndorsement: e.target.value as 'yes' | 'no' | '' })}
          className={selectCls}
        >
          <option value="">Not applicable</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      {d?.hazardousEndorsement === 'yes' && (
        <div className="space-y-1 @md:col-span-2">
          <Label htmlFor="d-hazard-note">Hazardous Endorsement Note</Label>
          <Input
            id="d-hazard-note"
            value={d?.hazardousEndorsementNote || ''}
            onChange={(e) => updateDriver({ hazardousEndorsementNote: e.target.value })}
            placeholder="e.g. valid up to 2027, endorsement code visible"
          />
        </div>
      )}

      {/* Verdicts last, after the evidence they rest on. */}
      <div className="space-y-1">
        <Label htmlFor="d-verif">Verification Status</Label>
        <select
          id="d-verif"
          value={d?.verificationStatus || 'photocopy'}
          onChange={(e) => updateDriver({ verificationStatus: e.target.value as DLVerificationStatus })}
          className={cn(selectCls, 'font-medium',
            d?.verificationStatus === 'verified' ? 'text-success' : d?.verificationStatus === 'not-available' ? 'text-danger' : 'text-amber')}
        >
          <option value="verified">Verified (Online)</option>
          <option value="photocopy">From Photocopy</option>
          <option value="not-available">Not Available</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="d-authorised">Authorised to Drive This Vehicle?</Label>
        <select
          id="d-authorised"
          className={selectCls}
          value={d?.authorisedToDrive || ''}
          onChange={(e) => updateDriver({ authorisedToDrive: e.target.value })}
        >
          <option value="">—</option>
          <option value="YES">Yes</option>
          <option value="NO">No</option>
        </select>
      </div>
    </DocSection>
  );
}
