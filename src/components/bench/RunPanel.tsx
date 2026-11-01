'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { defaultDailyCap } from '@/lib/bench/pacer';
import { planEstimate } from '@/lib/bench/plan';
import type { ProviderId } from '@/lib/ai/models-config';
import type { PdfProfile } from '@/lib/bench/types';
import { PROVIDERS, METHODS_OFFERED, canStart, missingKeys, defaultPickRows, toPicks, type PickRow } from './bench-logic';
import { useBenchRun } from './useBenchRun';

interface Props { profiles: PdfProfile[]; hardIds: string[]; onHardIds(ids: string[]): void; onFinished(): void }

export function RunPanel({ profiles, hardIds, onHardIds, onFinished }: Props) {
  const [rows, setRows] = useState<PickRow[]>(defaultPickRows);
  // Keys live only in this component's state: never stored, never logged.
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [caps, setCaps] = useState<Record<ProviderId, number>>(
    () => Object.fromEntries(PROVIDERS.map(p => [p, defaultDailyCap()])) as Record<ProviderId, number>);
  const [autoSave, setAutoSave] = useState(true);
  const run = useBenchRun(onFinished);

  const confirmed = useMemo(() => profiles.filter(p => p.confirmed), [profiles]);
  const picks = useMemo(() => toPicks(rows, keys), [rows, keys]);
  const planned = useMemo(() => planEstimate(confirmed, picks, hardIds), [confirmed, picks, hardIds]);
  const setRow = (i: number, patch: Partial<PickRow>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggleHard = (id: string) => onHardIds(hardIds.includes(id) ? hardIds.filter(h => h !== id) : [...hardIds, id]);
  const geminiCalls = useMemo(() => planEstimate(confirmed, toPicks(rows.map(r => (r.provider === 'gemini' ? { ...r, checked: true } : r)), keys).filter(k => k.provider === 'gemini'), hardIds).gemini, [confirmed, rows, keys, hardIds]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Run</h2>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <label key={`${r.provider}/${r.model}`} className="flex items-center gap-2 text-sm">
            <input type="checkbox" data-pick={`${r.provider}/${r.model}`} checked={r.checked}
              onChange={e => setRow(i, { checked: e.target.checked })} />
            {r.provider} / {r.label}
            {METHODS_OFFERED(r.model).map(m => (
              <span key={m} className="ml-2">
                <input type="checkbox" aria-label={`${r.model} ${m}`} checked={r.methods.includes(m)}
                  onChange={e => setRow(i, { methods: e.target.checked ? [...r.methods, m] : r.methods.filter(x => x !== m) })} /> {m}
              </span>
            ))}
            {r.provider === 'gemini' && <em className="text-xs text-slate-500">uses {geminiCalls} of today&apos;s quota</em>}
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PROVIDERS.map(p => (
          <div key={p} className="flex items-center gap-2 text-sm">
            <span className="w-16">{p}</span>
            <input type="password" autoComplete="off" placeholder="API key (kept in memory only)" className="flex-1 rounded border px-2 py-1"
              value={keys[p] ?? ''} onChange={e => setKeys(k => ({ ...k, [p]: e.target.value }))} />
            <input type="number" min={0} aria-label={`${p} daily cap`} className="w-20 rounded border px-2 py-1"
              value={caps[p]} onChange={e => setCaps(c => ({ ...c, [p]: Number(e.target.value) }))} />
          </div>
        ))}
      </div>
      <div className="text-sm">
        <p className="font-medium">Hard set (3 runs at every step)</p>
        {confirmed.map(p => (
          <label key={p.id} className="mr-4 inline-flex items-center gap-1">
            <input type="checkbox" checked={hardIds.includes(p.id)} onChange={() => toggleHard(p.id)} /> {p.fileName}
          </label>
        ))}
      </div>
      <ul className="text-sm">
        {PROVIDERS.filter(p => picks.some(k => k.provider === p)).map(p => <li key={p}>{p}: {planned[p]} calls</li>)}
      </ul>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={autoSave} onChange={e => setAutoSave(e.target.checked)} /> Save a file after each PDF
      </label>
      <div className="flex gap-2">
        <Button disabled={run.running || !canStart(profiles, picks)}
          onClick={() => void run.start({ profiles: confirmed, picks, hardIds, caps, autoSave })}>Start</Button>
        <Button variant="outline" disabled={!run.running} onClick={run.stop}>Stop</Button>
      </div>
      {missingKeys(picks).length > 0 && <p className="text-sm text-amber-700">Missing API key for: {missingKeys(picks).join(', ')}</p>}
      {run.error &&<p className="text-sm text-red-600">{run.error}</p>}
      <ul className="text-sm">
        {Object.values(run.progress).map(p => p && (
          <li key={p.provider}>
            {p.provider}: {p.callsMade}/{p.callsPlanned} calls, {p.tokensIn} in / {p.tokensOut} out tokens
            {p.paused ? ', paused (rate limited)' : ''}{p.lastError ? `, last error: ${p.lastError}` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
