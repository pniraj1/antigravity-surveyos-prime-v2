// src/lib/documents/folder.ts
/**
 * Bytes on disk. Wraps the File System Access API around the naming rules.
 * Browser-only; no unit tests (needs a real handle) — exercised manually.
 */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { MULTI_FILE_TYPES } from '@/types/documents';
import { getStoredRootHandle, ensureReadWrite, getDeviceLabel } from '@/lib/local-sync/directory-handle';
import { addDocuments, claimDocuments, newDocId, removeDocument, onThisDevice, isDiscardablePlaceholder } from './index-ops';
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

/** True when a file is already on disk at relPath (never creates anything). */
async function exists(claimDir: FileSystemDirectoryHandle, relPath: string): Promise<boolean> {
  try {
    const parts = relPath.split('/');
    const dir = await dirFor(claimDir, parts.slice(0, -1), false);
    await dir.getFileHandle(parts[parts.length - 1]);
    return true;
  } catch { return false; }
}

/** Best-effort cleanup of a partial/orphaned file — never throws. */
async function removeQuiet(claimDir: FileSystemDirectoryHandle, relPath: string) {
  try {
    const parts = relPath.split('/');
    const dir = await dirFor(claimDir, parts.slice(0, -1), false);
    await dir.removeEntry(parts[parts.length - 1]);
  } catch { /* nothing to clean up */ }
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
  const inputs = files.map((f) => ({ mime: f.blob.type, name: f.name }));
  let relPaths = relPathsFor(type, inputs, existing);
  const taken = new Set(existing.map((d) => d.relPath));

  // 0. Files on disk the index does not know about (another device's copy, or
  //    dropped in by hand) are never overwritten.
  //    ponytail: probes only the target names, not a directory listing.
  if (MULTI_FILE_TYPES.has(type)) {
    // Numbered types skip past whatever is already there.
    const seen = [...existing];
    for (let guard = 0; guard < 1000; guard++) {
      const clashes = await Promise.all(relPaths.map((p) => exists(claimDir, p)));
      if (!clashes.some(Boolean)) break;
      relPaths.forEach((relPath, i) => { if (clashes[i]) seen.push({ id: '', type, relPath, mime: '', size: 0, addedAt: '', source, devices: [] }); });
      relPaths = relPathsFor(type, inputs, seen);
    }
  } else {
    // Single-file types keep the stranger as "(old)"; indexed entries on this device are renamed in step 2.
    for (const p of relPaths) {
      if (existing.some((d) => d.relPath === p && onThisDevice(d, device))) continue; // step 2 renames it
      if (!(await exists(claimDir, p))) continue;
      const to = oldNameFor(p, taken);
      taken.add(to);
      try { await renameFile(claimDir, p, to); } catch { /* leave it; the .part promotion will overwrite */ }
    }
  }

  // 1. Write every new file to a `.part` sibling. Nothing on disk or in the index
  //    changes until all of these land — a failing write orphans nothing.
  const partPaths = relPaths.map((p) => `${p}.part`);
  const partsWritten: string[] = [];
  try {
    for (let i = 0; i < files.length; i++) {
      await writeFile(claimDir, partPaths[i], files[i].blob);
      partsWritten.push(partPaths[i]);
    }
  } catch (err) {
    for (const p of partsWritten) await removeQuiet(claimDir, p);
    throw err;
  }

  // 2. Single-file types: only entries on this device can be replaced (their files
  //    can be renamed here). Entries on other devices stay in the index untouched.
  let next: ClaimData = { ...claim, documentsFolder: folder };
  if (!MULTI_FILE_TYPES.has(type)) {
    const incomingMime = files[0]?.blob.type ?? '';
    const replaced = existing.filter((d) => d.type === type && onThisDevice(d, device));
    next = replaced.reduce((c, d) => removeDocument(c, d.id), next);
    for (const old of replaced) {
      if (isDiscardablePlaceholder(old, incomingMime)) {
        await removeQuiet(claimDir, old.relPath); // our own print-time HTML; the real document replaces it
        continue;
      }
      const to = oldNameFor(old.relPath, taken);
      taken.add(to);
      try { await renameFile(claimDir, old.relPath, to); } catch { /* already gone — nothing to keep */ }
    }
  }

  // 3. Promote the new files into place.
  const written: ClaimDocument[] = [];
  for (let i = 0; i < files.length; i++) {
    await renameFile(claimDir, partPaths[i], relPaths[i]);
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

const INLINE_MIME = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/;

/** PDFs and images open in a tab; everything else (HTML included) downloads — a blob URL must never run as a page. */
export async function openDocument(claim: ClaimData, doc: ClaimDocument): Promise<void> {
  const file = await readDocument(claim, doc);
  const url = URL.createObjectURL(file);
  if (!INLINE_MIME.test(file.type || doc.mime)) {
    const a = Object.assign(document.createElement('a'), { href: url, download: doc.relPath.split('/').pop() ?? doc.relPath });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — allow popups for this site.');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function claimFolderPath(claim: ClaimData): Promise<string | null> {
  const handle = await getStoredRootHandle();
  return handle ? `${handle.name}\\${folderNameFor(claim)}` : null;
}
