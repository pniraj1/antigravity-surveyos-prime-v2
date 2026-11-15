'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrencyShort } from '@/lib/calculations/utils';
import type { EstimateHeads } from '@/types/assessment';

interface Props {
  initial: EstimateHeads;
  totals: { linesInclGst: number; printed: number } | null;
  onConfirm: (h: EstimateHeads) => void;
  onCancel: () => void;
}

const ROWS: { key: keyof EstimateHeads; label: string }[] = [
  { key: 'metal', label: 'Metal' },
  { key: 'plastic', label: 'Plastic / Rubber' },
  { key: 'glass', label: 'Glass' },
  { key: 'fiberglass', label: 'Fibre Glass' },
  { key: 'labour', label: 'Labour' },
  { key: 'paint', label: 'Painting' },
];

/** A typed head figure: blank or negative counts as 0. */
export const clampHead = (s: string): number => Math.max(0, parseFloat(s) || 0);

export function EstimateHeadsDialog({ initial, totals, onConfirm, onCancel }: Props) {
  const [vals, setVals] = useState<Record<keyof EstimateHeads, string>>(
    () => Object.fromEntries(ROWS.map((r) => [r.key, String(initial[r.key])])) as Record<keyof EstimateHeads, string>
  );
  const num = (k: keyof EstimateHeads) => clampHead(vals[k]);
  const sum = ROWS.reduce((s, r) => s + num(r.key), 0);
  const diff = totals && totals.printed > 0 ? totals.linesInclGst - totals.printed : 0;

  const confirm = () =>
    onConfirm(Object.fromEntries(ROWS.map((r) => [r.key, num(r.key)])) as unknown as EstimateHeads);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border bg-amber-500/10">
          <h3 className="text-sm font-semibold text-foreground">Estimate amounts for the UIIC report</h3>
        </div>

        <div className="p-6 space-y-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-semibold">Head</th>
                <th className="py-1 font-semibold text-right">From estimate</th>
                <th className="py-1 font-semibold text-right">You confirm (₹)</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key}>
                  <td className="py-1">{r.label}</td>
                  <td className="py-1 text-right text-muted-foreground">{formatCurrencyShort(initial[r.key])}</td>
                  <td className="py-1 pl-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={vals[r.key]}
                      onChange={(e) => setVals({ ...vals, [r.key]: e.target.value })}
                      className="h-8 text-sm text-right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-2" colSpan={2}>Total of heads</td>
                <td className="pt-2 text-right">{formatCurrencyShort(sum)}</td>
              </tr>
              {totals && (
                <tr className="text-muted-foreground">
                  <td className="py-1" colSpan={2}>Lines read, incl. GST</td>
                  <td className="py-1 text-right">{formatCurrencyShort(totals.linesInclGst)}</td>
                </tr>
              )}
              {totals && (
                <tr className="text-muted-foreground">
                  <td className="py-1" colSpan={2}>Estimate total (printed on estimate)</td>
                  <td className="py-1 text-right">{formatCurrencyShort(totals.printed)}</td>
                </tr>
              )}
            </tfoot>
          </table>

          {totals && totals.printed > 0 && Math.abs(diff) > 1 && (
            <p className="text-xs font-medium text-destructive">
              Difference {formatCurrencyShort(Math.abs(diff))} — a line may have been missed
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Before GST. Printed in the Estimated column only; the claim amount does not change.
          </p>
        </div>

        <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onCancel} className="text-xs">Cancel</Button>
          <Button size="sm" onClick={confirm} className="text-xs bg-primary text-primary-foreground hover:bg-primary/90">
            Confirm and print
          </Button>
        </div>
      </div>
    </div>
  );
}
