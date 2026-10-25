'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFieldEvidence } from '@/hooks/useFieldEvidence';
import { DocSection, EvidenceDot, req } from '@/components/claim/form-bits';

/** Who appointed the surveyor, and when. Stored on `policy`, `accident` and `spotDetails`. */
export function AssignmentForm() {
  const { currentClaim, updatePolicy, updateAccident, updateSpotDetails } = useClaimStore();
  const { triggerField, hasEvidence } = useFieldEvidence();

  if (!currentClaim) return null;
  const p = currentClaim.policy;
  const isSpot = currentClaim.surveyType === 'spot';

  const dates = isSpot ? (
    <>
      <div className="space-y-1">
        <Label htmlFor="as-allot">Date of Allotment</Label>
        <Input
          id="as-allot"
          type="date"
          value={currentClaim.spotDetails.allotmentDate || ''}
          onChange={(e) => updateSpotDetails({ allotmentDate: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="as-report">Date of Report</Label>
        <Input
          id="as-report"
          type="date"
          value={currentClaim.spotDetails.reportDate || ''}
          onChange={(e) => updateSpotDetails({ reportDate: e.target.value })}
        />
      </div>
    </>
  ) : currentClaim.surveyType === 'final' ? (
    <div className="space-y-1">
      <Label htmlFor="as-app-date">Survey Appointment Date</Label>
      <Input
        id="as-app-date"
        type="date"
        value={currentClaim.accident?.appointmentDate || ''}
        onChange={(e) => updateAccident({ appointmentDate: e.target.value })}
      />
    </div>
  ) : undefined;

  return (
    <DocSection title="Assignment" dates={dates}>
      <div className="space-y-1">
        <Label htmlFor="p-ins">Insurer Name<EvidenceDot has={hasEvidence('insurerName')} /></Label>
        <Input
          id="p-ins"
          value={p?.insurerName || ''}
          onChange={(e) => updatePolicy({ insurerName: e.target.value })}
          onFocus={() => triggerField('insurerName')}
          className={req(p?.insurerName)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="p-appoint">Appointing Office</Label>
        <Input
          id="p-appoint"
          value={p?.appointingOffice || ''}
          onChange={(e) => updatePolicy({ appointingOffice: e.target.value })}
          placeholder="Enter manually"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="p-claimno">Claim No.<EvidenceDot has={hasEvidence('claimNumber')} /></Label>
        <Input
          id="p-claimno"
          value={p?.claimNumber || ''}
          onChange={(e) => updatePolicy({ claimNumber: e.target.value })}
          onFocus={() => triggerField('claimNumber')}
          className={req(p?.claimNumber)}
        />
      </div>
    </DocSection>
  );
}
