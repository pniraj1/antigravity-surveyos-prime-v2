'use client';

// ═══════════════════════════════════════════════════════════
// useLocalSync — folder connection + sync actions for the UI.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  isLocalSyncSupported, getStoredRootHandle, pickRootFolder, ensureReadWrite,
} from './directory-handle'
import { syncClaim, syncAllClaims, type SyncProgress } from './sync-engine'
import type { SyncClaimSummary } from '@/lib/sync-bridge/types'
import { getClaimRecordedDocs } from './local-source'
import { claimSyncState, type ClaimSyncState } from './sync-manifest'

interface ClaimRef {
  claimId: string; vehicleNumber: string; insuranceCompany: string; label: string
}

export function useLocalSync(token: string) {
  const supported = isLocalSyncSupported()
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [claimStatus, setClaimStatus] = useState<Record<string, { state: ClaimSyncState; newCount: number }>>({})

  useEffect(() => {
    if (!supported) return
    getStoredRootHandle().then(setRoot).catch(() => setRoot(null))
  }, [supported])

  /** Ensure we have a permitted root folder, prompting once if needed. */
  const ensureRoot = useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
    let handle = root
    if (!handle) {
      try { handle = await pickRootFolder(); setRoot(handle) }
      catch (err) { toast.error(err instanceof Error ? err.message : 'Could not open a folder.'); return null }
    }
    if (!(await ensureReadWrite(handle))) {
      toast.error('Folder access was not granted.')
      return null
    }
    return handle
  }, [root])

  /** Read each claim's local manifest (disk only) and classify it for the list tick. */
  const loadClaimStatuses = useCallback(async (claims: readonly SyncClaimSummary[]) => {
    if (!root) { setClaimStatus({}); return }
    const entries = await Promise.all(claims.map(async (c) => {
      const recorded = await getClaimRecordedDocs(root, c)
      return [c.claimId, {
        state: claimSyncState(recorded, c.receivedDocs),
        newCount: Math.max(0, c.receivedDocs - recorded),
      }] as const
    }))
    setClaimStatus(Object.fromEntries(entries))
  }, [root])

  const runSyncClaim = useCallback(async (claim: ClaimRef) => {
    if (!token) return
    const handle = await ensureRoot()
    if (!handle) return
    setBusy(true)
    try {
      const res = await syncClaim(token, handle, claim, setProgress)
      toast.success(
        `Synced ${res.downloaded} file${res.downloaded === 1 ? '' : 's'} to your folder` +
        (res.failed ? ` (${res.failed} failed)` : '.'),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }, [token, ensureRoot])

  const runSyncAll = useCallback(async (claims: readonly SyncClaimSummary[]) => {
    if (!token) return
    const handle = await ensureRoot()
    if (!handle) return
    setBusy(true)
    try {
      const res = await syncAllClaims(token, handle, claims, (i, total, label) =>
        setProgress({ claimLabel: `${label} (${i}/${total})`, done: 0, total: 0, failed: 0 }),
      )
      toast.success(
        `Synced ${res.downloaded} file${res.downloaded === 1 ? '' : 's'}` +
        (res.skipped ? `; ${res.skipped} claim${res.skipped === 1 ? '' : 's'} already up to date` : '') +
        (res.failed ? ` (${res.failed} failed)` : '') + '.',
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync-all failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }, [token, ensureRoot])

  return { supported, connected: !!root, busy, progress, root, claimStatus, runSyncClaim, runSyncAll, ensureRoot, loadClaimStatuses }
}
