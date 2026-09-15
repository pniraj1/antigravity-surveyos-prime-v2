import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ProviderId } from './models-config';
import type { AccuracyResult } from './probe-accuracy';

/**
 * Measured model fitness, replacing the name-based guessing that used to
 * decide what a model could do. Written by the admin panel's probe, read by
 * the panel (to rank) and by the request path (to size vision chunks).
 */

/**
 * DURABLE statuses describe the model itself and justify auto-disabling it.
 * TRANSIENT ones describe this moment — a queue, a cold start, a rate limit —
 * and must never remove a model from the surveyor config. A single measured
 * run of the NVIDIA catalogue produced 5 read timeouts and one HTTP 500 on
 * models that are demonstrably alive, so this distinction is load-bearing.
 */
export type ProbeStatus =
  | 'ok'
  | 'unreachable'     // DURABLE: 404 — listed by the provider, not served to this account
  | 'no-text-input'   // DURABLE: rejects a text prompt (e.g. nvidia/nemotron-parse)
  | 'ctx-too-small'   // DURABLE: context cannot hold the 16384-token extraction budget
  | 'auth-error'      // TRANSIENT: 401/403 — a key problem, not a model problem
  | 'transient'       // TRANSIENT: timeout, 429, or 5xx — tells us nothing about the model
  | 'error';          // TRANSIENT: unrecognised failure — treated as unknown, not dead

/** Statuses that justify removing an enabled model from the surveyor config. */
export const DURABLE_FAILURES: ReadonlySet<ProbeStatus> =
  new Set<ProbeStatus>(['unreachable', 'no-text-input', 'ctx-too-small']);

export type ProbeSource = 'probe' | 'provider-metadata';

export interface ProbeResult {
  id: string;
  status: ProbeStatus;
  /** Human-readable, shown in the panel's Gone group. */
  reason: string;
  vision: boolean;
  /** Max images accepted in one request. null = uncapped. */
  imageCap: number | null;
  ctxWindow: number | null;
  /** Milliseconds for a one-page extraction. null when the 90s cutoff hit. */
  msPerPage: number | null;
  slow: boolean;
  source: Record<'vision' | 'imageCap' | 'ctxWindow', ProbeSource>;
  probedAt: number;
  /**
   * Consecutive probes in which this model failed durably. Auto-disable needs
   * two, so one bad run never strips a working model. Reset to 0 on any 'ok'.
   */
  consecutiveFailures: number;
}

export interface ProviderProbe {
  probedAt: number;
  /** Set when the provider's probe aborted; previous results are kept. */
  error: string | null;
  models: Record<string, ProbeResult>;
  /**
   * Tier 2 results, keyed by model id. A separate map from `models` so a
   * capability re-probe never destroys accuracy data, and vice versa.
   */
  accuracy: Record<string, AccuracyResult>;
}

export interface ModelProbes {
  probedAt: number;
  probedBy: string;
  providers: Record<ProviderId, ProviderProbe>;
}

export function emptyProviderProbe(): ProviderProbe {
  return { probedAt: 0, error: null, models: {}, accuracy: {} };
}

export const EMPTY_PROBES: ModelProbes = {
  probedAt: 0,
  probedBy: '',
  providers: {
    gemini: emptyProviderProbe(),
    groq: emptyProviderProbe(),
    nvidia: emptyProviderProbe(),
    ollama: emptyProviderProbe(),
  },
};

const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'nvidia', 'ollama'];

/** Loads probe results; returns EMPTY_PROBES on any failure so callers never crash. */
export async function loadModelProbes(): Promise<ModelProbes> {
  try {
    const snap = await getDoc(doc(db, 'ai_config', 'model_probes'));
    if (!snap.exists()) return EMPTY_PROBES;
    const raw = snap.data() as Partial<ModelProbes>;
    const providers = { ...EMPTY_PROBES.providers };
    for (const p of PROVIDER_IDS) {
      const stored = raw.providers?.[p];
      if (stored) {
        // Documents written before accuracy scoring existed have no map.
        providers[p] = { ...stored, accuracy: stored.accuracy ?? {} };
      }
    }
    return {
      probedAt: raw.probedAt ?? 0,
      probedBy: raw.probedBy ?? '',
      providers,
    };
  } catch {
    return EMPTY_PROBES;
  }
}

/** Admin-only write, enforced by Firestore rules. Overwrites wholesale. */
export async function saveModelProbes(probes: ModelProbes, probedBy: string): Promise<void> {
  await setDoc(doc(db, 'ai_config', 'model_probes'), {
    ...probes,
    probedAt: Date.now(),
    probedBy,
  });
}

/**
 * True when an accuracy result was produced against a different benchmark
 * document than the one currently loaded. Stale results are shown and marked
 * rather than deleted, so the admin can see what changed and re-run knowingly.
 */
export function isAccuracyStale(
  result: AccuracyResult,
  currentBenchmarkFileName: string | null,
): boolean {
  if (currentBenchmarkFileName === null) return true;
  return result.benchmarkFileName !== currentBenchmarkFileName;
}
