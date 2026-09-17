import { create } from 'zustand';
import type { ModelProbes } from '@/lib/ai/probe-types';

/** Admin probe results, readable by every signed-in surveyor; null until loaded or when the read failed. */
interface ProbesState { probes: ModelProbes | null; loaded: boolean; setProbes: (p: ModelProbes | null) => void }
export const useProbesStore = create<ProbesState>((set) => ({ probes: null, loaded: false, setProbes: (probes) => set({ probes, loaded: true }) }));
