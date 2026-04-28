'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  PlusCircle, Trash2, Car, Gauge, ShieldCheck, Zap, FileText, MapPin,
  Receipt, Banknote, Camera, Percent, Calculator, CheckCircle, XCircle,
  Package, Truck,
} from 'lucide-react';
import type { ValuationConditionRow } from '@/types/assessment';

const CONDITION_OPTIONS = ['Good', 'Satisfactory', 'Average / Serviceable', 'Damaged', 'N/A'];

const PANEL_PRESETS = [
  'Front Bumper', 'Rear Bumper', 'Front Bonnet', 'Rear Boot / Dicky',
  'Roof Top', 'LH Front Door', 'RH Front Door', 'LH Rear Door', 'RH Rear Door',
  'LH Front Fender', 'RH Front Fender', 'LH Quarter Panel', 'RH Quarter Panel',
  'LH Rocker Panel', 'RH Rocker Panel', 'Front Windshield', 'Rear Windshield',
  'Underbody / Chassis',
];

// ── Shared 2-col row layout ────────────────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-stretch">
      <span className="px-5 py-3 text-xs font-black uppercase tracking-wider text-muted-foreground bg-muted/20 flex items-center border-r border-border self-stretch">
        {label}
      </span>
      <div className="px-5 py-2.5 flex items-center">
        {children}
      </div>
    </div>
  );
}

const COND_DATALIST_ID = 'condition-presets';

function CondInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      list={COND_DATALIST_ID}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type or pick: Good, Satisfactory…"
      className="h-9 w-full rounded border border-input bg-background px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

