'use client';

// ═══════════════════════════════════════════════════════════
// useLocalSync — folder connection + sync actions for the UI.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  isLocalSyncSupported, getStoredRootHandle, pickRootFolder, ensureReadWrite,
} from './directory-handle'
import { syncClaim, syncAllClaims, type SyncProgress } from './sync-engine'
import type { SyncClaimSummary } from '@/lib/sync-bridge/types'
import { getClaimRecordedDocs } from './local-source'
import { claimSyncState, type ClaimSyncState } from './sync-manifest'
import { planTidy, listRootFolders, runTidy, type TidyPlan, type TidyProgress } from './tidy-folders'

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

  // A ref, not the state: two clicks in one tick both read a stale `tidying`,
  // and two runs over the same folders is exactly how a copy meets a delete.
  // It gates sync too — a download into a folder the tidy is about to delete
  // lands after the walk, so verification passes on a snapshot without it.
  const tidyRunning = useRef(false)

  const runSyncClaim = useCallback(async (claim: ClaimRef) => {
    if (tidyRunning.current) return
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
    if (tidyRunning.current) return
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

  const [tidyPlan, setTidyPlan] = useState<TidyPlan | null>(null)
  // The folder the plan was made against. ensureRoot() may re-prompt and hand
  // back a different one; renaming there would act on names never listed.
  const tidyRoot = useRef<FileSystemDirectoryHandle | null>(null)

  /** Look for folders still under the pre-2026-09-23 name. Cheap: one directory listing. */
  const checkTidy = useCallback(async (claims: readonly SyncClaimSummary[]) => {
    if (!root || claims.length === 0) { setTidyPlan(null); return }
    try {
      const onDisk = await listRootFolders(root)
      tidyRoot.current = root
      setTidyPlan(planTidy(claims, onDisk))
    } catch (err) {
      // A permission lapse is not "nothing to tidy" — nulling the plan would
      // make the two look identical. Keep the last one and say so.
      console.warn('Could not list the sync folder to check for tidy-up:', err)
    }
  }, [root])

  const [tidyProgress, setTidyProgress] = useState<TidyProgress | null>(null)
  const [tidying, setTidying] = useState(false)

  const runTidyUp = useCallback(async (claims: readonly SyncClaimSummary[]) => {
    if (tidyRunning.current || busy) return
    if (!tidyPlan || tidyPlan.rename.length === 0) return
    tidyRunning.current = true
    setTidying(true)
    try {
      const handle = await ensureRoot()
      if (!handle) return
      if (handle !== tidyRoot.current) {
        toast.error('The folder changed — reopen this dialog and try again.')
        return
      }
      const res = await runTidy(handle, tidyPlan, setTidyProgress)
      if (res.failed.length === 0) {
        toast.success(
          `Renamed ${res.renamed} folder${res.renamed === 1 ? '' : 's'} ` +
          `(${res.files} file${res.files === 1 ? '' : 's'}) to the new naming.`,
        )
      } else {
        const shown = res.failed.slice(0, 3).map((f) => f.message).join(' ')
        const more = res.failed.length > 3 ? ` …and ${res.failed.length - 3} more.` : ''
        toast.warning(`Renamed ${res.renamed}; ${res.failed.length} left alone — ${shown}${more}`, { duration: 8000 })
      }
      // Re-plan rather than blank it: what failed stays on screen and retryable.
      setTidyPlan(planTidy(claims, await listRootFolders(handle)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not rename the folders.')
    } finally {
      tidyRunning.current = false
      setTidying(false)
      setTidyProgress(null)
    }
  }, [tidyPlan, busy, ensureRoot])

  return { supported, connected: !!root, busy, progress, root, claimStatus, runSyncClaim, runSyncAll, ensureRoot, loadClaimStatuses, tidyPlan, checkTidy, runTidyUp, tidying, tidyProgress }
}
