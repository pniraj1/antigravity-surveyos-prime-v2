import { describe, it, expect } from 'vitest'
import { filterAndGroupClaims } from '../group-claims'
import type { SyncClaimSummary } from '../types'

const claim = (over: Partial<SyncClaimSummary>): SyncClaimSummary => ({
  claimId: 'c',
  label: 'MH12AB1234 - HDFC ERGO',
  vehicleNumber: 'MH12AB1234',
  insuranceCompany: 'HDFC ERGO',
  modelMake: 'Maruti Swift',
  status: 'open',
  totalDocs: 3,
  receivedDocs: 2,
  ...over,
})

describe('filterAndGroupClaims', () => {
  it('groups by insurer and sorts groups alphabetically', () => {
    const claims = [
      claim({ claimId: 'a', insuranceCompany: 'ICICI Lombard', vehicleNumber: 'MH01' }),
      claim({ claimId: 'b', insuranceCompany: 'HDFC ERGO', vehicleNumber: 'MH02' }),
      claim({ claimId: 'c', insuranceCompany: 'HDFC ERGO', vehicleNumber: 'MH03' }),
    ]
    const groups = filterAndGroupClaims(claims, '')
    expect(groups.map((g) => g.insurer)).toEqual(['HDFC ERGO', 'ICICI Lombard'])
    expect(groups[0].claims).toHaveLength(2)
    expect(groups[1].claims).toHaveLength(1)
  })

  it('filters case-insensitively by vehicle number', () => {
    const claims = [
      claim({ claimId: 'a', vehicleNumber: 'MH12AB1234' }),
      claim({ claimId: 'b', vehicleNumber: 'DL09CX9999', insuranceCompany: 'ICICI Lombard' }),
    ]
    const groups = filterAndGroupClaims(claims, 'dl09')
    expect(groups).toHaveLength(1)
    expect(groups[0].claims[0].claimId).toBe('b')
  })

  it('filters by insurer and by model/label too', () => {
    const claims = [
      claim({ claimId: 'a', modelMake: 'Tata Ace', insuranceCompany: 'HDFC ERGO' }),
      claim({ claimId: 'b', modelMake: 'Maruti Swift', insuranceCompany: 'ICICI Lombard' }),
    ]
    expect(filterAndGroupClaims(claims, 'icici')).toHaveLength(1)
    expect(filterAndGroupClaims(claims, 'tata')[0].claims[0].claimId).toBe('a')
  })

  it('drops empty groups and returns [] when nothing matches', () => {
    const claims = [claim({ claimId: 'a', vehicleNumber: 'MH12AB1234' })]
    expect(filterAndGroupClaims(claims, 'zzz')).toEqual([])
  })

  it('trims and ignores whitespace-only queries', () => {
    const claims = [claim({ claimId: 'a' }), claim({ claimId: 'b' })]
    expect(filterAndGroupClaims(claims, '   ')).toHaveLength(1) // one insurer group, both claims
    expect(filterAndGroupClaims(claims, '   ')[0].claims).toHaveLength(2)
  })
})
