import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface FeeSlab {
  label: string;
  upTo: number | null;      // inclusive upper bound of basis; null = open-ended last slab
  base: number;             // flat base fee
  marginalFrom: number;     // basis above which marginalRatePct applies (0 = pure flat)
  marginalRatePct: number;  // e.g. 0.70 for 0.70%
  maxFee: number | null;    // cap; null = uncapped
}

export interface FeeSchedule {
  version: string;
  updatedAt: number | null;
  updatedBy: string;
  slabs: FeeSlab[];
}

/** IISLA Motor Department survey-fee schedule, Revised 2022. Estimate of Repairs basis (capped by IDV). */
export const FALLBACK_FEE_SCHEDULE: FeeSchedule = {
  version: 'IISLA-2022',
  updatedAt: null,
  updatedBy: 'fallback',
  slabs: [
    { label: 'Up to ₹20,000',          upTo: 20000,   base: 850,   marginalFrom: 0,       marginalRatePct: 0,    maxFee: null },
    { label: '₹20,001 – ₹50,000',      upTo: 50000,   base: 1500,  marginalFrom: 0,       marginalRatePct: 0,    maxFee: null },
    { label: '₹50,001 – ₹1,00,000',    upTo: 100000,  base: 1800,  marginalFrom: 0,       marginalRatePct: 0,    maxFee: null },
    { label: '₹1,00,001 – ₹2,00,000',  upTo: 200000,  base: 2800,  marginalFrom: 0,       marginalRatePct: 0,    maxFee: null },
    { label: '₹2,00,001 – ₹30,00,000', upTo: 3000000, base: 2800,  marginalFrom: 200000,  marginalRatePct: 0.70, maxFee: 15000 },
    { label: 'Above ₹30,00,000',       upTo: null,    base: 15000, marginalFrom: 3000000, marginalRatePct: 0.70, maxFee: 25000 },
  ],
};

/** Backfills a partial/absent Firestore doc so the UI never crashes on a malformed schedule. */
export function mergeWithFallback(raw: Partial<FeeSchedule> | null | undefined): FeeSchedule {
  if (!raw || !Array.isArray(raw.slabs) || raw.slabs.length === 0) return FALLBACK_FEE_SCHEDULE;
  return {
    version: raw.version ?? FALLBACK_FEE_SCHEDULE.version,
    updatedAt: raw.updatedAt ?? null,
    updatedBy: raw.updatedBy ?? 'unknown',
    slabs: raw.slabs as FeeSlab[],
  };
}

/** Resolution order: surveyor personal → admin global → code fallback. */
export function getActiveFeeSchedule(
  personal: FeeSchedule | undefined,
  global: FeeSchedule | null,
): FeeSchedule {
  return personal ?? global ?? FALLBACK_FEE_SCHEDULE;
}

/** Reads the admin global schedule; falls back gracefully on absence or error. */
export async function loadFeeSchedule(): Promise<FeeSchedule> {
  try {
    const snap = await getDoc(doc(db, 'fee_config', 'schedule'));
    if (!snap.exists()) return FALLBACK_FEE_SCHEDULE;
    return mergeWithFallback(snap.data() as Partial<FeeSchedule>);
  } catch {
    return FALLBACK_FEE_SCHEDULE;
  }
}

/** Admin-only write (enforced by Firestore rules). */
export async function saveFeeSchedule(schedule: FeeSchedule, updatedBy: string): Promise<void> {
  await setDoc(doc(db, 'fee_config', 'schedule'), { ...schedule, updatedAt: Date.now(), updatedBy });
}
