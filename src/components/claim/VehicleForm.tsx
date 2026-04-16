'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const S = () => <span className="ml-1 inline-block w-2 h-2 rounded-full bg-green-500 align-middle" title="Used in Spot Report" />;

export function VehicleDetailsForm() {
  const { currentClaim, updateVehicle } = useClaimStore();

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
            <Label htmlFor="v-reg">Registration No.<S /></Label>
            <Input
              id="v-reg"
              value={v?.registrationNumber || ''}
              onChange={(e) => updateVehicle({ registrationNumber: e.target.value.toUpperCase() })}
              placeholder="e.g. MH01AB1234"
              className="uppercase font-mono font-bold"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-class">Class of Vehicle<S /></Label>
            <Input
              id="v-class"
              value={v?.classOfVehicle || ''}
              onChange={(e) => updateVehicle({ classOfVehicle: e.target.value, registrationType: e.target.value })}
              placeholder="e.g. LMV PE"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-make">Make<S /></Label>
            <Input
              id="v-make"
              value={v?.make || ''}
              onChange={(e) => updateVehicle({ make: e.target.value })}
              placeholder="e.g. MARUTI SUZUKI"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-model">Model / Variant<S /></Label>
            <Input
              id="v-model"
              value={v?.model || ''}
              onChange={(e) => updateVehicle({ model: e.target.value })}
              placeholder="e.g. SWIFT VXI"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-year">Year of Mfg (YOM)<S /></Label>
            <Input
              id="v-year"
              type="number"
              value={v?.yearOfManufacture || ''}
              onChange={(e) => updateVehicle({ yearOfManufacture: parseInt(e.target.value) || null })}
              placeholder="YYYY"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-body">Body Type<S /></Label>
            <Input
              id="v-body"
              value={v?.bodyType || ''}
              onChange={(e) => updateVehicle({ bodyType: e.target.value })}
              placeholder="e.g. SALOON / HATCHBACK"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-chassis">Chassis No.<S /></Label>
            <Input
              id="v-chassis"
              value={v?.chassisNumber || ''}
              onChange={(e) => updateVehicle({ chassisNumber: e.target.value.toUpperCase() })}
              className="uppercase font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-engine">Engine No.<S /></Label>
            <Input
              id="v-engine"
              value={v?.engineNumber || ''}
              onChange={(e) => updateVehicle({ engineNumber: e.target.value.toUpperCase() })}
              className="uppercase font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-cc">Cubic Capacity (CC)<S /></Label>
            <Input
              id="v-cc"
              value={v?.cubicCapacity || ''}
              onChange={(e) => updateVehicle({ cubicCapacity: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-color">Colour<S /></Label>
            <Input
              id="v-color"
              value={v?.colour || ''}
              onChange={(e) => updateVehicle({ colour: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-fuel">Fuel Type<S /></Label>
            <select
              id="v-fuel"
              value={v?.fuel || ''}
              onChange={(e) => updateVehicle({ fuel: e.target.value })}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select Fuel</option>
              {['Petrol', 'Diesel', 'CNG', 'LPG', 'Electric', 'Hybrid', 'Petrol+CNG', 'Petrol+LPG'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-odo">Odometer<S /></Label>
            <Input
              id="v-odo"
              value={v?.odometer || ''}
              onChange={(e) => updateVehicle({ odometer: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-reg-auth">Registering Authority</Label>
            <Input
              id="v-reg-auth"
              value={v?.registeringAuthority || ''}
              onChange={(e) => updateVehicle({ registeringAuthority: e.target.value.toUpperCase() })}
              placeholder="e.g. RTO MUMBAI"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-reg-valid">Registration Valid Up To</Label>
            <Input
              id="v-reg-valid"
              type="date"
              value={v?.registrationValidUpTo || ''}
              onChange={(e) => updateVehicle({ registrationValidUpTo: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-rc-end">RC Endorsement (Financier)</Label>
            <Input
              id="v-rc-end"
              value={v?.rcEndorsement || ''}
              onChange={(e) => updateVehicle({ rcEndorsement: e.target.value.toUpperCase() })}
              placeholder="e.g. NO"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-regdate">Date of Registration<S /></Label>
            <Input
              id="v-regdate"
              type="date"
              value={v?.dateOfRegistration || ''}
              onChange={(e) => updateVehicle({ dateOfRegistration: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-rlw">Registered Load Weight (RLW)<S /></Label>
            <Input
              id="v-rlw"
              value={v?.registeredLoadWeight || ''}
              onChange={(e) => updateVehicle({ registeredLoadWeight: e.target.value })}
              placeholder="e.g. 1500 KG"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-ulw">Unladen Weight (ULW)</Label>
            <Input
              id="v-ulw"
              type="number"
              value={v?.unladenWeight || ''}
              onChange={(e) => updateVehicle({ unladenWeight: parseInt(e.target.value) || null })}
              placeholder="e.g. 800"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-seats-total">Seating Capacity</Label>
            <Input
              id="v-seats-total"
              value={(v as any)?.seatingCapacityTotal || ''}
              onChange={(e) => updateVehicle({ seatingCapacityTotal: e.target.value })}
              placeholder="e.g. 5"
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
            <Label htmlFor="v-fitness">Fitness Number<S /></Label>
            <Input
              id="v-fitness"
              value={v?.fitnessNo || ''}
              onChange={(e) => updateVehicle({ fitnessNo: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-fitness-valid">Fitness Valid Upto<S /></Label>
            <Input
              id="v-fitness-valid"
              type="date"
              value={v?.fitnessValidUpto || ''}
              onChange={(e) => updateVehicle({ fitnessValidUpto: e.target.value })}
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
            <Label htmlFor="v-route">Route / Permit<S /></Label>
            <Input
              id="v-route"
              value={v?.route || ''}
              onChange={(e) => updateVehicle({ route: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-cond">Pre-Accident Condition<S /></Label>
            <Input
              id="v-cond"
              value={v?.preAccidentCondition || ''}
              onChange={(e) => updateVehicle({ preAccidentCondition: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
