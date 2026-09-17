import { useEffect } from 'react';
import { loadAIModelsConfig } from '@/lib/ai/models-config';
import { loadModelProbes } from '@/lib/ai/probe-types';
import { useAIConfigStore } from '@/stores/ai-config-store';
import { useProbesStore } from '@/stores/probes-store';

/** Loads the admin-curated AI model config and probe results once on app start. */
export function useAIConfig(): void {
  const setConfig = useAIConfigStore(s => s.setConfig);
  const setProbes = useProbesStore(s => s.setProbes);
  useEffect(() => {
    let cancelled = false;
    loadAIModelsConfig().then(cfg => { if (!cancelled) setConfig(cfg); });
    loadModelProbes().then(p => { if (!cancelled) setProbes(p.probedAt > 0 ? p : null); }).catch(() => { if (!cancelled) setProbes(null); });
    return () => { cancelled = true; };
  }, [setConfig, setProbes]);
}
