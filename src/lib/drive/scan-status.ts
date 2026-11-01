/**
 * SurveyOS Scan's Drive status file `_surveyos-status.json` (pure codec + merge).
 * Contract: `SurveyOS Scan/docs/handover/scan-drive-status.md`. Port of Scan's chase/StatusFile.kt —
 * keep the two identical. Times are epoch ms in memory, IST ISO (whole seconds) on the wire.
 */
import type { ClaimData } from '@/types';
import type { ScanAsk, ScanChase } from '@/lib/scan-import/manifest';
import { istNow } from '@/lib/chase/ask-dialog';

export interface SlotStatus { state: string; reason: string | null; by: string; at: number }
export interface FieldValue { value: string; at: number }
export interface StatusAsk { at: number; to: string; via: string; lang: string; docs: string[] }
export interface Status {
  claimId: string; updatedAt: number; vehicle: string; insurer: string; claimNo: string | null;
  slots: Record<string, SlotStatus>; contacts: Record<string, Record<string, FieldValue>>;
  asks: StatusAsk[]; status: string;
  /** When Prime set `status` (Mark completed / Reopen). Only Prime writes it; absent in older files. */
  statusAt?: number;
}

const APP = 'surveyos-scan-status';
export const STATUS_FILE = '_surveyos-status.json';

/** Whole seconds, so local times equal what the wire gives back. */
const sec = (ms: number) => Math.floor(ms / 1000) * 1000;

export function statusToJson(s: Status): string {
  const slots: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s.slots)) {
    slots[k] = { state: v.state, ...(v.reason != null ? { reason: v.reason } : {}), by: v.by, at: istNow(v.at) };
  }
  const contacts: Record<string, Record<string, unknown>> = {};
  for (const [r, fs] of Object.entries(s.contacts)) {
    contacts[r] = Object.fromEntries(Object.entries(fs).map(([f, v]) => [f, { value: v.value, at: istNow(v.at) }]));
  }
  return JSON.stringify({
    app: APP, v: 1, claimId: s.claimId, updatedAt: istNow(s.updatedAt), vehicle: s.vehicle, insurer: s.insurer,
    ...(s.claimNo != null ? { claimNo: s.claimNo } : {}),
    slots, contacts,
    asks: s.asks.map((a) => ({ at: istNow(a.at), to: a.to, via: a.via, lang: a.lang, docs: a.docs })),
    status: s.status,
    ...(s.statusAt != null ? { statusAt: istNow(s.statusAt) } : {}),
  });
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown, dflt = '') => (typeof v === 'string' ? v : dflt);
const time = (v: unknown): number | null => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? null : t;
};

/** Null when [text] isn't a Scan status file. Unknown keys are ignored; entries with an unreadable time are dropped. */
export function parseStatus(text: string): Status | null {
  let j: Obj | null;
  try { j = obj(JSON.parse(text)); } catch { return null; }
  if (!j || j.app !== APP) return null;
  const slots: Record<string, SlotStatus> = {};
  for (const [k, v] of Object.entries(obj(j.slots) ?? {})) {
    const s = obj(v); const at = time(s?.at);
    if (!s || at == null) continue;
    slots[k] = { state: str(s.state), reason: 'reason' in s ? str(s.reason) : null, by: str(s.by, 'scan'), at };
  }
  const contacts: Record<string, Record<string, FieldValue>> = {};
  for (const [r, v] of Object.entries(obj(j.contacts) ?? {})) {
    const ro = obj(v);
    if (!ro) continue;
    const fs: Record<string, FieldValue> = {};
    for (const [f, fv] of Object.entries(ro)) {
      const fo = obj(fv); const at = time(fo?.at);
      if (fo && at != null) fs[f] = { value: str(fo.value), at };
    }
    contacts[r] = fs;
  }
  const statusAt = time(j.statusAt);
  const asks: StatusAsk[] = [];
  for (const v of Array.isArray(j.asks) ? j.asks : []) {
    const o = obj(v); const at = time(o?.at);
    if (!o || at == null) continue;
    asks.push({ at, to: str(o.to), via: str(o.via), lang: str(o.lang), docs: Array.isArray(o.docs) ? o.docs.map((d) => str(d)) : [] });
  }
  return {
    claimId: str(j.claimId), updatedAt: time(j.updatedAt) ?? 0, vehicle: str(j.vehicle), insurer: str(j.insurer),
    claimNo: 'claimNo' in j ? str(j.claimNo) : null, slots, contacts, asks, status: str(j.status, 'active'),
    ...(statusAt != null ? { statusAt } : {}),
  };
}

/** Newer `at` wins; a tie keeps local. */
const newer = <T extends { at: number }>(l: T | undefined, r: T | undefined): T => (!l ? r! : r && r.at > l.at ? r : l);

/**
 * Newest `at` wins per slot and per contact field (ties keep local); asks are a union by at+to;
 * `status` and `statusAt` come from remote only. No tombstones.
 */
