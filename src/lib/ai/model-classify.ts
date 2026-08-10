import type { ProbeResult } from './probe-types';
import type { AccuracyResult } from './probe-accuracy';

/**
 * Sorts working models into the two kinds of document this app extracts.
 *
 *   Small — driving licence, RC, policy, claim form. One page, few fields,
 *           usually a photo or scan, so vision is required. A surveyor is
 *           waiting, so speed is the binding constraint.
 *   Large — repair estimate, final bill. Multi-page, dense tables. Table
 *           accuracy is the binding constraint; vision is optional because a
 *           digitally-born PDF is read through its text layer.
 *
 * The two are not nested: a text-only model can be fit for large documents and
 * unfit for small ones.
 *
 * Derived, never stored — a stored category would drift from the measurements
 * it came from.
 */

/**
 * A model slower than this per page is unusable for a licence however accurate,
 * because the surveyor is sitting in front of the vehicle waiting for it.
 */
export const SMALL_DOC_MAX_MS = 20_000;

export interface ModelCapability {
  smallDocs: boolean;
  largeDocs: boolean;
}

export function classifyModel(probe: ProbeResult, accuracy?: AccuracyResult): ModelCapability {
  if (probe.status !== 'ok') return { smallDocs: false, largeDocs: false };

  const smallDocs =
    probe.vision &&
    probe.msPerPage !== null &&
    probe.msPerPage <= SMALL_DOC_MAX_MS;

  // Requires tier 2 to have run. Untested means unknown, not good.
  const largeDocs = accuracy?.verdict === 'exact' || accuracy?.verdict === 'close';

  return { smallDocs, largeDocs };
}
