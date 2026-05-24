'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDriveToken, getOrCreateClaimFolder, listFilesInFolder } from '@/lib/drive';
import { getDriveFileCache, setDriveFileCache, type DriveFileCacheEntry } from '@/lib/storage/indexeddb';
import { logger } from '@/lib/utils/logger';

interface UseClaimDriveFilesResult {
  files: DriveFileCacheEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Stale-while-revalidate hook for listing Drive files in a claim's folder.
 * Returns cached data immediately, then fetches fresh data from Drive in background.
 * If Drive is not connected, returns cached data only (not an error).
 */
export function useClaimDriveFiles(claimId: string | null): UseClaimDriveFilesResult {
  const [files, setFiles] = useState<DriveFileCacheEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!claimId) {
      setFiles([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      // 1. Read from IDB cache immediately
      try {
        const cached = await getDriveFileCache(claimId);
        if (cached && !cancelled) {
          setFiles(cached);
        }
      } catch {
        // IDB read failed — non-fatal, proceed to Drive fetch
      }

      // 2. If Drive is connected, fetch fresh list
      if (!getDriveToken()) {
        // Not connected — cached data is all we have, no error
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const folderId = await getOrCreateClaimFolder(claimId, claimId);
        const freshFiles = await listFilesInFolder(folderId);
        if (!cancelled) {
          setFiles(freshFiles);
          setError(null);
          // Update IDB cache
          await setDriveFileCache(claimId, freshFiles);
          logger.log(`[Drive] Refreshed file list for claim ${claimId}: ${freshFiles.length} files`);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch Drive files';
          setError(msg);
          logger.error(`[Drive] File list fetch failed for claim ${claimId}:`, err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [claimId, refreshKey]);

  return { files, loading, error, refresh };
}
