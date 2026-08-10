import type { ProbeResult, ProviderProbe } from './probe-types';

/**
 * Compares a probe against the previous one to produce the panel's three
 * groups. Obsolescence handling falls out of this: a model that was working
 * and no longer is appears in `gone`, which is what the reconciler uses to
 * pull it out of the surveyor-facing config.
 */

export interface ProbeDiff {
  /** True when there is nothing to compare against; the New group is suppressed. */
  isFirstProbe: boolean;
  /** Model ids working now that were not working before. */
  added: string[];
  /** Working models, fastest first, cutoff-exceeding models last. */
  working: ProbeResult[];
  gone: Array<{ id: string; reason: string }>;
}

function workingIds(probe: ProviderProbe | null): Set<string> {
  if (!probe) return new Set();
  return new Set(
    Object.values(probe.models).filter(m => m.status === 'ok').map(m => m.id),
  );
}

/** Fastest first. A model that hit the 90s cutoff has no measurement and sorts last. */
function bySpeed(a: ProbeResult, b: ProbeResult): number {
  if (a.msPerPage === null && b.msPerPage === null) return a.id.localeCompare(b.id);
  if (a.msPerPage === null) return 1;
  if (b.msPerPage === null) return -1;
  return a.msPerPage - b.msPerPage;
}

export function diffProbes(prev: ProviderProbe | null, next: ProviderProbe): ProbeDiff {
  const prevWorking = workingIds(prev);
  const isFirstProbe = prevWorking.size === 0;

  const working = Object.values(next.models)
    .filter(m => m.status === 'ok')
    .sort(bySpeed);

  const nextWorking = new Set(working.map(m => m.id));

  const added = isFirstProbe
    ? []
    : working.map(m => m.id).filter(id => !prevWorking.has(id)).sort();

  const gone = [...prevWorking]
    .filter(id => !nextWorking.has(id))
    .sort()
    .map(id => ({
      id,
      reason: next.models[id]?.reason || 'No longer listed by the provider.',
    }));

  return { isFirstProbe, added, working, gone };
}
