'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import type { ClaimDocument, DocType } from '@/types/documents';
import {
  isLocalSyncSupported, getStoredRootHandle, pickRootFolder, ensureReadWrite, getDeviceLabel, setDeviceLabel,
} from '@/lib/local-sync/directory-handle';
import { claimDocuments, removeDocument, onThisDevice } from './index-ops';
import {
  openDocument, claimFolderPath, scanClaimFolder, NotOnThisDeviceError, NoFolderError, PermissionDeniedError,
} from './folder';
import { saveDocuments } from './sink';

type FolderInfo = { rootName: string; device: string; claimPath: string | null; permission: PermissionState };

export function useClaimDocuments() {
  const claim = useClaimStore((s) => s.currentClaim);
  const updateClaim = useClaimStore((s) => s.updateClaim);
  const supported = isLocalSyncSupported();
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [device, setDevice] = useState('This PC');
  const [scanning, setScanning] = useState(false);

  const claimId = claim?.id;
  const folderName = claim?.documentsFolder;
  const loadFolder = useCallback(async (): Promise<{ device: string; folder: FolderInfo | null }> => {
    const handle = await getStoredRootHandle().catch(() => null);
    const label = await getDeviceLabel();
    const current = useClaimStore.getState().currentClaim;
    if (!handle || !current) return { device: label, folder: null };
    // Only query here — requestPermission needs a click (see reconnect).
    const permission = handle.queryPermission ? await handle.queryPermission({ mode: 'readwrite' }) : 'granted';
    return { device: label, folder: { rootName: handle.name, device: label, claimPath: await claimFolderPath(current), permission } };
  }, [claimId, folderName]);

  const applyFolder = (r: { device: string; folder: FolderInfo | null }) => {
    setDevice(r.device);
    setFolder(r.folder);
  };

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    loadFolder().then((r) => { if (!cancelled) applyFolder(r); }).catch(() => { if (!cancelled) setFolder(null); });
    return () => { cancelled = true; };
  }, [supported, loadFolder]);

  const connect = useCallback(async (deviceLabel: string) => {
    try {
      const handle = await pickRootFolder();            // user gesture: inside the button click
      if (!(await ensureReadWrite(handle))) { toast.error('Folder access was not granted.'); return; }
      await setDeviceLabel(deviceLabel);
      applyFolder(await loadFolder());
      toast.success(`Claim folder connected: ${handle.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open a folder.');
    }
  }, [loadFolder]);

  const reconnect = useCallback(async () => {
    const handle = await getStoredRootHandle();
    if (!handle) return;
    if (await ensureReadWrite(handle)) applyFolder(await loadFolder());
    else toast.error('Folder access was not granted.');
  }, [loadFolder]);

  const scan = useCallback(async () => {
    if (!claim || scanning) return; // the slowest button on the tab, so also the most double-clicked
    setScanning(true);
    try {
      const handle = await getStoredRootHandle();
      if (handle && !(await ensureReadWrite(handle))) { toast.error('Folder access was not granted.'); return; }
      const { claim: next, added, adopted, unreadable, skippedDirs, reset, changed } = await scanClaimFolder(claim);
      if (changed) {
        // The walk is long; the claim may have been switched while it ran (same guard as sink.ts).
        if (useClaimStore.getState().currentClaim?.id !== claim.id) {
          toast.warning('The claim changed while scanning — nothing was added.');
          return;
        }
        // Only a real change touches the record: updateClaim marks it dirty and triggers a cloud push.
        updateClaim({ documents: next.documents, documentsFolder: next.documentsFolder });
      }
      const parts = [
        reset.length ? `${reset.length} file${reset.length === 1 ? '' : 's'} changed, page labels cleared` : '',
        added ? `${added} file${added === 1 ? '' : 's'} added` : '',
        adopted ? `${adopted} now on this PC` : '',
        unreadable ? `${unreadable} could not be read` : '',
        skippedDirs ? `${skippedDirs} subfolder${skippedDirs === 1 ? '' : 's'} too deep to scan` : '',
      ].filter(Boolean).join(', ');
      if (!parts) { toast.info('Nothing new in the claim folder.'); return; }
      if (unreadable > 0) toast.warning(`Scanned the claim folder — ${parts}.`);
      else toast.success(`Scanned the claim folder — ${parts}.`);
    } catch (err) {
      toast.error(err instanceof NoFolderError
        ? 'This claim has no folder on this PC yet.'
        : err instanceof PermissionDeniedError
          ? 'Click "Allow access" on the folder card above, then scan again.'
          : `Could not scan the folder (${err instanceof Error ? err.message : String(err)})`);
    } finally {
      setScanning(false);
    }
  }, [claim, scanning, updateClaim]);

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
  return { supported, folder, documents, connect, reconnect, addFiles, scan, scanning, open, remove };
}
