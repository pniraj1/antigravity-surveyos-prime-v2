// src/lib/documents/folder.ts
/**
 * Bytes on disk. Wraps the File System Access API around the naming rules.
 * Browser-only; no unit tests (needs a real handle) — exercised manually.
 */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { MULTI_FILE_TYPES } from '@/types/documents';
import { getStoredRootHandle, ensureReadWrite, getDeviceLabel } from '@/lib/local-sync/directory-handle';
import { addDocuments, claimDocuments, newDocId, replaceByType, onThisDevice } from './index-ops';
import { folderNameFor, oldNameFor, relPathsFor } from './naming';

export class NoFolderError extends Error { constructor() { super('No claim folder is connected.'); } }
export class PermissionDeniedError extends Error { constructor() { super('Folder access was not granted.'); } }
export class NotOnThisDeviceError extends Error { constructor(where: string[]) { super(`This file is on ${where.join(', ') || 'another device'}.`); } }

export interface FolderInput { blob: Blob; name?: string }

async function root(): Promise<FileSystemDirectoryHandle> {
  const handle = await getStoredRootHandle();
  if (!handle) throw new NoFolderError();
  if (!(await ensureReadWrite(handle))) throw new PermissionDeniedError();
  return handle;
}

async function dirFor(rootHandle: FileSystemDirectoryHandle, segments: string[], create: boolean) {
  let dir = rootHandle;
  for (const seg of segments) dir = await dir.getDirectoryHandle(seg, { create });
  return dir;
}

async function writeFile(claimDir: FileSystemDirectoryHandle, relPath: string, blob: Blob) {
  const parts = relPath.split('/');
  const dir = await dirFor(claimDir, parts.slice(0, -1), true);
  const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

/** Rename by copy+delete — FileSystemFileHandle.move() is not everywhere yet. */
async function renameFile(claimDir: FileSystemDirectoryHandle, from: string, to: string) {
  const fromParts = from.split('/');
  const dir = await dirFor(claimDir, fromParts.slice(0, -1), false);
  const file = await (await dir.getFileHandle(fromParts[fromParts.length - 1])).getFile();
  await writeFile(claimDir, to, file);
  await dir.removeEntry(fromParts[fromParts.length - 1]);
}

export async function writeDocuments(
  claim: ClaimData,
  type: DocType,
  files: FolderInput[],
  source: ClaimDocument['source'],
): Promise<{ claim: ClaimData; written: ClaimDocument[] }> {
  if (files.length === 0) return { claim, written: [] };
  const rootHandle = await root();
  const folder = folderNameFor(claim);
  const claimDir = await rootHandle.getDirectoryHandle(folder, { create: true });
  const device = await getDeviceLabel();
  const existing = claimDocuments(claim);

  // Single-file types: the new batch replaces; old files step aside as "(old)".
  let next: ClaimData = { ...claim, documentsFolder: folder };
  let replaced: ClaimDocument[] = [];
  if (!MULTI_FILE_TYPES.has(type)) {
    const r = replaceByType(next, type, []);
    next = r.claim; replaced = r.replaced;
    const taken = new Set(claimDocuments(claim).map((d) => d.relPath));
    for (const old of replaced) {
      if (!onThisDevice(old, device)) continue;
      const to = oldNameFor(old.relPath, taken);
      taken.add(to);
      try { await renameFile(claimDir, old.relPath, to); } catch { /* already gone — nothing to keep */ }
    }
  }

  const relPaths = relPathsFor(type, files.map((f) => ({ mime: f.blob.type, name: f.name })), existing);
  const written: ClaimDocument[] = [];
  for (let i = 0; i < files.length; i++) {
    await writeFile(claimDir, relPaths[i], files[i].blob);
    written.push({
      id: newDocId(), type, relPath: relPaths[i], mime: files[i].blob.type || 'application/octet-stream',
      size: files[i].blob.size, addedAt: new Date().toISOString(), source, devices: [device],
    });
  }
  return { claim: addDocuments(next, written), written };
}

export async function readDocument(claim: ClaimData, doc: ClaimDocument): Promise<File> {
  const device = await getDeviceLabel();
  if (!onThisDevice(doc, device)) throw new NotOnThisDeviceError(doc.devices);
  const rootHandle = await root();
  const claimDir = await rootHandle.getDirectoryHandle(folderNameFor(claim));
  const parts = doc.relPath.split('/');
  const dir = await dirFor(claimDir, parts.slice(0, -1), false);
  return (await dir.getFileHandle(parts[parts.length - 1])).getFile();
}

export async function openDocument(claim: ClaimData, doc: ClaimDocument): Promise<void> {
  const file = await readDocument(claim, doc);
  const url = URL.createObjectURL(file);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function claimFolderPath(claim: ClaimData): Promise<string | null> {
  const handle = await getStoredRootHandle();
  return handle ? `${handle.name}\\${folderNameFor(claim)}` : null;
}
