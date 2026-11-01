import { benchGet, benchGetAll, benchPut } from '../storage/indexeddb';
import type { CallRecord } from '../ai/call-meter';
import type { ProviderId } from '../ai/models-config';
import type { BenchError, BenchRow, PdfProfile } from './types';

export interface CellKey { profileId: string; provider: ProviderId; model: string; method: 'text' | 'vision' | 'parser'; pagesPerCall: number; imageScale: 1 | 1.25 | 1.5; runNo: number }
export interface CellResult extends CellKey { id: string; status: 'done' | 'rate_limited' | 'capped'; rows: BenchRow[]; errors: BenchError[]; calls: CallRecord[]; tokensIn: number; tokensOut: number; ms: number; modelVersion: string; at: number }

/** Stable join of all key fields. JSON array so no separator can collide with a model name. */
export function cellId(k: CellKey): string {
  return JSON.stringify([k.profileId, k.provider, k.model, k.method, k.pagesPerCall, k.imageScale, k.runNo]);
}

interface GoldRec { profileId: string; rows: BenchRow[] }
interface PdfRec { id: string; blob: Blob; fileName: string }

export const bench = {
  putProfile: (p: PdfProfile) => benchPut('benchProfiles', p),
  profiles: () => benchGetAll<PdfProfile>('benchProfiles'),
  putPdf: (id: string, blob: Blob, fileName: string) => benchPut('benchPdfs', { id, blob, fileName }),
  async pdf(id: string): Promise<File | null> {
    const r = await benchGet<PdfRec>('benchPdfs', id);
    return r ? new File([r.blob], r.fileName, { type: r.blob.type }) : null;
  },
  putGold: (profileId: string, rows: BenchRow[]) => benchPut('benchGold', { profileId, rows }),
  async gold(profileId: string): Promise<BenchRow[] | null> {
    return (await benchGet<GoldRec>('benchGold', profileId))?.rows ?? null;
  },
  putCell: (c: CellResult) => benchPut('benchCells', c),
  cells: () => benchGetAll<CellResult>('benchCells'),
  /** profiles + gold + cells (no PDF blobs) */
  async exportJson(): Promise<string> {
    const [profiles, gold, cells] = await Promise.all([
      benchGetAll<PdfProfile>('benchProfiles'), benchGetAll<GoldRec>('benchGold'), benchGetAll<CellResult>('benchCells'),
    ]);
    return JSON.stringify({ version: 1, profiles, gold, cells });
  },
  /** Merges by id; existing records with the same id are overwritten. */
  async importJson(json: string): Promise<void> {
    const d = JSON.parse(json) as { profiles?: PdfProfile[]; gold?: GoldRec[]; cells?: CellResult[] };
    for (const p of d.profiles ?? []) await benchPut('benchProfiles', p);
    for (const g of d.gold ?? []) await benchPut('benchGold', g);
    for (const c of d.cells ?? []) await benchPut('benchCells', c);
  },
};
