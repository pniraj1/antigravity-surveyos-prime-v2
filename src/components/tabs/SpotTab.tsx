'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, PlusCircle, AlertTriangle, ShieldCheck, Truck, User, MapPin, Gauge, CheckCircle2, Zap, Lock } from 'lucide-react';
import { toast } from 'sonner';

export function SpotTab() {
  const { currentClaim, updateSpotDetails, addSpotDamageRow, updateSpotDamageRow, deleteSpotDamageRow, updateClaim } = useClaimStore();

  if (!currentClaim) return null;

  const isCompleted = currentClaim.isSpotCompleted;

  const handleFinalize = () => {
    if (confirm('Are you sure you want to finalize the Spot Survey? This will unlock the Final Survey workflow.')) {
      updateClaim({ 
        isSpotCompleted: true, 
        surveyType: 'final' 
      });
      toast.success('Spot Survey Finalized! Final Workflow Unlocked.');
    }
  };

  const { spotDetails, spotDamageRows, vehicleType } = currentClaim;
  const isCommercial = vehicleType !== 'private';

  const handleUpdate = (updates: Partial<typeof spotDetails>) => {
    updateSpotDetails(updates);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary">Spot Survey Details</h2>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-wider font-semibold">
            Scene Inspection & Preliminary Findings
          </p>
        </div>
        <div className="px-3 py-1 bg-primary/10 rounded-full text-primary text-xs font-bold ring-1 ring-primary/20">
          SPOT MODE ACTIVE
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 1: SCENE & POLICE */}
        <Card className="border-primary/10 shadow-sm overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              Scene & Authorities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Survey Datetime</Label>
              <Input
                type="datetime-local"
                value={spotDetails.surveyDatetime}
                onChange={(e) => handleUpdate({ surveyDatetime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Survey Place</Label>
              <Input
                value={spotDetails.surveyPlace}
                onChange={(e) => handleUpdate({ surveyPlace: e.target.value })}
                placeholder="e.g. Near Toll Plaza, NH-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Police Reported?</Label>
              <select
                value={spotDetails.policeReported}
                onChange={(e) => handleUpdate({ policeReported: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="na">N/A</option>
              </select>
            </div>
            {spotDetails.policeReported === 'yes' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Police Station</Label>
                  <Input
                    value={spotDetails.policeStation}
                    onChange={(e) => handleUpdate({ policeStation: e.target.value })}
                    placeholder="Station Name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">FIR / GD No.</Label>
                  <Input
                    value={spotDetails.diaryNo}
                    onChange={(e) => handleUpdate({ diaryNo: e.target.value })}
                    placeholder="Enter Number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Panchanama?</Label>
                  <select
                    value={spotDetails.panchanama}
                    onChange={(e) => handleUpdate({ panchanama: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </>
            )}
            <div className={`space-y-1.5 ${spotDetails.policeReported === 'yes' ? 'sm:col-span-2' : ''}`}>
              <Label className="text-xs font-bold uppercase text-muted-foreground">Third Party Involved?</Label>
              <select
                value={spotDetails.tpInvolved}
                onChange={(e) => handleUpdate({ tpInvolved: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            {spotDetails.tpInvolved === 'yes' && (
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">TP Injury/Damage Details</Label>
                <Input
                  value={spotDetails.tpDetails}
                  onChange={(e) => handleUpdate({ tpDetails: e.target.value })}
                  placeholder="Details of TP victim/property"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECTION 2: DRIVER (AT SPOT) */}
        <Card className="border-amber/10 shadow-sm overflow-hidden">
          <CardHeader className="bg-amber/5 pb-4 border-b border-amber/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User size={16} className="text-amber-600" />
              Driver (Inspection Time)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Full Name</Label>
              <Input
                value={spotDetails.driverName}
                onChange={(e) => handleUpdate({ driverName: e.target.value.toUpperCase() })}
                className="font-bold underline decoration-amber/30 underline-offset-4"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">DL Number</Label>
              <Input
                value={spotDetails.mdlNo}
                onChange={(e) => handleUpdate({ mdlNo: e.target.value.toUpperCase() })}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Relation</Label>
              <select
                value={spotDetails.dlRelation}
                onChange={(e) => handleUpdate({ dlRelation: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="S/o">S/o</option>
                <option value="D/o">D/o</option>
                <option value="W/o">W/o</option>
              </select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Parent / Spouse Name</Label>
              <Input
                value={spotDetails.dlParentName}
                onChange={(e) => handleUpdate({ dlParentName: e.target.value.toUpperCase() })}
              />
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: VEHICLE STATUS */}
        <Card className="border-indigo/10 shadow-sm overflow-hidden">
          <CardHeader className="bg-indigo/5 pb-4 border-b border-indigo/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Gauge size={16} className="text-indigo-600" />
              Vehicle Condition (Spot)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground text-danger">Is Drivable?</Label>
              <select
                value={spotDetails.drivable}
                onChange={(e) => handleUpdate({ drivable: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-bold"
              >
                <option value="yes">Yes - Self Driven</option>
                <option value="no">No - Towed/Craned</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Damage Severity</Label>
              <select
                value={spotDetails.damageSeverity}
                onChange={(e) => handleUpdate({ damageSeverity: e.target.value as any })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="minor">Minor Damage</option>
                <option value="moderate">Moderate Damage</option>
                <option value="major">Major / Total Loss</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Airbags Deployed?</Label>
              <select
                value={spotDetails.airbags}
                onChange={(e) => handleUpdate({ airbags: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="na">N/A (No Airbags)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Temp. Repairs Suggested?</Label>
              <Input
                value={spotDetails.repairs}
                onChange={(e) => handleUpdate({ repairs: e.target.value })}
                placeholder="e.g. Tie-up bumper"
              />
            </div>
          </CardContent>
        </Card>

        {/* SECTION 4: COMMERCIAL LOAD (CONDITIONAL) */}
        {isCommercial ? (
          <Card className="border-success/10 shadow-sm overflow-hidden">
            <CardHeader className="bg-success/5 pb-4 border-b border-success/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Truck size={16} className="text-success" />
                Commercial Load & Permit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">GVW (KG)</Label>
                <Input
                  type="number"
                  value={spotDetails.gvw || ''}
                  onChange={(e) => handleUpdate({ gvw: parseInt(e.target.value) || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">ULW (KG)</Label>
                <Input
                  type="number"
                  value={spotDetails.ulw || ''}
                  onChange={(e) => handleUpdate({ ulw: parseInt(e.target.value) || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Payload (KG)</Label>
                <Input
                  type="number"
                  value={spotDetails.loadCapacity || ''}
                  onChange={(e) => handleUpdate({ loadCapacity: parseInt(e.target.value) || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Actual Load (KG)</Label>
                <Input
                  type="number"
                  value={spotDetails.actualLoad || ''}
                  onChange={(e) => handleUpdate({ actualLoad: parseInt(e.target.value) || null })}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Commodity Desc.</Label>
                <Input
                  value={spotDetails.loadDesc}
                  onChange={(e) => handleUpdate({ loadDesc: e.target.value })}
                  placeholder="e.g. Iron Rods"
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-border flex items-center justify-center p-8 text-muted-foreground">
            <div className="text-center space-y-2">
              <Truck size={24} className="mx-auto opacity-20" />
              <p className="text-xs font-semibold tracking-tight uppercase">Commercial Load Section Inactive</p>
              <p className="text-[10px]">Only enabled for Goods/Passenger vehicles</p>
            </div>
          </Card>
        )}
      </div>

      {/* SECTION 5: DAMAGE MATRIX */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/50 pb-4 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
            <ShieldCheck size={16} className="text-primary" />
            Component-wise Damage Matrix (Spot)
          </CardTitle>
          <button
            onClick={() => addSpotDamageRow()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:shadow-lg transition-all"
          >
            <PlusCircle size={14} /> ADD DAMAGE
          </button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase sticky top-0">
              <tr>
                <th className="px-6 py-3 font-bold w-12 border-b">#</th>
                <th className="px-6 py-3 font-bold w-1/3 border-b">Affected Component</th>
                <th className="px-6 py-3 font-bold border-b">Visual Damage Details</th>
                <th className="px-6 py-3 font-bold w-12 border-b"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {spotDamageRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <ShieldCheck size={48} />
                      <div className="text-sm font-bold uppercase tracking-widest">No Damages Logged</div>
                    </div>
                  </td>
                </tr>
              ) : (
                spotDamageRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-accent/5 transition-colors group">
                    <td className="px-6 py-4 text-xs font-bold text-muted-foreground">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="px-6 py-4">
                      <Input
                        value={row.component}
                        onChange={(e) => updateSpotDamageRow(row.id, { component: e.target.value })}
                        className="h-9 text-sm font-bold ring-0 border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary/20"
                        placeholder="e.g. Right Headlamp Assembly"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Input
                        value={row.damage}
                        onChange={(e) => updateSpotDamageRow(row.id, { damage: e.target.value })}
                        className="h-9 text-sm ring-0 border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary/20"
                        placeholder="e.g. Glass broken, internal bracket snapped"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => deleteSpotDamageRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-md transition-all text-muted-foreground hover:text-danger hover:bg-danger/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle size={18} className="text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-primary font-medium leading-relaxed">
          <span className="font-bold uppercase block mb-1">IRDAI Compliance Note</span>
          The spot survey report is a preliminary scene inspection. Ensure photographs are captured sequentially from 360&deg; including Chassis/VIN and Odometer reading before vehicle movement to workshop.
        </div>
      </div>
      {/* ── Section 6: Handoff & Finalization ───────────── */}
      <Card className="border-2 border-emerald-100 bg-emerald-50/30 shadow-sm mb-10 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-emerald-900 tracking-tight">
                  {isCompleted ? 'Spot Survey Finalized' : 'Finalize Spot Survey'}
                </h3>
                <p className="text-sm text-emerald-700/70 max-w-lg mt-1">
                  Once the spot survey is complete, finalize it to generate the professional spot report. 
                  This will also unlock the Assessment and Billing sections for the final survey stage.
                </p>
              </div>
            </div>
            
            {!isCompleted ? (
              <button
                onClick={handleFinalize}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-black text-sm transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#FFFFFF',
                }}
              >
                <Zap size={16} />
                Finish Spot & Handover
              </button>
            ) : (
              <div className="flex items-center gap-3 px-6 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-sm border border-emerald-200">
                <Lock size={16} />
                Workflow In Final Stage
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
