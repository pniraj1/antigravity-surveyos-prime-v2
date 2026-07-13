import { ModelEntry, PROVIDER_IMAGE_CAPS, computeEstimateCapacity } from './models-config';

/**
 * Heuristic for NVIDIA/Groq, whose /models endpoints return only an id.
 * Matches known multimodal families; excludes embedding/safety/guard/text-only.
 */
export function isLikelyVisionModel(id: string): boolean {
  const s = id.toLowerCase();
  if (/embed|guard|safety|reward|retriev|nemoretriever|parse|reranking|tts|whisper/.test(s)) return false;
  return /vision|-vl\b|vl-|maverick|gemma-3|gemma-4|phi-3-vision|phi-4|llama-4|nemotron-nano-\d+b-v\d+-vl|pixtral|qwen.*vl/.test(s);
}

function mapList(provider: 'nvidia' | 'groq', ids: string[]): ModelEntry[] {
  const imageCap = PROVIDER_IMAGE_CAPS[provider];
  const ctxWindow = provider === 'groq' ? 131_072 : 128_000; // provider default; endpoints don't report it
  return ids
    .filter(id => !!id)
    .sort()
    .map(id => {
      const vision = isLikelyVisionModel(id);
      return {
        id,
        label: id.split('/').pop() ?? id,
        note: '',
        ctxWindow,
        vision,
        imageCap,
        estimateCapacity: computeEstimateCapacity({ vision, ctxWindow, imageCap }),
      };
    });
}

async function fetchOpenAIStyleModels(url: string, key: string): Promise<string[] | null> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const list: Array<{ id: string }> = data.data ?? [];
    return list.map(m => m.id);
  } catch {
    return null;
  }
}

export async function fetchNvidiaModels(key: string): Promise<ModelEntry[] | null> {
  // NVIDIA's API has no CORS support — must go through the Cloud Function proxy.
  try {
    const { callNvidiaProxy } = await import('@/lib/firebase/functions');
    const res = await callNvidiaProxy('models', key);
    if (!res.ok) return null;
    const data = JSON.parse(res.body);
    const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
    return mapList('nvidia', ids);
  } catch {
    return null;
  }
}

export async function fetchGroqModels(key: string): Promise<ModelEntry[] | null> {
  const ids = await fetchOpenAIStyleModels('https://api.groq.com/openai/v1/models', key);
  return ids ? mapList('groq', ids) : null;
}
