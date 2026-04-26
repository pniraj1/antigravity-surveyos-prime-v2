'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Car, Gauge, ShieldCheck, Zap, FileText } from 'lucide-react';
import type { ValuationConditionRow } from '@/types/assessment';

const CONDITION_OPTIONS = ['Good', 'Satisfactory', 'Average / Serviceable', 'Damaged', 'N/A'];

const PANEL_PRESETS = [
  'Front Bumper', 'Rear Bumper', 'Front Bonnet', 'Rear Boot / Dicky',
  'Roof Top', 'LH Front Door', 'RH Front Door', 'LH Rear Door', 'RH Rear Door',
  'LH Front Fender', 'RH Front Fender', 'LH Quarter Panel', 'RH Quarter Panel',
  'LH Rocker Panel', 'RH Rocker Panel', 'Front Windshield', 'Rear Windshield',
  'Underbody / Chassis',
];

export function ValuationTab() {
  const { currentClaim, updateValuationDetails } = useClaimStore();

  if (!currentClaim) return null;

  const vd = currentClaim.valuationDetails;
  const rows: ValuationConditionRow[] = vd.panelRows ?? [];

  const handle = (updates: Partial<typeof vd>) => updateValuationDetails(updates);

  // ── Panel row helpers ──────────────────────────────────────────────────────
  function addRow() {
    const newRow: ValuationConditionRow = { id: `vrow-${Date.now()}`, component: '', condition: '' };
    handle({ panelRows: [...rows, newRow] });
  }

  function updateRow(id: string, patch: Partial<ValuationConditionRow>) {
    handle({ panelRows: rows.map(r => r.id === id ? { ...r, ...patch } : r) });
  }

  function deleteRow(id: string) {
    handle({ panelRows: rows.filter(r => r.id !== id) });
  }

  // ── Condition select helper ────────────────────────────────────────────────
  function condSelect(
    label: string,
    key: keyof typeof vd,
    noteKey?: keyof typeof vd,
  ) {
    return (
      <div className="space-y-1.5">
        <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">{label}</Label>
        <select
          value={String(vd[key] ?? '')}
          onChange={(e) => handle({ [key]: e.target.value } as Partial<typeof vd>)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">— Select —</option>
          {CONDITION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {noteKey && (
          <Input
            value={String(vd[noteKey] ?? '')}
            onChange={(e) => handle({ [noteKey]: e.target.value } as Partial<typeof vd>)}
            placeholder="Additional note (optional)"
            className="h-8 text-xs border-primary/10 mt-1"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 border-t pt-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary">Valuation / Break-in Inspection</h2>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-wider font-semibold">
            Pre-Insurance Vehicle Condition Report
          </p>
        </div>
        <div className="px-3 py-1 bg-amber-100 rounded-full text-amber-700 text-xs font-bold ring-1 ring-amber-300">
          BREAK-IN MODE
        </div>
      </div>

      {/* ── SECTION 1: INSPECTION DETAILS ── */}
      <Card className="border-primary/20 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
            <Gauge size={16} />
            Inspection Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Date of Inspection</Label>
            <Input
              type="date"
              value={vd.inspectionDate}
              onChange={(e) => handle({ inspectionDate: e.target.value })}
              className="h-10 font-bold border-primary/10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Place of Inspection</Label>
            <Input
              value={vd.inspectionPlace}
              onChange={(e) => handle({ inspectionPlace: e.target.value })}
              placeholder="e.g. Chandannagar, Pune"
              className="h-10 font-bold border-primary/10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Odometer Reading (km)</Label>
            <Input
              value={vd.odometer}
              onChange={(e) => handle({ odometer: e.target.value })}
              placeholder="e.g. 42987"
              className="h-10 font-bold border-primary/10"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 2: MECHANICAL CONDITION ── */}
      <Card className="border-primary/20 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
            <Car size={16} />
            Mechanical Condition
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {condSelect('Chassis', 'chassis')}
          {condSelect('Engine & Transmission', 'engineTransmission')}
          {condSelect('Suspension', 'suspension')}
          {condSelect('Seats & Upholstery', 'seats')}
          {condSelect('Electricals', 'electricals')}
        </CardContent>
      </Card>

      {/* ── SECTION 3: BATTERY ── */}
      <Card className="border-primary/20 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
            <Zap size={16} />
            Battery
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Battery Make</Label>
            <Input
              value={vd.batteryMake}
              onChange={(e) => handle({ batteryMake: e.target.value })}
              placeholder="e.g. Amron, Exide"
              className="h-10 font-bold border-primary/10"
            />
          </div>
          {condSelect('Battery Condition', 'batteryCondition')}
        </CardContent>
      </Card>

      {/* ── SECTION 4: TYRES ── */}
      <Card className="border-primary/20 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
            <Car size={16} />
            Tyres & Stepney
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">No. of Tyres</Label>
            <Input
              value={vd.tyreCount}
              onChange={(e) => handle({ tyreCount: e.target.value })}
              placeholder="e.g. 4"
              className="h-10 font-bold border-primary/10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">No. of Stepney</Label>
            <Input
              value={vd.stepneyCount}
              onChange={(e) => handle({ stepneyCount: e.target.value })}
              placeholder="e.g. 1"
              className="h-10 font-bold border-primary/10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Tyre Make</Label>
            <Input
              value={vd.tyreMake}
              onChange={(e) => handle({ tyreMake: e.target.value })}
              placeholder="e.g. CEAT, MRF"
              className="h-10 font-bold border-primary/10"
            />
          </div>
          {condSelect('Tyre Condition', 'tyreCondition')}
        </CardContent>
      </Card>

      {/* ── SECTION 5: GLASS ── */}
      <Card className="border-primary/20 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
            <ShieldCheck size={16} />
            Glass Condition
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Textarea
            value={vd.glassCondition}
            onChange={(e) => handle({ glassCondition: e.target.value })}
            placeholder="e.g. Windshield, rear door glass, LH/RH side glasses found without any crack or earlier damage"
            rows={2}
            className="font-bold border-primary/10"
          />
        </CardContent>
      </Card>

      {/* ── SECTION 6: PANEL DAMAGE MATRIX ── */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/50 pb-4 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
            <ShieldCheck size={16} className="text-primary" />
            Cabin & Body Shell — Panel Condition
          </CardTitle>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:shadow-lg transition-all"
          >
            <PlusCircle size={14} /> ADD PANEL
          </button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase sticky top-0">
              <tr>
                <th className="px-6 py-3 font-bold w-12 border-b">#</th>
                <th className="px-6 py-3 font-bold w-2/5 border-b">Panel / Component</th>
                <th className="px-6 py-3 font-bold border-b">Condition / Damage Description</th>
                <th className="px-6 py-3 font-bold w-12 border-b"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <Car size={48} />
                      <div className="text-sm font-bold uppercase tracking-widest">No Panels Added</div>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-accent/5 transition-colors group">
                    <td className="px-6 py-4 text-xs font-bold text-muted-foreground">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="px-6 py-4">
                      <input
                        list="panel-presets-list"
                        value={row.component}
                        onChange={(e) => updateRow(row.id, { component: e.target.value })}
                        className="h-9 w-full text-sm font-bold ring-0 border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary/20 rounded px-2 outline-none"
                        placeholder="Select / type panel"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Textarea
                        value={row.condition}
                        onChange={(e) => updateRow(row.id, { condition: e.target.value })}
                        placeholder="e.g. Dented at RH side, Found intact"
                        rows={1}
                        className="text-sm resize-none border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary/20 rounded px-2 outline-none min-h-[36px]"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
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
        <datalist id="panel-presets-list">
          {PANEL_PRESETS.map(p => <option key={p} value={p} />)}
        </datalist>
      </Card>

      {/* ── SECTION 7: CONCLUSION ── */}
      <Card className="border-primary/20 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
            <FileText size={16} />
            Conclusion & Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Vehicle Insurable?</Label>
            <div className="flex gap-3">
              {[true, false].map(val => (
                <button
                  key={String(val)}
                  onClick={() => handle({ isInsurable: val })}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    vd.isInsurable === val
                      ? val ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  {val ? 'YES — Insurable' : 'NO — Not Insurable'}
                </button>
              ))}
            </div>
          </div>

          {vd.isInsurable && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Cover Recommendation</Label>
              <Input
                value={vd.coverRecommendation}
                onChange={(e) => handle({ coverRecommendation: e.target.value })}
                placeholder="e.g. Package Terms with Nil Depreciation as Add-on Cover"
                className="h-10 font-bold border-primary/10"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Document Verification Note</Label>
            <Input
              value={vd.documentVerificationNote}
              onChange={(e) => handle({ documentVerificationNote: e.target.value })}
              placeholder="e.g. found in order except for the Fitness Certificate"
              className="h-10 font-bold border-primary/10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Enclosures</Label>
            <Input
              value={vd.enclosures}
              onChange={(e) => handle({ enclosures: e.target.value })}
              placeholder="e.g. RC copy, Photographs"
              className="h-10 font-bold border-primary/10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Additional Remarks</Label>
            <Textarea
              value={vd.remarks}
              onChange={(e) => handle({ remarks: e.target.value })}
              placeholder="Any additional observations..."
              rows={3}
              className="font-bold border-primary/10"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
