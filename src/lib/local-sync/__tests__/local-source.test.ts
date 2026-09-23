import { describe, it, expect } from 'vitest'
import { localRelPath } from '../local-source'

describe('localRelPath', () => {
  it('matches the engine placement for a single-file doc', () => {
    expect(localRelPath(
      { vehicleNumber: 'MH12AB1234', insuranceCompany: 'HDFC ERGO' },
      { docType: 'RC Book', fileIndex: 0, fileCount: 1, mimeType: 'image/jpeg', docId: 'd1' },
      'MH12AB1234 - HDFC',
    )).toEqual(['MH12AB1234 - HDFC', 'RC Book.jpg'])
  })
  it('matches the engine placement for a multi-file doc', () => {
    expect(localRelPath(
      { vehicleNumber: 'MH12AB1234', insuranceCompany: 'HDFC ERGO' },
      { docType: 'Damage Photos', fileIndex: 1, fileCount: 3, mimeType: 'image/png', docId: 'd2' },
      'MH12AB1234 - HDFC',
    )).toEqual(['MH12AB1234 - HDFC', 'Damage Photos', 'Damage Photos 2.png'])
  })
})
