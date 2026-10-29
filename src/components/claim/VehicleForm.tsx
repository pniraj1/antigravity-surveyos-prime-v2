'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFieldEvidence } from '@/hooks/useFieldEvidence';
import { DocSection, EvidenceDot, req, selectCls } from '@/components/claim/form-bits';

/**
 * Registration Certificate fields. Fitness and route live in PermitForm;
 * odometer and pre-accident condition in SurveyForm; passengers and goods in
 * AtAccidentForm. All of them are still stored on `vehicle`.
 */
export function VehicleDetailsForm({ scan }: { scan?: React.ReactNode }) {
  const { currentClaim, updateVehicle } = useClaimStore();
  const { triggerField, hasEvidence } = useFieldEvidence();

  if (!currentClaim) return null;
  const v = currentClaim.vehicle;

  const dates = (
    <>
      <div className="space-y-1">
        <Label htmlFor="v-regdate">Date of Registration<EvidenceDot has={hasEvidence('dateOfRegistration')} /></Label>
        <Input
          id="v-regdate"
          type="date"
          value={v?.dateOfRegistration || ''}
          onChange={(e) => updateVehicle({ dateOfRegistration: e.target.value })}
          onFocus={() => triggerField('dateOfRegistration')}
          className={req(v?.dateOfRegistration)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-reg-valid">Registration Valid Up To<EvidenceDot has={hasEvidence('registrationValidUpTo')} /></Label>
        <Input
          id="v-reg-valid"
          type="date"
          value={v?.registrationValidUpTo || ''}
          onChange={(e) => updateVehicle({ registrationValidUpTo: e.target.value })}
          onFocus={() => triggerField('registrationValidUpTo')}
        />
      </div>
    </>
  );

  return (
    <DocSection title="Registration Certificate (RC)" action={scan} dates={dates}>
      <div className="space-y-1">
        <Label htmlFor="v-reg">Registration No.<EvidenceDot has={hasEvidence('registrationNumber')} /></Label>
        <Input
          id="v-reg"
          value={v?.registrationNumber || ''}
          onChange={(e) => updateVehicle({ registrationNumber: e.target.value.toUpperCase() })}
          onFocus={() => triggerField('registrationNumber')}
          placeholder="e.g. MH01AB1234"
          className={`uppercase font-mono font-bold ${req(v?.registrationNumber)}`}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-class">Class of Vehicle<EvidenceDot has={hasEvidence('classOfVehicle')} /></Label>
        <Input
          id="v-class"
          value={v?.classOfVehicle || ''}
          onChange={(e) => updateVehicle({ classOfVehicle: e.target.value, registrationType: e.target.value })}
          onFocus={() => triggerField('classOfVehicle')}
          placeholder="e.g. LMV PE"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-reg-auth">Registering Authority<EvidenceDot has={hasEvidence('registeringAuthority')} /></Label>
        <Input
          id="v-reg-auth"
          value={v?.registeringAuthority || ''}
          onChange={(e) => updateVehicle({ registeringAuthority: e.target.value.toUpperCase() })}
          onFocus={() => triggerField('registeringAuthority')}
          placeholder="e.g. RTO MUMBAI"
          className="uppercase"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-make">Make<EvidenceDot has={hasEvidence('make')} /></Label>
        <Input
          id="v-make"
          value={v?.make || ''}
          onChange={(e) => updateVehicle({ make: e.target.value })}
          onFocus={() => triggerField('make')}
          placeholder="e.g. MARUTI SUZUKI"
          className={req(v?.make)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-model">Model / Variant<EvidenceDot has={hasEvidence('model')} /></Label>
        <Input
          id="v-model"
          value={v?.model || ''}
          onChange={(e) => updateVehicle({ model: e.target.value })}
          onFocus={() => triggerField('model')}
          placeholder="e.g. SWIFT VXI"
          className={req(v?.model)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-year">Year of Mfg (YOM)<EvidenceDot has={hasEvidence('yearOfManufacture')} /></Label>
        <Input
          id="v-year"
          type="number"
          value={v?.yearOfManufacture || ''}
          onChange={(e) => updateVehicle({ yearOfManufacture: parseInt(e.target.value) || null })}
          onFocus={() => triggerField('yearOfManufacture')}
          placeholder="YYYY"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-body">Body Type<EvidenceDot has={hasEvidence('bodyType')} /></Label>
        <Input
          id="v-body"
          value={v?.bodyType || ''}
          onChange={(e) => updateVehicle({ bodyType: e.target.value })}
          onFocus={() => triggerField('bodyType')}
          placeholder="e.g. SALOON / HATCHBACK"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-color">Colour<EvidenceDot has={hasEvidence('colour')} /></Label>
        <Input
          id="v-color"
          value={v?.colour || ''}
          onChange={(e) => updateVehicle({ colour: e.target.value })}
          onFocus={() => triggerField('colour')}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-fuel">Fuel Type<EvidenceDot has={hasEvidence('fuel')} /></Label>
        <select
          id="v-fuel"
          value={v?.fuel || ''}
          onChange={(e) => updateVehicle({ fuel: e.target.value })}
          onFocus={() => triggerField('fuel')}
          className={selectCls}
        >
          <option value="">Select Fuel</option>
          {['Petrol', 'Diesel', 'CNG', 'LPG', 'Electric', 'Hybrid', 'Petrol+CNG', 'Petrol+LPG'].map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-chassis">Chassis No.<EvidenceDot has={hasEvidence('chassisNumber')} /></Label>
        <Input
          id="v-chassis"
          value={v?.chassisNumber || ''}
          onChange={(e) => updateVehicle({ chassisNumber: e.target.value.toUpperCase() })}
          onFocus={() => triggerField('chassisNumber')}
          className={`uppercase font-mono ${req(v?.chassisNumber)}`}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-engine">Engine No.<EvidenceDot has={hasEvidence('engineNumber')} /></Label>
        <Input
          id="v-engine"
          value={v?.engineNumber || ''}
          onChange={(e) => updateVehicle({ engineNumber: e.target.value.toUpperCase() })}
          onFocus={() => triggerField('engineNumber')}
          className={`uppercase font-mono ${req(v?.engineNumber)}`}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-cc">Cubic Capacity (CC)<EvidenceDot has={hasEvidence('cubicCapacity')} /></Label>
        <Input
          id="v-cc"
          value={v?.cubicCapacity || ''}
          onChange={(e) => updateVehicle({ cubicCapacity: e.target.value })}
          onFocus={() => triggerField('cubicCapacity')}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-seats-total">Seating Capacity<EvidenceDot has={hasEvidence('seatingCapacity')} /></Label>
        <Input
          id="v-seats-total"
          value={v?.seatingCapacity || ''}
          onChange={(e) => updateVehicle({ seatingCapacity: e.target.value })}
          onFocus={() => triggerField('seatingCapacity')}
          placeholder="e.g. 5"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-rlw">GVW (Gross Vehicle Weight)<EvidenceDot has={hasEvidence('registeredLoadWeight')} /></Label>
        <Input
          id="v-rlw"
          value={v?.registeredLoadWeight || (currentClaim.spotDetails?.gvw ? String(currentClaim.spotDetails.gvw) : '')}
          onChange={(e) => updateVehicle({ registeredLoadWeight: e.target.value, grossWeight: parseInt(e.target.value.replace(/[^0-9.]/g, '')) || null })}
          onFocus={() => triggerField('registeredLoadWeight')}
          placeholder="e.g. 1500 KG"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-ulw">Unladen Weight (ULW)<EvidenceDot has={hasEvidence('unladenWeight')} /></Label>
        <Input
          id="v-ulw"
          type="number"
          value={v?.unladenWeight ?? (currentClaim.spotDetails?.ulw ?? '')}
          onChange={(e) => updateVehicle({ unladenWeight: parseInt(e.target.value) || null })}
          onFocus={() => triggerField('unladenWeight')}
          placeholder="e.g. 800"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-hpa">Hypothecation (H.P.A.)<EvidenceDot has={hasEvidence('hypothecation')} /></Label>
        <Input
          id="v-hpa"
          value={v?.hypothecation || ''}
          onChange={(e) => updateVehicle({ hypothecation: e.target.value.toUpperCase() })}
          onFocus={() => triggerField('hypothecation')}
          placeholder="Financier name, or NIL"
          className="uppercase"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-rc-end">RC Endorsement (Financier)<EvidenceDot has={hasEvidence('rcEndorsement')} /></Label>
        <Input
          id="v-rc-end"
          value={v?.rcEndorsement || ''}
          onChange={(e) => updateVehicle({ rcEndorsement: e.target.value.toUpperCase() })}
          onFocus={() => triggerField('rcEndorsement')}
          placeholder="e.g. NO"
          className="uppercase"
        />
      </div>
    </DocSection>
  );
}