export function ValuationTab() {
  const { currentClaim, updateValuationDetails, updateFeeBill } = useClaimStore();

  if (!currentClaim) return null;

  const vd = currentClaim.valuationDetails;
  const rows: ValuationConditionRow[] = vd.panelRows ?? [];

  const handle = (updates: Partial<typeof vd>) => updateValuationDetails(updates);

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

      {/* ── SECTION 0: ADDRESSED TO ── */}
      <Card className="border-primary/20 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
            <MapPin size={16} />
            Addressed To
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <Row label="To (Name)">
              <Input
                value={vd.toName}
                onChange={(e) => handle({ toName: e.target.value })}
                placeholder="e.g. Reliance General Insurance, Mr. Ramesh Kumar"
                className="h-9 font-bold border-primary/10 w-full"
              />
            </Row>
            <Row label="Address">
              <Input
                value={vd.toAddress}
                onChange={(e) => handle({ toAddress: e.target.value })}
                placeholder="e.g. Andheri Branch, Mumbai — 400053"
                className="h-9 font-bold border-primary/10 w-full"
              />
            </Row>
          </div>
        </CardContent>
      </Card>

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
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <Row label="Chassis">
              <CondInput value={vd.chassis} onChange={(v) => handle({ chassis: v })} />
            </Row>
            <Row label="Engine & Transmission">
              <CondInput value={vd.engineTransmission} onChange={(v) => handle({ engineTransmission: v })} />
            </Row>
            <Row label="Suspension">
              <CondInput value={vd.suspension} onChange={(v) => handle({ suspension: v })} />
            </Row>
            <Row label="Seats & Upholstery">
              <CondInput value={vd.seats} onChange={(v) => handle({ seats: v })} />
            </Row>
            <Row label="Electricals">
              <CondInput value={vd.electricals} onChange={(v) => handle({ electricals: v })} />
            </Row>
          </div>
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
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <Row label="Battery Make">
              <Input
                value={vd.batteryMake}
                onChange={(e) => handle({ batteryMake: e.target.value })}
                placeholder="e.g. Amron, Exide"
                className="h-9 font-bold border-primary/10 w-full"
              />
            </Row>
            <Row label="Battery Condition">
              <CondInput value={vd.batteryCondition} onChange={(v) => handle({ batteryCondition: v })} />
            </Row>
          </div>
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
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <Row label="No. of Tyres">
              <Input
                value={vd.tyreCount}
                onChange={(e) => handle({ tyreCount: e.target.value })}
                placeholder="e.g. 4"
                className="h-9 font-bold border-primary/10 w-full"
              />
            </Row>
            <Row label="No. of Stepney">
              <Input
                value={vd.stepneyCount}
                onChange={(e) => handle({ stepneyCount: e.target.value })}
                placeholder="e.g. 1"
                className="h-9 font-bold border-primary/10 w-full"
              />
            </Row>
            <Row label="Tyre Make">
              <Input
                value={vd.tyreMake}
                onChange={(e) => handle({ tyreMake: e.target.value })}
                placeholder="e.g. CEAT, MRF"
                className="h-9 font-bold border-primary/10 w-full"
              />
            </Row>
            <Row label="Tyre Condition">
              <CondInput value={vd.tyreCondition} onChange={(v) => handle({ tyreCondition: v })} />
            </Row>
          </div>
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
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <Row label="Glass Condition">
              <Textarea
                value={vd.glassCondition}
                onChange={(e) => handle({ glassCondition: e.target.value })}
                placeholder="e.g. Windshield, rear door glass, LH/RH side glasses found without any crack or earlier damage"
                rows={2}
                className="font-bold border-primary/10 w-full resize-none"
              />
            </Row>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 6: CABIN & BODY PANEL CONDITION ── */}
      <Card className="border-border shadow-sm overflow-hidden">
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
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 opacity-30">
              <Car size={48} />
              <div className="text-sm font-bold uppercase tracking-widest">No Panels Added</div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[200px_1fr_40px] items-stretch group">
                  <div className="px-5 py-2.5 bg-muted/20 border-r border-border flex items-center">
                    <input
                      list="panel-presets-list"
                      value={row.component}
                      onChange={(e) => updateRow(row.id, { component: e.target.value })}
                      className="h-9 w-full text-sm font-bold ring-0 border border-input rounded bg-background focus:ring-1 focus:ring-primary/20 px-3 outline-none"
                      placeholder="Select / type panel"
                    />
                  </div>
                  <div className="px-5 py-2.5 flex items-center">
                    <Textarea
                      value={row.condition}
                      onChange={(e) => updateRow(row.id, { condition: e.target.value })}
                      placeholder="e.g. Dented at RH side corner, Found intact"
                      rows={1}
                      className="text-sm resize-none border border-input bg-background focus:ring-1 focus:ring-primary/20 rounded px-3 outline-none min-h-[36px] w-full font-medium"
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 p-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <datalist id="panel-presets-list">
          {PANEL_PRESETS.map(p => <option key={p} value={p} />)}
        </datalist>
        <datalist id={COND_DATALIST_ID}>
          {CONDITION_OPTIONS.map(o => <option key={o} value={o} />)}
        </datalist>
      </Card>

      {/* ── SECTION 7: SURVEY FEES BILL ── */}
      {(() => {
        const fb = currentClaim.feeBill;
        const setFb = (key: keyof typeof fb, val: unknown) => updateFeeBill({ [key]: val } as any);
        const photoCharges = (fb.photosCount || 0) * (fb.photoRate || 0);
        const subTotal = (fb.professionalFee || 0) + (fb.travelExpenses || 0)
          + photoCharges + (fb.postalCharges || 0) + (fb.haltageCharges || 0);
        const gstAmount = fb.includeGST ? subTotal * 0.18 : 0;
        const grossTotal = subTotal + gstAmount;
        const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        return (
          <Card className="border-primary/20 shadow-lg overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
              <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                <Receipt size={16} />
                Survey Fees Bill
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">

              {/* Bill meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Bill Date</Label>
                  <Input type="date" value={fb.billDate} onChange={e => setFb('billDate', e.target.value)} className="h-10 font-bold border-primary/10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Advance Receipt No.</Label>
                  <Input value={fb.advanceReceipt} onChange={e => setFb('advanceReceipt', e.target.value)} placeholder="e.g. ADV-001" className="h-10 font-bold border-primary/10" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Cash / Cheque Received</Label>
                  <Input value={fb.cashReceived} onChange={e => setFb('cashReceived', e.target.value)} placeholder="e.g. ₹5,000 cash received on 01/04/2026" className="h-10 font-bold border-primary/10" />
                </div>
              </div>

              {/* Fee components + summary side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left — inputs */}
                <div className="space-y-3">
                  {[
                    { key: 'professionalFee', label: 'Professional Fee (₹)', icon: <Calculator size={13} /> },
                    { key: 'travelExpenses',  label: 'Travel / Conveyance (₹)', icon: <Car size={13} /> },
                    { key: 'postalCharges',   label: 'Postal / Courier (₹)', icon: <Package size={13} /> },
                    { key: 'haltageCharges',  label: 'Haltage Charges (₹)', icon: <Truck size={13} /> },
                  ].map(({ key, label, icon }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">{label}</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
                        <Input
                          type="number" min={0}
                          value={(fb[key as keyof typeof fb] as number) || ''}
                          onChange={e => setFb(key as keyof typeof fb, Number(e.target.value))}
                          className="h-10 pl-8 font-bold border-primary/10"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Photos */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter flex items-center gap-1"><Camera size={10} /> No. of Photos</Label>
                      <Input type="number" min={0} value={fb.photosCount || ''} onChange={e => setFb('photosCount', Number(e.target.value))} className="h-10 font-bold border-primary/10" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Rate / Photo (₹)</Label>
                      <Input type="number" min={0} value={fb.photoRate || ''} onChange={e => setFb('photoRate', Number(e.target.value))} className="h-10 font-bold border-primary/10" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-tighter">Travel Note</Label>
                    <Input value={fb.travelNote} onChange={e => setFb('travelNote', e.target.value)} placeholder="e.g. 80 km × ₹10" className="h-10 font-bold border-primary/10" />
                  </div>
                </div>

                {/* Right — summary */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#0D1B2A' }}>
                  <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#D4AF37' }}>Fee Summary</div>
                  </div>
                  <div className="px-5 py-4 space-y-0">
                    {[
                      { label: 'Professional Fee',    val: fb.professionalFee || 0 },
                      { label: 'Travel',              val: fb.travelExpenses || 0 },
                      { label: `Photos (${fb.photosCount || 0}×${fmt(fb.photoRate || 0)})`, val: photoCharges },
                      { label: 'Postal / Courier',    val: fb.postalCharges || 0 },
                      { label: 'Haltage',             val: fb.haltageCharges || 0 },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="text-xs" style={{ color: 'rgba(232,236,240,0.55)' }}>{label}</span>
                        <span className="text-xs font-bold" style={{ color: '#F8F9FA' }}>{fmt(val)}</span>
                      </div>
                    ))}

                    <div className="flex items-center justify-between py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 4 }}>
                      <span className="text-sm font-bold" style={{ color: '#F8F9FA' }}>Sub Total</span>
                      <span className="text-sm font-black" style={{ color: '#F8F9FA' }}>{fmt(subTotal)}</span>
                    </div>

                    {/* GST toggle */}
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-2">
                        <Percent size={12} style={{ color: '#D4AF37' }} />
                        <span className="text-xs font-bold" style={{ color: '#F8F9FA' }}>GST @ 18%</span>
                      </div>
                      <button
                        onClick={() => setFb('includeGST', !fb.includeGST)}
                        className="w-9 h-4 rounded-full relative transition-all"
                        style={{ background: fb.includeGST ? '#D4AF37' : 'rgba(255,255,255,0.15)' }}
                      >
                        <span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all" style={{ left: fb.includeGST ? 'calc(100% - 14px)' : 2 }} />
                      </button>
                    </div>

                    {fb.includeGST && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-xs" style={{ color: 'rgba(232,236,240,0.55)' }}>GST (18%)</span>
                        <span className="text-xs font-bold" style={{ color: '#D4AF37' }}>{fmt(gstAmount)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between px-4 py-3 rounded-xl mt-3" style={{ background: 'linear-gradient(135deg, #D4AF37, #f0d870)' }}>
                      <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>GROSS TOTAL</span>
                      <span className="text-base font-black" style={{ color: '#0D1B2A' }}>{fmt(grossTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment status */}
              <button
                onClick={() => setFb('feePaid', !fb.feePaid)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                style={{
                  background: fb.feePaid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.05)',
                  border: `1.5px solid ${fb.feePaid ? '#10B981' : '#FECACA'}`,
                }}
              >
                {fb.feePaid
                  ? <CheckCircle size={18} style={{ color: '#10B981', flexShrink: 0 }} />
                  : <XCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                }
                <span className="text-sm font-black" style={{ color: fb.feePaid ? '#10B981' : '#EF4444' }}>
                  {fb.feePaid ? 'Fee Received' : 'Fee Not Yet Received'}
                </span>
                <span className="ml-auto text-[10px] font-semibold text-muted-foreground">tap to toggle</span>
              </button>

            </CardContent>
          </Card>
        );
      })()}

      {/* ── SECTION 8: CONCLUSION ── */}
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
