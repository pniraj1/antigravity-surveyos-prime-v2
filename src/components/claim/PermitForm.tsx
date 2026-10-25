'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFieldEvidence } from '@/hooks/useFieldEvidence';
import { DocSection, EvidenceDot, selectCls } from '@/components/claim/form-bits';

/**
 * Permit, authorisation and fitness papers for goods and passenger vehicles.
 * Permit fields live on `spotDetails` for historical reasons but every report
 * prints them; fitness and route live on `vehicle`.
 */
export function PermitForm() {
  const { currentClaim, updateSpotDetails, updateVehicle } = useClaimStore();
  const { triggerField, hasEvidence } = useFieldEvidence();

  if (!currentClaim) return null;
  if (currentClaim.vehicleType === 'private') return null;

  const sd = currentClaim.spotDetails;
  const v = currentClaim.vehicle;

  const dates = (
    <>
      <div className="space-y-1">
        <Label htmlFor="c-permit-to">Permit Valid Upto</Label>
        <Input
          id="c-permit-to"
          type="date"
          value={sd.permitTo || ''}
          onChange={(e) => updateSpotDetails({ permitTo: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="c-auth-valid">Auth Valid Upto</Label>
        <Input
          id="c-auth-valid"
          type="date"
          value={sd.authValid || ''}
          onChange={(e) => updateSpotDetails({ authValid: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-fitness-valid">Fitness Valid Upto<EvidenceDot has={hasEvidence('fitnessValidUpto')} /></Label>
        <Input
          id="v-fitness-valid"
          type="date"
          value={v?.fitnessValidUpto || ''}
          onChange={(e) => updateVehicle({ fitnessValidUpto: e.target.value })}
          onFocus={() => triggerField('fitnessValidUpto')}
        />
      </div>
    </>
  );

  return (
    <DocSection title="Permit & Fitness" dates={dates}>
      <div className="space-y-1">
        <Label htmlFor="c-permit-no">Permit No.</Label>
        <Input
          id="c-permit-no"
          value={sd.permitNo || ''}
          onChange={(e) => updateSpotDetails({ permitNo: e.target.value.toUpperCase() })}
          className="uppercase"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="c-permit-type">Permit Type</Label>
        <select
          id="c-permit-type"
          className={selectCls}
          value={sd.permitType || ''}
          onChange={(e) => updateSpotDetails({ permitType: e.target.value })}
        >
          <option value="">Select Type</option>
          <option value="National">National Permit</option>
          <option value="State">State Permit</option>
          <option value="Zonal">Zonal Permit</option>
          <option value="Service">Service Permit</option>
          <option value="Contract">Contract Carriage</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="c-permit-nature">Nature of Permit</Label>
        <Input
          id="c-permit-nature"
          value={sd.natureOfPermit || ''}
          onChange={(e) => updateSpotDetails({ natureOfPermit: e.target.value })}
          placeholder="e.g. Goods Carriage, Stage Carriage"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="c-auth-no">Auth No.</Label>
        <Input
          id="c-auth-no"
          value={sd.authNo || ''}
          onChange={(e) => updateSpotDetails({ authNo: e.target.value.toUpperCase() })}
          className="uppercase"
        />
      </div>

      <div className="space-y-1 @md:col-span-2">
        <Label htmlFor="c-area">Area of Operation</Label>
        <Input
          id="c-area"
          value={sd.areaOfOperation || ''}
          onChange={(e) => updateSpotDetails({ areaOfOperation: e.target.value })}
          placeholder="e.g. All India, State-wide"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-route">Route / Permit<EvidenceDot has={hasEvidence('route')} /></Label>
        <Input
          id="v-route"
          value={v?.route || ''}
          onChange={(e) => updateVehicle({ route: e.target.value })}
          onFocus={() => triggerField('route')}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-fitness">Fitness Number<EvidenceDot has={hasEvidence('fitnessNo')} /></Label>
        <Input
          id="v-fitness"
          value={v?.fitnessNo || ''}
          onChange={(e) => updateVehicle({ fitnessNo: e.target.value })}
          onFocus={() => triggerField('fitnessNo')}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-fitness-type">Fitness Type</Label>
        <select
          id="v-fitness-type"
          value={(v as any)?.fitnessType || 'NORMAL'}
          onChange={(e) => updateVehicle({ fitnessType: e.target.value })}
          className={selectCls}
        >
          <option value="NORMAL">NORMAL</option>
          <option value="EXECUTIVE">EXECUTIVE</option>
          <option value="TOURIST">TOURIST</option>
        </select>
      </div>

      {/* Only the spot report prints this. */}
      {currentClaim.surveyType === 'spot' && (
        <div className="space-y-1">
          <Label htmlFor="c-tax">Log Book / Tax Paid</Label>
          <Input
            id="c-tax"
            value={sd.taxPaid ?? sd.fitnessType ?? ''}
            onChange={(e) => updateSpotDetails({ taxPaid: e.target.value })}
            placeholder="e.g. Paid Upto 2026"
            disabled={currentClaim.isSpotCompleted}
          />
        </div>
      )}
    </DocSection>
  );
}
