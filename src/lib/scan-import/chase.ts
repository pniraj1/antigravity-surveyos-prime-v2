/**
 * Merge of SurveyOS Scan's manifest `chase` into a Prime claim.
 * Contract: `SurveyOS Scan/docs/handover/scan-manifest-chase.md`. Prime's value wins; Scan only fills blanks.
 * Pure: plan first, write only what the surveyor approves.
 */
import type { ClaimData } from '@/types';
import type { ScanAsk, ScanChase } from './manifest';
import { getAt } from './path';

export interface ChasePlan {
  fills: { path: string; value: string }[];
  next: ClaimData['scanChase'];
  scanClaimId: string | undefined;
  conflict: string | null;
}

const askKey = (a: ScanAsk) => [a.at, a.to, a.via, a.lang, a.docs.join(',')].join('|');

export function planChase(claim: ClaimData, chase: ScanChase | undefined, scanClaimId: string | undefined, relink = false): ChasePlan {
  const keep = relink ? undefined : claim.scanClaimId;
  if (keep && scanClaimId && keep !== scanClaimId) {
    return { fills: [], next: claim.scanChase, scanClaimId: keep, conflict: `Claim already linked to Scan claim ${keep}, not ${scanClaimId}` };
  }
  const id = keep ?? scanClaimId;
  if (!chase) return { fills: [], next: claim.scanChase, scanClaimId: id, conflict: null };

  const c = chase.contacts;
  const wanted: [string, string | undefined][] = [
    ['policy.insuredName', c?.insured?.name],
    ['policy.insuredMobile', c?.insured?.phone],
    ['accident.workshopName', c?.garage?.name],
    ['accident.workshopPhone', c?.garage?.phone],
    ['accident.workshopEmail', c?.garage?.email],
  ];
  const fills = wanted.flatMap(([path, v]) => {
    const value = (v ?? '').trim();
    return value && !String(getAt(claim, path) ?? '').trim() ? [{ path, value }] : [];
  });

  const seen = new Set<string>();
  const asks = [...(claim.scanChase?.asks ?? []), ...(chase.asks ?? [])].filter((a) => !seen.has(askKey(a)) && !!seen.add(askKey(a)));
  asks.sort((a, b) => a.at.localeCompare(b.at)); // ponytail: same-offset IST strings sort chronologically
  const next = { contacts: chase.contacts, slotStates: chase.slotStates, asks, importedAt: new Date().toISOString() };
  return { fills, next, scanClaimId: id, conflict: null };
}
