'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { bench } from '@/lib/bench/store';
import type { BenchSection, EstimateSpan, PdfProfile } from '@/lib/bench/types';
import { pageCountOf, pageTexts } from '@/lib/documents/kit/page-text';
import { proposeTotal } from './bench-logic';

const SECTIONS: BenchSection[] = ['spare_parts', 'labour_items', 'painting_items'];
const num = (s: string): number | null => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s));

interface Props { profiles: PdfProfile[]; onChange(p: PdfProfile): void }

export function ProfileEditor({ profiles, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  // Any edit un-confirms the profile; the owner confirms again.
  const edit = (p: PdfProfile, patch: Partial<PdfProfile>) => onChange({ ...p, confirmed: false, ...patch });
  const editSpan = (p: PdfProfile, i: number, patch: Partial<EstimateSpan>) =>
    edit(p, { estimates: p.estimates.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  async function upload(file: File) {
    setBusy(true);
    try {
      const [pageCount, texts] = await Promise.all([pageCountOf(file), pageTexts(file)]);
      const id = crypto.randomUUID();
      await bench.putPdf(id, file, file.name);
      onChange({ id, fileName: file.name, kind: texts?.some(t => t.length > 20) ? 'digital' : 'scan', pageCount, estimates: [], unreadablePages: [], confirmed: false });
    } finally { setBusy(false); }
  }

  async function propose(p: PdfProfile, i: number) {
    const file = await bench.pdf(p.id);
    const texts = file ? await pageTexts(file) : null;
    const e = p.estimates[i];
    const t = texts ? proposeTotal(texts, e.firstPage, e.lastPage) : null;
    if (t !== null) editSpan(p, i, { grandTotal: t });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Test PDFs</h2>
      <input type="file" accept="application/pdf" disabled={busy} aria-label="Add test PDF"
        onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
      {profiles.map(p => (
        <div key={p.id} className="space-y-2 rounded border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <strong>{p.fileName}</strong> <span>{p.pageCount} pages</span>
            <select aria-label="Kind" value={p.kind} onChange={e => edit(p, { kind: e.target.value as PdfProfile['kind'] })}>
              <option value="digital">digital</option><option value="scan">scan</option><option value="mixed">mixed</option>
            </select>
            <label>Unreadable pages{' '}
              <input className="w-28 rounded border px-1" defaultValue={p.unreadablePages.join(', ')} placeholder="e.g. 4, 9"
                onBlur={e => edit(p, { unreadablePages: e.target.value.split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0) })} />
            </label>
          </div>
          {p.estimates.map((e, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 border-t pt-2 sm:grid-cols-4">
              <label>Label <input className="w-full rounded border px-1" value={e.label} onChange={ev => editSpan(p, i, { label: ev.target.value })} /></label>
              <label>First page <input type="number" className="w-full rounded border px-1" value={e.firstPage} onChange={ev => editSpan(p, i, { firstPage: num(ev.target.value) ?? 1 })} /></label>
              <label>Last page <input type="number" className="w-full rounded border px-1" value={e.lastPage} onChange={ev => editSpan(p, i, { lastPage: num(ev.target.value) ?? 1 })} /></label>
              <label>Grand total (₹) <input type="number" className="w-full rounded border px-1" value={e.grandTotal ?? ''} onChange={ev => editSpan(p, i, { grandTotal: num(ev.target.value) })} /></label>
              <label>Totals basis{' '}
                <select value={e.totalsBasis ?? 'gross'} onChange={ev => editSpan(p, i, { totalsBasis: ev.target.value as 'gross' | 'taxable' })}>
                  <option value="gross">gross (incl. GST)</option><option value="taxable">taxable (pre-GST)</option>
                </select>
              </label>
              <label>Adjustment (₹, e.g. -discount) <input type="number" className="w-full rounded border px-1" value={e.adjustment ?? ''} onChange={ev => editSpan(p, i, { adjustment: num(ev.target.value) ?? undefined })} /></label>
              {SECTIONS.map(s => (
                <label key={s}>{s} subtotal <input type="number" className="w-full rounded border px-1" value={e.subtotals?.[s] ?? ''}
                  onChange={ev => editSpan(p, i, { subtotals: { ...e.subtotals, [s]: num(ev.target.value) ?? undefined } })} /></label>
              ))}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void propose(p, i)}>Propose total</Button>
                <Button size="sm" variant="ghost" onClick={() => edit(p, { estimates: p.estimates.filter((_, j) => j !== i) })}>Remove</Button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => edit(p, { estimates: [...p.estimates, { label: `Estimate ${p.estimates.length + 1}`, firstPage: 1, lastPage: p.pageCount, grandTotal: null, totalsBasis: 'gross' }] })}>Add estimate</Button>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={p.confirmed} disabled={p.estimates.length === 0 || p.estimates.some(e => e.grandTotal === null)}
                onChange={ev => onChange({ ...p, confirmed: ev.target.checked })} /> Confirmed (I checked these totals)
            </label>
          </div>
        </div>
      ))}
    </section>
  );
}
