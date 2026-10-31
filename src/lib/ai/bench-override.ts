import type { AITestOverride } from './service';

// Bench settings carried on the admin test override. All no-ops when `o` is null.
export const chunkSizeFor = (defaultSize: number, o: AITestOverride | null): number =>
  Math.max(1, o?.pagesPerCall ?? defaultSize);
export const isRaw = (o: AITestOverride | null): boolean => o?.raw === true;
export const apiImageScale = (o: AITestOverride | null): number => o?.imageScale ?? 1.5;
