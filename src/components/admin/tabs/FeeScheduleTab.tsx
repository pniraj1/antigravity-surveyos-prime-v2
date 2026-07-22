'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadFeeSchedule, saveFeeSchedule, FALLBACK_FEE_SCHEDULE,
  type FeeSchedule, type FeeSlab,
} from '@/lib/config/fee-schedule';

export function FeeScheduleTab({ adminName }: { adminName: string }) {
  const [schedule, setSchedule] = useState<FeeSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadFeeSchedule().then(setSchedule); }, []);

  if (!schedule) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading schedule…</div>;
  }

  const updateSlab = (i: number, key: keyof FeeSlab, raw: string) => {
    setSchedule(prev => {
      if (!prev) return prev;
      const slabs = prev.slabs.map((s, idx) => {
        if (idx !== i) return s;
        if (key === 'label') return { ...s, label: raw };
        if (key === 'upTo' || key === 'maxFee') return { ...s, [key]: raw === '' ? null : Number(raw) };
        return { ...s, [key]: Number(raw) || 0 };
      });
      return { ...prev, slabs };
    });
  };

  async function save() {
    if (!schedule) return;
    setSaving(true);
    try {
      await saveFeeSchedule(schedule, adminName);
      toast.success('Fee schedule saved — applies to all users without a custom rate card.');
    } catch {
      toast.error('Save failed. Check your admin permissions.');
    } finally { setSaving(false); }
  }

  const cell: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--color-neutral-200)', fontSize: 13 };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-medium">Survey Fee Schedule (Global)</h3>
        <span className="text-[11px] text-muted-foreground">
          v{schedule.version} · {schedule.updatedAt ? `updated ${new Date(schedule.updatedAt).toLocaleDateString()} by ${schedule.updatedBy}` : 'built-in default'}
        </span>
        <button onClick={() => setSchedule({ ...FALLBACK_FEE_SCHEDULE })} className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-neutral-100)', border: 'none', cursor: 'pointer' }}>
          <RotateCcw size={12} /> Reset to IISLA 2022
        </button>
      </div>

      <div className="overflow-x-auto">
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>{['Slab', 'Up to (₹)', 'Base (₹)', 'Marginal from (₹)', 'Rate %', 'Max fee (₹)'].map(h => (
              <th key={h} style={{ ...cell, textAlign: 'left', fontWeight: 500, color: 'var(--color-neutral-400)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {schedule.slabs.map((s, i) => (
              <tr key={i}>
                <td style={cell}><input value={s.label} onChange={e => updateSlab(i, 'label', e.target.value)} style={{ width: 160, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" value={s.upTo ?? ''} placeholder="∞" onChange={e => updateSlab(i, 'upTo', e.target.value)} style={{ width: 100, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" value={s.base} onChange={e => updateSlab(i, 'base', e.target.value)} style={{ width: 80, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" value={s.marginalFrom} onChange={e => updateSlab(i, 'marginalFrom', e.target.value)} style={{ width: 100, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" step="0.01" value={s.marginalRatePct} onChange={e => updateSlab(i, 'marginalRatePct', e.target.value)} style={{ width: 70, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" value={s.maxFee ?? ''} placeholder="—" onChange={e => updateSlab(i, 'maxFee', e.target.value)} style={{ width: 90, border: 'none', background: 'transparent' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-neutral-50)', border: 'none', cursor: saving ? 'wait' : 'pointer' }}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save for all users
      </button>
      <p className="text-[11px] text-muted-foreground">Surveyors who set a personal rate card keep it until they reset it in the Fees Bill tab.</p>
    </div>
  );
}
