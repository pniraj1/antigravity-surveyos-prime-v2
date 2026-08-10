/**
 * Error classification for the AI gateway.
 *
 * Gemini and Groq are called directly from the browser, so their failures
 * arrive as HTTP status codes. NVIDIA is routed through the `nvidiaProxy`
 * callable Cloud Function (NVIDIA's API sends no CORS headers), so its
 * failures arrive as a FirebaseError with a `code` string and NO `status`
 * property. Reading only `status` made every NVIDIA timeout, expired
 * subscription, and session expiry report as "check your API keys".
 */

export type GatewayErrorKind =
  | 'timeout'          // callable deadline — the model is too slow for the budget
  | 'subscription'     // assertActiveSubscription rejected the caller
  | 'unauthenticated'  // the Firebase session lapsed
  | 'auth'             // HTTP 401/403 — genuinely a bad provider key
  | 'other';

/** Returns the `functions/*` code from a FirebaseError, or null for anything else. */
function functionsCode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('functions/') ? code : null;
}

export function classifyGatewayError(err: unknown): GatewayErrorKind {
  const code = functionsCode(err);
  if (code === 'functions/deadline-exceeded') return 'timeout';
  if (code === 'functions/permission-denied') return 'subscription';
  if (code === 'functions/unauthenticated') return 'unauthenticated';

  const status = typeof err === 'object' && err !== null
    ? (err as { status?: unknown }).status
    : undefined;
  if (status === 401 || status === 403) return 'auth';

  return 'other';
}

/**
 * User-facing message for a classified error, or null when the caller already
 * has its own message for that kind ('auth' and 'other').
 */
export function gatewayErrorMessage(kind: GatewayErrorKind, providerLabel: string): string | null {
  if (kind === 'timeout') {
    return `${providerLabel} timed out after 5 minutes — try a faster model in Profile → AI & Documents Intelligence.`;
  }
  if (kind === 'subscription') {
    return 'Your SurveyOS subscription is not active. Please renew to use AI features.';
  }
  if (kind === 'unauthenticated') {
    return 'Session expired — sign in again.';
  }
  return null;
}
