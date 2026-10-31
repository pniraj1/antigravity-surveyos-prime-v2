export interface PacerOptions { minGapMs: number; dailyCap: number; now?: () => number; sleep?: (ms: number) => Promise<void> }
export interface Pacer {
  take(): Promise<'go' | 'capped'>
  onRateLimited(retryAfterMs?: number): 'retry' | 'pause'
  onSuccess(): void
  readonly callsMade: number
  readonly paused: boolean
}

const DEFAULT_RETRY_MS = 60_000

export function createPacer(o: PacerOptions): Pacer {
  const now = o.now ?? Date.now
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let calls = 0
  let last: number | null = null
  let streak = 0
  let paused = false
  let extraWait = 0

  return {
    async take() {
      if (calls >= o.dailyCap) return 'capped'
      const gap = last === null ? 0 : Math.max(0, last + o.minGapMs - now())
      const wait = Math.max(gap, extraWait)
      extraWait = 0
      if (wait > 0) await sleep(wait)
      last = now()
      calls += 1
      return 'go'
    },
    onRateLimited(retryAfterMs) {
      streak += 1
      if (streak >= 2) { paused = true; return 'pause' }
      extraWait = retryAfterMs ?? DEFAULT_RETRY_MS
      return 'retry'
    },
    onSuccess() { streak = 0 },
    get callsMade() { return calls },
    get paused() { return paused },
  }
}

// Half the provider's reported daily limit, else 100 calls per run.
export function defaultDailyCap(limitRequestsPerDay?: number): number {
  return limitRequestsPerDay ? Math.floor(limitRequestsPerDay * 0.5) : 100
}
