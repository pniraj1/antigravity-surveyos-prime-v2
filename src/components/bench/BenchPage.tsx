'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { initSandboxSession, isSandbox } from '@/lib/sandbox';
import { bench, type CellResult } from '@/lib/bench/store';
import type { BenchRow, PdfProfile } from '@/lib/bench/types';
import { GoldEditor } from './GoldEditor';
import { ProfileEditor } from './ProfileEditor';
import { ResultsTable } from './ResultsTable';
import { RunPanel } from './RunPanel';
import { downloadText } from './useBenchRun';

export type BenchMode = 'checking' | 'blocked' | 'loading' | 'ready';
type GoldMap = Record<string, BenchRow[] | undefined>;

interface Data { profiles: PdfProfile[]; cells: CellResult[]; gold: GoldMap }

const msg = (e: unknown) => (e instanceof Error ? e.message : 'unknown error');

async function load(): Promise<Data> {
  const [profiles, cells] = await Promise.all([bench.profiles(), bench.cells()]);
  const golds = await Promise.all(profiles.map(async p => [p.id, (await bench.gold(p.id)) ?? undefined] as const));
  return { profiles, cells, gold: Object.fromEntries(golds) };
}

export function BenchView({ mode, children }: { mode: BenchMode; children?: React.ReactNode }) {
  if (mode === 'blocked') return <p className="p-6">The bench runs only on the sandbox site.</p>;
  if (mode !== 'ready') return <p className="p-6">Loading the bench...</p>;
  return <main className="mx-auto max-w-5xl space-y-8 p-6">{children}</main>;
}

export function BenchPage() {
  const [mode, setMode] = useState<BenchMode>('checking');
  const [data, setData] = useState<Data>({ profiles: [], cells: [], gold: {} });
  const [error, setError] = useState<string | null>(null);
  const [hardIds, setHardIds] = useState<string[]>([]);
  const reload = useCallback(async () => setData(await load()), []);

  useEffect(() => {
    if (!isSandbox()) { setMode('blocked'); return; }
    setMode('loading');
    // IndexedDB is per user: open it through the sandbox session before touching the store.
    void initSandboxSession().then(reload).then(() => setMode('ready'))
      .catch(e => { setError(`Could not open the bench: ${msg(e)}`); setMode('ready'); });
  }, [reload]);

  const guard = (what: string, fn: () => Promise<void>) => { setError(null); fn().catch(e => setError(`${what} failed: ${msg(e)}`)); };
  const saveProfile = (p: PdfProfile) => guard('Saving the PDF profile', async () => { await bench.putProfile(p); await reload(); });
  const importFile = (f: File) => guard('Import', async () => { await bench.importJson(await f.text()); await reload(); });

  return (
    <BenchView mode={mode}>
      <h1 className="text-2xl font-bold">Extraction bench</h1>
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => void bench.exportJson().then(j => downloadText('bench-results.json', j))}>Export results (JSON)</Button>
        <label className="text-sm">Import <input type="file" accept="application/json" onChange={e => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} /></label>
      </div>
      <ProfileEditor profiles={data.profiles} onChange={p => void saveProfile(p)} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Gold keys</h2>
        {data.profiles.filter(p => p.confirmed).map(p => (
          <GoldEditor key={`${p.id}-${data.cells.length}`} profile={p} cells={data.cells} locked={data.gold[p.id]} onLocked={() => void reload()} />
        ))}
      </section>
      <RunPanel profiles={data.profiles} hardIds={hardIds} onHardIds={setHardIds} onFinished={() => void reload()} />
      <ResultsTable profiles={data.profiles} cells={data.cells} gold={data.gold} hardIds={hardIds} />
    </BenchView>
  );
}
