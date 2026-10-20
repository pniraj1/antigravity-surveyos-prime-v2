import { create } from 'zustand';

/** How many file reads (Scan, labelling, Build) are in flight; the folder card shows a Drive hint while it is > 0. */
export const useReading = create<{ active: number }>(() => ({ active: 0 }));

export async function whileReading<T>(job: () => Promise<T>): Promise<T> {
  useReading.setState((s) => ({ active: s.active + 1 }));
  try { return await job(); }
  finally { useReading.setState((s) => ({ active: s.active - 1 })); }
}
