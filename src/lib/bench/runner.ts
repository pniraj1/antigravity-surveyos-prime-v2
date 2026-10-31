import type { runModelTest as RunModelTest, ModelTestResult } from '../ai/service';
import { ProviderError } from '../ai/service';
import { setBeforeCall, type CallRecord, type subscribeCalls as SubscribeCalls } from '../ai/call-meter';
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

export class CappedError extends Error { constructor(provider: string) { super(`${provider}: daily cap reached`); this.name = 'CappedError'; } }

// Transient = 429, timeout (status 0 / TimeoutError) or network (no HTTP status). Anything else is a provider error.
const transientStatus = (s: number | undefined) => s === 429 || s === 0 || s === undefined;
type Outcome = 'ok' | 'capped' | 'transient' | 'provider_error' | 'broken_reply';
function classify(res: ModelTestResult | null, calls: CallRecord[], thrown: unknown, capped: boolean): Outcome {
  if (capped) return 'capped';
  if (res?.ok) return 'ok';
  const failed = calls.filter(c => c.finish === 'ERROR');
  if (thrown != null) {
    const s = thrown instanceof ProviderError ? thrown.status : undefined;
    return transientStatus(s) ? 'transient' : 'provider_error';
  }
  if (failed.some(c => transientStatus(c.status))) return 'transient';
  return failed.length ? 'provider_error' : 'broken_reply';
}

async function readCell(deps: RunnerDeps, pacer: Pacer, pick: ModelPick, key: CellKey, file: File) {
  const calls: CallRecord[] = [];
  let res: ModelTestResult | null = null;
  let thrown: unknown = null;
  let capped = false;
  let waitMs = 0;
  await exclusive(async () => {
    const off = deps.subscribeCalls(r => { if (r.provider === pick.provider) calls.push(r); });
    // Every API call paces through this provider's pacer. Inside the gate, so one global hook is race-free;
    // consequence of the serialisation: other providers wait while this one paces.
    setBeforeCall(async () => {
      const t0 = Date.now();
      const go = await pacer.take();
      waitMs += Date.now() - t0;
      if (go === 'capped') { capped = true; throw new CappedError(pick.provider); }
    });
    try {
      res = await deps.runModelTest({ provider: pick.provider, model: pick.model, key: pick.key, pagesPerCall: key.pagesPerCall, method: key.method, imageScale: key.imageScale, raw: true }, 'estimate', file, () => {});
    } catch (e) { thrown = e; } finally { setBeforeCall(null); off(); }
  });
  return { calls, res: res as ModelTestResult | null, thrown, capped, waitMs };
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
  const retried = new Set<string>();
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
    const file = await deps.store.pdf(job.profile.id);
    if (!file) { missing.add(job.profile.id); prog.lastError = `PDF missing: ${job.profile.fileName}`; continue; }
    const { calls, res, thrown, capped, waitMs } = await readCell(deps, pacer, job.pick, job.key, file);
    prog.waitMs += waitMs;
    const id = cellId(job.key);
    const outcome = classify(res, calls, thrown, capped);
    const failMsg = res?.error ?? (thrown instanceof Error ? thrown.message : 'no result');
    // one retry for a provider error before it is stored
    if (outcome === 'provider_error' && !retried.has(id)) { retried.add(id); prog.lastError = failMsg; continue; }
    const tokensIn = calls.reduce((n, c) => n + (c.tokensIn ?? 0), 0);
    const tokensOut = calls.reduce((n, c) => n + (c.tokensOut ?? 0), 0);
    prog.tokensIn += tokensIn; prog.tokensOut += tokensOut;
    const base = { ...job.key, id, calls, tokensIn, tokensOut, ms: res?.ms ?? 0, modelVersion: [...calls].reverse().find(c => c.model)?.model ?? job.pick.model, at: Date.now() };
    let cell: CellResult;
    const fail = (type: BenchError['type']): BenchError[] => [{ type, estimate: '', page: null, srNo: null, detail: failMsg }];
    if (outcome === 'capped') {
      // stored non-done, so nextCell re-queues it on the next run
      cell = { ...base, status: 'capped', rows: [], errors: [] };
    } else if (outcome === 'transient') {
      // never a model error; re-queued by nextCell. A 429 mid-cell re-runs the whole cell (earlier calls discarded).
      prog.lastError = failMsg;
      pacer.onRateLimited(calls.find(c => c.rateLimit?.retryAfterMs)?.rateLimit?.retryAfterMs);
      cell = { ...base, status: 'rate_limited', rows: [], errors: fail('rate_limited') };
    } else {
      pacer.onSuccess();
      const rows = res?.ok ? toBenchRows(res.data) : [];
      const errors = outcome === 'ok' ? await score(deps, job.profile, cells, id, rows) : fail(outcome);
      if (outcome !== 'ok') prog.lastError = failMsg;
      cell = { ...base, status: 'done', rows, errors };
    }
    await deps.store.putCell(cell);
    const i = cells.findIndex(c => c.id === id);
    if (i >= 0) cells[i] = cell; else cells.push(cell);
    report();
    if (outcome === 'capped') return;
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
