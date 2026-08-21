'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/calculations/utils';

interface SalvageInputProps {
  /** The rupee figure in force. */
  value: number;
  /** Reports `undefined` when the field is cleared. */
  onChange: (value: number | undefined) => void;
  /** Allowed metal parts, assessed, with GST — what the 5–10% band is struck on. */
  basis: number;
  /** Optional line beneath the band, e.g. where a carried-over figure came from. */
  note?: string;
  /** Distinct id per tab, so two rendered copies do not share a label target. */
  id?: string;
}

/**
 * The salvage figure and its suggested band.
 *
 * One component for both tabs, because two copies of a 5–10% rule is how this
 * codebase once ended up with three depreciation tables that disagreed.
 *
 * The band is a suggestion and the buttons only fill the box. The surveyor
 * decides the number: nothing here warns about, nags about, or overrides a
 * figure they have entered.
 *
 * Clearing the field reports `undefined`. The Bill Check tab reads that as
 * "back to automatic"; the Assessment tab reads it as zero.
 */
export function SalvageInput({ value, onChange, basis, note, id = 'salvage-value' }: SalvageInputProps) {
  const low = Math.round(basis * 0.05);
  const high = Math.round(basis * 0.10);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label htmlFor={id} className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Salvage value (₹)</Label>
      </div>
      <Input
        id={id}
        type="number"
        value={value || ''}
        onChange={e => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
        className="text-right font-medium text-[var(--color-status-danger)] bg-white border-[var(--color-neutral-200)] hover:border-[var(--color-status-danger)] focus:border-[var(--color-status-danger)] focus:ring-1 focus:ring-[var(--color-status-danger-tint)] shadow-sm transition-all h-9"
        placeholder="0.00"
        min="0"
      />
      {basis > 0 && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[10px] text-muted-foreground">
            Metal allowed {formatCurrency(basis)} · suggest {formatCurrency(low)}–{formatCurrency(high)}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange(low)}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-[var(--color-neutral-300)] bg-white text-muted-foreground hover:border-[var(--color-status-danger)] hover:text-[var(--color-status-danger)] transition-colors"
              title={`Apply 5% of the allowed metal basis (${formatCurrency(low)})`}
            >
              5%
            </button>
            <button
              type="button"
              onClick={() => onChange(high)}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-[var(--color-neutral-300)] bg-white text-muted-foreground hover:border-[var(--color-status-danger)] hover:text-[var(--color-status-danger)] transition-colors"
              title={`Apply 10% of the allowed metal basis (${formatCurrency(high)})`}
            >
              10%
            </button>
          </div>
        </div>
      )}
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}
