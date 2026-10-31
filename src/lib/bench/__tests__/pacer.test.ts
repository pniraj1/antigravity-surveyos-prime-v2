import { describe, it, expect } from 'vitest'
import { createPacer, defaultDailyCap } from '../pacer'

function make(o: { minGapMs?: number; dailyCap?: number } = {}) {
  let t = 0
  const sleeps: number[] = []
  const pacer = createPacer({
    minGapMs: o.minGapMs ?? 1000,
    dailyCap: o.dailyCap ?? 100,
    now: () => t,
    sleep: async (ms) => { sleeps.push(ms); t += ms },
  })
  return { pacer, sleeps, advance: (ms: number) => { t += ms } }
}

describe('pacer', () => {
  it('waits minGapMs between calls', async () => {
    const { pacer, sleeps, advance } = make()
    expect(await pacer.take()).toBe('go')
    advance(300)
    await pacer.take()
    expect(sleeps).toEqual([700])
  })

  it('caps after dailyCap calls', async () => {
    const { pacer } = make({ minGapMs: 0, dailyCap: 2 })
    expect(await pacer.take()).toBe('go')
    expect(await pacer.take()).toBe('go')
    expect(await pacer.take()).toBe('capped')
    expect(pacer.callsMade).toBe(2)
  })

  it('429 then ok: retry waits retryAfter, success resets streak', async () => {
    const { pacer, sleeps } = make({ minGapMs: 0 })
    await pacer.take()
    expect(pacer.onRateLimited(2000)).toBe('retry')
    await pacer.take()
    expect(sleeps).toEqual([2000])
    pacer.onSuccess()
    expect(pacer.onRateLimited()).toBe('retry')
    expect(pacer.paused).toBe(false)
    await pacer.take()
    expect(sleeps).toEqual([2000, 60_000])
  })

  it('two 429s in a row pause', () => {
    const { pacer } = make()
    expect(pacer.onRateLimited()).toBe('retry')
    expect(pacer.onRateLimited()).toBe('pause')
    expect(pacer.paused).toBe(true)
  })
})

describe('defaultDailyCap', () => {
  it('is half the limit, else 100', () => {
    expect(defaultDailyCap(1000)).toBe(500)
    expect(defaultDailyCap()).toBe(100)
  })
})
