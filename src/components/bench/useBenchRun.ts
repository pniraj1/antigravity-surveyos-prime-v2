import { useCallback, useRef, useState } from 'react';
import { runModelTest } from '@/lib/ai/service';
import { subscribeCalls } from '@/lib/ai/call-meter';
import { PROVIDER_MIN_GAP_MS } from '@/lib/ai/probe-runner';
import type { ProviderId } from '@/lib/ai/models-config';
import { createPacer, type Pacer } from '@/lib/bench/pacer';
import { nextCell, type ModelPick } from '@/lib/bench/plan';
import { runBench, type RunProgress } from '@/lib/bench/runner';
import { bench } from '@/lib/bench/store';
import type { PdfProfile } from '@/lib/bench/types';

export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

interface RunArgs { profiles: PdfProfile[]; picks: ModelPick[]; hardIds: string[]; caps: Record<ProviderId, number>; autoSave: boolean }

export function useBenchRun(onFinished: () => void) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Partial<Record<ProviderId, RunProgress>>>({});
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(async ({ profiles, picks, hardIds, caps, autoSave }: RunArgs) => {
    const ctl = new AbortController();
    abort.current = ctl;
    setRunning(true); setError(null);
    const pacers = new Map<ProviderId, Pacer>();
    const pacerFor = (p: ProviderId) => {
      if (!pacers.has(p)) pacers.set(p, createPacer({ minGapMs: PROVIDER_MIN_GAP_MS[p], dailyCap: caps[p] }));
      return pacers.get(p) as Pacer;
    };
    const saved = new Set<string>();
    let checking = false;
    // A PDF is finished when no pick has a next cell for it.
    const snapshotFinished = async () => {
      if (!autoSave || checking) return;
      checking = true;
      try {
        const cells = await bench.cells();
        const fresh = profiles.filter(p => !saved.has(p.id) && picks.every(k =>
          nextCell(cells, p, k, hardIds.includes(p.id) ? 'hard' : 'wide') === null));
        if (fresh.length) {
          fresh.forEach(p => saved.add(p.id));
          downloadText(`bench-${new Date().toISOString().slice(0, 10)}-${fresh[0].fileName}.json`, await bench.exportJson());
        }
      } finally { checking = false; }
    };
    let lock: { release(): Promise<void> } | null = null;
    try {
      lock = (await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
    } catch { /* wake lock is best effort */ }
    try {
      await runBench({ runModelTest, store: bench, pacerFor, subscribeCalls }, profiles, picks, hardIds,
        p => { setProgress(prev => ({ ...prev, [p.provider]: p })); void snapshotFinished(); }, ctl.signal);
      await snapshotFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      void lock?.release().catch(() => undefined);
      setRunning(false); onFinished();
    }
  }, [onFinished]);

  const stop = useCallback(() => abort.current?.abort(), []);
  return { running, progress, error, start, stop };
}
