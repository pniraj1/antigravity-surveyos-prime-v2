# AI Model Fitness Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace name-based capability guessing in the admin AI Models panel with measured probe results, and fix the three defects that make NVIDIA unusable as a primary provider.

**Architecture:** Tasks 1–3 are independent request-path fixes that unblock NVIDIA immediately with correct static image caps. Tasks 4–8 add a probe subsystem built as small pure modules (classifier, diff, reconciler) with a thin orchestrator, so the logic is unit-testable without network access. Tasks 9–10 delete the heuristics and rewrite the panel to consume probe data.

**Tech Stack:** Next.js 16, TypeScript, Zustand, Firestore, Firebase Cloud Functions v2, Vitest (client), plain `node` + `assert` (functions).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-ai-model-fitness-probe-design.md`
- Client tests: Vitest, colocated in `src/lib/ai/__tests__/`. Run with `npx vitest run <path>`.
- Functions tests: no framework, plain `node` + `assert`, registered in the `test:functions` npm script.
- Extraction output budget is **16384** tokens (`src/lib/ai/service.ts:422`). The probe ping must use this exact value.
- Latency probe cutoff: **90000** ms. Concurrency is per-provider: NVIDIA **4** (no gap), Groq **2** (2.5s gap), Gemini **1** (6.5s gap, for its 10 rpm free tier).
- Auto-disable requires **two consecutive DURABLE failures**. Transient failures (timeout, 429, 5xx) never remove a model. This rule is load-bearing: one measured NVIDIA run produced 5 read timeouts and an HTTP 500 on models that are alive.
- NVIDIA proxy timeout: **300** seconds server-side, **300000** ms client-side.
- No `console.log` in production code (project rule); `console.warn` / `console.error` are used elsewhere in these files and are acceptable.
- Immutable updates only — spread, never mutate (project rule).
- Commit directly to `main`.

---

### Task 1: Raise the NVIDIA proxy timeouts

The proxy dies at the Cloud Functions v2 default of 60s and the callable client gives up at 70s, while NVIDIA vision models take 27–200s per page. Every NVIDIA extraction fails on time.

**Files:**
- Modify: `functions/index.js:165`
- Modify: `src/lib/firebase/functions.ts:31-36`
- Test: `functions/nvidia-proxy.test.js` (create)
- Modify: `package.json` (register the new functions test)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new. `callNvidiaProxy(path, key, body)` keeps its existing signature.

- [ ] **Step 1: Write the failing test**

Create `functions/nvidia-proxy.test.js`:

```javascript
/**
 * Self-check for the nvidiaProxy deployment config. Run: `node nvidia-proxy.test.js`
 * NVIDIA vision models take 27-200s per page; the v2 default of 60s kills every
 * call. This asserts the declared timeout, which is otherwise invisible until
 * a surveyor hits it in production.
 */
const assert = require("assert");

// firebase-admin's initializeApp() runs at require-time in index.js and wants a
// project id. It never contacts the network here — we only read metadata.
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "surveyos-test";
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || "{}";

const { nvidiaProxy } = require("./index");

assert.ok(nvidiaProxy.__endpoint, "nvidiaProxy should expose v2 endpoint metadata");
assert.strictEqual(
  nvidiaProxy.__endpoint.timeoutSeconds,
  300,
  "nvidiaProxy must allow 300s — NVIDIA vision models take up to 200s per page"
);

console.log("nvidia-proxy.test.js: all assertions passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && node nvidia-proxy.test.js`

Expected: FAIL with `AssertionError [ERR_ASSERTION]: nvidiaProxy must allow 300s` — actual value `undefined`.

- [ ] **Step 3: Add the server-side timeout**

In `functions/index.js`, change line 165 from:

```javascript
exports.nvidiaProxy = onCall({ maxInstances: 10, memory: "512MiB" }, async (request) => {
```

to:

```javascript
// timeoutSeconds: NVIDIA vision inference measured at 27-200s per page (llama-3.2-90b
// at 131s, nemotron-super-49b at 200s). The v2 default of 60s kills every call before
// NVIDIA answers, and the client reports it as an invalid API key. 300s covers the
// slowest measured model with headroom.
exports.nvidiaProxy = onCall({ maxInstances: 10, memory: "512MiB", timeoutSeconds: 300 }, async (request) => {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && node nvidia-proxy.test.js`

Expected: `nvidia-proxy.test.js: all assertions passed`

- [ ] **Step 5: Add the client-side timeout**

In `src/lib/firebase/functions.ts`, replace the body of `callNvidiaProxy` (lines 31-36):

```typescript
  const fn = httpsCallable<{ path: string; key: string; body?: unknown }, ProxyResult>(
    functions,
    'nvidiaProxy',
    // The callable SDK defaults to 70s. NVIDIA vision inference runs 27-200s per
    // page, and a client-side deadline surfaces as a FirebaseError with no HTTP
    // status — which the gateway's error classifier reports as a bad API key.
    // Must stay >= the function's own timeoutSeconds (300) in functions/index.js.
    { timeout: 300_000 },
  );
  const res = await fn({ path, key, body });
  return res.data;
```

- [ ] **Step 6: Register the functions test**

In `package.json`, change the `test:functions` script from:

```json
"test:functions": "node functions/subscription.test.js && node functions/bramha.test.js",
```

to:

```json
"test:functions": "node functions/subscription.test.js && node functions/bramha.test.js && node functions/nvidia-proxy.test.js",
```

- [ ] **Step 7: Verify the full test suite still passes**

Run: `npm run test:functions`

Expected: all three test files print their pass lines, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add functions/index.js functions/nvidia-proxy.test.js src/lib/firebase/functions.ts package.json
git commit -m "fix(ai): raise NVIDIA proxy timeouts to 300s

NVIDIA vision inference takes 27-200s per page. The Cloud Functions v2
default of 60s and the callable SDK default of 70s both fire first, so
every NVIDIA extraction failed."
```

---

### Task 2: Classify FirebaseError codes instead of blaming the key

`callWithRotation` reads only `err.status`. Callable errors carry `code: 'functions/...'` and no status, so a timeout falls through every branch and surfaces as "Check your API keys". NVIDIA is the only provider routed through a callable, so it is the only one misdiagnosed.

**Files:**
- Create: `src/lib/ai/gateway-errors.ts`
- Create: `src/lib/ai/__tests__/gateway-errors.test.ts`
- Modify: `src/lib/ai/service.ts` (import, and the branch chain at lines 545-630)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type GatewayErrorKind = 'timeout' | 'subscription' | 'unauthenticated' | 'auth' | 'other'`
  - `classifyGatewayError(err: unknown): GatewayErrorKind`
  - `gatewayErrorMessage(kind: GatewayErrorKind, providerLabel: string): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/gateway-errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyGatewayError, gatewayErrorMessage } from '../gateway-errors';

/** Mimics a FirebaseError: a `code` string, no `status` property. */
function firebaseError(code: string, message = 'callable failed') {
  return Object.assign(new Error(message), { code });
}

describe('classifyGatewayError', () => {
  it('classifies a callable deadline as a timeout, not an auth failure', () => {
    expect(classifyGatewayError(firebaseError('functions/deadline-exceeded'))).toBe('timeout');
  });

  it('classifies a callable permission-denied as a subscription problem', () => {
    expect(classifyGatewayError(firebaseError('functions/permission-denied'))).toBe('subscription');
  });

  it('classifies a callable unauthenticated as a sign-in problem', () => {
    expect(classifyGatewayError(firebaseError('functions/unauthenticated'))).toBe('unauthenticated');
  });

  it('still classifies HTTP 401/403 as an auth (bad key) failure', () => {
    expect(classifyGatewayError(Object.assign(new Error('x'), { status: 401 }))).toBe('auth');
    expect(classifyGatewayError(Object.assign(new Error('x'), { status: 403 }))).toBe('auth');
  });

  it('does not treat an HTTP 500 as any of the special kinds', () => {
    expect(classifyGatewayError(Object.assign(new Error('x'), { status: 500 }))).toBe('other');
  });

  it('ignores a non-functions code string', () => {
    expect(classifyGatewayError(firebaseError('auth/user-not-found'))).toBe('other');
  });

  it('survives null and non-error input', () => {
    expect(classifyGatewayError(null)).toBe('other');
    expect(classifyGatewayError('boom')).toBe('other');
  });
});

describe('gatewayErrorMessage', () => {
  it('names the provider and suggests a faster model on timeout', () => {
    expect(gatewayErrorMessage('timeout', 'NVIDIA NIM'))
      .toBe('NVIDIA NIM timed out after 5 minutes — try a faster model in Profile → AI & Documents Intelligence.');
  });

  it('returns the subscription message', () => {
    expect(gatewayErrorMessage('subscription', 'NVIDIA NIM'))
      .toBe('Your SurveyOS subscription is not active. Please renew to use AI features.');
  });

  it('returns the sign-in message', () => {
    expect(gatewayErrorMessage('unauthenticated', 'NVIDIA NIM'))
      .toBe('Session expired — sign in again.');
  });

  it('returns null for kinds the caller already handles', () => {
    expect(gatewayErrorMessage('auth', 'NVIDIA NIM')).toBeNull();
    expect(gatewayErrorMessage('other', 'NVIDIA NIM')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/gateway-errors.test.ts`

Expected: FAIL — `Failed to resolve import "../gateway-errors"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/gateway-errors.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/gateway-errors.test.ts`

Expected: PASS, 11 tests.

- [ ] **Step 5: Wire it into the rotation loop**

In `src/lib/ai/service.ts`, add to the imports at the top of the file:

```typescript
import { classifyGatewayError, gatewayErrorMessage } from './gateway-errors';
```

Then in `callWithRotation`, replace line 546:

```typescript
    const isAuthError = err.status === 401 || err.status === 403;
```

with:

```typescript
    const errorKind = classifyGatewayError(err);
    const isAuthError = errorKind === 'auth';

    // ── Callable-transport failures (NVIDIA only) ──────────────────────────
    // A timeout, a lapsed subscription, and an expired session are all
    // unfixable by rotating to another key — stop immediately and say what
    // actually went wrong instead of blaming the surveyor's API key.
    if (errorKind === 'timeout' || errorKind === 'subscription' || errorKind === 'unauthenticated') {
      const message = gatewayErrorMessage(errorKind, providerLabel);
      if (message) toast.error(message, { duration: 10000 });
      break;
    }
```

- [ ] **Step 6: Verify nothing else regressed**

Run: `npx vitest run src/lib/ai`

Expected: PASS. All existing AI test files still green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/gateway-errors.ts src/lib/ai/__tests__/gateway-errors.test.ts src/lib/ai/service.ts
git commit -m "fix(ai): stop reporting NVIDIA timeouts as invalid API keys

Callable errors carry a code string and no HTTP status, so every NVIDIA
failure fell through the status-only classifier and surfaced as 'check
your API keys'. Timeouts and permission errors now say so, and no longer
burn through key rotation that cannot help."
```

---

### Task 3: Honest image caps, correct chunk sizing, no silent page loss

NVIDIA rejects any request carrying more than one image, but the processor sends two per call for estimates and the cap is declared as `null` ("unlimited"). The cap is also applied by truncation, so simply correcting it would silently drop page 2 of every chunk.

**Files:**
- Modify: `src/lib/ai/models-config.ts:29-34`
- Modify: `src/lib/ai/service.ts:140-143` (`buildOverrideProvider`), `:234-245` (`buildProvider`), `:400-409` (image cap application)
- Modify: `src/lib/ai/processor.ts:522-525`
- Create: `src/lib/ai/__tests__/image-cap.test.ts`
- Modify: `src/lib/ai/__tests__/models-config.test.ts:27-29`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PROVIDER_IMAGE_CAPS: Record<ProviderId, number | null>` — `nvidia` becomes `1`
  - `resolveVisionChunkSize(preferred: number, imageCap: number | null): number` (exported from `src/lib/ai/image-cap.ts`)
  - `getActiveImageCap(): number | null` (exported from `src/lib/ai/service.ts`) — synchronous and side-effect-free by design; see the comment in its implementation

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/image-cap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveVisionChunkSize, assertWithinImageCap } from '../image-cap';

