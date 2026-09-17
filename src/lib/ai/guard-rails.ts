//
// Veto with guard rails: every probe-ok model enters the chain unless the
// admin excludes it — and a few kinds of id are excluded for the admin,
// once, with a reason they can see and undo ("Include" adds the id to `keep`).
import type { ProviderId, AIModelsConfig } from './models-config';
import type { ModelProbes, ProbeResult } from './probe-types';

const NOT_A_DOCUMENT_MODEL = /(^|[-_/:.])(preview|exp|transcribe|robotics|tts|image|embedding|audio|live|omni)([-_/:.]|$)/i;

export function guardRailReason(_provider: ProviderId, r: ProbeResult): string | null {
  if (r.slow) return 'too slow (>90 s/page)';
  if (NOT_A_DOCUMENT_MODEL.test(r.id)) return 'not a document model';
  return null;
}

/** Adds guard-rail exclusions (with reasons) to a config. Pure; respects `keep`. */
export function applyGuardRails(config: AIModelsConfig, probes: ModelProbes): AIModelsConfig {
  const providers = { ...config.providers };
  for (const p of Object.keys(providers) as ProviderId[]) {
    const block = providers[p];
    const excluded = [...block.excluded];
    const excludedReason = { ...block.excludedReason };
    for (const r of Object.values(probes.providers[p]?.models ?? {})) {
      if (r.status !== 'ok' || block.keep.includes(r.id) || excluded.includes(r.id)) continue;
      const reason = guardRailReason(p, r);
      if (!reason) continue;
      excluded.push(r.id); excludedReason[r.id] = reason;
    }
    providers[p] = { ...block, excluded, excludedReason };
  }
  return { ...config, providers };
}
