import { describe, it, expect } from 'vitest'
import { sanitizeSegment, claimFolderName, extFor, placeFile } from '../nomenclature'

describe('sanitizeSegment', () => {
  it('removes Windows-illegal characters and trims dots/spaces', () => {
    expect(sanitizeSegment('RC: Book?/*')).toBe('RC Book')
    expect(sanitizeSegment('  trailing.  ')).toBe('trailing')
    expect(sanitizeSegment('a\\b|c')).toBe('a b c')
  })
  it('falls back to the provided default when empty', () => {
    expect(sanitizeSegment('***', 'document')).toBe('document')
  })
})

describe('claimFolderName', () => {
  it('joins vehicle and insurer, sanitized', () => {
    expect(claimFolderName({ vehicleNumber: 'MH12AB1234', insuranceCompany: 'HDFC ERGO' }))
      .toBe('MH12AB1234 - HDFC ERGO')
  })
})

describe('extFor', () => {
  it('maps common mime types', () => {
    expect(extFor('image/png')).toBe('png')
    expect(extFor('application/pdf')).toBe('pdf')
    expect(extFor('image/jpeg')).toBe('jpg')
    expect(extFor('anything/else')).toBe('jpg')
  })
})

describe('placeFile', () => {
  it('single-file slot → flat file in the claim folder', () => {
    expect(placeFile({ docType: 'RC Book', fileIndex: 0, fileCount: 1, mimeType: 'image/jpeg', docId: 'd1' }))
      .toEqual({ dir: [], fileName: 'RC Book.jpg' })
  })
  it('multi-file slot → subfolder per docType, numbered files', () => {
    expect(placeFile({ docType: 'Damage Photos', fileIndex: 0, fileCount: 3, mimeType: 'image/jpeg', docId: 'd2' }))
      .toEqual({ dir: ['Damage Photos'], fileName: 'Damage Photos 1.jpg' })
    expect(placeFile({ docType: 'Damage Photos', fileIndex: 2, fileCount: 3, mimeType: 'image/png', docId: 'd2' }))
      .toEqual({ dir: ['Damage Photos'], fileName: 'Damage Photos 3.png' })
  })
  it('empty docType falls back to "document"', () => {
    expect(placeFile({ docType: '   ', fileIndex: 0, fileCount: 1, mimeType: 'application/pdf', docId: 'd3' }))
      .toEqual({ dir: [], fileName: 'document.pdf' })
  })
})
