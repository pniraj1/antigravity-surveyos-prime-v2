import type { ProviderId } from './models-config';
import { useUIStore } from '@/stores/ui-store';
import { assertWithinImageCap } from './image-cap';
import { parseGeminiError, classifyGemini429 } from './gemini-errors';
import { beforeCall, parseRateLimit, usageOf, recordCall, type CallRecord, type RateLimitInfo } from './call-meter';
import {
  ProviderError, fetchWithTimeout, safeJsonParse, geminiFinish, geminiAuthHeaders, getMimeType, toRawBase64,
  type AIProvider, type CallOptions, type CallResult,
} from './service';

// Moved out of service.ts (800-line cap); service.ts re-exports callWithKey.

const RL_HEADERS = ['x-ratelimit-limit-requests', 'x-ratelimit-remaining-requests', 'x-ratelimit-limit-tokens', 'x-ratelimit-remaining-tokens', 'retry-after'];
/** Rate-limit headers of a browser fetch; CORS may hide them, then this is undefined. */
function headerLimits(res: Response): RateLimitInfo | undefined {
  const h: Record<string, string | null> = {};
  for (const n of RL_HEADERS) h[n] = res.headers?.get?.(n) ?? null;
  return parseRateLimit(h);
}

/** usageOf, but undefined when the provider reported nothing (keeps CallResult shape unchanged). */
function usageIf(p: ProviderId, body: unknown): CallResult['usage'] {
  const u = usageOf(p, body);
  return u.tokensIn === null && u.tokensOut === null ? undefined : u;
}

/** Gemini 429 RetryInfo.retryDelay ("12s") in ms, when present. */
function geminiRetryMs(details: unknown[]): number | undefined {
  for (const d of details as any[]) {
    const m = /^(\d+(?:\.\d+)?)s$/.exec(String(d?.retryDelay ?? ''));
    if (m) return Math.round(Number(m[1]) * 1000);
  }
  return undefined;
}

/** Calls one provider with one specific key, recording the attempt. Throws ProviderError on error. */
export async function callWithKey(
  provider: AIProvider, key: string, prompt: string, images: string[],
  responseFormat: 'json' | 'text', opts: CallOptions,
): Promise<CallResult> {
  await beforeCall(provider.name as ProviderId);
  const t0 = Date.now();
  const meta: { rateLimit?: RateLimitInfo } = {};
  const record = (r: Partial<CallRecord>) => {
    try {
      recordCall({ provider: provider.name as ProviderId, model: provider.model, tokensIn: null, tokensOut: null,
        ms: Date.now() - t0, finish: 'ERROR', rateLimit: meta.rateLimit, at: t0, ...r });
    } catch { /* recording never reaches callers */ }
  };
  try {
    const out = await callOnce(provider, key, prompt, images, responseFormat, opts, meta);
    record({ ...out.usage, finish: out.finish });
    return out;
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : undefined;
    if (e instanceof ProviderError && provider.name === 'gemini' && status === 429) {
      const ms = geminiRetryMs(e.details);
      if (ms !== undefined) meta.rateLimit = { ...meta.rateLimit, retryAfterMs: ms };
    }
    record({ status });
    throw e;
  }
}

