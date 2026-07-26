// Firebase Callable Functions client helpers.
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from './config';

/**
 * MUST match the region the functions are deployed to (see setGlobalOptions in
 * functions/index.js). Omitting it silently defaults to us-central1, where
 * nothing is deployed since the asia-south1 residency migration — calls then
 * fail with "not found" rather than anything that names the real cause.
 */
const FUNCTIONS_REGION = 'asia-south1';

const functions = getFunctions(getFirebaseApp(), FUNCTIONS_REGION);

export interface ProxyResult {
  status: number;
  ok: boolean;
  /** Raw response body text from the upstream provider (JSON or error HTML). */
  body: string;
}

/**
 * Calls the nvidiaProxy Cloud Function, which forwards to NVIDIA NIM
 * server-to-server (NVIDIA's API has no CORS support for browsers).
 */
export async function callNvidiaProxy(
  path: 'models' | 'chat/completions',
  key: string,
  body?: unknown,
): Promise<ProxyResult> {
  const fn = httpsCallable<{ path: string; key: string; body?: unknown }, ProxyResult>(
    functions,
    'nvidiaProxy',
  );
  const res = await fn({ path, key, body });
  return res.data;
}

export interface BramhaIndexResult {
  scanned: number;
  embedded: number;
  skipped: number;
  pruned: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

/**
 * Rebuilds the Bramha vector index over all completed claims. Admin-only
 * (enforced server-side). Safe to re-run — documents are keyed per claim, so
 * repeats overwrite rather than duplicate, and memories whose claim has been
 * deleted are pruned in the same pass.
 *
 * @param force re-embed claims that are already indexed
 */
export async function rebuildBramhaIndex(force = false): Promise<BramhaIndexResult> {
  const fn = httpsCallable<{ force: boolean }, BramhaIndexResult>(
    functions,
    'rebuildBramhaIndex',
  );
  const res = await fn({ force });
  return res.data;
}
