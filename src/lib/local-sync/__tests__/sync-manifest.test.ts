import { describe, it, expect } from 'vitest'
import { diffManifest, isDocSynced, fileKey, emptyManifest, type LocalManifest, type RemoteFile } from '../sync-manifest'
import { claimSyncState, partitionClaimsForSync } from '../sync-manifest'

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

describe('claimSyncState', () => {
  it('none when nothing recorded', () => {
    expect(claimSyncState(0, 5)).toBe('none')
  })
  it('synced when recorded >= received', () => {
    expect(claimSyncState(5, 5)).toBe('synced')
    expect(claimSyncState(6, 5)).toBe('synced')
  })
  it('new when partially recorded', () => {
    expect(claimSyncState(2, 5)).toBe('new')
  })
  it('none when received is 0 and nothing recorded', () => {
    expect(claimSyncState(0, 0)).toBe('none')
  })
})

describe('partitionClaimsForSync', () => {
  const claims = [
    { claimId: 'a', receivedDocs: 3 },
    { claimId: 'b', receivedDocs: 2 },
    { claimId: 'c', receivedDocs: 4 },
  ]
  it('skips claims whose recorded count covers receivedDocs', () => {
    const recorded = new Map([['a', 3], ['b', 0], ['c', 2]])
    const { toSync, skipped } = partitionClaimsForSync(claims, recorded)
    expect(skipped.map((c) => c.claimId)).toEqual(['a'])
    expect(toSync.map((c) => c.claimId)).toEqual(['b', 'c'])
  })
  it('syncs everything when nothing recorded', () => {
    const { toSync, skipped } = partitionClaimsForSync(claims, new Map())
    expect(skipped).toEqual([])
    expect(toSync).toHaveLength(3)
  })
})
