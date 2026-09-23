import { describe, it, expect } from 'vitest'
import { planTidy } from '../tidy-folders'

const claim = (over: Partial<{ claimId: string; label: string; vehicleNumber: string; insuranceCompany: string }> = {}) => ({
  claimId: 'c1', label: 'MH12AB1234 - HDFC ERGO', vehicleNumber: 'MH12AB1234', insuranceCompany: 'HDFC ERGO', ...over,
})

describe('planTidy', () => {
  it('renames a legacy folder when the new name is free', () => {
    const plan = planTidy([claim()], new Set(['MH12AB1234 - HDFC ERGO']))
    expect(plan.rename).toEqual([{ claimId: 'c1', label: 'MH12AB1234 - HDFC ERGO', from: 'MH12AB1234 - HDFC ERGO', to: 'MH12AB1234 - HDFC' }])
    expect(plan.skipped).toEqual([])
  })
  it('skips when the new name already exists', () => {
    const plan = planTidy([claim()], new Set(['MH12AB1234 - HDFC ERGO', 'MH12AB1234 - HDFC']))
    expect(plan.rename).toEqual([])
    expect(plan.skipped).toEqual([{ label: 'MH12AB1234 - HDFC ERGO', from: 'MH12AB1234 - HDFC ERGO', why: 'target exists' }])
  })
  it('ignores a claim with no folder on disk', () => {
    expect(planTidy([claim()], new Set())).toEqual({ rename: [], skipped: [] })
  })
  it('ignores a claim whose two names are the same', () => {
    const c = claim({ insuranceCompany: 'NIA' })
    expect(planTidy([c], new Set(['MH12AB1234 - NIA']))).toEqual({ rename: [], skipped: [] })
  })
  it('plans one rename when two claims share a folder name', () => {
    const plan = planTidy([claim(), claim({ claimId: 'c2' })], new Set(['MH12AB1234 - HDFC ERGO']))
    expect(plan.rename).toHaveLength(1)
  })
})
