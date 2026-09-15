import { ModelEntry, PROVIDER_IMAGE_CAPS } from './models-config';

/**
 * Maps a provider's raw catalogue into entries. Capability fields are left
 * unknown — vision, image cap and context window come from the probe
 * (src/lib/ai/probe-runner.ts), not from pattern-matching the model name.
 *
 * The previous version guessed vision support from the id and stamped every
 * match with "handles 6+ page scanned estimates". Measured against NVIDIA:
 * 60 of its 100 listed models 404 on call, and the vision models that do work
 * reject a second image outright.
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
    const { callAiProxy } = await import('@/lib/firebase/functions');
    const res = await callAiProxy('nvidia', 'models', key);
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
