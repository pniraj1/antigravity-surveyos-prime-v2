'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFieldEvidence } from '@/hooks/useFieldEvidence';
import { DocSection, EvidenceDot, req } from '@/components/claim/form-bits';

/**
 * Where and when the surveyor inspected, plus what they saw on the vehicle.
 * Survey and workshop are stored on `accident`; odometer and condition on
 * `vehicle`; the spot's actual survey time on `spotDetails`.
 */
export function SurveyForm() {
  const { currentClaim, updateAccident, updateVehicle, updateSpotDetails } = useClaimStore();
  const { triggerField, hasEvidence } = useFieldEvidence();

  if (!currentClaim) return null;
  const a = currentClaim.accident || {} as any;
  const v = currentClaim.vehicle;
  const type = currentClaim.surveyType;

  const dates = type === 'valuation' ? undefined : (
    <>
      <div className="space-y-1">
        <Label htmlFor="a-sdate">Date of Survey</Label>
        <Input
          id="a-sdate"
          type="date"
          value={a?.dateOfSurvey || ''}
          onChange={(e) => updateAccident({ dateOfSurvey: e.target.value })}
          className={req(a?.dateOfSurvey)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="a-stime">Time of Survey</Label>
        <Input
          id="a-stime"
          type="time"
          value={a?.timeOfSurvey || ''}
          onChange={(e) => updateAccident({ timeOfSurvey: e.target.value })}
        />
      </div>

      {type === 'spot' && (
        <div className="space-y-1">
          <Label htmlFor="sp-datetime">Survey Datetime (Actual)</Label>
          <Input
            id="sp-datetime"
            type="datetime-local"
            value={currentClaim.spotDetails.surveyDatetime || ''}
            onChange={(e) => updateSpotDetails({ surveyDatetime: e.target.value })}
          />
        </div>
      )}
    </>
  );

  return (
    <DocSection title={type === 'valuation' ? 'Inspection' : 'Survey & Workshop'} dates={dates}>
      {type !== 'valuation' && (
        <div className="space-y-1 col-span-full">
          <Label htmlFor="a-splace">Place of Survey (Workshop Name)</Label>
          <Input
            id="a-splace"
            value={a?.placeOfSurvey || ''}
            onChange={(e) => updateAccident({ placeOfSurvey: e.target.value })}
            className={req(a?.placeOfSurvey)}
          />
        </div>
      )}

      {type === 'final' && (
        <>
          <div className="space-y-1 @md:col-span-2">
            <Label htmlFor="w-name">Workshop Name</Label>
            <Input
              id="w-name"
              value={a?.workshopName || ''}
              onChange={(e) => updateAccident({ workshopName: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="w-phone">Workshop Phone</Label>
            <Input
              id="w-phone"
              value={a?.workshopPhone || ''}
              onChange={(e) => updateAccident({ workshopPhone: e.target.value })}
            />
          </div>
          <div className="space-y-1 @md:col-span-2">
            <Label htmlFor="w-email">Workshop Email</Label>
            <Input
              id="w-email"
              type="email"
              value={a?.workshopEmail || ''}
              onChange={(e) => updateAccident({ workshopEmail: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="w-fax">Workshop Fax</Label>
            <Input
              id="w-fax"
              value={a?.workshopFax || ''}
              onChange={(e) => updateAccident({ workshopFax: e.target.value })}
            />
          </div>
          <div className="space-y-1 col-span-full">
            <Label htmlFor="w-addr">Workshop Address</Label>
            <Input
              id="w-addr"
              value={a?.workshopAddress || ''}
              onChange={(e) => updateAccident({ workshopAddress: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label htmlFor="v-odo">Odometer<EvidenceDot has={hasEvidence('odometer')} /></Label>
        <Input
          id="v-odo"
          value={v?.odometer || ''}
          onChange={(e) => updateVehicle({ odometer: e.target.value })}
          onFocus={() => triggerField('odometer')}
        />
      </div>

      <div className="space-y-1 @md:col-span-2">
        <Label htmlFor="v-cond">Pre-Accident Condition</Label>
        <Input
          id="v-cond"
          value={v?.preAccidentCondition || ''}
          onChange={(e) => updateVehicle({ preAccidentCondition: e.target.value })}
        />
      </div>
    </DocSection>
  );
}
