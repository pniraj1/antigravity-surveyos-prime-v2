export type StageVariant = 'spot' | 'final' | 'reinspection' | 'valuation' | 'default';

const KNOWN: ReadonlySet<string> = new Set(['spot', 'final', 'reinspection', 'valuation']);

export function stageVariant(stage: string): StageVariant {
  return KNOWN.has(stage) ? (stage as StageVariant) : 'default';
}