async function callOnce(
  provider: AIProvider, key: string, prompt: string, images: string[],
  responseFormat: 'json' | 'text', opts: CallOptions, meta: { rateLimit?: RateLimitInfo },
): Promise<CallResult> {
  if (provider.name === 'gemini') {
    const parts: any[] = images.map(img => ({ inlineData: { mimeType: getMimeType(img), data: toRawBase64(img) } }));
    parts.push({ text: prompt });

    // Dev-only ?ai-fault= injection (see fault.ts); null in production and after the first call.
    const fault = (await import('./fault')).takeFault();
    if (fault) throw fault;

    const res = await fetchWithTimeout('gemini', provider.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...geminiAuthHeaders(key) },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1, topP: 0.95, topK: 40,
          maxOutputTokens: 65536,  // gemini-2.5-flash supports up to 65K — needed for multi-page invoices
          // Only force JSON mime when the caller actually expects JSON back.
          // Pass 3 (covering narrative) expects plain text — forcing JSON mode
          // causes the model to wrap the letter in a JSON object or refuse.
          ...(responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
          // Measured 2026-09-15: 2.5 Flash spent its output budget thinking and
          // returned MAX_TOKENS after 2,612 tokens. Extraction is OCR, not
          // reasoning — thinking off. The loop retries once without this when a
          // model rejects it (Gemini 3.x uses thinkingLevel).
          ...(opts.thinkingOff && responseFormat === 'json' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    }, opts.timeoutMs);
    meta.rateLimit = headerLimits(res);

    if (!res.ok) {
      const info = parseGeminiError(res.status, await res.json().catch(() => ({})));
      throw new ProviderError('gemini', res.status, info.message, info.details);
    }
    const data = await res.json();
    const cand = data.candidates?.[0];
    useUIStore.getState().setAIProviderHealth('gemini', 'ok');
    return {
      text: (cand?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '').trim(),
      finish: geminiFinish(cand?.finishReason),
      usage: usageIf('gemini', data),
    };
  }

  if (provider.name === 'ollama') {
    // Ollama Cloud has no CORS — always via aiProxy. Native /api/chat takes
    // raw base64 images on the message and `format: 'json'` for JSON mode.
    // The proxy's callable has its own 300s server-side timeout — opts.timeoutMs
    // cannot be applied mid-flight (a callable cannot be aborted once sent).
    const { callAiProxy } = await import('@/lib/firebase/functions');
    const body = {
      model: provider.model, stream: false,
      ...(responseFormat === 'json' ? { format: 'json' } : {}),
      options: { temperature: 0.1, num_predict: provider.maxOutputTokens ?? 16384 },
      messages: [{ role: 'user', content: prompt, ...(images.length ? { images: images.map(toRawBase64) } : {}) }],
    };
    const proxied = await callAiProxy('ollama', 'api/chat', key, body);
    meta.rateLimit = proxied.rateLimit ? parseRateLimit(proxied.rateLimit) : undefined;
    if (!proxied.ok) {
      const err = safeJsonParse(proxied.body);
      throw new ProviderError('ollama', proxied.status, typeof err?.error === 'string' ? err.error : err?.error?.message || String(proxied.status));
    }
    const data = safeJsonParse(proxied.body) ?? {};
    return {
      text: (data.message?.content || '').trim(),
      finish: data.done_reason === 'length' ? 'MAX_TOKENS' : 'STOP',
      usage: usageIf('ollama', data),
    };
  }

  // Groq / NVIDIA NIM / OpenAI-compatible
  const messages: any[] = [];

  // Only inject this system message for JSON responses — for plain-text requests (e.g. the
  // covering narrative letter in Pass 3), this instruction causes Groq to wrap the prose in
  // a JSON object or refuse to generate it at all.
  if (provider.name === 'groq' && responseFormat === 'json') {
    messages.push({ role: 'system', content: 'You are a document extraction assistant. Always respond in valid JSON format.' });
  } else if (provider.name === 'groq' && responseFormat === 'text') {
    messages.push({ role: 'system', content: 'You are a professional insurance letter writer. Respond with plain prose only — no JSON, no markdown, no code blocks.' });
  }

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
    messages.push({ role: 'user', content: prompt });
  }

  const requestBody = {
    model: provider.model,
    messages,
    temperature: 0.1,
    // Only request json_object mode for JSON responses.
    // Pass 3 (covering narrative) returns plain text — json_object mode would
    // force the model to wrap the letter in JSON or produce a parse error.
    ...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    max_tokens: provider.maxOutputTokens ?? 16384,
  };

  let data: any;
  if (provider.name === 'nvidia') {
    // NVIDIA's API sends no CORS headers → the browser cannot call it directly.
    // Route through the Cloud Function proxy (server-to-server, no CORS). Its
    // callable has its own 300s server-side timeout — opts.timeoutMs cannot be
    // applied mid-flight (a callable cannot be aborted once sent).
    const { callAiProxy } = await import('@/lib/firebase/functions');
    const proxied = await callAiProxy('nvidia', 'chat/completions', key, requestBody);
    meta.rateLimit = proxied.rateLimit ? parseRateLimit(proxied.rateLimit) : undefined;
    if (!proxied.ok) {
      const err = safeJsonParse(proxied.body);
      throw new ProviderError('nvidia', proxied.status, err?.error?.message || String(proxied.status));
    }
    data = safeJsonParse(proxied.body) ?? {};
  } else {
    const res = await fetchWithTimeout(provider.name, provider.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(requestBody),
    }, opts.timeoutMs);
    meta.rateLimit = headerLimits(res);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ProviderError(provider.name, res.status, err.error?.message || String(res.status));
    }

    data = await res.json();
    useUIStore.getState().setAIProviderHealth(provider.name as 'groq' | 'gemini', 'ok');
  }
  return {
    text: (data.choices?.[0]?.message?.content || '').trim(),
    finish: data.choices?.[0]?.finish_reason === 'length' ? 'MAX_TOKENS' : 'STOP',
    usage: usageIf(provider.name as ProviderId, data),
  };
}
