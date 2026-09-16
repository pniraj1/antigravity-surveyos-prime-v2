/**
 * SurveyOS Prime — AI Gateway Cloud Function
 * 
 * Config-driven AI routing with:
 *   - Multi-provider support (Groq, Gemini, OpenRouter)
 *   - Key rotation across multiple API keys
 *   - Automatic fallback on rate limit / failure
 *   - Usage tracking per key per day
 *   - Zero-code model/provider updates via Firestore config
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { isSubscriptionActive } = require("./subscription");

// Keep compute co-located with the Firestore database (asia-south1) —
// data residency, not just latency.
setGlobalOptions({ region: "asia-south1" });

initializeApp();
const db = getFirestore();

// ─── Subscription gate ───
// The client SubscriptionGuard is only a UI overlay. Any function that spends
// AI keys must re-check the caller's subscription server-side, or a rejected /
// unpaid / expired account uses the app's AI for free.
async function assertActiveSubscription(uid) {
  const snap = await db.doc(`users/${uid}/profile/current`).get();
  if (!isSubscriptionActive(snap.exists ? snap.data() : null)) {
    throw new HttpsError(
      "permission-denied",
      "Your SurveyOS subscription is not active. Please renew to use AI features."
    );
  }
}

// ─── Fetch routing config from Firestore ───
async function getRoutingConfig() {
  const doc = await db.collection("ai_config").doc("routing").get();
  if (!doc.exists) throw new HttpsError("not-found", "AI routing config not found in Firestore.");
  return doc.data();
}

// ─── Track usage per key ───
async function trackUsage(keyName, provider, tokensIn = 0, tokensOut = 0) {
  const today = new Date().toISOString().split("T")[0];
  const ref = db.collection("ai_usage").doc(today);
  await ref.set({
    [provider + "_" + keyName]: FieldValue.increment(1),
    [`${provider}_${keyName}_tokens_in`]: FieldValue.increment(tokensIn),
    [`${provider}_${keyName}_tokens_out`]: FieldValue.increment(tokensOut),
  }, { merge: true });
}

// ─── Call a single provider+key ───
async function callProvider(provider, key, prompt, images, maxTokens) {
  const { name, model, endpoint } = provider;

  let body, headers;

  if (name === "gemini") {
    // Google Gemini format
    const parts = images && images.length > 0
      ? images.map(img => ({
          inlineData: { mimeType: "image/jpeg", data: img.replace(/^data:image\/\w+;base64,/, "") }
        })).concat([{ text: prompt }])
      : [{ text: prompt }];

    body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: maxTokens || 2048, temperature: 0.1 }
    });
    headers = { "Content-Type": "application/json" };
    const url = `${endpoint}?key=${key}`;

    const fetch = (await import("node-fetch")).default;
    const res = await fetch(url, { method: "POST", headers, body });
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { text, tokensIn: data.usageMetadata?.promptTokenCount || 0, tokensOut: data.usageMetadata?.candidatesTokenCount || 0 };

  } else {
    // OpenAI-compatible format (Groq, OpenRouter)
    const messages = [];
    if (images && images.length > 0) {
      const content = images.map(img => ({
        type: "image_url",
        image_url: { url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}` }
      }));
      content.push({ type: "text", text: prompt });
      messages.push({ role: "user", content });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    body = JSON.stringify({ model, messages, max_tokens: maxTokens || 2048, temperature: 0.1 });
    headers = { "Content-Type": "application/json", "Authorization": `Bearer ${key}` };

    const fetch = (await import("node-fetch")).default;
    const res = await fetch(endpoint, { method: "POST", headers, body });
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    return { text, tokensIn: data.usage?.prompt_tokens || 0, tokensOut: data.usage?.completion_tokens || 0 };
  }
}

// ─── Main AI Gateway Function ───
exports.callAI = onCall({ maxInstances: 10, memory: "256MiB" }, async (request) => {
  // Auth check
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  await assertActiveSubscription(request.auth.uid);

  const { prompt, images, maxTokens } = request.data;
  if (!prompt) throw new HttpsError("invalid-argument", "prompt is required.");

  // Load config
  const config = await getRoutingConfig();
  const providers = (config.providers || [])
    .filter(p => p.enabled)
    .sort((a, b) => a.priority - b.priority);

  if (!providers.length) throw new HttpsError("failed-precondition", "No AI providers enabled.");

  // Try each provider in priority order, rotate through keys
  for (const provider of providers) {
    const keys = provider.keys || [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const keyLabel = `key${i + 1}`;
      try {
        console.log(`Trying ${provider.name} ${keyLabel} (model: ${provider.model})`);
        const result = await callProvider(provider, key, prompt, images, maxTokens);
        // Track usage
        await trackUsage(keyLabel, provider.name, result.tokensIn, result.tokensOut);
        console.log(`Success: ${provider.name} ${keyLabel}`);
        return { text: result.text, provider: provider.name, model: provider.model };
      } catch (err) {
        if (err.message === "RATE_LIMIT") {
          console.warn(`${provider.name} ${keyLabel} rate limited, trying next key...`);
          continue;
        }
        console.error(`${provider.name} ${keyLabel} failed: ${err.message}`);
        continue;
      }
    }
    console.warn(`All keys for ${provider.name} exhausted, falling back to next provider...`);
  }

  throw new HttpsError("resource-exhausted", "All AI providers and keys are currently exhausted. Try again shortly.");
});

// ─── AI provider proxy ───
// NVIDIA (integrate.api.nvidia.com) and Ollama Cloud (ollama.com) send no CORS
// headers, so the browser cannot call them. This forwards the caller's own
// (BYOK) key server-to-server. Host and path are allowlisted so it is not an
// open proxy. The key is used for one request and never logged or stored.
//
// ponytail: every proxied request spends Cloud Functions egress (free tier
// 5 GB/month across all surveyors ≈ 10,000 two-page estimate calls). Proxied
// models rank last in the client so this is reached only when Gemini is
// unavailable. Upgrade path if the ceiling is hit: per-provider daily cap in
// Firestore, checked here.
const PROXY_TARGETS = {
  nvidia: { base: "https://integrate.api.nvidia.com/v1", paths: { models: "GET", "chat/completions": "POST" }, auth: (k) => ({ Authorization: `Bearer ${k}` }) },
  ollama: { base: "https://ollama.com", paths: { "api/tags": "GET", "api/chat": "POST" }, auth: (k) => ({ Authorization: `Bearer ${k}` }) },
};

// timeoutSeconds: NVIDIA vision inference measured at 27-200s per page; Ollama
// gemma4:31b at 55-63s for five pages. The v2 default of 60s kills every call
// before the provider answers, and the client reports it as an invalid key.
async function proxyToProvider(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  await assertActiveSubscription(request.auth.uid);

  const { provider = "nvidia", path, key, body } = request.data || {};
  // Object.hasOwn: a plain bracket lookup would resolve __proto__/constructor.
  const target = Object.hasOwn(PROXY_TARGETS, provider) ? PROXY_TARGETS[provider] : undefined;
  if (!target) throw new HttpsError("invalid-argument", `Unsupported provider: ${provider}`);
  if (!key) throw new HttpsError("invalid-argument", `${provider} key is required.`);
  const method = Object.hasOwn(target.paths, path) ? target.paths[path] : undefined;
  if (!method) throw new HttpsError("invalid-argument", `Unsupported path: ${path}`);

  const fetch = (await import("node-fetch")).default;
  const res = await fetch(`${target.base}/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...target.auth(key) },
    ...(method === "POST" ? { body: JSON.stringify(body || {}) } : {}),
  });

  // Pass the provider's response through verbatim; the client interprets status.
  const text = await res.text();
  return { status: res.status, ok: res.ok, body: text };
}

const PROXY_OPTS = { maxInstances: 10, memory: "512MiB", timeoutSeconds: 300 };
exports.aiProxy = onCall(PROXY_OPTS, proxyToProvider);
// Alias for clients built before the rename. Remove one release after aiProxy ships.
exports.nvidiaProxy = onCall(PROXY_OPTS, (request) => proxyToProvider({ ...request, data: { ...(request.data || {}), provider: "nvidia" } }));

// ─── Bramha Intelligence Engine ───
// Admin-triggered batch indexer (replaces the old per-archive Firestore
// trigger, which fired on every claim write and hid its own failures).
const bramha = require("./bramha");
exports.rebuildBramhaIndex = bramha.rebuildBramhaIndex;
