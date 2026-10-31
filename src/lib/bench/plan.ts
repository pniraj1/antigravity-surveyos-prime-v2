import type { ProviderId } from '../ai/models-config';
import { passes } from './score';
import type { PdfProfile } from './types';
import type { CellKey, CellResult } from './store';

export const PAGES_STEPS = [1, 2, 3, 4] as const;
export const SCALES = [1, 1.25, 1.5] as const;
type Scale = CellKey['imageScale'];
type Method = CellKey['method'];
export interface ModelPick { provider: ProviderId; model: string; key: string; methods: Method[] }

export function plannedCalls(profile: PdfProfile, pagesPerCall: number): number {
  return Math.ceil(profile.pageCount / pagesPerCall);
}

const mine = (c: CellResult, pick: ModelPick, method: Method) =>
  c.provider === pick.provider && c.model === pick.model && c.method === method;

/** Highest pages-per-call that passed at scale 1.5 (a borderline step counts when 2 of 3 runs passed). */
function stepUp(cells: CellResult[], k: Omit<CellKey, 'pagesPerCall' | 'imageScale' | 'runNo'>): { next: CellKey | null; best: number | null } {
  const at = (p: number, s: Scale, r: number) => cells.find(c => c.pagesPerCall === p && c.imageScale === s && c.runNo === r);
  const key = (p: number, s: Scale, r: number): CellKey => ({ ...k, pagesPerCall: p, imageScale: s, runNo: r });
  let best: number | null = null;
  // a bad key/model fails every cell: one provider_error ends this method on this PDF
  if (cells.some(c => c.errors.some(e => e.type === 'provider_error'))) return { next: null, best };
  for (const p of PAGES_STEPS) {
    const r1 = at(p, 1.5, 1);
    if (!r1) return { next: key(p, 1.5, 1), best };
    if (passes(r1.errors)) { best = p; continue; }
    const r2 = at(p, 1.5, 2);
    if (!r2) return { next: key(p, 1.5, 2), best };
    if (!passes(r2.errors)) break;
    const r3 = at(p, 1.5, 3);
    if (!r3) return { next: key(p, 1.5, 3), best };
    if (!passes(r3.errors)) break;
    best = p;
  }
  if (best === null) return { next: null, best };
  for (const s of [1.25, 1] as const) {
    const r = at(best, s, 1);
    if (!r) return { next: key(best, s, 1), best };
    if (!passes(r.errors)) break;
  }
  return { next: null, best };
}

/** Lowest scale whose readings at it all passed, across other PDFs; default 1.5. */
function bestScale(cells: CellResult[]): Scale {
  for (const s of [1, 1.25] as const) {
    const at = cells.filter(c => c.imageScale === s);
    if (at.length && at.every(c => passes(c.errors))) return s;
  }
  return 1.5;
}

export function nextCell(done: CellResult[], profile: PdfProfile, pick: ModelPick, set: 'hard' | 'wide', proposed?: number): CellKey | null {
  for (const method of pick.methods) {
    const base = { profileId: profile.id, provider: pick.provider, model: pick.model, method };
    const ours = done.filter(c => mine(c, pick, method));
    const here = ours.filter(c => c.profileId === profile.id);
    // rate_limited / capped cells are re-queued as the same key
    const requeue = here.find(c => c.status !== 'done');
    if (requeue) return { ...base, pagesPerCall: requeue.pagesPerCall, imageScale: requeue.imageScale, runNo: requeue.runNo };
    const finished = here.filter(c => c.status === 'done');
    if (set === 'hard') {
      const { next } = stepUp(finished, base);
      if (next) return next;
      continue;
    }
    if (finished.length) continue;
    const others = ours.filter(c => c.profileId !== profile.id && c.status === 'done');
    const ids = [...new Set(others.map(c => c.profileId))];
    const bests = ids.map(id => stepUp(others.filter(c => c.profileId === id), { ...base, profileId: id }).best ?? 1);
    return { ...base, pagesPerCall: proposed ?? (bests.length ? Math.min(...bests) : 1), imageScale: bestScale(others), runNo: 1 };
  }
  return null;
}

/** Upper bound: hard = 3 runs at every step + 2 scale runs at 1 page; wide = one run at 1 page. */
export function planEstimate(profiles: PdfProfile[], picks: ModelPick[], hardIds: string[]): Record<ProviderId, number> {
  const out: Record<ProviderId, number> = { gemini: 0, groq: 0, nvidia: 0, ollama: 0 };
  for (const pick of picks) for (const _m of pick.methods) for (const p of profiles) {
    out[pick.provider] += hardIds.includes(p.id)
      ? PAGES_STEPS.reduce((n, s) => n + 3 * plannedCalls(p, s), 0) + 2 * plannedCalls(p, 1)
      : plannedCalls(p, 1);
  }
  return out;
}
