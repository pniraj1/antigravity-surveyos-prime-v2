import { ProviderError } from './service';

/**
 * Dev-only. `?ai-fault=503` (or 429-minute | 429-day | 429-zero) makes the
 * FIRST Gemini call of the page load fail with a canned Google body, so the
 * fallback loop can be watched on a real document without waiting for Google
 * to be busy. Inert in production builds.
 */
const violation = (quotaId: string) => ({ quotaId, quotaDimensions: { location: 'global', model: 'fault' } });
const quota = (...ids: string[]) => [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: ids.map(violation) }];

const CANNED: Record<string, () => ProviderError> = {
  '503': () => new ProviderError('gemini', 503, 'This model is currently experiencing high demand. (injected)'),
  '429-minute': () => new ProviderError('gemini', 429, 'quota (injected)', quota('GenerateRequestsPerMinutePerProjectPerModel')),
  '429-day': () => new ProviderError('gemini', 429, 'quota (injected)', quota('GenerateRequestsPerDayPerProjectPerModel-FreeTier')),
  '429-zero': () => new ProviderError('gemini', 429, 'quota (injected)', quota(
    'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
    'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
  )),
};

let pending: string | null | undefined;   // undefined = not read from the URL yet

function readFromUrl(): string | null {
  if (process.env.NODE_ENV === 'production' || typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get('ai-fault');
}

/** The injected failure for this page load, once; null every time after. */
export function takeFault(): ProviderError | null {
  if (pending === undefined) pending = readFromUrl();
  const make = pending ? CANNED[pending] : undefined;
  pending = null;
  return make ? make() : null;
}

/** Tests only. */
export function _setFaultForTests(v: string | null): void { pending = v; }
