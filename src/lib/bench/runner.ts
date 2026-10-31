import type { runModelTest as RunModelTest, ModelTestResult } from '../ai/service';
import { ProviderError } from '../ai/service';
import type { CallRecord, subscribeCalls as SubscribeCalls } from '../ai/call-meter';
import type { ProviderId } from '../ai/models-config';
import { referenceFor } from './agree';
import type { Pacer } from './pacer';
import { nextCell, planEstimate, type ModelPick } from './plan';
import { compareToReference, selfCheck, toBenchRows } from './score';
import { cellId, type bench, type CellKey, type CellResult } from './store';
import type { BenchError, PdfProfile } from './types';

export interface RunnerDeps { runModelTest: typeof RunModelTest; store: typeof bench; pacerFor(p: ProviderId): Pacer; subscribeCalls: typeof SubscribeCalls }
export interface RunProgress { provider: ProviderId; callsMade: number; callsPlanned: number; tokensIn: number; tokensOut: number; waitMs: number; lastError: string | null; paused: boolean }

// ponytail: the AI test override is a module-level singleton, so model runs are serialised
// across providers by this one gate. Pacer waits (take) stay outside it and overlap.
// Upgrade path: a per-call override in service.ts if parallel extraction is ever needed.
let gate: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = gate.then(fn, fn);
  gate = run.catch(() => undefined);
  return run;
}

const is429 = (calls: CallRecord[], thrown: unknown) =>
  calls.some(c => c.status === 429) || (thrown instanceof ProviderError && thrown.status === 429);
const isTransient = (calls: CallRecord[], thrown: unknown) =>
  is429(calls, thrown) || thrown != null || calls.some(c => c.finish === 'ERROR');

async function readCell(deps: RunnerDeps, pick: ModelPick, key: CellKey, file: File) {
  const calls: CallRecord[] = [];
  let res: ModelTestResult | null = null;
  let thrown: unknown = null;
  await exclusive(async () => {
    const off = deps.subscribeCalls(r => { if (r.provider === pick.provider) calls.push(r); });
    try {
      res = await deps.runModelTest({ provider: pick.provider, model: pick.model, key: pick.key, pagesPerCall: key.pagesPerCall, method: key.method, imageScale: key.imageScale, raw: true }, 'estimate', file, () => {});
    } catch (e) { thrown = e; } finally { off(); }
  });
  return { calls, res: res as ModelTestResult | null, thrown };
}

async function score(deps: RunnerDeps, profile: PdfProfile, cells: CellResult[], id: string, rows: CellResult['rows']): Promise<BenchError[]> {
  const readings = cells.filter(c => c.profileId === profile.id && c.status === 'done' && c.id !== id)
    .map(c => ({ cellId: c.id, model: c.model, rows: c.rows, errors: c.errors }));
  const ref = referenceFor(readings, profile, (await deps.store.gold(profile.id)) ?? undefined);
  return [...selfCheck(rows, profile), ...(ref ? compareToReference(rows, ref.rows, profile) : [])];
}

async function runProvider(deps: RunnerDeps, provider: ProviderId, profiles: PdfProfile[], picks: ModelPick[], hardIds: string[],
  cells: CellResult[], planned: number, onProgress: (p: RunProgress) => void, signal: AbortSignal): Promise<void> {
  const pacer = deps.pacerFor(provider);
  const prog: RunProgress = { provider, callsMade: 0, callsPlanned: planned, tokensIn: 0, tokensOut: 0, waitMs: 0, lastError: null, paused: false };
  const report = () => onProgress({ ...prog, callsMade: pacer.callsMade, paused: pacer.paused });
  const ordered = [...profiles.filter(p => hardIds.includes(p.id)), ...profiles.filter(p => !hardIds.includes(p.id))];
  const missing = new Set<string>();
  for (;;) {
    let job: { pick: ModelPick; profile: PdfProfile; key: CellKey } | null = null;
    for (const profile of ordered) {
      if (missing.has(profile.id)) continue;
      for (const pick of picks) {
        const key = nextCell(cells, profile, pick, hardIds.includes(profile.id) ? 'hard' : 'wide');
        if (key) { job = { pick, profile, key }; break; }
      }
      if (job) break;
    }
    if (!job || signal.aborted || pacer.paused) return report();
    const t0 = Date.now();
    if ((await pacer.take()) === 'capped') return report();
    prog.waitMs += Date.now() - t0;
    const file = await deps.store.pdf(job.profile.id);
    if (!file) { missing.add(job.profile.id); prog.lastError = `PDF missing: ${job.profile.fileName}`; continue; }
    const { calls, res, thrown } = await readCell(deps, job.pick, job.key, file);
    const id = cellId(job.key);
    const tokensIn = calls.reduce((n, c) => n + (c.tokensIn ?? 0), 0);
    const tokensOut = calls.reduce((n, c) => n + (c.tokensOut ?? 0), 0);
    prog.tokensIn += tokensIn; prog.tokensOut += tokensOut;
    const base = { ...job.key, id, calls, tokensIn, tokensOut, ms: res?.ms ?? 0, modelVersion: [...calls].reverse().find(c => c.model)?.model ?? job.pick.model, at: Date.now() };
    let cell: CellResult;
    if (!res?.ok && isTransient(calls, thrown)) {
      // rate limit / timeout / network: never a model error; re-queued by nextCell
      prog.lastError = res?.error ?? (thrown instanceof Error ? thrown.message : 'call failed');
      const retryAfter = calls.find(c => c.rateLimit?.retryAfterMs)?.rateLimit?.retryAfterMs;
      pacer.onRateLimited(retryAfter);
      cell = { ...base, status: 'rate_limited', rows: [], errors: [{ type: 'rate_limited', estimate: '', page: null, srNo: null, detail: prog.lastError }] };
    } else {
      pacer.onSuccess();
      const rows = res?.ok ? toBenchRows(res.data) : [];
      const errors = res?.ok ? await score(deps, job.profile, cells, id, rows)
        : [{ type: 'broken_reply' as const, estimate: '', page: null, srNo: null, detail: res?.error ?? 'no result' }];
      if (!res?.ok) prog.lastError = res?.error ?? 'no result';
      cell = { ...base, status: 'done', rows, errors };
    }
    await deps.store.putCell(cell);
    const i = cells.findIndex(c => c.id === id);
    if (i >= 0) cells[i] = cell; else cells.push(cell);
    report();
  }
}

export async function runBench(deps: RunnerDeps, profiles: PdfProfile[], picks: ModelPick[], hardIds: string[],
  onProgress: (p: RunProgress) => void, signal: AbortSignal): Promise<void> {
  const cells = await deps.store.cells();
  const planned = planEstimate(profiles, picks, hardIds);
  const providers = [...new Set(picks.map(p => p.provider))];
  await Promise.all(providers.map(p =>
    runProvider(deps, p, profiles, picks.filter(k => k.provider === p), hardIds, cells, planned[p], onProgress, signal)));
}
