import { useEffect } from 'react';
import { loadAIModelsConfig } from '@/lib/ai/models-config';
import { useAIConfigStore } from '@/stores/ai-config-store';

/** Loads the admin-curated AI model config once on app start. */
export function useAIConfig(): void {
  const setConfig = useAIConfigStore(s => s.setConfig);
  useEffect(() => {
    let cancelled = false;
    loadAIModelsConfig().then(cfg => { if (!cancelled) setConfig(cfg); });
    return () => { cancelled = true; };
  }, [setConfig]);
}
