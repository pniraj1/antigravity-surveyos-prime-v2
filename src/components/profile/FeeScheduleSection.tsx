'use client';

import { useEffect, useState } from 'react';
import { Receipt, ChevronDown, RotateCcw, BellRing } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';
import {
  getActiveFeeSchedule, loadFeeSchedule,
  type FeeSchedule, type FeeSlab,
} from '@/lib/config/fee-schedule';
import { schedulePromptNeeded } from '@/lib/config/fee-schedule-adopt';

export function FeeScheduleSection() {
  const { profile, updateProfile } = useProfileStore();
  const [globalSchedule, setGlobalSchedule] = useState<FeeSchedule | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { loadFeeSchedule().then(setGlobalSchedule); }, []);

  const active = getActiveFeeSchedule(profile.feeSchedule, globalSchedule);
  const usingPersonal = !!profile.feeSchedule;
  const globalVersion = globalSchedule?.version ?? null;
  const promptAdopt = schedulePromptNeeded(profile.feeSchedule, profile.feeScheduleAckVersion, globalVersion);

  const updateSlab = (i: number, key: keyof FeeSlab, raw: string) => {
    const slabs = active.slabs.map((s, idx) => {
      if (idx !== i) return s;
      if (key === 'label') return { ...s, label: raw };
      if (key === 'upTo' || key === 'maxFee') return { ...s, [key]: raw === '' ? null : Number(raw) };
      return { ...s, [key]: Number(raw) || 0 };
    });
    updateProfile({
      feeSchedule: { ...active, slabs, updatedBy: profile.name || 'surveyor', updatedAt: Date.now() },
      feeScheduleAckVersion: globalVersion ?? active.version,
    });
  };

  const adoptGlobal = () => {
    if (!globalSchedule) return;
    updateProfile({ feeSchedule: { ...globalSchedule }, feeScheduleAckVersion: globalSchedule.version });
  };
  const keepMine = () => { if (globalVersion) updateProfile({ feeScheduleAckVersion: globalVersion }); };
  const resetToGlobal = () => updateProfile({ feeSchedule: undefined, feeScheduleAckVersion: undefined });

  const cell: React.CSSProperties = { padding: '4px 6px', border: '1px solid var(--color-neutral-200)', fontSize: 12 };

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      <div className="px-6 py-4 flex items-center gap-2 border-b border-border" style={{ background: 'var(--color-neutral-100)' }}>
        <Receipt size={14} className="text-primary" />
        <span className="text-sm font-medium text-foreground">Survey Fee Schedule (IISLA)</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: usingPersonal ? 'var(--color-status-warning-tint)' : 'var(--color-neutral-100)', color: usingPersonal ? 'var(--color-status-warning)' : 'var(--color-neutral-400)' }}>
          {usingPersonal ? 'Custom (your rate card)' : `Org default · ${active.version}`}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {promptAdopt && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--color-status-warning-tint)', border: '1px solid var(--color-status-warning)' }}>
            <BellRing size={16} style={{ color: 'var(--color-status-warning)' }} />
            <span className="text-xs" style={{ color: 'var(--color-neutral-900)' }}>
              Admin updated the IISLA schedule ({profile.feeScheduleAckVersion ?? active.version} → {globalVersion}). Adopt the new slabs or keep your custom card?
            </span>
            <button onClick={adoptGlobal} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-neutral-50)', border: 'none', cursor: 'pointer' }}>Adopt</button>
            <button onClick={keepMine} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-neutral-100)', border: 'none', cursor: 'pointer' }}>Keep mine</button>
          </div>
        )}

        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-xs font-medium" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-600)' }}>
          <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          {open ? 'Hide slabs' : 'View / edit slabs'}
        </button>

        {open && (
          <div className="overflow-x-auto">
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>{['Slab', 'Up to (₹)', 'Base (₹)', 'Marginal from (₹)', 'Rate %', 'Max fee (₹)'].map(h => (
                  <th key={h} style={{ ...cell, textAlign: 'left', color: 'var(--color-neutral-400)', fontWeight: 500 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {active.slabs.map((s, i) => (
                  <tr key={i}>
                    <td style={cell}><input value={s.label} onChange={e => updateSlab(i, 'label', e.target.value)} style={{ width: 150, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" value={s.upTo ?? ''} placeholder="∞" onChange={e => updateSlab(i, 'upTo', e.target.value)} style={{ width: 90, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" value={s.base} onChange={e => updateSlab(i, 'base', e.target.value)} style={{ width: 70, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" value={s.marginalFrom} onChange={e => updateSlab(i, 'marginalFrom', e.target.value)} style={{ width: 90, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" step="0.01" value={s.marginalRatePct} onChange={e => updateSlab(i, 'marginalRatePct', e.target.value)} style={{ width: 60, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" value={s.maxFee ?? ''} placeholder="—" onChange={e => updateSlab(i, 'maxFee', e.target.value)} style={{ width: 80, border: 'none', background: 'transparent' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usingPersonal && (
              <button onClick={resetToGlobal} className="mt-4 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', border: 'none', cursor: 'pointer' }}>
                <RotateCcw size={12} /> Reset to org default
              </button>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">Auto-fills the professional fee in the Survey Fees Bill from the repair estimate. You can still edit the fee per claim.</p>
      </div>
    </div>
  );
}
