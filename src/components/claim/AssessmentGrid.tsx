'use client';

import { useClaimStore } from '@/stores/claim-store';
import { getDepreciationRate, getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { formatCurrency } from '@/lib/calculations/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, PlusCircle, Wrench, ShieldAlert } from 'lucide-react';
import type { PartType } from '@/types';

export function AssessmentGrid() {
  const { 
    currentClaim, 
    addAssessmentRow, 
    updateAssessmentRow, 
    deleteAssessmentRow,
    toggleRowAllowed 
  } = useClaimStore();

  if (!currentClaim) return null;

  const { assessmentRows, vehicle, accident, depreciationType } = currentClaim;

  // Calculate vehicle age once for the grid
  const ageMonths = getVehicleAgeMonths(
    vehicle.dateOfRegistration,
    vehicle.yearOfManufacture,
    accident.dateAndTime
  );

  return (
    <Card className="flex flex-col h-full border-border">
      <CardHeader className="border-b border-border bg-card/50 px-4 py-3 flex flex-row items-center justify-between sticky top-0 z-10 rounded-t-xl">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Wrench size={16} className="text-primary" />
          Parts Assessment Grid
        </CardTitle>
        <div className="flex gap-2">
          <button
            onClick={() => addAssessmentRow('parts')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition-colors"
          >
            <PlusCircle size={14} /> Part Row
          </button>
          <button
            onClick={() => addAssessmentRow('labour')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary transition-colors border border-primary/20 text-xs font-semibold"
          >
            <PlusCircle size={14} /> Labour Row
          </button>
        </div>
      </CardHeader>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase sticky top-0 z-0 shadow-sm">
            <tr>
              <th className="px-3 py-2 font-medium w-6">#</th>
              <th className="px-3 py-2 font-medium w-8 text-center" title="Allowed?"><ShieldAlert size={12} className="mx-auto opacity-50" /></th>
              <th className="px-3 py-2 font-medium min-w-[250px]">Particulars</th>
              <th className="px-3 py-2 font-medium w-32">Type</th>
              <th className="px-3 py-2 font-medium w-28">Est. (₹)</th>
              <th className="px-3 py-2 font-medium w-28 text-primary">Assessed (₹)</th>
              <th className="px-3 py-2 font-medium w-20 text-danger text-center">Dep %</th>
              <th className="px-3 py-2 font-medium w-28 text-right pr-6">Net (₹)</th>
              <th className="px-2 py-2 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assessmentRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                    <Wrench size={20} className="opacity-50" />
                  </div>
                  <p className="text-sm">No items in assessment.</p>
                  <p className="text-xs opacity-60">Click the buttons above to add parts or labour.</p>
                </td>
              </tr>
            ) : (
              assessmentRows.map((row, idx) => {
                // ─── Real-Time Math Output ─────────────────
                const depRate = getDepreciationRate(row.partType, ageMonths, depreciationType);
                const depFactor = depRate / 100;
                
                const netAssessed = row.assessed * (1 - depFactor);

                return (
                  <tr key={row.id} className={`hover:bg-accent/30 transition-colors ${!row.allowed ? 'opacity-40 bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input 
                        type="checkbox" 
                        checked={row.allowed}
                        onChange={() => toggleRowAllowed(row.id)}
                        className="rounded border-border focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary" 
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.particulars}
                        onChange={(e) => updateAssessmentRow(row.id, { particulars: e.target.value })}
                        className="h-8 text-xs font-semibold lg:text-sm bg-transparent border-transparent hover:border-input focus:bg-background"
                        placeholder="Item Description"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row.partType}
                        onChange={(e) => {
                          const val = e.target.value as PartType;
                          updateAssessmentRow(row.id, { 
                            partType: val, 
                            section: (val === 'labour' || val === 'paint') ? val : 'parts' 
                          });
                        }}
                        className={`h-8 w-full text-xs rounded-md border border-transparent hover:border-input focus:border-input focus:bg-background bg-transparent px-2 disabled:cursor-not-allowed
                          ${row.partType === 'metal' ? 'text-blue-500' : 
                            row.partType === 'plastic' ? 'text-amber' : 
                            row.partType === 'glass' ? 'text-teal' : 
                            row.partType === 'paint' ? 'text-purple-500' : 
                            'text-sidebar-foreground'} font-medium
                        `}
                      >
                        <option value="metal">🟦 Metal</option>
                        <option value="plastic">🟧 Plastic / Rubber</option>
                        <option value="glass">🟩 Glass</option>
                        <option value="paint">🎨 Paint Material</option>
                        <option value="labour">⚙️ Labour</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        value={row.estimated || ''}
                        onChange={(e) => updateAssessmentRow(row.id, { estimated: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs text-right bg-transparent border-transparent hover:border-input focus:bg-background px-2"
                        placeholder="0.00"
                        min="0"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        value={row.assessed || ''}
                        onChange={(e) => updateAssessmentRow(row.id, { assessed: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs text-right font-bold text-primary bg-transparent border-transparent hover:border-input focus:bg-background px-2"
                        placeholder="0.00"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-center text-xs font-bold text-danger bg-danger/5">
                      {row.allowed && row.section === 'parts' ? `${depRate}%` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-black pr-6 tabular-nums">
                      {row.allowed ? formatCurrency(netAssessed) : '₹0.00'}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button 
                        onClick={() => deleteAssessmentRow(row.id)}
                        className="text-muted-foreground hover:text-danger hover:bg-danger/10 p-1.5 rounded-md transition-colors"
                        title="Delete Row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
