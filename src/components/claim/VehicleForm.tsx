'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
            <Label htmlFor="v-reg">Registration No.</Label>
            <Input
              id="v-reg"
              value={v.registrationNumber}
              onChange={(e) => updateVehicle({ registrationNumber: e.target.value.toUpperCase() })}
              placeholder="e.g. MH01AB1234"
              className="uppercase font-mono font-bold"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-class">Class of Vehicle</Label>
            <Input
              id="v-class"
              value={v.classOfVehicle}
              onChange={(e) => updateVehicle({ classOfVehicle: e.target.value })}
              placeholder="e.g. LMV PE"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-make">Make</Label>
            <Input
              id="v-make"
              value={v.make}
              onChange={(e) => updateVehicle({ make: e.target.value })}
              placeholder="e.g. MARUTI SUZUKI"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-model">Model / Variant</Label>
            <Input
              id="v-model"
              value={v.model}
              onChange={(e) => updateVehicle({ model: e.target.value })}
              placeholder="e.g. SWIFT VXI"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-year">Year of Mfg (YOM)</Label>
            <Input
              id="v-year"
              type="number"
              value={v.yearOfManufacture || ''}
              onChange={(e) => updateVehicle({ yearOfManufacture: parseInt(e.target.value) || null })}
              placeholder="YYYY"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-body">Body Type</Label>
            <Input
              id="v-body"
              value={v.bodyType}
              onChange={(e) => updateVehicle({ bodyType: e.target.value })}
              placeholder="e.g. SALOON / HATCHBACK"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-chassis">Chassis No.</Label>
            <Input
              id="v-chassis"
              value={v.chassisNumber}
              onChange={(e) => updateVehicle({ chassisNumber: e.target.value.toUpperCase() })}
              className="uppercase font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-engine">Engine No.</Label>
            <Input
              id="v-engine"
              value={v.engineNumber}
              onChange={(e) => updateVehicle({ engineNumber: e.target.value.toUpperCase() })}
              className="uppercase font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-cc">Cubic Capacity (CC)</Label>
            <Input
              id="v-cc"
              value={v.cubicCapacity}
              onChange={(e) => updateVehicle({ cubicCapacity: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-color">Colour</Label>
            <Input
              id="v-color"
              value={v.colour}
              onChange={(e) => updateVehicle({ colour: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-fuel">Fuel Type</Label>
            <select
              id="v-fuel"
              value={v.fuel}
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
            <Label htmlFor="v-odo">Odometer</Label>
            <Input
              id="v-odo"
              value={v.odometer}
              onChange={(e) => updateVehicle({ odometer: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-regdate">Date of Registration</Label>
            <Input
              id="v-regdate"
              type="date"
              value={v.dateOfRegistration}
              onChange={(e) => updateVehicle({ dateOfRegistration: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-hyp">Hypothecation</Label>
            <Input
              id="v-hyp"
              value={v.hypothecation}
              onChange={(e) => updateVehicle({ hypothecation: e.target.value })}
              placeholder="e.g. HDFC BANK"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-rlw">Registered Load Weight (RLW)</Label>
            <Input
              id="v-rlw"
              value={v.registeredLoadWeight}
              onChange={(e) => updateVehicle({ registeredLoadWeight: e.target.value })}
              placeholder="e.g. 1500 KG"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-seats">Seating Capacity</Label>
            <Input
              id="v-seats"
              value={v.seatingCapacity}
              onChange={(e) => updateVehicle({ seatingCapacity: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-fitness">Fitness Number/Expiry</Label>
            <Input
              id="v-fitness"
              value={v.fitnessNo}
              onChange={(e) => updateVehicle({ fitnessNo: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-route">Route / Permit</Label>
            <Input
              id="v-route"
              value={v.route}
              onChange={(e) => updateVehicle({ route: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-cond">Pre-Accident Condition</Label>
            <Input
              id="v-cond"
              value={v.preAccidentCondition}
              onChange={(e) => updateVehicle({ preAccidentCondition: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
