'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import type { ClaimDocument, DocType } from '@/types/documents';
import {
  isLocalSyncSupported, getStoredRootHandle, pickRootFolder, ensureReadWrite, getDeviceLabel, setDeviceLabel,
} from '@/lib/local-sync/directory-handle';
import { claimDocuments, removeDocument, onThisDevice } from './index-ops';
import { openDocument, claimFolderPath, NotOnThisDeviceError, PermissionDeniedError } from './folder';
import { saveDocuments } from './sink';

export function useClaimDocuments() {
  const claim = useClaimStore((s) => s.currentClaim);
  const updateClaim = useClaimStore((s) => s.updateClaim);
  const supported = isLocalSyncSupported();
  const [folder, setFolder] = useState<{ rootName: string; device: string; claimPath: string | null } | null>(null);
  const [device, setDevice] = useState('This PC');

  const refreshFolder = useCallback(async () => {
    const handle = await getStoredRootHandle().catch(() => null);
    const label = await getDeviceLabel();
    setDevice(label);
    if (!handle || !claim) { setFolder(null); return; }
    setFolder({ rootName: handle.name, device: label, claimPath: await claimFolderPath(claim) });
  }, [claim?.id, claim?.documentsFolder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (supported) void refreshFolder(); }, [supported, refreshFolder]);

  const connect = useCallback(async (deviceLabel: string) => {
    try {
      const handle = await pickRootFolder();            // user gesture: inside the button click
      if (!(await ensureReadWrite(handle))) { toast.error('Folder access was not granted.'); return; }
      await setDeviceLabel(deviceLabel);
      await refreshFolder();
      toast.success(`Claim folder connected: ${handle.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open a folder.');
    }
  }, [refreshFolder]);

  const addFiles = useCallback(async (type: DocType, files: File[]) => {
    await saveDocuments(type, files.map((f) => ({ blob: f, name: f.name })), 'upload');
  }, []);

  const open = useCallback(async (doc: ClaimDocument) => {
    if (!claim) return;
    try { await openDocument(claim, doc); }
    catch (err) {
      if (err instanceof NotOnThisDeviceError) toast.info(err.message);
      else if (err instanceof PermissionDeniedError) toast.error(err.message);
      else toast.error(`Missing here: ${doc.relPath}. It may have been moved or renamed in Explorer.`);
    }
  }, [claim]);

  const remove = useCallback((doc: ClaimDocument) => {
    if (!claim) return;
    updateClaim({ documents: removeDocument(claim, doc.id).documents });
    toast.info(`Removed from the list. The file is still on disk: ${doc.relPath}`, { duration: 5000 }); // spec D8
  }, [claim, updateClaim]);

  const documents = claim ? claimDocuments(claim).map((d) => ({ ...d, here: onThisDevice(d, device) })) : [];
  return { supported, folder, documents, connect, addFiles, open, remove };
}
