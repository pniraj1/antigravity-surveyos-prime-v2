// Firebase Callable Functions client helpers.
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from './config';

const functions = getFunctions(getFirebaseApp());

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
