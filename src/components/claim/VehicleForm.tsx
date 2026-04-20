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

const r = (v: any) => !v ? 'border-red-400' : '';

export function VehicleDetailsForm() {
  const { currentClaim, updateVehicle } = useClaimStore();
  const { triggerField, hasEvidence } = useFieldEvidence();

  if (!currentClaim) return null;
  const v = currentClaim.vehicle;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-primary">Vehicle Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="v-reg">Registration No.<S /><EvidenceDot has={hasEvidence('registrationNumber')} /></Label>
            <Input
              id="v-reg"
              value={v?.registrationNumber || ''}
              onChange={(e) => updateVehicle({ registrationNumber: e.target.value.toUpperCase() })}
              onFocus={() => triggerField('registrationNumber')}
              placeholder="e.g. MH01AB1234"
              className={`uppercase font-mono font-bold ${r(v?.registrationNumber)}`}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-class">Class of Vehicle<S /><EvidenceDot has={hasEvidence('classOfVehicle')} /></Label>
            <Input
              id="v-class"
              value={v?.classOfVehicle || ''}
              onChange={(e) => updateVehicle({ classOfVehicle: e.target.value, registrationType: e.target.value })}
              onFocus={() => triggerField('classOfVehicle')}
              placeholder="e.g. LMV PE"
              className={r(v?.classOfVehicle)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-make">Make<S /><EvidenceDot has={hasEvidence('make')} /></Label>
            <Input
              id="v-make"
              value={v?.make || ''}
              onChange={(e) => updateVehicle({ make: e.target.value })}
              onFocus={() => triggerField('make')}
              placeholder="e.g. MARUTI SUZUKI"
              className={r(v?.make)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-model">Model / Variant<S /><EvidenceDot has={hasEvidence('model')} /></Label>
            <Input
              id="v-model"
              value={v?.model || ''}
              onChange={(e) => updateVehicle({ model: e.target.value })}
              onFocus={() => triggerField('model')}
              placeholder="e.g. SWIFT VXI"
              className={r(v?.model)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-year">Year of Mfg (YOM)<S /><EvidenceDot has={hasEvidence('yearOfManufacture')} /></Label>
            <Input
              id="v-year"
              type="number"
              value={v?.yearOfManufacture || ''}
              onChange={(e) => updateVehicle({ yearOfManufacture: parseInt(e.target.value) || null })}
              onFocus={() => triggerField('yearOfManufacture')}
              placeholder="YYYY"
              className={r(v?.yearOfManufacture)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-body">Body Type<S /><EvidenceDot has={hasEvidence('bodyType')} /></Label>
            <Input
              id="v-body"
              value={v?.bodyType || ''}
              onChange={(e) => updateVehicle({ bodyType: e.target.value })}
              onFocus={() => triggerField('bodyType')}
              placeholder="e.g. SALOON / HATCHBACK"
              className={r(v?.bodyType)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-chassis">Chassis No.<S /><EvidenceDot has={hasEvidence('chassisNumber')} /></Label>
            <Input
              id="v-chassis"
              value={v?.chassisNumber || ''}
              onChange={(e) => updateVehicle({ chassisNumber: e.target.value.toUpperCase() })}
              onFocus={() => triggerField('chassisNumber')}
              className={`uppercase font-mono ${r(v?.chassisNumber)}`}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-engine">Engine No.<S /><EvidenceDot has={hasEvidence('engineNumber')} /></Label>
            <Input
              id="v-engine"
              value={v?.engineNumber || ''}
              onChange={(e) => updateVehicle({ engineNumber: e.target.value.toUpperCase() })}
              onFocus={() => triggerField('engineNumber')}
              className={`uppercase font-mono ${r(v?.engineNumber)}`}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-cc">Cubic Capacity (CC)<S /><EvidenceDot has={hasEvidence('cubicCapacity')} /></Label>
            <Input
              id="v-cc"
              value={v?.cubicCapacity || ''}
              onChange={(e) => updateVehicle({ cubicCapacity: e.target.value })}
              onFocus={() => triggerField('cubicCapacity')}
              className={r(v?.cubicCapacity)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-color">Colour<S /><EvidenceDot has={hasEvidence('colour')} /></Label>
            <Input
              id="v-color"
              value={v?.colour || ''}
              onChange={(e) => updateVehicle({ colour: e.target.value })}
              onFocus={() => triggerField('colour')}
              className={r(v?.colour)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-fuel">Fuel Type<S /><EvidenceDot has={hasEvidence('fuel')} /></Label>
            <select
              id="v-fuel"
              value={v?.fuel || ''}
              onChange={(e) => updateVehicle({ fuel: e.target.value })}
              onFocus={() => triggerField('fuel')}
              className={`flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${r(v?.fuel)}`}
            >
              <option value="">Select Fuel</option>
              {['Petrol', 'Diesel', 'CNG', 'LPG', 'Electric', 'Hybrid', 'Petrol+CNG', 'Petrol+LPG'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-odo">Odometer<S /><EvidenceDot has={hasEvidence('odometer')} /></Label>
            <Input
              id="v-odo"
              value={v?.odometer || ''}
              onChange={(e) => updateVehicle({ odometer: e.target.value })}
              onFocus={() => triggerField('odometer')}
              className={r(v?.odometer)}
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
              className={`uppercase ${r(v?.registeringAuthority)}`}
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
              className={r(v?.registrationValidUpTo)}
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
              className={`uppercase ${r(v?.rcEndorsement)}`}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-regdate">Date of Registration<S /><EvidenceDot has={hasEvidence('dateOfRegistration')} /></Label>
            <Input
              id="v-regdate"
              type="date"
              value={v?.dateOfRegistration || ''}
              onChange={(e) => updateVehicle({ dateOfRegistration: e.target.value })}
              onFocus={() => triggerField('dateOfRegistration')}
              className={r(v?.dateOfRegistration)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-rlw">Registered Load Weight (RLW)<S /><EvidenceDot has={hasEvidence('registeredLoadWeight')} /></Label>
            <Input
              id="v-rlw"
              value={v?.registeredLoadWeight || ''}
              onChange={(e) => updateVehicle({ registeredLoadWeight: e.target.value })}
              onFocus={() => triggerField('registeredLoadWeight')}
              placeholder="e.g. 1500 KG"
              className={r(v?.registeredLoadWeight)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-ulw">Unladen Weight (ULW)<EvidenceDot has={hasEvidence('unladenWeight')} /></Label>
            <Input
              id="v-ulw"
              type="number"
              value={v?.unladenWeight || ''}
              onChange={(e) => updateVehicle({ unladenWeight: parseInt(e.target.value) || null })}
              onFocus={() => triggerField('unladenWeight')}
              placeholder="e.g. 800"
              className={r(v?.unladenWeight)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-seats-total">Seating Capacity<EvidenceDot has={hasEvidence('seatingCapacityTotal')} /></Label>
            <Input
              id="v-seats-total"
              value={(v as any)?.seatingCapacityTotal || ''}
              onChange={(e) => updateVehicle({ seatingCapacityTotal: e.target.value })}
              onFocus={() => triggerField('seatingCapacityTotal')}
              placeholder="e.g. 5"
              className={r((v as any)?.seatingCapacityTotal)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-pass-acc">Passengers at Accident</Label>
            <Input
              id="v-pass-acc"
              value={(v as any)?.passengersAtAccident || ''}
              onChange={(e) => updateVehicle({ passengersAtAccident: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-pass-type">Passenger Type</Label>
            <Input
              id="v-pass-type"
              value={(v as any)?.passengerType || ''}
              onChange={(e) => updateVehicle({ passengerType: e.target.value.toUpperCase() })}
              placeholder="e.g. OWNER / PAID"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-goods-weight">Goods Weight at Accident</Label>
            <Input
              id="v-goods-weight"
              value={(v as any)?.goodsWeightAtAccident || ''}
              onChange={(e) => updateVehicle({ goodsWeightAtAccident: e.target.value })}
            />
          </div>

          {currentClaim.surveyType !== 'spot' && (
            <div className="space-y-1">
              <Label htmlFor="v-goods-nature">Nature of Goods</Label>
              <Input
                id="v-goods-nature"
                value={(v as any)?.natureOfGoods || ''}
                onChange={(e) => updateVehicle({ natureOfGoods: e.target.value.toUpperCase() })}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="v-fitness">Fitness Number<S /><EvidenceDot has={hasEvidence('fitnessNo')} /></Label>
            <Input
              id="v-fitness"
              value={v?.fitnessNo || ''}
              onChange={(e) => updateVehicle({ fitnessNo: e.target.value })}
              onFocus={() => triggerField('fitnessNo')}
              className={r(v?.fitnessNo)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-fitness-valid">Fitness Valid Upto<S /><EvidenceDot has={hasEvidence('fitnessValidUpto')} /></Label>
            <Input
              id="v-fitness-valid"
              type="date"
              value={v?.fitnessValidUpto || ''}
              onChange={(e) => updateVehicle({ fitnessValidUpto: e.target.value })}
              onFocus={() => triggerField('fitnessValidUpto')}
              className={r(v?.fitnessValidUpto)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-fitness-type">Fitness Type</Label>
            <select
              id="v-fitness-type"
              value={(v as any)?.fitnessType || 'NORMAL'}
              onChange={(e) => updateVehicle({ fitnessType: e.target.value })}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="NORMAL">NORMAL</option>
              <option value="EXECUTIVE">EXECUTIVE</option>
              <option value="TOURIST">TOURIST</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-route">Route / Permit<S /><EvidenceDot has={hasEvidence('route')} /></Label>
            <Input
              id="v-route"
              value={v?.route || ''}
              onChange={(e) => updateVehicle({ route: e.target.value })}
              onFocus={() => triggerField('route')}
              className={r(v?.route)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-cond">Pre-Accident Condition<S /></Label>
            <Input
              id="v-cond"
              value={v?.preAccidentCondition || ''}
              onChange={(e) => updateVehicle({ preAccidentCondition: e.target.value })}
              className={r(v?.preAccidentCondition)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
