import { describe, it, expect } from 'vitest'
import { diffManifest, isDocSynced, fileKey, emptyManifest, type LocalManifest, type RemoteFile } from '../sync-manifest'

const remote = (over: Partial<RemoteFile>): RemoteFile => ({
  docId: 'd1', fileIndex: 0, docType: 'RC Book', mimeType: 'image/jpeg', fileSizeKb: 10, uploadedAt: 't0', ...over,
})

describe('diffManifest', () => {
  it('returns all remote files when local is empty', () => {
    const out = diffManifest([remote({}), remote({ fileIndex: 1 })], emptyManifest('c1'))
    expect(out).toHaveLength(2)
  })
  it('skips files already recorded with matching size + uploadedAt', () => {
    const local: LocalManifest = emptyManifest('c1')
    local.files[fileKey('d1', 0)] = { fileName: 'RC Book.jpg', relPath: 'RC Book.jpg', fileSizeKb: 10, uploadedAt: 't0' }
    const out = diffManifest([remote({})], local)
    expect(out).toEqual([])
  })
  it('re-downloads when size or uploadedAt changed', () => {
    const local: LocalManifest = emptyManifest('c1')
    local.files[fileKey('d1', 0)] = { fileName: 'RC Book.jpg', relPath: 'RC Book.jpg', fileSizeKb: 10, uploadedAt: 't0' }
    expect(diffManifest([remote({ fileSizeKb: 99 })], local)).toHaveLength(1)
    expect(diffManifest([remote({ uploadedAt: 't1' })], local)).toHaveLength(1)
  })
})

describe('isDocSynced', () => {
  it('true only when every file index of a doc is present', () => {
    const local: LocalManifest = emptyManifest('c1')
    local.files[fileKey('d1', 0)] = { fileName: 'a', relPath: 'a', fileSizeKb: 1, uploadedAt: 't' }
    expect(isDocSynced('d1', 2, local)).toBe(false) // missing index 1
    local.files[fileKey('d1', 1)] = { fileName: 'b', relPath: 'b', fileSizeKb: 1, uploadedAt: 't' }
    expect(isDocSynced('d1', 2, local)).toBe(true)
  })
  it('false for a doc with zero files', () => {
    expect(isDocSynced('d9', 0, emptyManifest('c1'))).toBe(false)
  })
})
