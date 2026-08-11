// ═══════════════════════════════════════════════════════════
// EXTRACTION STORE — Zustand
//
// Holds in-flight AI extraction state OUTSIDE React's tree.
//
// Why this exists: Dashboard renders <ErrorBoundary key={activeTab}>, so
// switching tabs unmounts the whole subtree — including whichever component
// called useAIExtraction(). When that hook owned its state as useState, the
// state died on unmount and the resolving fetch wrote its result to a dead
// component instance. The surveyor saw the analysis vanish even though the
// provider had already been billed for the call.
//
// Keyed by document, not global: a Documents extraction and an Assessment
// extraction must stay independent (they are today, by accident of each tab
// owning its own hook instance — a single global flag would regress that).
//
// NEVER wrap this in persist(). It holds File objects, which do not
// serialise, and a page reload kills the underlying fetch anyway. Tab
// switching is what this fixes; a refresh is not.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { AppTab } from './ui-store';

export type JobStatus = 'processing' | 'done' | 'error';

export interface ExtractionResult {
  key: string;
  data: unknown;
  file: File;
}

export interface ExtractionJob {
  status: JobStatus;
  /** Human-readable message from the processor's progress callback. */
  progress: string;
  pagesDone: number;
  pagesTotal: number;
  /** Review payload — populated only once status is 'done'. */
  result: ExtractionResult | null;
  error: string | null;
  startedAt: number;
  /** Tab the job was started from, so completion can route back to it. */
  originTab: AppTab | null;
}

/** Context saved after an extraction that reported amount discrepancies. */
export interface DiscrepancyContext {
  totalPages: number;
  discrepancies: string[];
}

interface ExtractionState {
  jobs: Record<string, ExtractionJob>;
  /**
   * Files kept for re-scan / Smart Fix, keyed by document.
   *
   * These live in the store rather than a module-level map because hasFile()
   * drives UI (it enables the re-scan control) and so must trigger a
   * re-render when it changes. AbortControllers, by contrast, are not
   * render-relevant and stay in the module map below.
   */
  files: Record<string, File>;
  discrepancies: Record<string, DiscrepancyContext>;

  startJob: (key: string, originTab: AppTab | null) => void;
  setProgress: (key: string, message: string, pagesDone?: number, pagesTotal?: number) => void;
  finishJob: (key: string, result: ExtractionResult) => void;
  failJob: (key: string, error: string) => void;
  cancelJob: (key: string) => void;
  clearJob: (key: string) => void;
  rememberFile: (key: string, file: File) => void;
  setDiscrepancyContext: (key: string, ctx: DiscrepancyContext | null) => void;
}

// ─── Abort controllers ───────────────────────────────────────────────────────
// Module-level, deliberately outside the store: they are not render-relevant,
// and keeping non-serialisable objects out of state stops anyone later adding
// persist() and quietly breaking.

const controllers = new Map<string, AbortController>();

export function registerAbort(key: string, controller: AbortController): void {
  controllers.set(key, controller);
}

export function clearAbort(key: string): void {
  controllers.delete(key);
}

/** Test seam — lets a test assert that cancel actually aborted. */
export function getAbort(key: string): AbortController | undefined {
  return controllers.get(key);
}

// ─── Store ───────────────────────────────────────────────────────────────────

/** Drops one key from a record without mutating the original. */
function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

export const useExtractionStore = create<ExtractionState>()((set) => ({
  jobs: {},
  files: {},
  discrepancies: {},

  startJob: (key, originTab) =>
    set((state) => ({
      jobs: {
        ...state.jobs,
        [key]: {
          status: 'processing',
          progress: 'Preparing…',
          pagesDone: 0,
          pagesTotal: 0,
          result: null,
          error: null,
          startedAt: Date.now(),
          originTab,
        },
      },
    })),

  // The three updaters below all bail when the job is gone. That is the
  // guarantee behind "cancel discards everything": a cancelled job is removed
  // from the map, so a late-resolving promise finds nothing and cannot
  // resurrect it or write its result into the claim.
  setProgress: (key, message, pagesDone, pagesTotal) =>
    set((state) => {
      const job = state.jobs[key];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [key]: {
            ...job,
            progress: message,
            pagesDone: pagesDone ?? job.pagesDone,
            pagesTotal: pagesTotal ?? job.pagesTotal,
          },
        },
      };
    }),

  finishJob: (key, result) =>
    set((state) => {
      const job = state.jobs[key];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [key]: { ...job, status: 'done', progress: '', result, error: null },
        },
      };
    }),

  failJob: (key, error) =>
    set((state) => {
      const job = state.jobs[key];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [key]: { ...job, status: 'error', progress: '', result: null, error },
        },
      };
    }),

  cancelJob: (key) => {
    controllers.get(key)?.abort();
    controllers.delete(key);
    set((state) => ({
      jobs: omit(state.jobs, key),
      discrepancies: omit(state.discrepancies, key),
    }));
  },

  clearJob: (key) => {
    controllers.delete(key);
    set((state) => ({ jobs: omit(state.jobs, key) }));
  },

  rememberFile: (key, file) =>
    set((state) => ({ files: { ...state.files, [key]: file } })),

  setDiscrepancyContext: (key, ctx) =>
    set((state) => ({
      discrepancies: ctx
        ? { ...state.discrepancies, [key]: ctx }
        : omit(state.discrepancies, key),
    })),
}));

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectIsProcessing = (state: ExtractionState): boolean =>
  Object.values(state.jobs).some((j) => j.status === 'processing');

/** Progress line of the oldest running job — the one the surveyor started first. */
export const selectActiveProgress = (state: ExtractionState): string => {
  const running = Object.values(state.jobs)
    .filter((j) => j.status === 'processing')
    .sort((a, b) => a.startedAt - b.startedAt);
  return running[0]?.progress ?? '';
};

/**
 * The review payload to surface next: most recently started finished job.
 *
 * The hook's public API is singular while the store is keyed by document, so
 * a tab owning several keys (DocumentsTab owns rc, dl, policy…) shows one
 * review dialog at a time in completion order — matching existing behaviour.
 */
export const selectLatestReview = (state: ExtractionState): ExtractionResult | null => {
  const done = Object.values(state.jobs)
    .filter((j) => j.status === 'done' && j.result)
    .sort((a, b) => b.startedAt - a.startedAt);
  return done[0]?.result ?? null;
};