export function mergeStatus(local: Status, remote: Status | null): Status {
  if (!remote) return local;
  const slots: Record<string, SlotStatus> = {};
  for (const k of new Set([...Object.keys(local.slots), ...Object.keys(remote.slots)])) slots[k] = newer(local.slots[k], remote.slots[k]);
  const contacts: Record<string, Record<string, FieldValue>> = {};
  for (const role of new Set([...Object.keys(local.contacts), ...Object.keys(remote.contacts)])) {
    const l = local.contacts[role] ?? {}; const r = remote.contacts[role] ?? {};
    contacts[role] = {};
    for (const f of new Set([...Object.keys(l), ...Object.keys(r)])) contacts[role][f] = newer(l[f], r[f]);
  }
  const seen = new Set<string>();
  const asks = [...local.asks, ...remote.asks]
    .filter((a) => !seen.has(`${a.at}|${a.to}`) && !!seen.add(`${a.at}|${a.to}`))
    .sort((a, b) => a.at - b.at);
  return {
    ...local, updatedAt: Math.max(local.updatedAt, remote.updatedAt), slots, contacts, asks,
    status: remote.status, statusAt: remote.statusAt,
  };
}

/**
 * Prime's write on a document upload: its own view is just `slotKey` received by prime at `now`, merged
 * into the remote file. With no remote file it starts one (Scan fills vehicle/insurer on its next write).
 * Prime never sets `status` here (completion is Plan 4).
 */
export function withReceived(remote: Status | null, scanClaimId: string, slotKey: string, now: number): Status {
  const at = sec(now);
  const local: Status = {
    claimId: remote?.claimId || scanClaimId, updatedAt: at, vehicle: remote?.vehicle ?? '', insurer: remote?.insurer ?? '',
    claimNo: remote ? remote.claimNo : null, slots: { [slotKey]: { state: 'received', reason: null, by: 'prime', at } },
    contacts: {}, asks: [], status: 'active',
  };
  return mergeStatus(local, remote);
}

/**
 * Prime's write on Mark completed / Reopen: the remote file (or a fresh one) with `status`, `statusAt` = [at]
 * (the claim's change time, default now) and `updatedAt` = now. Scan compares `statusAt` with its own Done/Reopen.
 * Slots, contacts and asks stay as in the file.
 */
export function withCompletion(remote: Status | null, scanClaimId: string, completed: boolean, now: number, at = now): Status {
  const status = completed ? 'completed' : 'active';
  const updatedAt = sec(now);
  const statusAt = sec(at);
  return remote
    ? { ...remote, updatedAt, status, statusAt }
    : { claimId: scanClaimId, updatedAt, vehicle: '', insurer: '', claimNo: null, slots: {}, contacts: {}, asks: [], status, statusAt };
}

/** The claim fields Mark completed / Reopen sets. Reopen also clears `driveTrashedAt` so a later cleanup lists it again. */
export function completionPatch(completed: boolean, nowIso: string): Partial<ClaimData> {
  return completed
    ? { completedAt: nowIso, statusChangedAt: nowIso }
    : { completedAt: undefined, statusChangedAt: nowIso, driveTrashedAt: undefined };
}

/**
 * On claim open: the status to write when the file disagrees with the claim (completed iff `completedAt`; time =
 * `statusChangedAt`, else `completedAt`). Repairs an offline write, or one a concurrent Scan read-merge-write lost.
 * Null when it agrees, the claim was never marked, or the file holds a newer `statusAt`.
 */
export function reconcileCompletion(
  file: Status | null, claim: Pick<ClaimData, 'completedAt' | 'statusChangedAt' | 'scanClaimId'>, now: number,
): Status | null {
  const changed = claim.statusChangedAt ?? claim.completedAt;
  const t = changed ? Date.parse(changed) : NaN;
  if (Number.isNaN(t)) return null;
  const at = sec(t);
  const status = claim.completedAt ? 'completed' : 'active';
  if (file?.statusAt != null && file.statusAt > at) return null;
  if (file && file.status === status && file.statusAt === at) return null;
  return withCompletion(file, claim.scanClaimId ?? '', !!claim.completedAt, now, at);
}

type Chase = NonNullable<ClaimData['scanChase']>;
const ROLES = ['insured', 'garage', 'other'] as const;

/**
 * The claim's `scanChase` from a status file: slots and contacts from the file, asks unioned with Prime's
 * (by at+to). Null when Prime's chase is fresher than the file (a later manifest import) — keep it.
 */
export function statusToChase(s: Status, prev: Partial<Chase> | undefined): Chase | null {
  const importedAt = new Date(s.updatedAt).toISOString();
  if (prev?.importedAt && Date.parse(prev.importedAt) >= s.updatedAt) return null;
  const slotStates: NonNullable<ScanChase['slotStates']> = {};
  for (const [k, v] of Object.entries(s.slots)) {
    if (v.state === 'received' || v.state === 'missing') slotStates[k] = v.state;
    else if (v.state === 'rejected') slotStates[k] = { state: 'rejected', reason: v.reason ?? '' };
  }
  const contacts: Record<string, Record<string, string>> = {};
  for (const role of ROLES) {
    const fs = s.contacts[role];
    if (fs && Object.keys(fs).length) contacts[role] = Object.fromEntries(Object.entries(fs).map(([f, v]) => [f, v.value]));
  }
  const seen = new Set<string>();
  const fromFile = s.asks.map((a) => ({ ...a, at: istNow(a.at) }) as ScanAsk);
  const asks = [...(prev?.asks ?? []), ...fromFile]
    .filter((a) => { const k = `${Date.parse(a.at)}|${a.to}`; return !seen.has(k) && !!seen.add(k); })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { contacts: contacts as ScanChase['contacts'], slotStates, asks, importedAt };
}
