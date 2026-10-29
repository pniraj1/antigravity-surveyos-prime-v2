'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DocSection, selectCls } from '@/components/claim/form-bits';
import { Trash2, PlusCircle, Info } from 'lucide-react';

/**
 * Spot-only findings, rendered at the bottom of Claim Details. Spot dates
 * live in AssignmentForm / SurveyForm and tax paid in PermitForm.
 */
export function SpotTab() {
  const {
    currentClaim,
    updateSpotDetails,
    updateVehicle,
    addSpotDamageRow,
    updateSpotDamageRow,
    deleteSpotDamageRow
  } = useClaimStore();

  if (!currentClaim) return null;

  const isCompleted = currentClaim.isSpotCompleted;

  const { spotDetails, vehicleType } = currentClaim;
  const spotDamageRows = currentClaim.spotDamageRows ?? [];
  const isCommercial = vehicleType !== 'private';

  const effectiveGvw = spotDetails.gvw || parseFloat(String(currentClaim.vehicle?.registeredLoadWeight || '').replace(/[^0-9.]/g, '')) || 0;
  const effectiveUlw = spotDetails.ulw ?? currentClaim.vehicle?.unladenWeight ?? 0;
  const effectiveCap = spotDetails.loadCapacity ?? ((effectiveGvw > effectiveUlw && effectiveUlw > 0) ? effectiveGvw - effectiveUlw : (effectiveGvw || 0));

  const handleUpdate = (updates: Partial<typeof spotDetails>) => {
    updateSpotDetails(updates);
  };

  return (
    <div className="space-y-6 pt-2">
      <h3 className="text-xl font-medium tracking-tight">Spot Findings</h3>

      <DocSection title="Vehicle Status at Spot">
        <div className="space-y-1">
          <Label htmlFor="sp-drivable">Is Drivable?</Label>
          <select
            id="sp-drivable"
            value={spotDetails.drivable}
            onChange={(e) => handleUpdate({ drivable: e.target.value })}
            className={selectCls}
          >
            <option value="yes">Yes - Driven Self</option>
            <option value="no">No - Towed/Craned</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-severity">Damage Severity</Label>
          <select
            id="sp-severity"
            value={spotDetails.damageSeverity}
            onChange={(e) => handleUpdate({ damageSeverity: e.target.value as any })}
            className={selectCls}
          >
            <option value="minor">Minor Damage</option>
            <option value="moderate">Moderate Damage</option>
            <option value="major">Major / Total Loss</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-airbags">Airbags Status</Label>
          <select
            id="sp-airbags"
            value={spotDetails.airbags}
            onChange={(e) => handleUpdate({ airbags: e.target.value })}
            className={selectCls}
          >
            <option value="no">Not Deployed</option>
            <option value="yes">Deployed</option>
            <option value="na">N/A (No Airbags)</option>
          </select>
        </div>
      </DocSection>

      {isCommercial && (
        <DocSection title="Load Capacity">
          <div className="space-y-1">
            <Label htmlFor="sp-gvw">GVW (KG)</Label>
            <Input
              id="sp-gvw"
              type="number"
              value={effectiveGvw || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                handleUpdate({
                  gvw: val || null,
                  loadCapacity: (val > (effectiveUlw || 0) && (effectiveUlw || 0) > 0) ? val - effectiveUlw : (val || 0)
                });
                updateVehicle({
                  registeredLoadWeight: val ? String(val) : '',
                  grossWeight: val || null
                });
              }}
              disabled={isCompleted}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sp-ulw">ULW (KG)</Label>
            <Input
              id="sp-ulw"
              type="number"
              value={effectiveUlw || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                handleUpdate({
                  ulw: val || null,
                  loadCapacity: ((effectiveGvw || 0) > val && val > 0) ? effectiveGvw - val : (effectiveGvw || 0)
                });
                updateVehicle({
                  unladenWeight: val || null
                });
              }}
              disabled={isCompleted}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sp-payload">Payload Capacity</Label>
            <Input
              id="sp-payload"
              type="number"
              value={effectiveCap || ''}
              disabled={true}
              className="bg-muted font-medium"
            />
          </div>
        </DocSection>
      )}

      <datalist id="spot-components-list">
        {[
          'FRONT END STRUCTURE / DRIVERS CABIN',
          'INSTRUMENTS',
          'COOLING SYSTEM',
          'ENGINE & TRANSMISSION',
          'CHASSIS ASSY',
          'LOAD BODY',
          'STEERING SYSTEM',
          'FRONT SUSPENSION',
          'REAR SUSPENSION',
          'WHEEL DISCS & TYRES',
          'FRONT AXLE ASSY',
          'REAR AXLE ASSY',
          'BRAKING SYSTEM',
          'ELECTRICAL SYSTEM',
          'FUEL SYSTEM',
          'EXHAUST SYSTEM',
          'BODY PANELS',
          'WINDSHIELD & GLASS',
          'INTERIOR',
        ].map((c) => <option key={c} value={c} />)}
      </datalist>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Component-wise Damage</CardTitle>
          {!isCompleted && (
            <button
              onClick={() => addSpotDamageRow()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium"
            >
              <PlusCircle size={14} /> Add Damage
            </button>
          )}
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 text-muted-foreground text-xs">
              <tr>
                <th className="px-6 py-3 font-medium w-12 border-b">#</th>
                <th className="px-6 py-3 font-medium w-1/3 border-b">Affected Component</th>
                <th className="px-6 py-3 font-medium border-b">Visual Damage Details</th>
                <th className="px-6 py-3 font-medium w-12 border-b"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {spotDamageRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    No damages logged yet.
                  </td>
                </tr>
              ) : (
                spotDamageRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-accent/5 transition-colors group">
                    <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="px-6 py-4">
                      <input
                        list="spot-components-list"
                        value={row.component}
                        onChange={(e) => updateSpotDamageRow(row.id, { component: e.target.value })}
                        disabled={isCompleted}
                        className="h-9 w-full text-sm font-medium ring-0 border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary/20 rounded px-2 outline-none"
                        placeholder="Select Component"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Textarea
                        value={row.damage}
                        onChange={(e) => updateSpotDamageRow(row.id, { damage: e.target.value })}
                        disabled={isCompleted}
                        className="min-h-[60px] text-sm ring-0 border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary/20 resize-y"
                        placeholder="e.g. Glass broken, internal bracket snapped"
                      />
                    </td>
                    <td className="px-6 py-4">
                      {!isCompleted && (
                        <button
                          onClick={() => deleteSpotDamageRow(row.id)}
                          className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 p-2 rounded-md transition-all text-muted-foreground hover:text-danger hover:bg-danger/10"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <DocSection title="Observations & Remarks">
        <div className="space-y-1 col-span-full">
          <Label htmlFor="sp-comments">Spot Observations / Comments</Label>
          <Textarea
            id="sp-comments"
            rows={5}
            value={spotDetails.comments}
            onChange={(e) => handleUpdate({ comments: e.target.value })}
            placeholder="Describe the accident scene, vehicle position, and overall assessment..."
            disabled={isCompleted}
          />
        </div>
        <div className="space-y-1 col-span-full">
          <Label htmlFor="sp-repairs">Further Repairs</Label>
          <Input
            id="sp-repairs"
            value={spotDetails.repairWorkshop ?? ''}
            placeholder="Workshop where vehicle will go for further repairs"
            onChange={(e) => handleUpdate({ repairWorkshop: e.target.value })}
            disabled={isCompleted}
          />
        </div>
        <div className="space-y-1 col-span-full">
          <Label htmlFor="sp-encl">Enclosed Documents</Label>
          <Textarea
            id="sp-encl"
            rows={2}
            value={spotDetails.enclosures}
            onChange={(e) => handleUpdate({ enclosures: e.target.value })}
            placeholder="e.g. Copy of RC, DL, Policy, Spot Photos"
          />
        </div>
      </DocSection>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          IRDAI: a spot survey is a preliminary scene inspection. Capture photos 360&deg; including Chassis/VIN and
          odometer before the vehicle moves to the workshop.
        </p>
      </div>
    </div>
  );
}
