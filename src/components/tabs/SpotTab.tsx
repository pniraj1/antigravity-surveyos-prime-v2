'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, PlusCircle, AlertTriangle, ShieldCheck, Truck, User, MapPin, Gauge, CheckCircle2, Zap, Lock, FileText, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { saveClaim } from '@/lib/storage/indexeddb';

const S = () => <span className="ml-1 inline-block w-2 h-2 rounded-full bg-green-500 align-middle" title="Used in Spot Report" />;

export function SpotTab() {
  const { currentClaim, updateSpotDetails, updateDriver, updateAccident, updateVehicle, addSpotDamageRow, updateSpotDamageRow, deleteSpotDamageRow, updateClaim } = useClaimStore();

  if (!currentClaim) return null;

  const isCompleted = currentClaim.isSpotCompleted;

  const handleFinalize = async () => {
    if (confirm('Are you sure you want to finalize the Spot Survey? This will unlock the Final Survey workflow.')) {
      try {
        await saveClaim(currentClaim);
        updateClaim({ isSpotCompleted: true, surveyType: 'final' });
        toast.success('Spot Survey Finalized! Final Workflow Unlocked.');
      } catch {
        toast.error('Failed to save spot data — please try again.');
      }
    }
  };

  const { spotDetails, vehicleType, driver, accident, vehicle } = currentClaim;
  const spotDamageRows = currentClaim.spotDamageRows ?? [];
  const isCommercial = vehicleType !== 'private';
  const overloaded = (spotDetails.actualLoad || 0) > (spotDetails.loadCapacity || 0);

  const handleUpdate = (updates: Partial<typeof spotDetails>) => {
    updateSpotDetails(updates);
  };

  return (
    <div className="space-y-8 border-t pt-8 animate-in fade-in duration-300">
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

      {/* ── SECTION: SURVEY DATES ── */}
      <Card className="border-primary/20 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
            <Zap size={16} />
            Survey Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Report Date</Label>
            <Input
              type="date"
              value={spotDetails.reportDate}
              onChange={(e) => handleUpdate({ reportDate: e.target.value })}
              className="h-10 font-bold border-primary/10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Date of Allotment</Label>
            <Input
              type="date"
              value={spotDetails.allotmentDate}
              onChange={(e) => handleUpdate({ allotmentDate: e.target.value })}
              className="h-10 font-bold border-primary/10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter text-primary">Survey Datetime (Actual)</Label>
            <Input
              type="datetime-local"
              value={spotDetails.surveyDatetime}
              onChange={(e) => handleUpdate({ surveyDatetime: e.target.value })}
              className="h-10 font-bold border-primary/20 bg-primary/5 ring-primary/10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 1: SCENE & POLICE */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/50 pb-4 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              Scene & Authorities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Police Reported?<S /></Label>
              <select
                value={spotDetails.policeReported}
                onChange={(e) => handleUpdate({ policeReported: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold focus:ring-2 focus:ring-primary/20"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {spotDetails.policeReported === 'yes' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Panchanama?<S /></Label>
                  <select
                    value={spotDetails.panchanama}
                    onChange={(e) => handleUpdate({ panchanama: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </>
            )}

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Third Party Involvement<S /></Label>
              <select
                value={spotDetails.tpInvolved}
                onChange={(e) => handleUpdate({ tpInvolved: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="no">NIL — No Third Party</option>
                <option value="tppd">TPPD — Property Damage Only</option>
                <option value="tppi">TPPI — Personal Injury / Death</option>
                <option value="both">Both — Property Damage & Injury</option>
              </select>
            </div>
            
            {(spotDetails.tpInvolved !== 'no') && (
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">TP Details<S /></Label>
                <Input
                  value={accident.thirdPartyDetails}
                  onChange={(e) => updateAccident({ thirdPartyDetails: e.target.value })}
                  placeholder="Details of TP victim/property"
                />
              </div>
            )}
          </CardContent>
        </Card>



        {/* SECTION 3: VEHICLE STATUS */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/50 pb-4 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Gauge size={16} className="text-primary" />
              Vehicle Status at Spot
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Is Drivable?<S /></Label>
              <select
                value={spotDetails.drivable}
                onChange={(e) => handleUpdate({ drivable: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-bold"
              >
                <option value="yes">Yes - Driven Self</option>
                <option value="no">No - Towed/Craned</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Damage Severity<S /></Label>
              <select
                value={spotDetails.damageSeverity}
                onChange={(e) => handleUpdate({ damageSeverity: e.target.value as any })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="minor">Minor Damage</option>
                <option value="moderate">Moderate Damage</option>
                <option value="major">Major / Total Loss</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Airbags Status<S /></Label>
              <select
                value={spotDetails.airbags}
                onChange={(e) => handleUpdate({ airbags: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="no">Not Deployed</option>
                <option value="yes">Deployed</option>
                <option value="na">N/A (No Airbags)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Temporary Repairs Suggested<S /></Label>
              <Input
                value={spotDetails.repairs}
                onChange={(e) => handleUpdate({ repairs: e.target.value })}
                placeholder="Immediate actions taken..."
              />
            </div>
          </CardContent>
        </Card>

        {/* SECTION 4: LEGAL & LOGISTICS (CONDITIONAL) */}
        {isCommercial ? (
          <div className="space-y-4">
            <Card className="border-border shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/50 pb-4 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  Commercial Compliance (Permit/Fitness)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Permit No.<S /></Label>
                  <Input
                    value={spotDetails.permitNo}
                    onChange={(e) => handleUpdate({ permitNo: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Permit Type<S /></Label>
                  <select
                    className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary h-10"
                    value={spotDetails.permitType}
                    onChange={(e) => handleUpdate({ permitType: e.target.value })}
                  >
                    <option value="">Select Type</option>
                    <option value="National">National Permit</option>
                    <option value="State">State Permit</option>
                    <option value="Zonal">Zonal Permit</option>
                    <option value="Service">Service Permit</option>
                    <option value="Contract">Contract Carriage</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Permit Valid Upto<S /></Label>
                  <Input
                    type="date"
                    value={spotDetails.permitTo}
                    onChange={(e) => handleUpdate({ permitTo: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Auth No.<S /></Label>
                  <Input
                    value={spotDetails.authNo}
                    onChange={(e) => handleUpdate({ authNo: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Actual Load (KG)<S /></Label>
                  <Input
                    type="number"
                    className={`font-mono font-bold ${overloaded ? 'text-red-600 border-red-200 bg-red-50' : 'text-green-600'}`}
                    value={spotDetails.actualLoad || ''}
                    onChange={(e) => handleUpdate({ actualLoad: Number(e.target.value) })}
                  />
                </div>

                {/* Challan Info */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Challan No.<S /></Label>
                  <Input
                    value={spotDetails.challanNo}
                    placeholder="CN Number"
                    onChange={(e) => handleUpdate({ challanNo: e.target.value.toUpperCase() })}
                    disabled={isCompleted}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Challan Date<S /></Label>
                  <Input
                    type="date"
                    value={spotDetails.challanDate}
                    onChange={(e) => handleUpdate({ challanDate: e.target.value })}
                    disabled={isCompleted}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Log Book / Tax Paid<S /></Label>
                  <Input
                    value={spotDetails.fitnessType}
                    onChange={(e) => handleUpdate({ fitnessType: e.target.value })}
                    placeholder="e.g. Paid Upto 2026"
                    disabled={isCompleted}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Area of Operation<S /></Label>
                  <Input
                    value={spotDetails.areaOfOperation}
                    onChange={(e) => handleUpdate({ areaOfOperation: e.target.value })}
                    placeholder="e.g. All India, State-wide"
                    disabled={isCompleted}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/50 pb-4 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Truck size={16} className="text-emerald-600" />
                  Load Logistics & Challan
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">GVW / RLW (KG)<S /></Label>
                    <Input
                      type="number"
                      value={spotDetails.gvw || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        handleUpdate({ 
                          gvw: val,
                          loadCapacity: val - (spotDetails.ulw || 0)
                        });
                      }}
                      className="font-bold text-blue-600"
                      disabled={isCompleted}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">ULW (KG)<S /></Label>
                    <Input
                      type="number"
                      value={spotDetails.ulw || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        handleUpdate({ 
                          ulw: val,
                          loadCapacity: (spotDetails.gvw || 0) - val
                        });
                      }}
                      disabled={isCompleted}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Payload Capacity<S /></Label>
                    <Input
                      type="number"
                      value={spotDetails.loadCapacity || ''}
                      disabled={true}
                      className="bg-muted font-bold text-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Goods Description<S /></Label>
                    <Input
                      value={spotDetails.loadDesc}
                      onChange={(e) => handleUpdate({ loadDesc: e.target.value })}
                      placeholder="Type of goods being carried..."
                      disabled={isCompleted}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Route From<S /></Label>
                      <Input
                        value={spotDetails.loadOrigin}
                        onChange={(e) => handleUpdate({ loadOrigin: e.target.value })}
                        disabled={isCompleted}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Route To<S /></Label>
                      <Input
                        value={spotDetails.loadDest}
                        onChange={(e) => handleUpdate({ loadDest: e.target.value })}
                        disabled={isCompleted}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-dashed border-border flex items-center justify-center p-8 text-muted-foreground bg-muted/20">
            <div className="text-center space-y-2">
              <Truck size={24} className="mx-auto opacity-20" />
              <p className="text-xs font-bold tracking-tight uppercase">Legal & Logistics Section Halted</p>
              <p className="text-[10px]">Information only required for Goods/Commercial vehicles</p>
            </div>
          </Card>
        )}
      </div>

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

      {/* SECTION 5: DAMAGE MATRIX */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/50 pb-4 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
            <ShieldCheck size={16} className="text-primary" />
            Component-wise Damage Matrix (Spot)
          </CardTitle>
          {!isCompleted && (
            <button
              onClick={() => addSpotDamageRow()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:shadow-lg transition-all"
            >
              <PlusCircle size={14} /> ADD DAMAGE
            </button>
          )}
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
                      <input
                        list="spot-components-list"
                        value={row.component}
                        onChange={(e) => updateSpotDamageRow(row.id, { component: e.target.value })}
                        disabled={isCompleted}
                        className="h-9 w-full text-sm font-bold ring-0 border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary/20 rounded px-2 outline-none"
                        placeholder="Select Component"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Input
                        value={row.damage}
                        onChange={(e) => updateSpotDamageRow(row.id, { damage: e.target.value })}
                        disabled={isCompleted}
                        className="h-9 text-sm ring-0 border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary/20"
                        placeholder="e.g. Glass broken, internal bracket snapped"
                      />
                    </td>
                    <td className="px-6 py-4">
                      {!isCompleted && (
                        <button 
                          onClick={() => deleteSpotDamageRow(row.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-md transition-all text-muted-foreground hover:text-danger hover:bg-danger/10"
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
      
      {/* SECTION 6: OBSERVATIONS & REMARKS */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/50 pb-4 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" />
            Observations & Final Remarks
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Spot Observations / Comments<S /></Label>
              <textarea
                value={spotDetails.comments}
                onChange={(e) => handleUpdate({ comments: e.target.value })}
                className="w-full min-h-[120px] rounded-md border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-primary/20"
                placeholder="Describe the accident scene, vehicle position, and overall assessment..."
                disabled={isCompleted}
              />
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Further Repairs<S /></Label>
                  <Input
                    value={spotDetails.repairWorkshop ?? ''}
                    placeholder="Workshop where vehicle will go for further repairs"
                    onChange={(e) => handleUpdate({ repairWorkshop: e.target.value })}
                    disabled={isCompleted}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground gap-1 flex items-center">Enclosed Documents<S /></Label>
                <textarea
                  value={spotDetails.enclosures}
                  onChange={(e) => handleUpdate({ enclosures: e.target.value })}
                  className="w-full min-h-[60px] rounded-md border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Copy of RC, DL, Policy, Spot Photos"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-indigo/5 border border-indigo/20 p-4 rounded-xl flex items-start gap-3">
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
