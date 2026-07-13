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
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

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

// ─── NVIDIA NIM Proxy ───
// NVIDIA's REST API (integrate.api.nvidia.com) sends no CORS headers, so the
// browser cannot call it directly. This forwards the caller's own (BYOK) key
// server-to-server. Host + path are allowlisted so it is not an open proxy.
const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_ALLOWED_PATHS = new Set(["models", "chat/completions"]);

exports.nvidiaProxy = onCall({ maxInstances: 10, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

  const { path, key, body } = request.data || {};
  if (!key) throw new HttpsError("invalid-argument", "NVIDIA key is required.");
  if (!NVIDIA_ALLOWED_PATHS.has(path)) throw new HttpsError("invalid-argument", `Unsupported path: ${path}`);

  const method = path === "models" ? "GET" : "POST";
  const fetch = (await import("node-fetch")).default;
  const res = await fetch(`${NVIDIA_BASE}/${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    ...(method === "POST" ? { body: JSON.stringify(body || {}) } : {}),
  });

  // Pass the provider's response through verbatim; the client interprets status.
  const text = await res.text();
  return { status: res.status, ok: res.ok, body: text };
});

// ─── Bramha Intelligence Engine ───
const bramha = require("./bramha");
exports.onClaimArchived = bramha.onClaimArchived;
