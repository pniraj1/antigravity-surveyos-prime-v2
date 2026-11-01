import { FALLBACK_MODELS, type ProviderId } from '@/lib/ai/models-config';
import { referenceFor } from '@/lib/bench/agree';
import type { ModelPick } from '@/lib/bench/plan';
import { compareToReference, passes, selfCheck } from '@/lib/bench/score';
import type { CellResult } from '@/lib/bench/store';
import type { BenchRow, ErrorType, PdfProfile } from '@/lib/bench/types';

export type Method = 'text' | 'vision' | 'parser';
export interface PickRow { provider: ProviderId; model: string; label: string; checked: boolean; methods: Method[] }
export const PROVIDERS: ProviderId[] = ['gemini', 'groq', 'nvidia', 'ollama'];
/** The row parser is benched like a model, but makes no calls and needs no key. */
export const PARSER_MODEL = 'row-parser';
export const METHODS_OFFERED = (model: string): Method[] => (model === PARSER_MODEL ? ['parser'] : ['text', 'vision']);
export const STALE_MS = 30 * 86_400_000;

// ponytail: picks come from the built-in fallback catalogue, not the live probe list; add when the owner needs other models.
export function defaultPickRows(): PickRow[] {
  const parser: PickRow = { provider: 'ollama', model: PARSER_MODEL, label: 'Row parser (no AI)', checked: true, methods: ['parser'] };
  return [parser, ...PROVIDERS.flatMap(provider => FALLBACK_MODELS[provider].map(m => ({
    provider, model: m.id, label: m.label, checked: provider !== 'gemini', methods: [m.vision ? 'vision' : 'text'] as Method[],
  })))];
}

export const toPicks = (rows: PickRow[], keys: Partial<Record<ProviderId, string>>): ModelPick[] =>
  rows.filter(r => r.checked && r.methods.length).map(r => ({ provider: r.provider, model: r.model, key: keys[r.provider] ?? '', methods: r.methods }));

/** Providers with a ticked pick but no key (every provider is BYOK). */
export const missingKeys = (picks: ModelPick[]): ProviderId[] =>
  [...new Set(picks.filter(k => !k.key.trim() && !k.methods.every(m => m === 'parser')).map(k => k.provider))];

export const canStart = (profiles: PdfProfile[], picks: ModelPick[]): boolean =>
  picks.length > 0 && missingKeys(picks).length === 0 && profiles.some(p => p.confirmed);

/** Largest amount that follows the word "total" on the given 1-based page range. Only a proposal. */
// ponytail: regex over the joined page text, not real line geometry.
export function proposeTotal(texts: string[], first: number, last: number): number | null {
  let best: number | null = null;
  for (const text of texts.slice(Math.max(0, first - 1), last)) {
    for (const m of text.matchAll(/total[^0-9]{0,25}(\d[\d,]*(?:\.\d{1,2})?)/gi)) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && (best === null || n > best)) best = n;
    }
  }
  return best;
}

type GoldMap = Record<string, BenchRow[] | undefined>;

/** For each reading of a gold PDF: does the checker (selfCheck + agreement without gold) give the same pass/fail as gold? */
export function checkerVsGold(profiles: PdfProfile[], cells: CellResult[], gold: GoldMap): { agree: number; total: number } {
  let agree = 0, total = 0;
  for (const p of profiles) {
    const g = gold[p.id];
    if (!g) continue;
    const readings = cells.filter(c => c.profileId === p.id && c.status === 'done')
      .map(c => ({ cellId: c.id, model: c.model, rows: c.rows, errors: c.errors }));
    for (const r of readings) {
      if (r.errors.some(e => e.type === 'broken_reply')) continue;
      const own = selfCheck(r.rows, p);
      const ref = referenceFor(readings.filter(o => o.cellId !== r.cellId), p, undefined);
      const checker = passes(own) && (!ref || passes(compareToReference(r.rows, ref.rows, p)));
      const truth = passes([...own, ...compareToReference(r.rows, g, p)]);
      total += 1;
      if (checker === truth) agree += 1;
    }
  }
  return { agree, total };
}

export interface Summary {
  key: string; provider: ProviderId; model: string; method: Method;
  maxPages: number | null; maxRowsPerCall: number; tokensPerRow: number | null;
  errors: Partial<Record<ErrorType, number>>; stale: boolean;
}

export function summarize(cells: CellResult[], now = Date.now()): Summary[] {
  const groups = new Map<string, CellResult[]>();
  for (const c of cells.filter(x => x.status === 'done')) {
    const k = `${c.provider}|${c.model}|${c.method}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return [...groups].map(([key, cs]) => {
    const ok = cs.filter(c => passes(c.errors));
    const errors: Summary['errors'] = {};
    for (const e of cs.flatMap(c => c.errors)) errors[e.type] = (errors[e.type] ?? 0) + 1;
    const rows = ok.reduce((n, c) => n + c.rows.length, 0);
    return {
      key, provider: cs[0].provider, model: cs[0].model, method: cs[0].method, errors,
      maxPages: ok.length ? Math.max(...ok.map(c => c.pagesPerCall)) : null,
      maxRowsPerCall: ok.length ? Math.max(...ok.map(c => Math.round(c.rows.length / Math.max(1, c.calls.length)))) : 0,
      tokensPerRow: rows ? Math.round(ok.reduce((n, c) => n + c.tokensIn + c.tokensOut, 0) / rows) : null,
      stale: now - Math.max(...cs.map(c => c.at)) > STALE_MS,
    };
  });
}

/** Profiles with readings but neither gold nor two agreeing clean readings. */
export function needsOwner(profiles: PdfProfile[], cells: CellResult[], gold: GoldMap): PdfProfile[] {
  return profiles.filter(p => {
    const rs = cells.filter(c => c.profileId === p.id && c.status === 'done').map(c => ({ cellId: c.id, model: c.model, rows: c.rows, errors: c.errors }));
    return rs.length > 0 && !referenceFor(rs, p, gold[p.id]);
  });
}
