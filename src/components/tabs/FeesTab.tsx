'use client';

import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { calculateAssessmentSummary } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { triggerSpotFeeBillPrint } from '@/lib/reports/spot-fee-bill-builder';
import {
  Receipt, DollarSign, Calculator, Percent, Plus, Minus,
  TrendingDown, FileText, Calendar, Banknote, Car, Camera,
  Package, Phone, Truck, CheckCircle, XCircle,
} from 'lucide-react';

// ─── Fee Bill Section ────────────────────────────────────────────────────────
function FeeLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F0F2F5' }}>
      <span className="text-sm" style={{ color: '#4A4E69' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: '#0D1B2A' }}>{value}</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export function FeesTab() {
  const { currentClaim, updateFeeBill } = useClaimStore();
  const { profile } = useProfileStore();

  if (!currentClaim) return null;

  const fb = currentClaim.feeBill;

  // Calculate sub-totals
  const photoCharges   = (fb.photosCount || 0) * (fb.photoRate || 0);
  const subTotal       = (fb.professionalFee || 0) + (fb.riFee || 0) + (fb.travelExpenses || 0) +
                         photoCharges + (fb.postalCharges || 0) + (fb.haltageCharges || 0);
  const gstAmount      = fb.includeGST ? subTotal * 0.18 : 0;
  const grossTotal     = subTotal + gstAmount;

  const ageMonths = getVehicleAgeMonths(
    currentClaim.vehicle.dateOfRegistration,
    currentClaim.vehicle.yearOfManufacture,
    currentClaim.accident.dateAndTime,
  );
  const summary = calculateAssessmentSummary(
    currentClaim.assessmentRows,
    ageMonths,
    currentClaim.depreciationType,
    fb.salvageValue,
    fb.lessExcess,
  );

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const set = (key: keyof typeof fb, val: unknown) => updateFeeBill({ [key]: val } as any);

  // ─── Shared input style ───────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #E2E6EA',
    background: '#FAFAFA',
    color: '#0D1B2A',
    fontSize: 14,
    fontWeight: 600,
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: '#8D99AE',
    display: 'block',
    marginBottom: 6,
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8F9FA' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="px-8 py-8 lg:px-12"
        style={{ background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)' }}
      >
        <div className="max-w-5xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-4"
            style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
          >
            <Receipt size={11} />
            Surveyor Fee Statement
          </div>
          <h1 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
            Fee Bill
          </h1>
          <p className="text-sm" style={{ color: 'rgba(232,236,240,0.65)' }}>
            Professional fee statement for {currentClaim.vehicle.registrationNumber || 'this claim'} — auto-calculates GST and totals.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
              Gross Total: {fmt(grossTotal)}
            </div>
            {currentClaim.surveyType !== 'spot' && (
              <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(5,150,105,0.15)', color: '#34d399' }}>
                Net Loss: {fmt(summary.netAssessedLoss)}
              </div>
            )}
            
            <div className="flex-1" />
            <button
              onClick={() => {
                triggerSpotFeeBillPrint(currentClaim, profile!);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-xs transition-all shadow-lg hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #b8942a)',
                color: '#FFFFFF',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              <FileText size={14} />
              POWER PRINT — FEE BILL
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-12 py-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT: Fee Inputs ─────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Bill Metadata */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
                <div className="flex items-center gap-2">
                  <FileText size={14} style={{ color: '#D4AF37' }} />
                  <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>Bill Details</span>
                </div>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Bill Date</label>
                  <input type="date" value={fb.billDate} onChange={e => set('billDate', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Advance Receipt No.</label>
                  <input value={fb.advanceReceipt} onChange={e => set('advanceReceipt', e.target.value)} placeholder="e.g. ADV-001" style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label style={labelStyle}>Cash / Cheque Received</label>
                  <input value={fb.cashReceived} onChange={e => set('cashReceived', e.target.value)} placeholder="e.g. ₹5,000 cash received on 01/04/2026" style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label style={labelStyle}>Payment Status</label>
                  <button
                    onClick={() => set('feePaid', !fb.feePaid)}
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
                    <span className="ml-auto text-[10px] font-semibold" style={{ color: '#8D99AE' }}>
                      tap to toggle
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Fee Items */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
                <div className="flex items-center gap-2">
                  <Banknote size={14} style={{ color: '#D4AF37' }} />
                  <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>Fee Components</span>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'professionalFee', label: 'Professional Fee (₹)', icon: <Calculator size={13} />, type: 'number' },
                  { key: 'riFee',           label: 'Re-inspection Fee (₹)', icon: <TrendingDown size={13} />, type: 'number' },
                  { key: 'travelExpenses',  label: 'Travel / Conveyance (₹)', icon: <Car size={13} />, type: 'number' },
                  { key: 'postalCharges',   label: 'Postal / Courier Charges (₹)', icon: <Package size={13} />, type: 'number' },
                  { key: 'haltageCharges',  label: 'Haltage Charges (₹)', icon: <Truck size={13} />, type: 'number' },
                ].map(({ key, label, icon }) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8D99AE' }}>{icon}</div>
                      <input
                        type="number"
                        min={0}
                        value={(fb[key as keyof typeof fb] as number) || ''}
                        onChange={e => set(key as keyof typeof fb, Number(e.target.value))}
                        style={{ ...inputStyle, paddingLeft: 32 }}
                      />
                    </div>
                  </div>
                ))}

                <div>
                  <label style={labelStyle}>Travel Note</label>
                  <input
                    value={fb.travelNote}
                    onChange={e => set('travelNote', e.target.value)}
                    placeholder="e.g. 80 km × ₹10"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Photos */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
                <div className="flex items-center gap-2">
                  <Camera size={14} style={{ color: '#D4AF37' }} />
                  <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>Photography Charges</span>
                </div>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>No. of Photos</label>
                  <input
                    type="number"
                    min={0}
                    value={fb.photosCount || ''}
                    onChange={e => set('photosCount', Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Rate per Photo (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={fb.photoRate || ''}
                    onChange={e => set('photoRate', Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#F0F2F5' }}>
                  <span className="text-sm font-semibold" style={{ color: '#4A4E69' }}>Photo Total</span>
                  <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>{fmt(photoCharges)}</span>
                </div>
              </div>
            </div>

            {/* Settlement Info - Only for Final Survey */}
            {currentClaim.surveyType !== 'spot' && (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} style={{ color: '#D4AF37' }} />
                    <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>Settlement Deductions</span>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>Salvage Value (₹)</label>
                    <input type="number" min={0} value={fb.salvageValue || ''} onChange={e => set('salvageValue', Number(e.target.value))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Policy Excess (₹)</label>
                    <input type="number" min={0} value={fb.lessExcess || ''} onChange={e => set('lessExcess', Number(e.target.value))} style={inputStyle} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Fee Summary ─────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden sticky top-6" style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: '#D4AF37' }}>Fee Summary</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {currentClaim.vehicle.registrationNumber || 'Claim'}
                </div>
              </div>
              <div className="px-5 py-4 space-y-0">
                {[
                  { label: 'Professional Fee',     val: fb.professionalFee || 0 },
                  { label: 'Re-Inspection Fee',    val: fb.riFee || 0 },
                  { label: 'Travel / Conveyance',  val: fb.travelExpenses || 0 },
                  { label: `Photos (${fb.photosCount}×${fmt(fb.photoRate)})`, val: photoCharges },
                  { label: 'Postal / Courier',     val: fb.postalCharges || 0 },
                  { label: 'Haltage',              val: fb.haltageCharges || 0 },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-xs" style={{ color: 'rgba(232,236,240,0.55)' }}>{label}</span>
                    <span className="text-xs font-bold" style={{ color: '#F8F9FA' }}>{fmt(val)}</span>
                  </div>
                ))}

                {/* Sub-total */}
                <div className="flex items-center justify-between py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 4 }}>
                  <span className="text-sm font-bold" style={{ color: '#F8F9FA' }}>Sub Total</span>
                  <span className="text-sm font-black" style={{ color: '#F8F9FA' }}>{fmt(subTotal)}</span>
                </div>

                {/* GST Toggle */}
                <div className="flex items-center justify-between py-3 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2">
                    <Percent size={13} style={{ color: '#D4AF37' }} />
                    <span className="text-xs font-bold" style={{ color: '#F8F9FA' }}>Include GST @ 18%</span>
                  </div>
                  <button
                    onClick={() => set('includeGST', !fb.includeGST)}
                    className="w-10 h-5 rounded-full transition-all relative flex-shrink-0"
                    style={{ background: fb.includeGST ? '#D4AF37' : 'rgba(255,255,255,0.15)' }}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                      style={{ left: fb.includeGST ? 'calc(100% - 18px)' : 2 }}
                    />
                  </button>
                </div>

                {fb.includeGST && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs" style={{ color: 'rgba(232,236,240,0.55)' }}>GST (18%)</span>
                    <span className="text-xs font-bold" style={{ color: '#D4AF37' }}>{fmt(gstAmount)}</span>
                  </div>
                )}

                {/* Gross Total */}
                <div
                  className="flex items-center justify-between px-4 py-4 rounded-xl mt-2"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #f0d870)' }}
                >
                  <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>GROSS TOTAL</span>
                  <span className="text-lg font-black" style={{ color: '#0D1B2A' }}>{fmt(grossTotal)}</span>
                </div>
              </div>

              {/* Assessment Summary Reference - Only for Final Survey */}
              {currentClaim.surveyType !== 'spot' && (
                <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Assessment Reference
                  </div>
                  {[
                    { label: 'Grand Total', val: summary.grandTotal },
                    { label: '— Salvage',   val: -(fb.salvageValue || 0) },
                    { label: '— Excess',    val: -(fb.lessExcess || 0) },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between py-1.5">
                      <span className="text-[11px]" style={{ color: 'rgba(232,236,240,0.4)' }}>{label}</span>
                      <span className="text-[11px] font-bold" style={{ color: 'rgba(232,236,240,0.7)' }}>{fmt(Math.abs(val))}</span>
                    </div>
                  ))}
                  <div
                    className="flex items-center justify-between py-2 px-3 rounded-lg mt-2"
                    style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.25)' }}
                  >
                    <span className="text-xs font-bold" style={{ color: '#D4AF37' }}>Net Assessed Loss</span>
                    <span className="text-sm font-black" style={{ color: '#D4AF37' }}>{fmt(summary.netAssessedLoss)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
