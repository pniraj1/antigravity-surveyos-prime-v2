import type { AIModelsConfig, ProviderId } from './models-config';
import { DURABLE_FAILURES, type ModelProbes, type ProbeResult } from './probe-types';

/**
 * Removes enabled models that stopped working, and nothing else.
 *
 * Enabling is always the admin's decision; disabling on death is automatic,
 * because leaving a dead model enabled just produces failed extractions for
 * surveyors. This never enables a model, and never touches a provider whose
 * probe failed — a failed probe must not empty the working config.
 */

export interface Removal {
  provider: ProviderId;
  id: string;
  reason: string;
}

const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'nvidia', 'ollama'];

/** Two consecutive durable failures before a model is pulled. */
export const REMOVAL_STRIKES = 2;

/**
 * A model is removed only when the probe is confident it is actually dead:
 *
 *  - It must have failed DURABLY (404, no text input, context too small).
 *    A timeout, a 429, or a 5xx says nothing about the model — one measured
 *    NVIDIA run produced 5 read timeouts and a 500 on models that are alive.
 *  - It must have failed that way twice in a row, so a bad afternoon at the
 *    provider cannot strip a surveyor's working models.
 *
 * Absent from the probe entirely means the provider stopped listing it, which
 * is durable on its own — but still needs the strike count, so the runner
 * synthesises an 'unreachable' result for it rather than leaving a hole here.
 */
function shouldRemove(result: ProbeResult | undefined): boolean {
  if (!result) return false;                       // never probed — leave alone
  if (result.status === 'ok') return false;
  if (!DURABLE_FAILURES.has(result.status)) return false;
  return result.consecutiveFailures >= REMOVAL_STRIKES;
}

export function reconcileEnabledModels(
  config: AIModelsConfig,
  probes: ModelProbes,
): { config: AIModelsConfig; removed: Removal[] } {
  const removed: Removal[] = [];
  const providers = { ...config.providers };

  for (const p of PROVIDER_IDS) {
    const probe = probes.providers[p];
    const block = config.providers[p];

    // A provider whose probe aborted, or returned nothing, tells us nothing
    // about its models. Leave the working config exactly as it was.
    if (!probe || probe.error !== null || Object.keys(probe.models).length === 0) continue;

    const survivors = block.models.filter(m => !shouldRemove(probe.models[m.id]));
    if (survivors.length === block.models.length) continue;

    for (const m of block.models) {
      const result = probe.models[m.id];
      if (!shouldRemove(result)) continue;
      removed.push({
        provider: p,
        id: m.id,
        reason: result?.reason || 'No longer listed by the provider.',
      });
    }

    const defaultSurvives = survivors.some(m => m.id === block.defaultModel);
    providers[p] = {
      ...block,
      models: survivors,
      defaultModel: defaultSurvives ? block.defaultModel : (survivors[0]?.id ?? ''),
    };
  }

  if (removed.length === 0) return { config, removed };
  return { config: { ...config, providers }, removed };
}
