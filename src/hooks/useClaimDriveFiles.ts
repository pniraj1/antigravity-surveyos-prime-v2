'use client';

import { useState, useEffect, useCallback } from 'react';
import { listClaimDriveFiles } from '@/lib/drive/files';
import type { DriveFile } from '@/lib/drive/list-cache';

interface UseClaimDriveFilesResult {
  files: DriveFile[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useClaimDriveFiles(claimId: string | null): UseClaimDriveFilesResult {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listClaimDriveFiles(claimId);
      setFiles(result);
    } catch {
      setError('Could not load Drive files.');
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return { files, loading, error, refresh: fetchFiles };
}
