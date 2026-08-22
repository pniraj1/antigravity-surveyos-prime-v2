'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck } from 'lucide-react';

/**
 * Permit, load and challan details for goods and passenger vehicles.
 *
 * These live on `spotDetails` for historical reasons but are read off the
 * permit and challan documents, not observed at the scene, and both final
 * reports print them. SpotTab renders only for spot claims, so this card
 * carries them for every survey type instead.
 */
export function CommercialLoadForm() {
  const { currentClaim, updateSpotDetails } = useClaimStore();

  if (!currentClaim) return null;
  if (currentClaim.vehicleType === 'private') return null;

  const sd = currentClaim.spotDetails;
  const overWeightNumeric = (sd.actualLoad || 0) > (sd.loadCapacity || 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <Truck size={18} />
          Permit, Load &amp; Challan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4 gap-4">
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
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
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
            <Label htmlFor="c-permit-to">Permit Valid Upto</Label>
            <Input
              id="c-permit-to"
              type="date"
              value={sd.permitTo || ''}
              onChange={(e) => updateSpotDetails({ permitTo: e.target.value })}
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

          <div className="space-y-1">
            <Label htmlFor="c-auth-valid">Auth Valid Upto</Label>
            <Input
              id="c-auth-valid"
              type="date"
              value={sd.authValid || ''}
              onChange={(e) => updateSpotDetails({ authValid: e.target.value })}
            />
          </div>

          <div className="space-y-1 @2xl:col-span-2">
            <Label htmlFor="c-area">Area of Operation</Label>
            <Input
              id="c-area"
              value={sd.areaOfOperation || ''}
              onChange={(e) => updateSpotDetails({ areaOfOperation: e.target.value })}
              placeholder="e.g. All India, State-wide"
            />
          </div>

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
            <Label htmlFor="c-challan-date">Load Challan Date</Label>
            <Input
              id="c-challan-date"
              type="date"
              value={sd.challanDate || ''}
              onChange={(e) => updateSpotDetails({ challanDate: e.target.value })}
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
            {overWeightNumeric && (
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

          <div className="space-y-1 @2xl:col-span-3">
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
        </div>
      </CardContent>
    </Card>
  );
}
