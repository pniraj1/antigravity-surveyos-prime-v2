'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DocSection, selectCls } from '@/components/claim/form-bits';

/**
 * Occupants and load at the moment of the accident. Passenger and goods
 * fields are stored on `vehicle`, challan and load on `spotDetails`.
 */
export function AtAccidentForm() {
  const { currentClaim, updateVehicle, updateSpotDetails } = useClaimStore();

  if (!currentClaim) return null;
  const v = currentClaim.vehicle as any;
  const sd = currentClaim.spotDetails;
  const isCommercial = currentClaim.vehicleType !== 'private';

  // loadCapacity is only worked out by the Spot tab and RC extraction, so fall
  // back to the RC weights on the RC card. Unknown capacity = no prompt.
  const rcGvw = parseFloat(String(currentClaim.vehicle.registeredLoadWeight).replace(/,/g, '')) || 0;
  const rcUlw = currentClaim.vehicle.unladenWeight || 0;
  const capacity = (sd.loadCapacity ?? 0) > 0 ? sd.loadCapacity! : (rcGvw > rcUlw && rcUlw > 0 ? rcGvw - rcUlw : 0);
  const overWeightNumeric = capacity > 0 && (sd.actualLoad || 0) > capacity;

  const dates = isCommercial ? (
    <div className="space-y-1">
      <Label htmlFor="c-challan-date">Load Challan Date</Label>
      <Input
        id="c-challan-date"
        type="date"
        value={sd.challanDate || ''}
        onChange={(e) => updateSpotDetails({ challanDate: e.target.value })}
      />
    </div>
  ) : undefined;

  return (
    <DocSection title="At the Time of Accident" dates={dates}>
      <div className="space-y-1">
        <Label htmlFor="v-pass-acc">Passengers at Accident</Label>
        <Input
          id="v-pass-acc"
          value={v?.passengersAtAccident || ''}
          onChange={(e) => updateVehicle({ passengersAtAccident: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-pass-type">Passenger Type</Label>
        <Input
          id="v-pass-type"
          value={v?.passengerType || ''}
          onChange={(e) => updateVehicle({ passengerType: e.target.value.toUpperCase() })}
          placeholder="e.g. OWNER / PAID"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="v-pass-contra">Passengers in Contravention?</Label>
        <select
          id="v-pass-contra"
          className={selectCls}
          value={v?.passengersContravention || ''}
          onChange={(e) => updateVehicle({ passengersContravention: e.target.value })}
        >
          <option value="">—</option>
          <option value="NO">No</option>
          <option value="YES">Yes</option>
        </select>
      </div>

      {isCommercial && (
        <>
          <div className="space-y-1">
            <Label htmlFor="c-challan-no">Load Challan No.</Label>
            <Input
              id="c-challan-no"
              value={sd.challanNo || ''}
              onChange={(e) => updateSpotDetails({ challanNo: e.target.value.toUpperCase() })}
              placeholder="CN Number"
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-actual-load">Load at Accident (KG)</Label>
            <Input
              id="c-actual-load"
              type="number"
              className={`font-mono font-bold ${sd.flagOverload ? 'text-red-600 border-red-200 bg-red-50' : ''}`}
              value={sd.actualLoad || ''}
              onChange={(e) => updateSpotDetails({ actualLoad: Number(e.target.value) })}
            />
            {/* Keep the box while flagged, so a stale flag can still be cleared. */}
            {(overWeightNumeric || sd.flagOverload) && (
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={!!sd.flagOverload}
                  onChange={(e) => updateSpotDetails({ flagOverload: e.target.checked })}
                />
                Flag as overloaded in report
              </label>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="v-goods-weight">Goods Weight at Accident</Label>
            <Input
              id="v-goods-weight"
              value={v?.goodsWeightAtAccident || ''}
              onChange={(e) => updateVehicle({ goodsWeightAtAccident: e.target.value })}
            />
          </div>

          {currentClaim.surveyType !== 'spot' && (
            <div className="space-y-1">
              <Label htmlFor="v-goods-nature">Nature of Goods</Label>
              <Input
                id="v-goods-nature"
                value={v?.natureOfGoods || ''}
                onChange={(e) => updateVehicle({ natureOfGoods: e.target.value.toUpperCase() })}
              />
            </div>
          )}

          <div className="space-y-1 col-span-full">
            <Label htmlFor="c-goods">Description of Goods</Label>
            <Input
              id="c-goods"
              value={sd.loadDesc || ''}
              onChange={(e) => updateSpotDetails({ loadDesc: e.target.value })}
              placeholder="Type of goods being carried"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-route-from">Route From</Label>
            <Input
              id="c-route-from"
              value={sd.loadOrigin || ''}
              onChange={(e) => updateSpotDetails({ loadOrigin: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="c-route-to">Route To</Label>
            <Input
              id="c-route-to"
              value={sd.loadDest || ''}
              onChange={(e) => updateSpotDetails({ loadDest: e.target.value })}
            />
          </div>
        </>
      )}
    </DocSection>
  );
}
