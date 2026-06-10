import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { redeemLinkCode, listSyncClaims, getSyncClaim, fetchSyncDocFile, fetchSyncDocFileAt, SYNC_WORKER_URL } from '../client'

const okJson = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) } as Response)

describe('redeemLinkCode', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('POSTs code + uid and returns the bridge token', async () => {
    const fetchMock = vi.fn().mockReturnValue(okJson({ bridgeToken: 'tok-123' }))
    vi.stubGlobal('fetch', fetchMock)

    const token = await redeemLinkCode('ABCD1234', 'uid-9')

    expect(token).toBe('tok-123')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${SYNC_WORKER_URL}/api/bridge/redeem`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ code: 'ABCD1234', firebaseUid: 'uid-9' })
  })

  it('throws the worker error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({ ok: false, error: 'Code expired — generate a new one' }),
    } as Response))
    await expect(redeemLinkCode('X', 'uid')).rejects.toThrow('Code expired')
  })
})

describe('listSyncClaims', () => {
  it('sends the bridge token as a Bearer and returns claims', async () => {
    const fetchMock = vi.fn().mockReturnValue(okJson([{ claimId: 'c1', label: 'MH12 - HDFC' }]))
    vi.stubGlobal('fetch', fetchMock)

    const claims = await listSyncClaims('tok-123')

    expect(claims).toHaveLength(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${SYNC_WORKER_URL}/api/bridge/claims`)
    expect(init.headers.Authorization).toBe('Bearer tok-123')
  })
})

describe('getSyncClaim', () => {
  it('fetches claim detail for the given claimId', async () => {
    const fetchMock = vi.fn().mockReturnValue(
      okJson({ claimId: 'c1', vehicleNumber: 'MH12AB1234', insuranceCompany: 'HDFC', modelMake: 'Swift', documents: [] })
    )
    vi.stubGlobal('fetch', fetchMock)

    const detail = await getSyncClaim('tok-abc', 'c1')

    expect(detail.claimId).toBe('c1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${SYNC_WORKER_URL}/api/bridge/claims/c1`)
    expect(init.headers.Authorization).toBe('Bearer tok-abc')
  })
})

describe('fetchSyncDocFile', () => {
  it('returns a File built from the streamed blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
      headers: new Headers({ 'Content-Type': 'image/jpeg' }),
    } as unknown as Response))

    const file = await fetchSyncDocFile('tok', 'c1', 'd1', 'RC Book')

    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('image/jpeg')
    expect(file.name).toMatch(/^RC Book\.(jpg|jpeg)$/)
    expect(file.size).toBe(3)
  })

  it('throws when the worker returns a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      blob: () => Promise.resolve(new Blob()),
      headers: new Headers(),
    } as unknown as Response))

    await expect(fetchSyncDocFile('tok', 'c1', 'd1', 'RC Book'))
      .rejects.toThrow('Could not download')
  })
})

describe('fetchSyncDocFileAt', () => {
  it('GETs the per-file route with the bearer token and wraps a numbered File', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
      headers: new Headers({ 'Content-Type': 'image/jpeg' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const file = await fetchSyncDocFileAt('tok', 'c1', 'd1', 2, 'Damage Photos')

    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('image/jpeg')
    expect(file.name).toMatch(/^Damage Photos 3\.(jpg|jpeg)$/) // index 2 → human #3
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${SYNC_WORKER_URL}/api/bridge/file/c1/d1/2`)
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
  })
})
