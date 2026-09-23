import { describe, it, expect } from 'vitest'
import { resolveSyncFolderName } from '../local-source'

const SHORT = 'MH12AB1234 - HDFC'
const LEGACY = 'MH12AB1234 - HDFC ERGO'
const CLAIM = { vehicleNumber: 'MH12AB1234', insuranceCompany: 'HDFC ERGO' }

const notFound = () => Object.assign(new Error('missing'), { name: 'NotFoundError' })

/** The resolver only ever calls getDirectoryHandle, so that is the whole stub. */
const rootWith = (present: string[]) => ({
  getDirectoryHandle: async (n: string) => {
    if (!present.includes(n)) throw notFound()
    return {} as FileSystemDirectoryHandle
  },
}) as unknown as FileSystemDirectoryHandle

describe('resolveSyncFolderName', () => {
  it('returns the legacy name when only the pre-2026-09 folder is on disk', async () => {
    expect(await resolveSyncFolderName(rootWith([LEGACY]), CLAIM)).toBe(LEGACY)
  })

  it('returns the short name when only the short folder is on disk', async () => {
    expect(await resolveSyncFolderName(rootWith([SHORT]), CLAIM)).toBe(SHORT)
  })

  it('prefers the short name when both exist', async () => {
    expect(await resolveSyncFolderName(rootWith([SHORT, LEGACY]), CLAIM)).toBe(SHORT)
  })

  it('returns the short name when neither exists', async () => {
    expect(await resolveSyncFolderName(rootWith([]), CLAIM)).toBe(SHORT)
  })

  it('probes once when the short name equals the legacy one', async () => {
    let calls = 0
    const root = {
      getDirectoryHandle: async () => { calls++; throw notFound() },
    } as unknown as FileSystemDirectoryHandle
    const claim = { vehicleNumber: 'MH12AB1234', insuranceCompany: 'NIA' }
    expect(await resolveSyncFolderName(root, claim)).toBe('MH12AB1234 - NIA')
    expect(calls).toBe(1)
  })

  it('rejects rather than forking the folder when the probe is not a NotFoundError', async () => {
    const root = {
      getDirectoryHandle: async () => {
        throw Object.assign(new Error('locked'), { name: 'NotAllowedError' })
      },
    } as unknown as FileSystemDirectoryHandle
    await expect(resolveSyncFolderName(root, CLAIM)).rejects.toThrow('locked')
  })
})
