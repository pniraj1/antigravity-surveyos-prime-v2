export type ProviderId = 'gemini' | 'groq' | 'nvidia';

export interface ModelEntry {
  id: string;
  label: string;
  note: string;          // admin free-text guidance
  ctxWindow: number | null;
  vision: boolean;
  imageCap: number | null;
  estimateCapacity: string;
}

export interface ProviderConfig {
  enabled: boolean;
  defaultModel: string;
  models: ModelEntry[];
}

export interface AIModelsConfig {
  updatedAt: number | null;
  updatedBy: string;
  defaultProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
}

/** Per-provider image cap. Groq accepts max 5 images; others are uncapped. */
export const PROVIDER_IMAGE_CAPS: Record<ProviderId, number | null> = {
  gemini: null,
  groq: 5,
  nvidia: null,
};

/** Formats a context window token count into a short badge string (1M, 131K). */
export function formatCtx(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Honest, use-case-framed verdict for handling multi-page estimate PDFs. */
export function computeEstimateCapacity(input: {
  vision: boolean;
  ctxWindow: number | null;
  imageCap: number | null;
}): string {
  const { vision, ctxWindow, imageCap } = input;
  if (!vision) return 'text only · not for scanned estimates';
  if (imageCap !== null && imageCap <= 5) {
    return `vision · max ${imageCap} images · not ideal for 6-page scans`;
  }
  const ctx = ctxWindow ? `~${formatCtx(ctxWindow)} ctx · ` : '';
  return `vision · ${ctx}handles 6+ page scanned estimates`;
}

function entry(p: ProviderId, id: string, label: string, note: string, ctxWindow: number | null, vision: boolean): ModelEntry {
  const imageCap = PROVIDER_IMAGE_CAPS[p];
  return { id, label, note, ctxWindow, vision, imageCap, estimateCapacity: computeEstimateCapacity({ vision, ctxWindow, imageCap }) };
}

/** Offline fallback used when Firestore is unreachable or the doc is absent. */
export const FALLBACK_AI_MODELS_CONFIG: AIModelsConfig = {
  updatedAt: null,
  updatedBy: 'fallback',
  defaultProvider: 'gemini',
  providers: {
    gemini: {
      enabled: true,
      defaultModel: 'gemini-2.5-flash',
      models: [
        entry('gemini', 'gemini-2.5-pro', '2.5 Pro', 'Most capable · deep reasoning', 1_000_000, true),
        entry('gemini', 'gemini-2.5-flash', '2.5 Flash', 'Best value · 10 RPM · 500/day', 1_000_000, true),
        entry('gemini', 'gemini-2.5-flash-lite', '2.5 Flash-Lite', 'Fastest · 15 RPM · 1000/day', 1_000_000, true),
      ],
    },
    groq: {
      enabled: true,
      defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
      models: [
        entry('groq', 'meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout', 'Vision + text · free tier', 131_072, true),
        entry('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B', 'Text only · reliable', 131_072, false),
      ],
    },
    nvidia: {
      enabled: true,
      defaultModel: 'meta/llama-3.2-90b-vision-instruct',
      models: [
        entry('nvidia', 'meta/llama-3.2-90b-vision-instruct', 'Llama 3.2 90B', 'Best vision', 128_000, true),
        entry('nvidia', 'meta/llama-3.2-11b-vision-instruct', 'Llama 3.2 11B', 'Smaller · faster', 128_000, true),
      ],
    },
  },
};
