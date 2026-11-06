// src/lib/documents/folder.ts
/**
 * Bytes on disk. Wraps the File System Access API around the naming rules.
 * Browser-only; no unit tests (needs a real handle) — exercised manually.
 */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { MULTI_FILE_TYPES } from '@/types/documents';
import { getStoredRootHandle, ensureReadWrite, getDeviceLabel } from '@/lib/local-sync/directory-handle';
import { addDocuments, claimDocuments, newDocId, removeDocument, onThisDevice, addDeviceTo, replaceableEntries } from './index-ops';
import { folderNameFor, relPathsFor, docTypeFromRelPath, isScanSkippable, staleUploads } from './naming';
import { fingerprintOf, reconcileKnown } from './kit/fingerprint';
import { pageCountOf } from './kit/page-text';
import { getAllClaims } from '@/lib/storage/indexeddb';
import { getClaimFolderHandle, verifyHandlePermission, getClaimFolderPath } from '@/lib/storage/claim-folder-store';

export class NoFolderError extends Error { constructor() { super('No claim folder is connected.'); } }
export class PermissionDeniedError extends Error { constructor() { super('Folder access was not granted.'); } }
export class NotOnThisDeviceError extends Error { constructor(where: string[]) { super(`This file is on ${where.join(', ') || 'another device'}.`); } }

export interface FolderInput { blob: Blob; name?: string; /** Recorded on the document: the file is already on Drive. */ driveFileId?: string }

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

/** File size in bytes if file exists on disk, or null if missing. */
async function getFileSize(claimDir: FileSystemDirectoryHandle, relPath: string): Promise<number | null> {
  try {
    const parts = relPath.split('/');
    const dir = await dirFor(claimDir, parts.slice(0, -1), false);
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    const file = await fh.getFile();
    return file.size;
  } catch { return null; }
}

/** Best-effort cleanup of a partial/orphaned file — never throws. */
async function removeQuiet(claimDir: FileSystemDirectoryHandle, relPath: string) {
  try {
    const parts = relPath.split('/');
    const dir = await dirFor(claimDir, parts.slice(0, -1), false);
    await dir.removeEntry(parts[parts.length - 1]);
  } catch { /* nothing to clean up */ }
}

/**
 * The folder name a claim should use, with collisions resolved. Two accidents
 * on the same truck with the same insurer produce the same base name; the
 * second claim gets ` - 2` so their files never mix. Runs once per claim —
 * `documentsFolder` is sticky after the first write.
 */
