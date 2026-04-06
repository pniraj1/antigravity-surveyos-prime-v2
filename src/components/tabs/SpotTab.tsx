'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, PlusCircle, AlertTriangle } from 'lucide-react';

export function SpotTab() {
  const { currentClaim, updateSpotDetails, addSpotDamageRow, updateSpotDamageRow, deleteSpotDamageRow } = useClaimStore();

  if (!currentClaim) return null;

  const { spotDetails, spotDamageRows } = currentClaim;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Spot Survey</h2>
        <p className="text-muted-foreground text-sm mt-1">Secondary survey details and spot damage matrix.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Core Detail Grid */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-card/50 pb-4 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle size={16} className="text-primary" />
                Police & TP Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Police Reported?</Label>
                <select
                  value={spotDetails.policeReported}
                  onChange={(e) => updateSpotDetails({ policeReported: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="na">N/A</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Police Station</Label>
                <Input
                  value={spotDetails.policeStation}
                  onChange={(e) => updateSpotDetails({ policeStation: e.target.value })}
                  placeholder="Enter station name"
                  disabled={spotDetails.policeReported !== 'yes'}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Diary / FIR No.</Label>
                <Input
                  value={spotDetails.diaryNo}
                  onChange={(e) => updateSpotDetails({ diaryNo: e.target.value })}
                  placeholder="Enter FIR number"
                  disabled={spotDetails.policeReported !== 'yes'}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Third Party Involved?</Label>
                <select
                  value={spotDetails.tpInvolved}
                  onChange={(e) => updateSpotDetails({ tpInvolved: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {spotDetails.tpInvolved === 'yes' && (
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Third Party Details</Label>
                  <Input
                    value={spotDetails.tpDetails}
                    onChange={(e) => updateSpotDetails({ tpDetails: e.target.value })}
                    placeholder="Provide TP damage details..."
                  />
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-card/50 pb-4 border-b border-border">
              <CardTitle className="text-sm font-semibold">Incident Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Damage Severity</Label>
                  <select
                    value={spotDetails.damageSeverity}
                    onChange={(e) => updateSpotDetails({ damageSeverity: e.target.value as 'minor'|'moderate'|'major' })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                  >
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="major">Major / Total Loss</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vehicle Drivable?</Label>
                  <select
                    value={spotDetails.drivable}
                    onChange={(e) => updateSpotDetails({ drivable: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Additional Comments / Remarks</Label>
                <textarea
                  value={spotDetails.comments}
                  onChange={(e) => updateSpotDetails({ comments: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary min-h-[100px]"
                  placeholder="Details observed at the spot..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Spot Damage Matrix */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm h-full flex flex-col items-stretch">
            <CardHeader className="bg-card/50 pb-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Affected Components</CardTitle>
              <button
                onClick={() => addSpotDamageRow()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition-colors"
              >
                <PlusCircle size={14} /> Add Damage
              </button>
            </CardHeader>
            <div className="flex-1 overflow-x-auto min-h-[300px]">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-muted-foreground text-xs uppercase sticky top-0">
                  <tr>
                    <th className="px-4 py-2 font-medium w-12">#</th>
                    <th className="px-4 py-2 font-medium w-1/3">Component</th>
                    <th className="px-4 py-2 font-medium">Damage Details</th>
                    <th className="px-4 py-2 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {spotDamageRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                        <AlertTriangle size={24} className="mx-auto opacity-30 mb-3" />
                        <p className="text-sm">No spot damages recorded.</p>
                      </td>
                    </tr>
                  ) : (
                    spotDamageRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-2 text-xs font-medium text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={row.component}
                            onChange={(e) => updateSpotDamageRow(row.id, { component: e.target.value })}
                            className="h-8 text-xs font-semibold bg-transparent border-transparent hover:border-input focus:bg-background"
                            placeholder="e.g. Front Bumper"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={row.damage}
                            onChange={(e) => updateSpotDamageRow(row.id, { damage: e.target.value })}
                            className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:bg-background"
                            placeholder="e.g. Broken / Scratched"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button 
                            onClick={() => deleteSpotDamageRow(row.id)}
                            className="text-muted-foreground hover:text-danger hover:bg-danger/10 p-1.5 rounded-md transition-colors"
                            title="Delete Row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