describe('resolveVisionChunkSize', () => {
  it('clamps the preferred size down to a cap of 1 (NVIDIA)', () => {
    expect(resolveVisionChunkSize(2, 1)).toBe(1);
  });

  it('keeps the preferred size when the cap is larger (Groq at 5)', () => {
    expect(resolveVisionChunkSize(2, 5)).toBe(2);
  });

  it('keeps the preferred size when there is no cap (Gemini)', () => {
    expect(resolveVisionChunkSize(2, null)).toBe(2);
  });

  it('never returns less than 1, even for a nonsense cap', () => {
    expect(resolveVisionChunkSize(2, 0)).toBe(1);
    expect(resolveVisionChunkSize(2, -3)).toBe(1);
  });
});

describe('assertWithinImageCap', () => {
  it('accepts a chunk at exactly the cap', () => {
    expect(() => assertWithinImageCap(1, 1, 'nvidia')).not.toThrow();
    expect(() => assertWithinImageCap(5, 5, 'groq')).not.toThrow();
  });

  it('accepts any size when uncapped', () => {
    expect(() => assertWithinImageCap(9, null, 'gemini')).not.toThrow();
  });

  it('throws rather than silently dropping pages when over the cap', () => {
    expect(() => assertWithinImageCap(2, 1, 'nvidia'))
      .toThrow('nvidia accepts at most 1 image per request, got 2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/image-cap.test.ts`

Expected: FAIL — `Failed to resolve import "../image-cap"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/image-cap.ts`:

```typescript
/**
 * Per-provider image limits.
 *
 * NVIDIA NIM rejects any request carrying more than one image:
 *   400 {"message":"At most 1 image(s) may be provided in one request."}
 * Groq accepts 5. Gemini is effectively uncapped.
 *
 * The cap must shrink the CHUNK the processor builds, not truncate the images
 * inside a chunk — truncation silently drops pages from an estimate, which is
 * a liability document.
 */

/** Largest chunk that fits under `imageCap`. Always at least 1. */
export function resolveVisionChunkSize(preferred: number, imageCap: number | null): number {
  if (imageCap === null) return Math.max(1, preferred);
  return Math.max(1, Math.min(preferred, imageCap));
}

/**
 * Guards the request builder. Reaching here over the cap means the caller
 * chunked wrongly — fail loudly rather than quietly sending fewer pages than
 * the surveyor's document contains.
 */
export function assertWithinImageCap(count: number, imageCap: number | null, providerName: string): void {
  if (imageCap !== null && count > imageCap) {
    throw new Error(
      `${providerName} accepts at most ${imageCap} image per request, got ${count}. ` +
      `This is a chunking bug — pages would otherwise be dropped silently.`
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/image-cap.test.ts`

Expected: PASS, 7 tests.

- [ ] **Step 5: Correct the declared NVIDIA cap**

In `src/lib/ai/models-config.ts`, replace lines 29-34:

```typescript
/**
 * Per-provider image cap — the maximum images accepted in ONE request.
 * Groq accepts 5. NVIDIA NIM accepts exactly 1 and 400s on more
 * ("At most 1 image(s) may be provided in one request"). Gemini is uncapped.
 * These are defaults; a probe result overrides them per model.
 */
export const PROVIDER_IMAGE_CAPS: Record<ProviderId, number | null> = {
  gemini: null,
  groq: 5,
  nvidia: 1,
};
```

- [ ] **Step 6: Fix the existing assertion that locks in the wrong value**

In `src/lib/ai/__tests__/models-config.test.ts`, replace lines 27-29:

```typescript
  it('caps NVIDIA at 1 image and Groq at 5, Gemini uncapped', () => {
    expect(PROVIDER_IMAGE_CAPS).toEqual({ gemini: null, groq: 5, nvidia: 1 });
  });
```

- [ ] **Step 7: Apply the cap in both provider builders**

In `src/lib/ai/service.ts`, add to the imports:

```typescript
import { assertWithinImageCap } from './image-cap';
import { PROVIDER_IMAGE_CAPS } from './models-config';
```

Replace line 141 in `buildOverrideProvider`:

```typescript
    return { name: 'nvidia', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions', model: o.model, keys: [o.key], maxImages: PROVIDER_IMAGE_CAPS.nvidia ?? undefined };
```

Replace lines 238-244 in `buildProvider`:

```typescript
    return {
      name: 'nvidia',
      endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
      model,
      keys,
      // NVIDIA NIM 400s on more than one image per request. Verified against
      // llama-3.2-90b/11b-vision-instruct and nemotron-nano-12b-v2-vl.
      maxImages: PROVIDER_IMAGE_CAPS.nvidia ?? undefined,
    };
```

- [ ] **Step 8: Replace the truncating slice with a guard**

In `src/lib/ai/service.ts`, replace lines 400-409:

```typescript
  if (images.length > 0) {
    // The chunk must already fit the provider's cap — the processor sizes it
    // from getActiveImageCap(). Truncating here would drop pages from an
    // estimate without telling anyone, so this throws instead.
    assertWithinImageCap(images.length, provider.maxImages ?? null, provider.name);
    const content: any[] = images.map(img => ({
      type: 'image_url',
      image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` },
    }));
    content.push({ type: 'text', text: prompt });
    messages.push({ role: 'user', content });
  } else {
```

- [ ] **Step 9: Export the active cap for the processor**

In `src/lib/ai/service.ts`, add after the `buildProvider` function (after line 258):

```typescript
/**
 * The image cap of the provider that will actually serve the next request —
 * the test override if one is active, otherwise the surveyor's primary
 * provider. The processor uses this to size vision chunks so no page is ever
 * dropped by the cap guard in callWithKey.
 *
 * Deliberately does NOT call getAIProvider(). That function toasts when the
 * preferred provider has no keys and falls through to a Firestore read of
 * ai_config/routing — calling it here would double every such toast and add a
 * second, independent provider resolution per extraction that could disagree
 * with the one callAIGateway performs. This reads the same inputs with no
 * side effects and no network.
 */
export function getActiveImageCap(): number | null {
  const override = getAITestOverride();
  if (override) return buildOverrideProvider(override).maxImages ?? null;

  const profile = getProfileFromStorage();
  if (!profile) return null;

  const preferred = (profile.aiProvider ?? 'gemini') as 'gemini' | 'groq' | 'nvidia';
  // Mirror getAIProvider's choice: preferred if it has keys, else the fallback.
  const hasKeys: Record<'gemini' | 'groq' | 'nvidia', boolean> = {
    gemini: resolveGeminiKeys(profile).length > 0,
    groq: resolveGroqKeys(profile).length > 0,
    nvidia: resolveNvidiaKeys(profile).length > 0,
  };
  const fallback: 'gemini' | 'groq' = preferred === 'groq' ? 'gemini' : 'groq';
  const active = hasKeys[preferred] ? preferred : hasKeys[fallback] ? fallback : null;
  if (!active) return null;

  return PROVIDER_IMAGE_CAPS[active];
}
```

- [ ] **Step 10: Size the vision chunk from the cap**

In `src/lib/ai/processor.ts`, add to the imports:

```typescript
import { resolveVisionChunkSize } from './image-cap';
```

and change the existing `callAIGateway` import on line 7 to also pull in the new helper:

```typescript
import { callAIGateway, getActiveImageCap } from './service';
```

Then replace lines 522-525:

```typescript
    // Chunk size: always 1 page per call in text-mode (avoids 413 on dense documents).
    // In vision-mode: estimates prefer 2 pages per call for efficiency; others get 1.
    // The preference is then clamped to the active provider's image cap — NVIDIA
    // accepts exactly 1, and exceeding it 400s the whole request.
    const PREFERRED_VISION_CHUNK = (key === 'estimate' || key === 'final-bill') ? 2 : 1;
    const VISION_CHUNK_SIZE = resolveVisionChunkSize(PREFERRED_VISION_CHUNK, getActiveImageCap());
    const CHUNK_SIZE = useTextMode ? 1 : VISION_CHUNK_SIZE;
```

- [ ] **Step 11: Run the full client suite**

Run: `npx vitest run`

Expected: PASS. `models-config.test.ts` now asserts `nvidia: 1`.

- [ ] **Step 12: Commit**

```bash
git add src/lib/ai/image-cap.ts src/lib/ai/__tests__/image-cap.test.ts src/lib/ai/models-config.ts src/lib/ai/__tests__/models-config.test.ts src/lib/ai/service.ts src/lib/ai/processor.ts
git commit -m "fix(ai): size vision chunks to the provider image cap

NVIDIA NIM 400s on more than one image per request, but estimates were
chunked two pages at a time and the cap was declared as unlimited. The
cap was also applied by truncation, which would have dropped page 2 of
every chunk instead of erroring."
```

---

### Task 4: Probe document types and persistence

The probe needs somewhere to record what it measured, readable by surveyors (so the client can trust probed caps) and writable only by admins.

**Files:**
- Create: `src/lib/ai/probe-types.ts`
- Create: `src/lib/ai/__tests__/probe-types.test.ts`
- Modify: `firestore.rules` (after the `ai_config/models` block, around line 49)

**Interfaces:**
- Consumes: `ProviderId` from `src/lib/ai/models-config.ts`.
- Produces:
  - `type ProbeStatus = 'ok' | 'unreachable' | 'no-text-input' | 'ctx-too-small' | 'auth-error' | 'error'`
  - `type ProbeSource = 'probe' | 'provider-metadata'`
  - `interface ProbeResult`, `interface ProviderProbe`, `interface ModelProbes`
  - `EMPTY_PROBES: ModelProbes`
  - `emptyProviderProbe(): ProviderProbe`
  - `loadModelProbes(): Promise<ModelProbes>`
  - `saveModelProbes(probes: ModelProbes, probedBy: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/probe-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EMPTY_PROBES, emptyProviderProbe } from '../probe-types';

describe('EMPTY_PROBES', () => {
  it('carries a block for every provider so the panel never reads undefined', () => {
    expect(Object.keys(EMPTY_PROBES.providers).sort()).toEqual(['gemini', 'groq', 'nvidia']);
  });

  it('starts with no models and no error', () => {
    expect(EMPTY_PROBES.providers.nvidia.models).toEqual({});
    expect(EMPTY_PROBES.providers.nvidia.error).toBeNull();
  });

  it('has never been probed', () => {
    expect(EMPTY_PROBES.probedAt).toBe(0);
  });
});

describe('emptyProviderProbe', () => {
  it('returns a fresh object each call, not a shared reference', () => {
    const a = emptyProviderProbe();
    const b = emptyProviderProbe();
    expect(a).not.toBe(b);
    expect(a.models).not.toBe(b.models);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-types.test.ts`

Expected: FAIL — `Failed to resolve import "../probe-types"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/probe-types.ts`:

```typescript
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ProviderId } from './models-config';

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
}

export interface ModelProbes {
  probedAt: number;
  probedBy: string;
  providers: Record<ProviderId, ProviderProbe>;
}

export function emptyProviderProbe(): ProviderProbe {
  return { probedAt: 0, error: null, models: {} };
}

export const EMPTY_PROBES: ModelProbes = {
  probedAt: 0,
  probedBy: '',
  providers: {
    gemini: emptyProviderProbe(),
    groq: emptyProviderProbe(),
    nvidia: emptyProviderProbe(),
  },
};

const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'nvidia'];

/** Loads probe results; returns EMPTY_PROBES on any failure so callers never crash. */
export async function loadModelProbes(): Promise<ModelProbes> {
  try {
    const snap = await getDoc(doc(db, 'ai_config', 'model_probes'));
    if (!snap.exists()) return EMPTY_PROBES;
    const raw = snap.data() as Partial<ModelProbes>;
    const providers = { ...EMPTY_PROBES.providers };
    for (const p of PROVIDER_IDS) {
      if (raw.providers?.[p]) providers[p] = raw.providers[p]!;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/probe-types.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Add the Firestore rule**

In `firestore.rules`, insert immediately after the closing brace of the `match /ai_config/models { ... }` block:

```
    // AI model probe results — admin writes, all signed-in surveyors read.
    // Contains NO secrets (model ids and measured capabilities only). Surveyors
    // read it so the request path can size vision chunks to a model's real
    // image cap rather than a hardcoded guess.
    match /ai_config/model_probes {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
```

- [ ] **Step 6: Verify the rules file still parses**

Run: `npx firebase deploy --only firestore:rules --dry-run --project surveyos-v2-antigravity-in`

Expected: rules compile without error. If the CLI is not authenticated, run `npx firebase login` first.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/probe-types.ts src/lib/ai/__tests__/probe-types.test.ts firestore.rules
git commit -m "feat(ai): probe result types and ai_config/model_probes document"
```

---

### Task 5: Response classifier

Turning a provider's HTTP response into a verdict is the one piece of probe logic worth testing hard, because every rule in it came from a measured failure.

**Files:**
- Create: `src/lib/ai/probe-classify.ts`
- Create: `src/lib/ai/__tests__/probe-classify.test.ts`

**Interfaces:**
- Consumes: `ProbeStatus` from `src/lib/ai/probe-types.ts`.
- Produces:
  - `interface RawResponse { status: number; body: string }`
  - `interface PingVerdict { status: ProbeStatus; reason: string; ctxWindow: number | null }`
  - `classifyPing(res: RawResponse): PingVerdict`
  - `parseContextWindow(body: string): number | null`
  - `parseImageCap(body: string): number | null`
  - `PROBE_MAX_TOKENS: 16384`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/probe-classify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyPing, parseContextWindow, parseImageCap } from '../probe-classify';

// Every body below is a verbatim response captured from NVIDIA NIM.

describe('parseContextWindow', () => {
  it('extracts the ceiling from a context-length rejection', () => {
    expect(parseContextWindow(
      '{"error":"This model\'s maximum context length is 16384 tokens. However, you ' +
      'requested 16448 tokens (64 in the messages, 16384 in the completion)."}'
    )).toBe(16384);
  });

  it('extracts the ceiling from the TRT-LLM shape of the same rejection', () => {
    expect(parseContextWindow(
      '{"error":{"message":"max_tokens=16384 cannot be greater than ' +
      'max_model_len=max_total_tokens=8192. Please request fewer output tokens."}}'
    )).toBe(8192);
  });

  it('returns null when the body says nothing about context', () => {
    expect(parseContextWindow('{"object":"error","message":"Bad request"}')).toBeNull();
    expect(parseContextWindow('')).toBeNull();
  });
});

describe('parseImageCap', () => {
  it('extracts the cap from a multi-image rejection', () => {
    expect(parseImageCap(
      '{"object":"error","message":"At most 1 image(s) may be provided in one request. ' +
      'You can set `--limit-mm-per-prompt` to increase this limit if the model supports it."}'
    )).toBe(1);
  });

  it('handles a cap above 1', () => {
    expect(parseImageCap('{"message":"At most 5 image(s) may be provided in one request."}')).toBe(5);
  });

  it('returns null when the body is about something else', () => {
    expect(parseImageCap('{"message":"Bad request"}')).toBeNull();
  });
});

describe('classifyPing', () => {
  it('accepts a 200', () => {
    const v = classifyPing({ status: 200, body: '{"choices":[{"message":{"content":"OK"}}]}' });
    expect(v.status).toBe('ok');
  });

  it('marks a 404 unreachable and keeps the provider detail as the reason', () => {
    const v = classifyPing({
      status: 404,
      body: '{"status":404,"title":"Not Found","detail":"Function \'ee47df99\': Not found for account \'6awCv\'"}',
    });
    expect(v.status).toBe('unreachable');
    expect(v.reason).toContain('Not found for account');
  });

  it('marks a text-input rejection', () => {
    const v = classifyPing({
      status: 400,
      body: '{"object":"error","message":"Content cannot be a plain string. The model does not support text input."}',
    });
    expect(v.status).toBe('no-text-input');
  });

  it('marks a model whose context cannot hold the extraction budget', () => {
    const v = classifyPing({
      status: 400,
      body: '{"error":"This model\'s maximum context length is 16384 tokens. However, you requested 16448 tokens."}',
    });
    expect(v.status).toBe('ctx-too-small');
    expect(v.ctxWindow).toBe(16384);
    expect(v.reason).toContain('16384');
  });

  it('marks 401 and 403 as an auth error, which aborts the provider', () => {
    expect(classifyPing({ status: 401, body: '{}' }).status).toBe('auth-error');
    expect(classifyPing({ status: 403, body: '{}' }).status).toBe('auth-error');
  });

  it('treats a 5xx as transient, not as a dead model', () => {
    expect(classifyPing({ status: 500, body: 'upstream exploded' }).status).toBe('transient');
    expect(classifyPing({ status: 503, body: '' }).status).toBe('transient');
  });

  it('treats a rate limit as transient', () => {
    expect(classifyPing({ status: 429, body: '{"message":"rate limit"}' }).status).toBe('transient');
  });

  it('treats our own timeout or transport failure as transient', () => {
    // A measured NVIDIA run read-timed out on 5 models that are demonstrably
    // alive, including meta/llama-3.2-1b-instruct. Cold start, not death.
    expect(classifyPing({ status: 0, body: 'ReadTimeout' }).status).toBe('transient');
  });

  it('catches the TRT-LLM context rejection as ctx-too-small, not a generic error', () => {
    const v = classifyPing({
      status: 400,
      body: '{"error":{"message":"max_tokens=16384 cannot be greater than max_model_len=max_total_tokens=8192."}}',
    });
    expect(v.status).toBe('ctx-too-small');
    expect(v.ctxWindow).toBe(8192);
  });

  it('falls back to a generic error for an unrecognised 4xx', () => {
    const v = classifyPing({ status: 422, body: 'nope' });
    expect(v.status).toBe('error');
    expect(v.reason).toContain('422');
  });

  it('never throws on an unparseable body', () => {
    expect(() => classifyPing({ status: 400, body: '<html>gateway timeout</html>' })).not.toThrow();
    expect(classifyPing({ status: 400, body: '<html>gateway timeout</html>' }).status).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-classify.test.ts`

Expected: FAIL — `Failed to resolve import "../probe-classify"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/probe-classify.ts`:

```typescript
import type { ProbeStatus } from './probe-types';

/**
 * Turns a provider response into a probe verdict.
 *
 * Every rule here came from a response measured against NVIDIA NIM on
 * 2026-08-10 — see the spec's Problem section. Matching is done on the raw
 * body text rather than parsed JSON because providers disagree about the
 * error envelope ({"error":...} vs {"object":"error","message":...}) and some
 * upstream failures return HTML.
 */

/**
 * The extraction request's output budget (src/lib/ai/service.ts). The ping
 * deliberately asks for this much so that models whose context cannot hold it
 * reject the ping — that rejection is the only way to learn the real ceiling.
 * A healthy model answers "OK" in two tokens regardless, because max_tokens is
 * a ceiling, not a target.
 */
export const PROBE_MAX_TOKENS = 16384;

export interface RawResponse {
  status: number;
  body: string;
}

export interface PingVerdict {
  status: ProbeStatus;
  reason: string;
  ctxWindow: number | null;
}

/**
 * Extracts a model's real context ceiling from a rejection. NVIDIA emits two
 * different shapes for the same condition, both measured against live models:
 *   "This model's maximum context length is 16384 tokens"        (vLLM)
 *   "max_tokens=16384 cannot be greater than max_model_len=8192" (TRT-LLM)
 */
export function parseContextWindow(body: string): number | null {
  const vllm = /maximum context length is (\d+) tokens/i.exec(body);
  if (vllm) return Number(vllm[1]);
  const trt = /max_model_len=(?:max_total_tokens=)?(\d+)/i.exec(body);
  if (trt) return Number(trt[1]);
  return null;
}

/** "At most 1 image(s) may be provided in one request" → 1 */
export function parseImageCap(body: string): number | null {
  const m = /at most (\d+) image\(s\) may be provided/i.exec(body);
  return m ? Number(m[1]) : null;
}

/** Pulls the most useful human-readable sentence out of a provider error body. */
function extractReason(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body);
    const candidate = parsed?.detail ?? parsed?.message ?? parsed?.error?.message ?? parsed?.error;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  } catch {
    // Not JSON — providers sometimes return HTML on upstream failures.
  }
  return fallback;
}

export function classifyPing(res: RawResponse): PingVerdict {
  const { status, body } = res;

  if (status === 200) {
    return { status: 'ok', reason: '', ctxWindow: null };
  }

  // ── Transient first — these say nothing about the model ─────────────────
  // status 0 is our own transport failure or probe cutoff. In one measured run
  // of the NVIDIA catalogue, 5 alive models (including meta/llama-3.2-1b-instruct)
  // read-timed out on a cold start, and one returned 500. Treating those as
  // death would strip working models from the surveyor config.
  if (status === 0 || status === 429 || status >= 500) {
    return {
      status: 'transient',
      reason: status === 429
        ? 'Rate limited during the probe — not a model fault.'
        : `Temporary failure (${status || 'timeout'}) — not a model fault.`,
      ctxWindow: null,
    };
  }

  if (status === 404) {
    return {
      status: 'unreachable',
      reason: extractReason(body, 'Listed by the provider but not served to this account.'),
      ctxWindow: null,
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 'auth-error',
      reason: extractReason(body, `HTTP ${status} — the API key was rejected.`),
      ctxWindow: null,
    };
  }

  if (status === 400) {
    if (/does not support text input/i.test(body)) {
      return {
        status: 'no-text-input',
        reason: extractReason(body, 'Rejects text prompts — cannot be used for extraction.'),
        ctxWindow: null,
      };
    }
    const ctxWindow = parseContextWindow(body);
    if (ctxWindow !== null) {
      return {
        status: 'ctx-too-small',
        reason: `Context window is ${ctxWindow} tokens — too small for the ${PROBE_MAX_TOKENS}-token extraction budget.`,
        ctxWindow,
      };
    }
  }

  return {
    status: 'error',
    reason: extractReason(body, `HTTP ${status}.`) || `HTTP ${status}.`,
    ctxWindow: null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/probe-classify.test.ts`

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/probe-classify.ts src/lib/ai/__tests__/probe-classify.test.ts
git commit -m "feat(ai): probe response classifier

Rules derived from responses measured against NVIDIA NIM: 404 phantoms,
text-input rejections, and context ceilings that the catalogue does not
report."
```

---

### Task 6: Probe diff

The panel's New / Working / Gone grouping, and the obsolescence handling, both fall out of comparing this probe against the last one.

**Files:**
- Create: `src/lib/ai/probe-diff.ts`
- Create: `src/lib/ai/__tests__/probe-diff.test.ts`

**Interfaces:**
- Consumes: `ProbeResult`, `ProviderProbe` from `src/lib/ai/probe-types.ts`.
- Produces:
  - `interface ProbeDiff { isFirstProbe: boolean; added: string[]; working: ProbeResult[]; gone: Array<{ id: string; reason: string }> }`
  - `diffProbes(prev: ProviderProbe | null, next: ProviderProbe): ProbeDiff`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/probe-diff.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { diffProbes } from '../probe-diff';
import type { ProbeResult, ProviderProbe } from '../probe-types';

function result(id: string, over: Partial<ProbeResult> = {}): ProbeResult {
  return {
    id,
    status: 'ok',
    reason: '',
    vision: true,
    imageCap: 1,
    ctxWindow: 128000,
    msPerPage: 30000,
    slow: false,
    source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' },
    probedAt: 1,
    ...over,
  };
}

function probe(...results: ProbeResult[]): ProviderProbe {
  return {
    probedAt: 1,
    error: null,
    models: Object.fromEntries(results.map(r => [r.id, r])),
  };
}

describe('diffProbes', () => {
  it('flags the first ever probe and suppresses the New group', () => {
    const d = diffProbes(null, probe(result('a'), result('b')));
    expect(d.isFirstProbe).toBe(true);
    expect(d.added).toEqual([]);
    expect(d.working.map(r => r.id).sort()).toEqual(['a', 'b']);
  });

  it('treats a previous probe with no models as the first probe', () => {
    const d = diffProbes(probe(), probe(result('a')));
    expect(d.isFirstProbe).toBe(true);
    expect(d.added).toEqual([]);
  });

  it('reports models absent from the previous probe as added', () => {
    const d = diffProbes(probe(result('a')), probe(result('a'), result('b')));
    expect(d.isFirstProbe).toBe(false);
    expect(d.added).toEqual(['b']);
  });

  it('reports a model that was ok and now fails as gone, with its reason', () => {
    const d = diffProbes(
      probe(result('a'), result('b')),
      probe(result('a'), result('b', { status: 'unreachable', reason: 'Not found for account' })),
    );
    expect(d.gone).toEqual([{ id: 'b', reason: 'Not found for account' }]);
    expect(d.working.map(r => r.id)).toEqual(['a']);
  });

  it('reports a model that vanished from the catalogue entirely as gone', () => {
    const d = diffProbes(probe(result('a'), result('b')), probe(result('a')));
    expect(d.gone).toEqual([{ id: 'b', reason: 'No longer listed by the provider.' }]);
  });

  it('does not report a model as gone if it was already failing', () => {
    const d = diffProbes(
      probe(result('a'), result('b', { status: 'error', reason: 'x' })),
      probe(result('a')),
    );
    expect(d.gone).toEqual([]);
  });

  it('reports a model that returns after being gone as added', () => {
    const d = diffProbes(
      probe(result('a'), result('b', { status: 'unreachable', reason: 'x' })),
      probe(result('a'), result('b')),
    );
    expect(d.added).toEqual(['b']);
  });

  it('ranks working models fastest first', () => {
    const d = diffProbes(null, probe(
      result('slow-ish', { msPerPage: 90000 }),
      result('quick', { msPerPage: 27000 }),
      result('middle', { msPerPage: 61000 }),
    ));
    expect(d.working.map(r => r.id)).toEqual(['quick', 'middle', 'slow-ish']);
  });

  it('ranks models that hit the cutoff last, regardless of order', () => {
    const d = diffProbes(null, probe(
      result('over-cutoff', { msPerPage: null, slow: true }),
      result('quick', { msPerPage: 27000 }),
    ));
    expect(d.working.map(r => r.id)).toEqual(['quick', 'over-cutoff']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-diff.test.ts`

Expected: FAIL — `Failed to resolve import "../probe-diff"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/probe-diff.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/probe-diff.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/probe-diff.ts src/lib/ai/__tests__/probe-diff.test.ts
git commit -m "feat(ai): probe diff for New/Working/Gone grouping"
```

---

### Task 7: Auto-disable reconciler

Enabling a model is the admin's decision; keeping a dead one enabled is not. This module removes models that stopped working, and nothing else.

**Files:**
- Create: `src/lib/ai/probe-reconcile.ts`
- Create: `src/lib/ai/__tests__/probe-reconcile.test.ts`

**Interfaces:**
- Consumes: `AIModelsConfig`, `ProviderId`, `ModelEntry` from `src/lib/ai/models-config.ts`; `ModelProbes` from `src/lib/ai/probe-types.ts`.
- Produces:
  - `interface Removal { provider: ProviderId; id: string; reason: string }`
  - `reconcileEnabledModels(config: AIModelsConfig, probes: ModelProbes): { config: AIModelsConfig; removed: Removal[] }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/probe-reconcile.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reconcileEnabledModels } from '../probe-reconcile';
import type { AIModelsConfig, ModelEntry } from '../models-config';
import type { ModelProbes, ProbeResult, ProbeStatus } from '../probe-types';
import { emptyProviderProbe } from '../probe-types';

function entry(id: string): ModelEntry {
  return { id, label: id, note: '', ctxWindow: 128000, vision: true, imageCap: 1, estimateCapacity: '' };
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-reconcile.test.ts`

Expected: FAIL — `Failed to resolve import "../probe-reconcile"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/probe-reconcile.ts`:

```typescript
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

const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'nvidia'];

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
 * is durable on its own — but still needs the strike count, carried on the
 * previous result.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/probe-reconcile.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/probe-reconcile.ts src/lib/ai/__tests__/probe-reconcile.test.ts
git commit -m "feat(ai): auto-disable models that stopped working

Enabling stays manual; a model that dies is pulled from the surveyor
config on the next probe. A failed provider probe changes nothing."
```

---

### Task 8: Probe runner

The orchestrator: fetch each catalogue, ping everything, capability-probe the survivors, four at a time.

**Files:**
- Create: `src/lib/ai/probe-runner.ts`
- Create: `src/lib/ai/__tests__/probe-runner.test.ts`
- Create: `public/ai-probe-page.jpg`

**Interfaces:**
- Consumes: `classifyPing`, `parseImageCap`, `PROBE_MAX_TOKENS`, `RawResponse` (Task 5); `ProbeResult`, `ProviderProbe`, `ModelProbes`, `emptyProviderProbe` (Task 4); `PROVIDER_IMAGE_CAPS` (Task 3); `callNvidiaProxy` from `@/lib/firebase/functions`.
- Produces:
  - `LATENCY_CUTOFF_MS: 90000`, `PROVIDER_CONCURRENCY`, `PROVIDER_MIN_GAP_MS`, `PROBE_VISION_CODE: 'PROBE7X'`
  - `mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]>`
  - `buildProbeResult(input: BuildProbeResultInput): ProbeResult`
  - `runProviderProbe(provider: ProviderId, key: string, previous: ProviderProbe, onProgress: (done: number, total: number) => void): Promise<ProviderProbe>`
  - `runFullProbe(keys: Partial<Record<ProviderId, string>>, previous: ModelProbes, onProgress: (provider: ProviderId, done: number, total: number) => void, onProviderComplete: (provider: ProviderId, result: ProviderProbe) => Promise<void>): Promise<ModelProbes>`

- [ ] **Step 1: Create the probe fixture**

Create `public/ai-probe-page.jpg` — a synthetic one-page repair estimate.

Requirements:
- Roughly A4 at ~1275×1650px, JPEG quality ~90, target ~200KB, matching what `fileToImages` produces at scale 1.5 (`src/lib/ai/processor.ts:167-174`) so the latency measurement is representative.
- A table of **invented** parts and amounts. No real registration number, chassis number, GSTIN, name, or address — this image is transmitted to every probed model on every run.
- The literal text `REF: PROBE7X` printed in the header, large enough to be legible at this resolution. The vision probe asks for this code; a text-only model handed the image cannot produce it.

Any tool that can render text and a table to a JPEG at that resolution works — an HTML page screenshotted at 1275×1650, or a generated image. Verify:

```bash
ls -l public/ai-probe-page.jpg
```

Expected: file exists, size between 100KB and 400KB.

- [ ] **Step 2: Write the failing test**

Create `src/lib/ai/__tests__/probe-runner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  mapWithConcurrency, buildProbeResult, PROBE_VISION_CODE,
  LATENCY_CUTOFF_MS, PROVIDER_CONCURRENCY, PROVIDER_MIN_GAP_MS,
} from '../probe-runner';

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const delays = [30, 5, 20, 1];
    const out = await mapWithConcurrency(delays, 2, async (d) => {
      await new Promise(r => setTimeout(r, d));
      return d;
    });
    expect(out).toEqual(delays);
  });

  it('never runs more than `limit` at once', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 4, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});

describe('buildProbeResult', () => {
  const base = {
    id: 'meta/llama-3.2-90b-vision-instruct',
    ping: { status: 'ok' as const, reason: '', ctxWindow: null },
    providerCap: 1 as number | null,
    providerCtx: null as number | null,
    now: 1000,
    previousFailures: 0,
  };

  it('records a working vision model with its measured latency', () => {
    const r = buildProbeResult({ ...base, visionOk: true, probedCap: 1, latencyMs: 27000 });
    expect(r.status).toBe('ok');
    expect(r.vision).toBe(true);
    expect(r.imageCap).toBe(1);
    expect(r.msPerPage).toBe(27000);
    expect(r.slow).toBe(false);
    expect(r.source.imageCap).toBe('probe');
  });

  it('marks a model that exceeded the cutoff as slow with no measurement', () => {
    const r = buildProbeResult({ ...base, visionOk: true, probedCap: 1, latencyMs: null });
    expect(r.status).toBe('ok');
    expect(r.slow).toBe(true);
    expect(r.msPerPage).toBeNull();
  });

  it('falls back to the provider cap when the 2-image probe succeeded', () => {
    const r = buildProbeResult({ ...base, providerCap: 5, visionOk: true, probedCap: null, latencyMs: 40000 });
    expect(r.imageCap).toBe(5);
    expect(r.source.imageCap).toBe('provider-metadata');
  });

  it('records a text-only model as vision:false but still ok', () => {
    const r = buildProbeResult({ ...base, visionOk: false, probedCap: null, latencyMs: 61000 });
    expect(r.status).toBe('ok');
    expect(r.vision).toBe(false);
  });

  it('preserves a failing ping verdict and skips capability fields', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'unreachable', reason: 'Not found for account', ctxWindow: null },
      visionOk: false, probedCap: null, latencyMs: null,
    });
    expect(r.status).toBe('unreachable');
    expect(r.reason).toBe('Not found for account');
    expect(r.slow).toBe(false);
  });

  it('prefers a probed context window over provider metadata', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'ctx-too-small', reason: 'too small', ctxWindow: 16384 },
      providerCtx: 128000, visionOk: false, probedCap: null, latencyMs: null,
    });
    expect(r.ctxWindow).toBe(16384);
    expect(r.source.ctxWindow).toBe('probe');
  });

  it('uses provider metadata for context when the probe learned nothing', () => {
    const r = buildProbeResult({ ...base, providerCtx: 131072, visionOk: true, probedCap: null, latencyMs: 10 });
    expect(r.ctxWindow).toBe(131072);
    expect(r.source.ctxWindow).toBe('provider-metadata');
  });
});

describe('strike counting', () => {
  const base = {
    id: 'x', providerCap: null as number | null, providerCtx: null as number | null,
    visionOk: false, probedCap: null, latencyMs: null, now: 1,
  };

  it('increments the strike count on a durable failure', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'unreachable', reason: 'gone', ctxWindow: null },
      previousFailures: 1,
    });
    expect(r.consecutiveFailures).toBe(2);
  });

  it('leaves the strike count untouched on a transient failure', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'transient', reason: 'timeout', ctxWindow: null },
      previousFailures: 1,
    });
    expect(r.consecutiveFailures).toBe(1);
  });

  it('resets the strike count when the model works again', () => {
    const r = buildProbeResult({
      ...base,
      ping: { status: 'ok', reason: '', ctxWindow: null },
      latencyMs: 1000,
      previousFailures: 5,
    });
    expect(r.consecutiveFailures).toBe(0);
  });
});

describe('constants', () => {
  it('cuts latency probes off at 90s', () => {
    expect(LATENCY_CUTOFF_MS).toBe(90_000);
  });

  it('uses a reference code the fixture image carries', () => {
    expect(PROBE_VISION_CODE).toBe('PROBE7X');
  });

  it('paces Gemini under its 10 rpm free-tier cap', () => {
    // 1 in flight with a 6.5s gap is ~9 requests/minute. Probing Gemini
    // 4-wide would 429-storm and record failures against healthy models.
    expect(PROVIDER_CONCURRENCY.gemini).toBe(1);
    expect(PROVIDER_MIN_GAP_MS.gemini).toBeGreaterThanOrEqual(6_000);
  });

  it('lets NVIDIA run 4-wide with no gap', () => {
    // Measured: 100 pings in 222s at concurrency 4, no rate limiting.
    expect(PROVIDER_CONCURRENCY.nvidia).toBe(4);
    expect(PROVIDER_MIN_GAP_MS.nvidia).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/probe-runner.test.ts`

Expected: FAIL — `Failed to resolve import "../probe-runner"`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/ai/probe-runner.ts`:

```typescript
import { PROVIDER_IMAGE_CAPS, type ProviderId } from './models-config';
import {
  classifyPing, parseImageCap, PROBE_MAX_TOKENS,
  type PingVerdict, type RawResponse,
} from './probe-classify';
import {
  DURABLE_FAILURES, emptyProviderProbe,
  type ModelProbes, type ProbeResult, type ProbeSource, type ProviderProbe,
} from './probe-types';

/**
 * Runs the two-pass model probe.
 *
 * Pass 1 pings every catalogue entry with the real extraction token budget, so
 * models whose context cannot hold it reject the ping and are caught here
 * rather than mid-claim. Pass 2 measures vision, image cap, and latency on the
 * survivors only.
 */

/** A model slower than this per page is flagged, not hidden — the request path allows 300s. */
export const LATENCY_CUTOFF_MS = 90_000;

/**
 * Per-provider concurrency. NVIDIA tolerates 4 (measured: 100 pings in 222s).
 * Gemini's free tier is 10 requests per minute — probing it 4-wide would
 * 429-storm, and every 429 would be recorded against a model that is fine.
 * Groq's free tier is likewise per-minute limited.
 */
export const PROVIDER_CONCURRENCY: Record<ProviderId, number> = {
  gemini: 1,
  groq: 2,
  nvidia: 4,
};

/** Minimum gap between requests, to stay under per-minute free-tier caps. */
export const PROVIDER_MIN_GAP_MS: Record<ProviderId, number> = {
  gemini: 6_500,   // ~9 rpm, just under the 10 rpm free-tier cap
  groq: 2_500,
  nvidia: 0,
};

/**
 * Model families that cannot serve a chat extraction under any circumstances.
 * This is an EXCLUSION list, not the capability guess that was deleted — it
 * never claims a model *can* do something, it only skips families that would
 * waste a probe call. On Gemini, where the budget is ~9 requests per minute,
 * skipping embedding/imagen/veo/tts entries is the difference between a
 * 10-minute probe and a 40-minute one.
 */
const NON_CHAT_PATTERN =
  /embed|embedqa|rerank|retriev|nemoretriever|guard|safety|reward|tts|stt|whisper|imagen|veo|image-generation|aqa/i;

/** Printed on public/ai-probe-page.jpg. A text-only model cannot produce it. */
export const PROBE_VISION_CODE = 'PROBE7X';

const PROBE_FIXTURE_URL = '/ai-probe-page.jpg';
const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'nvidia'];

const EXTRACTION_PROMPT =
  'Extract every line item from this repair estimate as JSON: ' +
  '{"items":[{"description":str,"qty":number,"rate":number,"amount":number}],"total":number}';

/** Runs `fn` over `items` at most `limit` at a time, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export interface BuildProbeResultInput {
  id: string;
  ping: PingVerdict;
  /** Cap the provider documents, used when the 2-image probe did not reject. */
  providerCap: number | null;
  /** Context window the provider reports, used when the probe learned nothing. */
  providerCtx: number | null;
  visionOk: boolean;
  /** Cap parsed from a 2-image rejection, or null if 2 images were accepted. */
  probedCap: number | null;
  /** Measured milliseconds, or null when the cutoff was hit. */
  latencyMs: number | null;
  now: number;
  /** Strike count carried from the previous probe; 0 when there was none. */
  previousFailures: number;
}

export function buildProbeResult(input: BuildProbeResultInput): ProbeResult {
  const { id, ping, providerCap, providerCtx, visionOk, probedCap, latencyMs, now, previousFailures } = input;
  const failed = ping.status !== 'ok';

  const imageCap = probedCap !== null ? probedCap : providerCap;
  const capSource: ProbeSource = probedCap !== null ? 'probe' : 'provider-metadata';

  const ctxWindow = ping.ctxWindow !== null ? ping.ctxWindow : providerCtx;
  const ctxSource: ProbeSource = ping.ctxWindow !== null ? 'probe' : 'provider-metadata';

  return {
    id,
    status: ping.status,
    reason: ping.reason,
    vision: failed ? false : visionOk,
    imageCap: failed ? null : imageCap,
    ctxWindow,
    msPerPage: failed ? null : latencyMs,
    slow: !failed && latencyMs === null,
    source: { vision: 'probe', imageCap: capSource, ctxWindow: ctxSource },
    probedAt: now,
    // Only DURABLE failures accumulate strikes. A timeout or 429 leaves the
    // count exactly where it was — it is not evidence either way.
    consecutiveFailures:
      ping.status === 'ok' ? 0
      : DURABLE_FAILURES.has(ping.status) ? previousFailures + 1
      : previousFailures,
  };
}

// ─── Transport ───────────────────────────────────────────────────────────────

interface ChatRequest {
  prompt: string;
  images: string[];      // base64 data URLs
  maxTokens: number;
  timeoutMs?: number;
}

/** One chat call, normalised to a RawResponse. Never throws on an HTTP error. */
async function chat(
  provider: ProviderId,
  model: string,
  key: string,
  req: ChatRequest,
): Promise<RawResponse> {
  const controller = new AbortController();
  const timer = req.timeoutMs
    ? setTimeout(() => controller.abort(), req.timeoutMs)
    : null;

  try {
    if (provider === 'gemini') {
      const parts: unknown[] = req.images.map(img => ({
        inlineData: { mimeType: 'image/jpeg', data: img.replace(/^data:image\/\w+;base64,/, '') },
      }));
      parts.push({ text: req.prompt });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { maxOutputTokens: req.maxTokens, temperature: 0.1 },
          }),
          signal: controller.signal,
        },
      );
      return { status: res.status, body: await res.text() };
    }

    const content: unknown[] = req.images.map(img => ({
      type: 'image_url',
      image_url: { url: img },
    }));
    content.push({ type: 'text', text: req.prompt });
    const body = {
      model,
      messages: [{ role: 'user', content: req.images.length ? content : req.prompt }],
      temperature: 0.1,
      max_tokens: req.maxTokens,
    };

    if (provider === 'nvidia') {
      // The callable ignores AbortSignal and carries its own 300s deadline, so
      // without this race an NVIDIA latency probe would run five times past the
      // 90s cutoff and blow the estimated probe duration.
      const { callNvidiaProxy } = await import('@/lib/firebase/functions');
      const call = callNvidiaProxy('chat/completions', key, body)
        .then(p => ({ status: p.status, body: p.body }));
      if (!req.timeoutMs) return await call;
      const cutoff = new Promise<RawResponse>(resolve =>
        setTimeout(() => resolve({ status: 0, body: 'probe cutoff reached' }), req.timeoutMs));
      return await Promise.race([call, cutoff]);
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { status: res.status, body: await res.text() };
  } catch (err: unknown) {
    // AbortError (cutoff) and transport failures both land here. Status 0 is
    // not a real HTTP status; classifyPing maps it to 'error'.
    return { status: 0, body: err instanceof Error ? err.message : 'probe transport failed' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

interface CatalogueEntry {
  id: string;
  /** Context window the provider reports; null when it reports none. */
  ctxWindow: number | null;
}

/** Drops model families that cannot serve a chat extraction, to save probe budget. */
function dropNonChat(entries: CatalogueEntry[]): CatalogueEntry[] {
  return entries.filter(e => !NON_CHAT_PATTERN.test(e.id));
}

async function fetchCatalogue(provider: ProviderId, key: string): Promise<CatalogueEntry[]> {
  if (provider === 'nvidia') {
    const { callNvidiaProxy } = await import('@/lib/firebase/functions');
    const res = await callNvidiaProxy('models', key);
    if (!res.ok) throw new Error(`NVIDIA catalogue failed: HTTP ${res.status}`);
    const data = JSON.parse(res.body);
    // NVIDIA reports only {id, object, created, owned_by} — no context window,
    // no availability. Measured: 60 of its 100 listed models 404 on call.
    return dropNonChat((data.data ?? []).map((m: { id: string }) => ({ id: m.id, ctxWindow: null })));
  }

  if (provider === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`Groq catalogue failed: HTTP ${res.status}`);
    const data = await res.json();
    // Groq reports context_window and an active flag — trust both.
    return dropNonChat((data.data ?? [])
      .filter((m: { active?: boolean }) => m.active !== false)
      .map((m: { id: string; context_window?: number }) => ({
        id: m.id,
        ctxWindow: m.context_window ?? null,
      })));
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  if (!res.ok) throw new Error(`Gemini catalogue failed: HTTP ${res.status}`);
  const data = await res.json();
  // Gemini reports supportedGenerationMethods — skip models that cannot generate.
  return dropNonChat((data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string; inputTokenLimit?: number }) => ({
      id: m.name.replace(/^models\//, ''),
      ctxWindow: m.inputTokenLimit ?? null,
    })));
}

// ─── Passes ──────────────────────────────────────────────────────────────────

async function loadFixture(): Promise<string> {
  const res = await fetch(PROBE_FIXTURE_URL);
  if (!res.ok) throw new Error(`Probe fixture missing at ${PROBE_FIXTURE_URL}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the probe fixture'));
    reader.readAsDataURL(blob);
  });
}

/** Thrown to abort a whole provider — a rejected key tells us nothing about its models. */
class ProbeAbort extends Error {}

/** Paces a worker so a provider's per-minute free-tier cap is not exceeded. */
async function pace(gapMs: number, lastAt: { t: number }): Promise<void> {
  if (gapMs <= 0) return;
  const wait = gapMs - (Date.now() - lastAt.t);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastAt.t = Date.now();
}

export async function runProviderProbe(
  provider: ProviderId,
  key: string,
  previous: ProviderProbe,
  onProgress: (done: number, total: number) => void,
): Promise<ProviderProbe> {
  const now = Date.now();
  try {
    const catalogue = await fetchCatalogue(provider, key);
    const fixture = await loadFixture();
    const providerCap = PROVIDER_IMAGE_CAPS[provider];
    const gap = PROVIDER_MIN_GAP_MS[provider];
    const lastAt = { t: 0 };
    let done = 0;
    const total = catalogue.length;

    const results = await mapWithConcurrency(catalogue, PROVIDER_CONCURRENCY[provider], async (entry) => {
      const previousFailures = previous.models[entry.id]?.consecutiveFailures ?? 0;

      // ── Pass 1: reachability, with the real extraction token budget ──
      // Retried once on a transient failure. A measured NVIDIA run produced 5
      // read timeouts and one 500 on models that are alive; without the retry
      // those would be recorded as failures against working models.
      await pace(gap, lastAt);
      let pingRes = await chat(provider, entry.id, key, {
        prompt: 'Reply with OK.',
        images: [],
        maxTokens: PROBE_MAX_TOKENS,
        timeoutMs: LATENCY_CUTOFF_MS,
      });
      let ping = classifyPing(pingRes);

      if (ping.status === 'transient') {
        await new Promise(r => setTimeout(r, 2_000));
        await pace(gap, lastAt);
        pingRes = await chat(provider, entry.id, key, {
          prompt: 'Reply with OK.',
          images: [],
          maxTokens: PROBE_MAX_TOKENS,
          timeoutMs: LATENCY_CUTOFF_MS,
        });
        ping = classifyPing(pingRes);
      }

      if (ping.status === 'auth-error') {
        throw new ProbeAbort(ping.reason);
      }

      if (ping.status !== 'ok') {
        done++; onProgress(done, total);
        return buildProbeResult({
          id: entry.id, ping, providerCap, providerCtx: entry.ctxWindow,
          visionOk: false, probedCap: null, latencyMs: null, now, previousFailures,
        });
      }

      // ── Pass 2a: vision — the model must read a code only visible in pixels ──
      await pace(gap, lastAt);
      const visionRes = await chat(provider, entry.id, key, {
        prompt: `What reference code is printed on this document? Reply with the code only.`,
        images: [fixture],
        maxTokens: 32,
        timeoutMs: LATENCY_CUTOFF_MS,
      });
      const visionOk = visionRes.status === 200 && visionRes.body.includes(PROBE_VISION_CODE);

      // ── Pass 2b: image cap ──
      let probedCap: number | null = null;
      if (visionOk) {
        await pace(gap, lastAt);
        const capRes = await chat(provider, entry.id, key, {
          prompt: 'Reply with OK.',
          images: [fixture, fixture],
          maxTokens: 32,
          timeoutMs: LATENCY_CUTOFF_MS,
        });
        if (capRes.status !== 200) probedCap = parseImageCap(capRes.body);
      }

      // ── Pass 2c: latency on a realistic payload ──
      await pace(gap, lastAt);
      const started = Date.now();
      const latencyRes = await chat(provider, entry.id, key, {
        prompt: EXTRACTION_PROMPT,
        images: visionOk ? [fixture] : [],
        maxTokens: 512,
        timeoutMs: LATENCY_CUTOFF_MS,
      });
      const latencyMs = latencyRes.status === 200 ? Date.now() - started : null;

      done++; onProgress(done, total);
      return buildProbeResult({
        id: entry.id, ping, providerCap, providerCtx: entry.ctxWindow,
        visionOk, probedCap, latencyMs, now, previousFailures,
      });
    });

    const models: Record<string, ProbeResult> = Object.fromEntries(results.map(r => [r.id, r]));

    // A model that was working and is no longer in the catalogue has been
    // retired by the provider. Synthesise a durable result so it appears in
    // the Gone group and accrues a strike, rather than vanishing silently.
    for (const [id, prev] of Object.entries(previous.models)) {
      if (models[id] || prev.status !== 'ok') continue;
      models[id] = {
        ...prev,
        status: 'unreachable',
        reason: 'No longer listed by the provider.',
        msPerPage: null,
        slow: false,
        probedAt: now,
        consecutiveFailures: prev.consecutiveFailures + 1,
      };
    }

    return { probedAt: now, error: null, models };
  } catch (err: unknown) {
    const message = err instanceof ProbeAbort
      ? `Key rejected — probe aborted. ${err.message}`
      : err instanceof Error ? err.message : 'Probe failed';
    // No models: the reconciler treats this as "we learned nothing" and
    // leaves the working config untouched.
    return { probedAt: now, error: message, models: {} };
  }
}

export async function runFullProbe(
  keys: Partial<Record<ProviderId, string>>,
  previous: ModelProbes,
  onProgress: (provider: ProviderId, done: number, total: number) => void,
  /**
   * Called as each provider finishes so the caller can persist partial
   * results. A full run takes 20+ minutes; without this, closing the tab
   * two providers in would throw away everything.
   */
  onProviderComplete: (provider: ProviderId, result: ProviderProbe) => Promise<void>,
): Promise<ModelProbes> {
  const providers: Record<ProviderId, ProviderProbe> = {
    gemini: { ...previous.providers.gemini },
    groq: { ...previous.providers.groq },
    nvidia: { ...previous.providers.nvidia },
  };

  // Sequential across providers so progress reads clearly and free-tier rate
  // limits are not hit from three directions at once.
  for (const p of PROVIDER_IDS) {
    const key = keys[p]?.trim();
    if (!key) {
      // No key means we learned nothing — keep the previous results rather
      // than replacing them with an empty block the reconciler might act on.
      providers[p] = { ...previous.providers[p], error: 'No admin key for this provider.' };
      continue;
    }
    providers[p] = await runProviderProbe(p, key, previous.providers[p], (done, total) =>
      onProgress(p, done, total));
    await onProviderComplete(p, providers[p]);
  }

  return { probedAt: Date.now(), probedBy: '', providers };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/probe-runner.test.ts`

Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/probe-runner.ts src/lib/ai/__tests__/probe-runner.test.ts public/ai-probe-page.jpg
git commit -m "feat(ai): two-pass model probe runner

Pings every catalogue entry with the real extraction token budget, then
measures vision, image cap and latency on the survivors, four at a time."
```

---

### Task 9: Delete the heuristics and make the request path probe-driven

`isLikelyVisionModel` and `computeEstimateCapacity` exist only to fabricate the values the probe now measures. Removing them is what stops the panel lying.

**Files:**
- Modify: `src/lib/ai/discovery.ts` (delete `isLikelyVisionModel`, rewrite `mapList`)
- Modify: `src/lib/ai/models-config.ts` (delete `computeEstimateCapacity`, drop `estimateCapacity` from `ModelEntry`, update `entry()` and `FALLBACK_AI_MODELS_CONFIG`)
- Modify: `src/lib/ai/__tests__/discovery.test.ts` (remove the `isLikelyVisionModel` block)
- Modify: `src/lib/ai/__tests__/models-config.test.ts` (remove the `computeEstimateCapacity` block)
- Modify: `src/lib/ai/service.ts` (`buildProvider` reads the enabled model's probed cap)

**Interfaces:**
- Consumes: `ModelEntry` (Task 4 unchanged), `PROVIDER_IMAGE_CAPS` (Task 3).
- Produces:
  - `ModelEntry` without `estimateCapacity`
  - `resolveModelImageCap(providerId: ProviderId, modelId: string, block: ProviderConfig): number | null` (exported from `src/lib/ai/models-config.ts`)

- [ ] **Step 1: Write the failing test**

In `src/lib/ai/__tests__/models-config.test.ts`, add `resolveModelImageCap` to the existing import on line 2 (ESM imports must stay at the top of the file), then append this block at the end:

```typescript
describe('resolveModelImageCap', () => {
  const block = {
    enabled: true,
    defaultModel: 'probed',
    models: [
      { id: 'probed', label: 'p', note: '', ctxWindow: 128000, vision: true, imageCap: 1 },
      { id: 'unprobed', label: 'u', note: '', ctxWindow: 128000, vision: true, imageCap: null },
    ],
  };

  it('uses the probed cap recorded on the enabled model', () => {
    expect(resolveModelImageCap('nvidia', 'probed', block)).toBe(1);
  });

  it('falls back to the provider default when the model records no cap', () => {
    expect(resolveModelImageCap('groq', 'unprobed', block)).toBe(5);
  });

  it('falls back to the provider default for a model not in the block', () => {
    expect(resolveModelImageCap('nvidia', 'missing', block)).toBe(1);
  });

  it('returns null for an uncapped provider', () => {
    expect(resolveModelImageCap('gemini', 'missing', block)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/models-config.test.ts`

Expected: FAIL — `resolveModelImageCap is not a function`.

- [ ] **Step 3: Remove the fabricated capability field and add the resolver**

In `src/lib/ai/models-config.ts`:

Delete the `estimateCapacity: string;` line from `ModelEntry` (line 13).

Delete `computeEstimateCapacity` entirely (lines 46-59).

Replace the `entry()` helper (lines 61-64) with:

```typescript
function entry(p: ProviderId, id: string, label: string, note: string, ctxWindow: number | null, vision: boolean): ModelEntry {
  return { id, label, note, ctxWindow, vision, imageCap: PROVIDER_IMAGE_CAPS[p] };
}
```

Add after `PROVIDER_IMAGE_CAPS`:

```typescript
/**
 * The image cap that applies to a specific enabled model: the probed value
 * recorded on its ModelEntry, falling back to the provider default when the
 * model has not been probed.
 */
export function resolveModelImageCap(
  providerId: ProviderId,
  modelId: string,
  block: ProviderConfig,
): number | null {
  const probed = block.models.find(m => m.id === modelId)?.imageCap;
  return probed ?? PROVIDER_IMAGE_CAPS[providerId];
}
```

- [ ] **Step 4: Delete the obsolete tests**

In `src/lib/ai/__tests__/models-config.test.ts`, delete the whole `describe('computeEstimateCapacity', ...)` block (lines 4-24) and remove `computeEstimateCapacity` from the import on line 2.

In `src/lib/ai/__tests__/discovery.test.ts`, delete the whole `describe('isLikelyVisionModel', ...)` block and remove `isLikelyVisionModel` from the import on line 2.

- [ ] **Step 5: Strip the guessing out of discovery**

In `src/lib/ai/discovery.ts`, delete `isLikelyVisionModel` (lines 7-11) and replace `mapList` (lines 13-31) with:

```typescript
/**
 * Maps a provider's raw catalogue into entries. Capability fields are left
 * unknown — vision, image cap and context window come from the probe, not
 * from pattern-matching the model name.
 */
function mapList(provider: 'nvidia' | 'groq', ids: string[]): ModelEntry[] {
  return ids
    .filter(id => !!id)
    .sort()
    .map(id => ({
      id,
      label: id.split('/').pop() ?? id,
      note: '',
      ctxWindow: null,
      vision: false,
      imageCap: PROVIDER_IMAGE_CAPS[provider],
    }));
}
```

and change the import on line 1 to:

```typescript
import { ModelEntry, PROVIDER_IMAGE_CAPS } from './models-config';
```

- [ ] **Step 6: Read the probed cap in the request path**

In `src/lib/ai/service.ts`, change the `models-config` import to include the resolver:

```typescript
import { PROVIDER_IMAGE_CAPS, resolveModelImageCap } from './models-config';
```

In `buildProvider`, replace the `maxImages` line inside the `nvidia` branch:

```typescript
      maxImages: resolveModelImageCap('nvidia', model, useAIConfigStore.getState().config.providers.nvidia) ?? undefined,
```

and in the Groq branch replace `maxImages: 5,` with:

```typescript
    maxImages: resolveModelImageCap('groq', model, useAIConfigStore.getState().config.providers.groq) ?? undefined,
```

Finally, make `getActiveImageCap` probe-driven too — replace its last line (`return PROVIDER_IMAGE_CAPS[active];`) with:

```typescript
  const block = useAIConfigStore.getState().config.providers[active];
  const model = resolveEnabledModel(
    active === 'gemini' ? resolveGeminiModel(profile)
      : active === 'nvidia' ? resolveNvidiaModel(profile)
      : resolveGroqModel(profile),
    block,
  );
  return resolveModelImageCap(active, model, block);
```

- [ ] **Step 7: Fix any remaining compile errors**

Run: `npx tsc --noEmit`

Expected: exactly one class of error remains — references to `estimateCapacity` in `AIModelsTab.tsx`, which Task 10 rewrites. Any other error is a real break and must be fixed before committing. Do not commit if `npx vitest run` fails.

- [ ] **Step 8: Run the suite**

Run: `npx vitest run`

Expected: PASS. The deleted heuristic tests are gone; `resolveModelImageCap` tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/ai/models-config.ts src/lib/ai/discovery.ts src/lib/ai/service.ts src/lib/ai/__tests__/models-config.test.ts src/lib/ai/__tests__/discovery.test.ts
git commit -m "refactor(ai): delete name-based capability guessing

isLikelyVisionModel and computeEstimateCapacity invented the values the
probe now measures — including 'handles 6+ page scanned estimates' on
NVIDIA models that reject a second image."
```

---

### Task 10: Panel rewrite

One **Refresh & probe** action replacing three per-provider refresh buttons, three result groups, measured badges, and automatic removal of dead models.

**Files:**
- Modify: `src/components/admin/tabs/AIModelsTab.tsx` (replace `refresh`, the `discovered` state, and the row renderer)

**Interfaces:**
- Consumes: `runFullProbe` (Task 8), `loadModelProbes` / `saveModelProbes` / `ModelProbes` (Task 4), `diffProbes` (Task 6), `reconcileEnabledModels` (Task 7), `saveAIModelsConfig` (existing).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Replace discovery state with probe state**

In `src/components/admin/tabs/AIModelsTab.tsx`, replace the imports on lines 12-13:

```typescript
import { runModelTest, type ModelTestResult, type AITestOverride } from '@/lib/ai/service';
import { runFullProbe } from '@/lib/ai/probe-runner';
import { loadModelProbes, saveModelProbes, EMPTY_PROBES, type ModelProbes } from '@/lib/ai/probe-types';
import { diffProbes } from '@/lib/ai/probe-diff';
import { reconcileEnabledModels } from '@/lib/ai/probe-reconcile';
```

Replace the `discovered` and `busy` state (lines 25-26) with:

```typescript
  const [probes, setProbes] = useState<ModelProbes>(EMPTY_PROBES);
  // The probe this one replaced. Kept so the NEW badge can be computed from the
  // diff — once `probes` is overwritten the comparison is no longer available.
  const [prevProbes, setPrevProbes] = useState<ModelProbes>(EMPTY_PROBES);
  const [probing, setProbing] = useState(false);
  const [probeStatus, setProbeStatus] = useState('');
  const [showGone, setShowGone] = useState<Record<ProviderId, boolean>>({ gemini: false, groq: false, nvidia: false });
```

Extend the initial load on line 32:

```typescript
  useEffect(() => {
    loadAIModelsConfig().then(setConfig);
    loadModelProbes().then(setProbes);
  }, []);
```

- [ ] **Step 2: Replace the per-provider refresh with a single probe action**

Delete the `refresh` function (lines 39-57) and add:

```typescript
  async function probeAll() {
    const keys = {
      gemini: adminKey('gemini'),
      groq: adminKey('groq'),
      nvidia: adminKey('nvidia'),
    };
    if (!keys.gemini && !keys.groq && !keys.nvidia) {
      toast.error('Add at least one provider key in your Profile to run a probe.');
      return;
    }

    setProbing(true);
    setProbeStatus('Starting… a full probe takes roughly 20-30 minutes. Leave this tab open.');
    try {
      const previous = probes;
      // Persisted after each provider so closing the tab part-way through
      // keeps the providers that already finished.
      let running: ModelProbes = { ...previous };
      const next = await runFullProbe(
        keys,
        previous,
        (p, done, total) => setProbeStatus(`${PROVIDER_META[p].label}: ${done} of ${total}`),
        async (p, result) => {
          running = { ...running, providers: { ...running.providers, [p]: result } };
          await saveModelProbes(running, adminEmail);
          setProbes(running);
        },
      );

      await saveModelProbes(next, adminEmail);
      setPrevProbes(previous);
      setProbes(next);

      // Dead models leave the surveyor-facing config immediately — waiting for
      // a Save click would leave surveyors extracting against a model that
      // cannot answer. Enabling still requires an explicit Save.
      const { config: reconciled, removed } = reconcileEnabledModels(config!, next);
      if (removed.length > 0) {
        setConfig(reconciled);
        await saveAIModelsConfig(reconciled, adminEmail);
        setStoreConfig(reconciled);
        toast.warning(
          `Removed ${removed.length} model${removed.length === 1 ? '' : 's'} that stopped working: ` +
          removed.map(r => r.id).join(', '),
          { duration: 10000 },
        );
      }

      const totalWorking = (['gemini', 'groq', 'nvidia'] as ProviderId[])
        .reduce((n, pid) => n + diffProbes(previous.providers[pid], next.providers[pid]).working.length, 0);
      toast.success(`Probe complete — ${totalWorking} usable models.`);
    } catch (e: unknown) {
      toast.error(`Probe failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setProbing(false);
      setProbeStatus('');
    }
  }
```

- [ ] **Step 3: Add a badge builder for measured facts**

Add above the `return` statement:

```typescript
  /** Only measured facts — nothing inferred from the model name. */
  function badge(r: { vision: boolean; imageCap: number | null; ctxWindow: number | null; msPerPage: number | null; slow: boolean }): string {
    const parts = [r.vision ? 'vision' : 'text only'];
    if (r.vision && r.imageCap !== null) parts.push(`${r.imageCap} img/call`);
    if (r.ctxWindow !== null) parts.push(`${formatCtx(r.ctxWindow)} ctx`);
    parts.push(r.slow || r.msPerPage === null ? '>90s/page' : `${Math.round(r.msPerPage / 1000)}s/page`);
    return parts.join(' · ');
  }
```

and add `formatCtx` to the `models-config` import on line 8-11.

- [ ] **Step 4: Replace the header controls**

Replace the header block (lines 115-121):

```tsx
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Probed with <strong>your</strong> profile keys. Only models verified to work are shown.</p>
          {probes.probedAt > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Last probed {new Date(probes.probedAt).toLocaleString()} by {probes.probedBy || 'unknown'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {probing && <span className="text-[10px] text-muted-foreground">{probeStatus}</span>}
          <button onClick={probeAll} disabled={probing || saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border border-border text-foreground disabled:opacity-50">
            {probing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh &amp; probe
          </button>
          <button onClick={save} disabled={saving || probing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-foreground text-primary disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Config
          </button>
        </div>
      </div>
```

- [ ] **Step 5: Render the three groups**

Replace the provider body — the `<div className="divide-y divide-border">` block (lines 141-193) — with:

```tsx
            {(() => {
              const providerProbe = probes.providers[p];
              const d = diffProbes(prevProbes.providers[p], providerProbe);
              const addedSet = new Set(d.added);

              if (providerProbe.error) {
                return <div className="px-6 py-4 text-xs text-status-danger">Probe failed: {providerProbe.error} — previous results kept.</div>;
              }
              if (d.working.length === 0) {
                return <div className="px-6 py-4 text-xs text-muted-foreground">No probe results yet — click "Refresh &amp; probe".</div>;
              }

              return (
                <div className="divide-y divide-border">
                  {d.working.map(row => {
                    const enabled = isEnabled(p, row.id);
                    const isDefault = block.defaultModel === row.id;
                    const note = block.models.find(m => m.id === row.id)?.note ?? '';
                    return (
                      <div key={row.id} className="px-6 py-3 flex items-start gap-3">
                        <button onClick={() => toggleModel(p, {
                          id: row.id, label: row.id.split('/').pop() ?? row.id, note: '',
                          ctxWindow: row.ctxWindow, vision: row.vision, imageCap: row.imageCap,
                        })}
                          className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-foreground text-white' : 'border border-border'}`}>
                          {enabled && <Check size={12} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-medium text-foreground">{row.id.split('/').pop()}</code>
                            {addedSet.has(row.id) && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-status-success-tint text-status-success">NEW</span>}
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-card text-muted-foreground">{badge(row)}</span>
                            {row.slow && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-status-warning-tint text-status-warning">SLOW</span>}
                            {enabled && (
                              <button onClick={() => setDefault(p, row.id)}
                                className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 ${isDefault ? 'bg-status-warning-tint text-status-warning' : 'text-muted-foreground'}`}>
                                <Star size={9} /> {isDefault ? 'Default' : 'Set default'}
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{row.id}</div>
                          {enabled && (
                            <input value={note} onChange={e => setNote(p, row.id, e.target.value)}
                              placeholder="Admin note"
                              className="mt-1.5 w-full text-[11px] px-2 py-1 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary" />
                          )}
                          {enabled && (
                            <div className="mt-2">
                              <label className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-lg border border-border cursor-pointer hover:bg-card">
                                {testing === `${p}:${row.id}` ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />}
                                Test with estimate PDF
                                <input type="file" accept="application/pdf,image/*" className="hidden"
                                  disabled={testing !== null || probing}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) runTest(p, row.id, f); e.currentTarget.value = ''; }} />
                              </label>
                              {testing === `${p}:${row.id}` && <span className="ml-2 text-[10px] text-muted-foreground">{testProgress}</span>}
                              {testResult[`${p}:${row.id}`] && (
                                <pre className={`mt-1.5 max-h-48 overflow-auto text-[10px] p-2 rounded-lg border ${testResult[`${p}:${row.id}`].ok ? 'border-status-success-tint bg-status-success-tint' : 'border-status-danger-tint bg-status-danger-tint'}`}>
                                  {testResult[`${p}:${row.id}`].ok
                                    ? `✅ ${(testResult[`${p}:${row.id}`].ms / 1000).toFixed(1)}s\n` + JSON.stringify(testResult[`${p}:${row.id}`].data, null, 2)
                                    : `❌ ${testResult[`${p}:${row.id}`].error}`}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {(() => {
                    const unusable = Object.values(providerProbe.models).filter(m => m.status !== 'ok');
                    if (unusable.length === 0) return null;
                    return (
                      <div className="px-6 py-3">
                        <button onClick={() => setShowGone(s => ({ ...s, [p]: !s[p] }))}
                          className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
                          {showGone[p] ? 'Hide' : 'Show'} {unusable.length} unusable
                        </button>
                        {showGone[p] && (
                          <div className="mt-2 space-y-1">
                            {unusable.map(m => (
                              <div key={m.id} className="text-[10px] text-muted-foreground">
                                <span className="font-mono">{m.id}</span> — {m.status}: {m.reason}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
```

Also delete the now-unused `rows` variable on line 126.

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 7: Verify the build**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 8: Run the full suite**

Run: `npm test`

Expected: PASS — Vitest plus all three functions test files.

- [ ] **Step 9: Verify in the running app**

Start the dev server, sign in as admin, open the AI Models tab.

Confirm:
1. "Refresh & probe" runs and shows live progress per provider.
2. `google/gemma-3-12b-it`, `google/gemma-4-31b-it` and `microsoft/phi-3-vision-128k-instruct` land under "Show N unusable" as `unreachable`.
3. `nvidia/nemotron-parse` appears as `no-text-input`.
4. `nvidia/llama-3.1-nemotron-nano-vl-8b-v1` appears as `ctx-too-small` with 16384.
5. `nvidia/nemotron-nano-12b-v2-vl` shows `vision · 1 img/call · ~27s/page`.
6. `meta/llama-3.2-90b-vision-instruct` carries the SLOW badge.
7. Enable an NVIDIA model, save, select NVIDIA as primary in Profile, and extract `DTC Proforma Invoice-1.PDF` end to end.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/tabs/AIModelsTab.tsx
git commit -m "feat(admin): one-click model probe with measured badges

Replaces three per-provider refresh buttons and fabricated capability
text with a single probe, ranked results, a NEW badge from the diff, and
automatic removal of models that stopped working."
```

---

## Verification checklist

- [ ] `npm test` passes (Vitest + three functions test files)
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` succeeds
- [ ] `firebase deploy --only functions:nvidiaProxy,firestore:rules --project surveyos-v2-antigravity-in`
- [ ] NVIDIA selected as primary extracts `DTC Proforma Invoice-1.PDF` successfully
- [ ] A deliberately wrong NVIDIA key produces "key is invalid", not a timeout message
- [ ] A model with `imageCap: 1` chunks a scanned estimate one page at a time
- [ ] Running a probe twice in a row does not remove any model that worked in the first run
- [ ] Killing the browser tab after NVIDIA finishes leaves NVIDIA's results persisted
- [ ] Extracting with no NVIDIA key configured produces exactly ONE "falling back" toast, not two