export async function resolveFolderName(
  claim: ClaimData,
  rootHandle?: FileSystemDirectoryHandle,
): Promise<string> {
  if (claim.documentsFolder) return claim.documentsFolder;
  const base = folderNameFor(claim);
  // No folder on disk under this name means nobody to collide with — and saves
  // reading every claim (and its photo data URLs) out of IndexedDB.
  const handle = rootHandle ?? (await getStoredRootHandle().catch(() => null));
  if (handle) {
    try { await handle.getDirectoryHandle(base); } catch { return base; }
  }
  let taken = new Set<string>();
  try {
    const all = await getAllClaims();
    taken = new Set(all.filter((c) => c.id !== claim.id && c.documentsFolder).map((c) => c.documentsFolder as string));
  } catch {
    return base; // no claim store available — the base name is still better than nothing
  }
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base} - ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base} - ${claim.id.slice(-6)}`;
}

export async function writeDocuments(
  claim: ClaimData,
  type: DocType,
  files: FolderInput[],
  source: ClaimDocument['source'],
): Promise<{ claim: ClaimData; written: ClaimDocument[] }> {
  if (files.length === 0) return { claim, written: [] };
  const claimDir = await getClaimDirHandle(claim, true);
  if (!claimDir) throw new NoFolderError();
  const folder = claimDir.name;
  const device = await getDeviceLabel();
  const existing = claimDocuments(claim);
  const inputs = files.map((f) => ({ mime: f.blob.type, name: f.name }));
  let relPaths = relPathsFor(type, inputs, existing);
  // 0. Multi-file types skip past whatever is already there.
  //    Single-file types silently replace any existing or stranger file on disk.
  if (MULTI_FILE_TYPES.has(type)) {
    // Numbered types skip past whatever is already there.
    const seen = [...existing];
    for (let guard = 0; guard < 1000; guard++) {
      const clashes = await Promise.all(relPaths.map((p) => exists(claimDir, p)));
      if (!clashes.some(Boolean)) break;
      relPaths.forEach((relPath, i) => { if (clashes[i]) seen.push({ id: '', type, relPath, mime: '', size: 0, addedAt: '', source, devices: [] }); });
      relPaths = relPathsFor(type, inputs, seen);
    }
  }

  // Deduplication check: if exact same file exists on disk, skip redundant write
  if (!MULTI_FILE_TYPES.has(type) && files.length === 1) {
    const target = relPaths[0];
    const diskSize = await getFileSize(claimDir, target);
    if (diskSize !== null && diskSize === files[0].blob.size) {
      const existingDoc = existing.find((d) => d.relPath === target && d.type === type)
        ?? existing.find((d) => d.relPath === target);
      if (existingDoc) {
        const replaced = replaceableEntries(existing, type, device).filter((d) => d.id !== existingDoc.id);
        let nextClaim = replaced.reduce((c, d) => removeDocument(c, d.id), claim);
        for (const old of replaced) {
          if (old.relPath !== target) {
            await removeQuiet(claimDir, old.relPath);
          }
        }
        nextClaim = addDeviceTo(nextClaim, existingDoc.id, device);
        const currentDoc = nextClaim.documents?.[existingDoc.id] ?? existingDoc;
        return { claim: { ...nextClaim, documentsFolder: folder }, written: [currentDoc] };
      } else {
        const doc: ClaimDocument = {
          id: newDocId(),
          type,
          relPath: target,
          mime: files[0].blob.type || 'application/octet-stream',
          size: files[0].blob.size,
          addedAt: new Date().toISOString(),
          source,
          devices: [device],
          ...(files[0].driveFileId && { driveFileId: files[0].driveFileId }),
        };
        const replaced = replaceableEntries(existing, type, device);
        let nextClaim = replaced.reduce((c, d) => removeDocument(c, d.id), claim);
        for (const old of replaced) {
          if (old.relPath !== target) {
            await removeQuiet(claimDir, old.relPath);
          }
        }
        return {
          claim: addDocuments({ ...nextClaim, documentsFolder: folder }, [doc]),
          written: [doc],
        };
      }
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

  // 2. Single-file types: replaceable entries are removed from the index.
  //    Old files with a different relative path/extension (e.g. replacing report.html
  //    with report.pdf) are marked for discard. Target file is silently replaced in step 3.
  let next: ClaimData = { ...claim, documentsFolder: folder };
  const discard: string[] = [];
  if (!MULTI_FILE_TYPES.has(type)) {
    const replaced = replaceableEntries(existing, type, device);
    next = replaced.reduce((c, d) => removeDocument(c, d.id), next);
    for (const old of replaced) {
      if (old.relPath !== relPaths[0]) {
        discard.push(old.relPath);
      }
    }
  }

  // 3. Promote the new files into place.
  const written: ClaimDocument[] = [];
  for (let i = 0; i < files.length; i++) {
    await renameFile(claimDir, partPaths[i], relPaths[i]);
    written.push({
      id: newDocId(), type, relPath: relPaths[i], mime: files[i].blob.type || 'application/octet-stream',
      size: files[i].blob.size, addedAt: new Date().toISOString(), source, devices: [device],
      ...(files[i].driveFileId && { driveFileId: files[i].driveFileId }),
    });
  }
  // The placeholder / old extension file goes only once its replacement is safely in place.
  for (const p of discard) await removeQuiet(claimDir, p);
  return { claim: addDocuments(next, written), written };
}

export async function readDocument(claim: ClaimData, doc: ClaimDocument): Promise<File> {
  const device = await getDeviceLabel();
  if (!onThisDevice(doc, device)) throw new NotOnThisDeviceError(doc.devices);
  const claimDir = await getClaimDirHandle(claim, false);
  if (!claimDir) throw new NoFolderError();
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
  const allocatedPath = await getClaimFolderPath(claim.id);
  if (allocatedPath) return allocatedPath;
  const handle = await getStoredRootHandle();
  return handle ? `${handle.name}\\${await resolveFolderName(claim, handle)}` : null;
}

/**
 * The claim's directory handle, or null when this claim has no folder yet.
 * A missing/unauthorized root folder is a different problem — that throws
 * NoFolderError / PermissionDeniedError from root() instead of being reported
 * as "no folder" here.
 */
export async function getClaimDirHandle(
  claim: ClaimData,
  create = false,
): Promise<FileSystemDirectoryHandle | null> {
  const allocated = await getClaimFolderHandle(claim.id);
  if (allocated) {
    const granted = await verifyHandlePermission(allocated, 'readwrite');
    if (!granted) throw new PermissionDeniedError();
    return allocated;
  }
  const rootHandle = await root();
  try {
    return await rootHandle.getDirectoryHandle(await resolveFolderName(claim, rootHandle), { create });
  } catch {
    return null;
  }
}

/** How many levels of subfolders a scan walks. ponytail: a flat number, not a setting — raise it if real claim folders nest deeper. */
const MAX_SCAN_DEPTH = 3;

/**
 * Every file in the claim folder, up to MAX_SCAN_DEPTH levels of subfolders deep,
 * as relative paths. Unreadable files (cloud placeholder not hydrated, locked, AV
 * scan) are skipped and counted, not thrown on; so is any folder below the depth
 * limit, so the scan never reports "nothing found" when it simply did not look.
 */
async function listFiles(
  dir: FileSystemDirectoryHandle,
  prefix = '',
  depth = 0,
): Promise<{ files: Array<{ relPath: string; file: File }>; unreadable: number; skippedDirs: number }> {
  const files: Array<{ relPath: string; file: File }> = [];
  let unreadable = 0;
  let skippedDirs = 0;
  for await (const [name, handle] of (dir.entries as () => AsyncIterableIterator<[string, FileSystemHandle]>)()) {
    if (handle.kind === 'file') {
      try {
        files.push({ relPath: `${prefix}${name}`, file: await (handle as FileSystemFileHandle).getFile() });
      } catch {
        unreadable++; // reported, never guessed at
      }
    } else if (depth + 1 < MAX_SCAN_DEPTH) {
      const sub = await listFiles(handle as FileSystemDirectoryHandle, `${prefix}${name}/`, depth + 1);
      files.push(...sub.files);
      unreadable += sub.unreadable;
      skippedDirs += sub.skippedDirs;
    } else {
      skippedDirs++; // too deep to walk — said out loud, not silently dropped
    }
  }
  return { files, unreadable, skippedDirs };
}

/**
 * Adopt whatever is already in the claim folder: files put there by hand, a
 * PDF saved straight from Chrome, a Word export, or — on a second PC whose
 * root folder was copied or cloud-synced — the files an entry already
 * describes, which stop reading "on Office PC" and start reading "here".
 * A file that cannot be read (cloud placeholder, lock, AV scan) is skipped
 * and reported in `unreadable`, never guessed at.
 *
 * Reads only. Nothing on disk is written, renamed or deleted.
 */
export async function scanClaimFolder(
  claim: ClaimData,
): Promise<{ claim: ClaimData; added: number; adopted: number; unreadable: number; skippedDirs: number; reset: string[]; changed: boolean }> {
  const dir = await getClaimDirHandle(claim);
  if (!dir) throw new NoFolderError();
  const folder = dir.name; // the folder we actually walked — never a name resolved a second time
  const device = await getDeviceLabel();
  const { files: found, unreadable, skippedDirs } = await listFiles(dir);

  // One path can hold several entries (two devices each wrote "RC Book.pdf") — adopt them all.
  const byPath = new Map<string, ClaimDocument[]>();
  for (const d of claimDocuments(claim)) byPath.set(d.relPath, [...(byPath.get(d.relPath) ?? []), d]);
  // In-memory field update only — resolveFolderName's on-disk folder is untouched; this stays read-only on disk.
  let next: ClaimData = { ...claim, documentsFolder: folder };
  const fresh: ClaimDocument[] = [];
  let adopted = 0;
  const reset: string[] = []; // relPaths whose page labels were dropped because the file changed
  let changed = claim.documentsFolder !== folder; // anything the claim record must save: the folder name, an adoption, a new file, a new or reset fingerprint

  for (const { relPath, file } of found) {
    if (isScanSkippable(relPath)) continue;
    const known = byPath.get(relPath);
    if (known) {
      for (const k of known) {
        if (!onThisDevice(k, device)) { next = addDeviceTo(next, k.id, device); adopted++; }
      }
      // The file is here now: a changed one drops the page labels made on the old one.
      // Counted from this device's own bytes, not the shared entry.pageCount; 0 = unreadable, never resets on its own.
      const pages = /\.pdf$/i.test(relPath) || file.type === 'application/pdf' ? await pageCountOf(file) : 0;
      const current = known.map((k) => next.documents?.[k.id] ?? k);
      const here = current.map((c) => (pages > 0 && c.pageCount !== pages ? { ...c, pageCount: pages } : c));
      const r = reconcileKnown(here, file, device);
      if (r.changed || here.some((h, i) => h !== current[i])) { changed = true; next = addDocuments(next, r.entries); }
      if (r.reset) reset.push(relPath);
      continue;
    }
    // C2: fingerprinted at once, so labels made before the next scan are tied to this exact file.
    const pageCount = await pageCountOf(file); // 1 for anything not a PDF; 0 = a PDF we couldn't open (unknown)
    fresh.push({
      id: newDocId(),
      type: docTypeFromRelPath(relPath),
      relPath,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      addedAt: new Date().toISOString(), // added to the list now — file.lastModified would bury it under old dates
      source: 'upload', // found on disk — never treated as a placeholder we may delete
      adopted: true,
      devices: [device],
      ...(pageCount > 0 ? { pageCount } : {}),
      fingerprints: { [device]: fingerprintOf(file, pageCount) },
    });
  }

  return { claim: addDocuments(next, fresh), added: fresh.length, adopted, unreadable, skippedDirs, reset, changed: changed || adopted > 0 || fresh.length > 0 };
}

/** Every path segment under Portal Upload/ is one plain name: no separators, never "." or "..". */
function assertPortalSafe(segments: string[]): void {
  for (const seg of segments) {
    if (!seg || /[\\/]|^\.+$/.test(seg)) throw new Error(`Unsafe name for Portal Upload: "${seg}"`);
  }
}

/**
 * Remove every file in "<claim folder>/Portal Upload/<portalTitle>/" except `keep`, so the folder holds only
 * what the current review covers. Those files are ours (C9); nothing outside that one folder is touched.
 */
export async function clearPortalUpload(claim: ClaimData, portalTitle: string, keep: string[]): Promise<void> {
  assertPortalSafe([portalTitle, ...keep]);
  const claimDir = await getClaimDirHandle(claim);
  if (!claimDir) return;
  let dir: FileSystemDirectoryHandle;
  try { dir = await dirFor(claimDir, ['Portal Upload', portalTitle], false); } catch { return; } // nothing built yet
  const names: string[] = [];
  for await (const [name, handle] of (dir.entries as () => AsyncIterableIterator<[string, FileSystemHandle]>)()) {
    if (handle.kind === 'file') names.push(name);
  }
  for (const name of staleUploads(names, keep)) await dir.removeEntry(name);
}

/**
 * Write built upload files to "<claim folder>/Portal Upload/<portalTitle>/<name>", overwriting.
 * Same .part-then-rename write as writeDocuments; touches nothing outside Portal Upload/.
 */
export async function writePortalUpload(
  claim: ClaimData,
  portalTitle: string,
  files: Array<{ name: string; blob: Blob }>,
): Promise<void> {
  assertPortalSafe([portalTitle, ...files.map((f) => f.name)]);
  const claimDir = await getClaimDirHandle(claim, true);
  if (!claimDir) throw new NoFolderError();
  const base = `Portal Upload/${portalTitle}`;
  const written: string[] = [];
  try {
    for (const f of files) {
      await writeFile(claimDir, `${base}/${f.name}.part`, f.blob);
      written.push(f.name);
    }
  } catch (err) {
    for (const n of written) await removeQuiet(claimDir, `${base}/${n}.part`);
    throw err;
  }
  for (const f of files) {
    await renameFile(claimDir, `${base}/${f.name}.part`, `${base}/${f.name}`);
  }
}
