import { describe, it, expect } from 'vitest';
import { reconcileEnabledModels } from '../probe-reconcile';
import type { AIModelsConfig, ModelEntry } from '../models-config';
import type { ModelProbes, ProbeResult, ProbeStatus } from '../probe-types';
import { emptyProviderProbe } from '../probe-types';

function entry(id: string): ModelEntry {
  return { id, label: id, note: '', ctxWindow: 128000, vision: true, imageCap: 1 };
}

function config(nvidiaModels: string[], defaultModel: string): AIModelsConfig {
  return {
    updatedAt: 1, updatedBy: 'test', defaultProvider: 'nvidia',
    providers: {
      gemini: { enabled: true, defaultModel: '', models: [] },
      groq: { enabled: true, defaultModel: '', models: [] },
      nvidia: { enabled: true, defaultModel, models: nvidiaModels.map(entry) },
    },
  };
}

function probeResult(id: string, status: ProbeStatus, reason = '', consecutiveFailures = 2): ProbeResult {
  return {
    id, status, reason, vision: true, imageCap: 1, ctxWindow: 128000,
    msPerPage: 30000, slow: false,
    source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' },
    probedAt: 1,
    consecutiveFailures: status === 'ok' ? 0 : consecutiveFailures,
  };
}

function probes(nvidia: ProbeResult[], error: string | null = null): ModelProbes {
  return {
    probedAt: 1, probedBy: 'test',
    providers: {
      gemini: emptyProviderProbe(),
      groq: emptyProviderProbe(),
      nvidia: { probedAt: 1, error, models: Object.fromEntries(nvidia.map(r => [r.id, r])) },
    },
  };
}

describe('reconcileEnabledModels', () => {
  it('removes an enabled model that became unreachable', () => {
    const { config: next, removed } = reconcileEnabledModels(
      config(['a', 'b'], 'a'),
      probes([probeResult('a', 'ok'), probeResult('b', 'unreachable', 'Not found for account')]),
    );
    expect(next.providers.nvidia.models.map(m => m.id)).toEqual(['a']);
    expect(removed).toEqual([{ provider: 'nvidia', id: 'b', reason: 'Not found for account' }]);
  });

  it('removes an enabled model the runner marked as no longer listed', () => {
    // The runner synthesises an 'unreachable' result for a previously-working
    // model that vanished from the catalogue, so the reconciler sees it here.
    const { config: next, removed } = reconcileEnabledModels(
      config(['a', 'b'], 'a'),
      probes([probeResult('a', 'ok'), probeResult('b', 'unreachable', 'No longer listed by the provider.')]),
    );
    expect(next.providers.nvidia.models.map(m => m.id)).toEqual(['a']);
    expect(removed[0].reason).toBe('No longer listed by the provider.');
  });

  it('keeps a model that failed transiently, however badly', () => {
    // A measured NVIDIA run produced 5 read timeouts and one 500 on live
    // models. Removing on those would strip working models from surveyors.
    const { config: next, removed } = reconcileEnabledModels(
      config(['a', 'b'], 'a'),
      probes([probeResult('a', 'ok'), probeResult('b', 'transient', 'timeout', 9)]),
    );
    expect(next.providers.nvidia.models.map(m => m.id)).toEqual(['a', 'b']);
    expect(removed).toEqual([]);
  });

  it('keeps a model on its FIRST durable failure and removes it on the second', () => {
    const once = reconcileEnabledModels(
      config(['a'], 'a'),
      probes([probeResult('a', 'unreachable', 'gone', 1)]),
    );
    expect(once.removed).toEqual([]);
    expect(once.config.providers.nvidia.models.map(m => m.id)).toEqual(['a']);

    const twice = reconcileEnabledModels(
      config(['a'], 'a'),
      probes([probeResult('a', 'unreachable', 'gone', 2)]),
    );
    expect(twice.removed.map(r => r.id)).toEqual(['a']);
  });

  it('keeps a model that was never probed at all', () => {
    const { config: next, removed } = reconcileEnabledModels(
      config(['a', 'never-probed'], 'a'),
      probes([probeResult('a', 'ok')]),
    );
    expect(next.providers.nvidia.models.map(m => m.id)).toEqual(['a', 'never-probed']);
    expect(removed).toEqual([]);
  });

  it('keeps a model that is merely slow', () => {
    const slow = probeResult('b', 'ok');
    const { config: next, removed } = reconcileEnabledModels(
      config(['a', 'b'], 'a'),
      probes([probeResult('a', 'ok'), { ...slow, msPerPage: null, slow: true }]),
    );
    expect(next.providers.nvidia.models.map(m => m.id)).toEqual(['a', 'b']);
    expect(removed).toEqual([]);
  });

  it('falls the default back to the first survivor when the default itself dies', () => {
    const { config: next } = reconcileEnabledModels(
      config(['dead', 'alive'], 'dead'),
      probes([probeResult('dead', 'unreachable', 'gone'), probeResult('alive', 'ok')]),
    );
    expect(next.providers.nvidia.defaultModel).toBe('alive');
  });

  it('empties the default when nothing survives', () => {
    const { config: next } = reconcileEnabledModels(
      config(['dead'], 'dead'),
      probes([probeResult('dead', 'unreachable', 'gone')]),
    );
    expect(next.providers.nvidia.models).toEqual([]);
    expect(next.providers.nvidia.defaultModel).toBe('');
  });

  it('removes nothing when the provider probe aborted', () => {
    const { config: next, removed } = reconcileEnabledModels(
      config(['a', 'b'], 'a'),
      probes([], 'Key rejected — probe aborted'),
    );
    expect(next.providers.nvidia.models.map(m => m.id)).toEqual(['a', 'b']);
    expect(removed).toEqual([]);
  });

  it('removes nothing when the provider probe returned no models at all', () => {
    const { config: next, removed } = reconcileEnabledModels(config(['a'], 'a'), probes([]));
    expect(next.providers.nvidia.models.map(m => m.id)).toEqual(['a']);
    expect(removed).toEqual([]);
  });

  it('never enables a model the admin did not tick', () => {
    const { config: next } = reconcileEnabledModels(
      config(['a'], 'a'),
      probes([probeResult('a', 'ok'), probeResult('brand-new', 'ok')]),
    );
    expect(next.providers.nvidia.models.map(m => m.id)).toEqual(['a']);
  });

  it('returns the original object identity when nothing changed', () => {
    const original = config(['a'], 'a');
    const { config: next, removed } = reconcileEnabledModels(original, probes([probeResult('a', 'ok')]));
    expect(removed).toEqual([]);
    expect(next).toBe(original);
  });
});
