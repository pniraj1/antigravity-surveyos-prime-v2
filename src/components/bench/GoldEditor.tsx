'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { passes, selfCheck } from '@/lib/bench/score';
import type { CellResult } from '@/lib/bench/store';
import { bench } from '@/lib/bench/store';
import type { BenchRow, PdfProfile } from '@/lib/bench/types';

interface Props { profile: PdfProfile; cells: CellResult[]; locked: BenchRow[] | undefined; onLocked(rows: BenchRow[]): void }

const blank = (page: number): BenchRow => ({ section: 'spare_parts', srNo: null, description: '', qty: null, rate: null, amount: 0, taxable: null, page });
const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s));

/** Best reading = a done cell that passes the self-check, with the most rows. */
function seed(profile: PdfProfile, cells: CellResult[]): BenchRow[] {
  const ok = cells.filter(c => c.profileId === profile.id && c.status === 'done' && passes(selfCheck(c.rows, profile)))
    .sort((a, b) => b.rows.length - a.rows.length);
  return ok[0]?.rows ?? [];
}

export function GoldEditor({ profile, cells, locked, onLocked }: Props) {
  const [rows, setRows] = useState<BenchRow[]>(() => locked ?? seed(profile, cells));
  const set = (i: number, patch: Partial<BenchRow>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const lock = async () => { await bench.putGold(profile.id, rows); onLocked(rows); };
  return (
    <div className="space-y-2 rounded border p-3 text-sm">
      <div className="flex items-center gap-3">
        <strong>{profile.fileName}</strong>
        {locked ? <span className="text-green-700">gold locked ({locked.length} rows)</span> : <span>no gold yet</span>}
        <Button size="sm" onClick={() => void lock()} disabled={rows.length === 0}>Lock</Button>
        <Button size="sm" variant="outline" onClick={() => setRows(r => [...r, blank(1)])}>Add row</Button>
      </div>
      <table className="w-full">
        <thead><tr className="text-left"><th>Section</th><th>Sr</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Taxable</th><th>Page</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><select value={r.section} onChange={e => set(i, { section: e.target.value as BenchRow['section'] })}>
                <option value="spare_parts">spare_parts</option><option value="labour_items">labour_items</option><option value="painting_items">painting_items</option></select></td>
              <td><input className="w-12 rounded border px-1" value={r.srNo ?? ''} onChange={e => set(i, { srNo: numOrNull(e.target.value) })} /></td>
              <td><input className="w-full rounded border px-1" value={r.description} onChange={e => set(i, { description: e.target.value })} /></td>
              <td><input className="w-16 rounded border px-1" value={r.qty ?? ''} onChange={e => set(i, { qty: numOrNull(e.target.value) })} /></td>
              <td><input className="w-20 rounded border px-1" value={r.rate ?? ''} onChange={e => set(i, { rate: numOrNull(e.target.value) })} /></td>
              <td><input className="w-24 rounded border px-1" value={r.amount} onChange={e => set(i, { amount: Number(e.target.value) || 0 })} /></td>
              <td><input className="w-24 rounded border px-1" value={r.taxable ?? ''} onChange={e => set(i, { taxable: numOrNull(e.target.value) })} /></td>
              <td><input className="w-12 rounded border px-1" value={r.page} onChange={e => set(i, { page: Number(e.target.value) || 1 })} /></td>
              <td><button type="button" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
