import { create } from 'zustand';
import { AIModelsConfig, FALLBACK_AI_MODELS_CONFIG } from '@/lib/ai/models-config';

interface AIConfigState {
  config: AIModelsConfig;
  loaded: boolean;
  setConfig: (config: AIModelsConfig) => void;
}

export const useAIConfigStore = create<AIConfigState>((set) => ({
  config: FALLBACK_AI_MODELS_CONFIG,
  loaded: false,
  setConfig: (config) => set({ config, loaded: true }),
}));
