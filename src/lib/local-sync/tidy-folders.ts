// ═══════════════════════════════════════════════════════════
// TIDY UP — one-time rename of folders created before the
// insurer short form (2026-09-23). Pure planning here; the
// copy/delete lives in the engine half of this file.
//
// The invariant the engine holds: removeEntry(from) runs only
// when every file under the source — at any depth — has a
// same-size twin in a destination this call created. Anything
// unwalkable, unreadable, short or already present is a hard
// failure that leaves both folders alone. Nothing is skipped.
// ═══════════════════════════════════════════════════════════

import { claimFolderName, legacyClaimFolderName } from './nomenclature'
import { dirExists } from './local-source'

export interface TidyCandidate {
  claimId: string
  label: string
  from: string
  to: string
}

export interface TidySkip {
  label: string
  from: string
  why: 'target exists' | 'already named'
}

export interface TidyPlan {
  rename: TidyCandidate[]
  skipped: TidySkip[]
}

/**
 * Which claims have a folder on disk under the old name that could move to the
 * new one. `onDisk` is the set of directory names directly under the root.
 * Pure — the caller lists the directories and performs the moves.
 */
export function planTidy(
  claims: ReadonlyArray<{ claimId: string; label: string; vehicleNumber: string; insuranceCompany: string }>,
  onDisk: ReadonlySet<string>,
): TidyPlan {
  const rename: TidyCandidate[] = []
  const skipped: TidySkip[] = []
  const seen = new Set<string>()
  for (const c of claims) {
    const to = claimFolderName(c)
    const from = legacyClaimFolderName(c)
    if (from === to || !onDisk.has(from) || seen.has(from)) continue
    seen.add(from)
    if (onDisk.has(to)) {
      // Both names exist — the surveyor synced before and after the change.
      // Merging two manifests is not worth the risk; leave it for them.
      skipped.push({ label: c.label, from, why: 'target exists' })
      continue
    }
    rename.push({ claimId: c.claimId, label: c.label, from, to })
  }
  return { rename, skipped }
}

/** The one cast for `entries()`, which the DOM lib still does not declare. */
const entriesOf = (dir: FileSystemDirectoryHandle) =>
  (dir as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries()

/** Directory names directly under the root. */
export async function listRootFolders(root: FileSystemDirectoryHandle): Promise<Set<string>> {
  const names = new Set<string>()
  for await (const [name, handle] of entriesOf(root)) {
    if (handle.kind === 'directory') names.add(name)
  }
  return names
}

interface CopiedFile { dir: string[]; name: string }

/** Deeper than a claim folder ever nests. Beyond it we refuse rather than guess. */
const MAX_COPY_DEPTH = 8

/** Every file under `dir`, at any depth. Nothing is skipped — too deep throws. */
async function listFilesDeep(
  dir: FileSystemDirectoryHandle,
  prefix: string[] = [],
  depth = 0,
): Promise<CopiedFile[]> {
  const out: CopiedFile[] = []
  for await (const [name, handle] of entriesOf(dir)) {
    if (handle.kind === 'file') { out.push({ dir: prefix, name }); continue }
    if (depth >= MAX_COPY_DEPTH) {
      throw new Error(`"${[...prefix, name].join('/')}" nests deeper than the tidy-up copies — the folder was left alone.`)
    }
    out.push(...(await listFilesDeep(handle as FileSystemDirectoryHandle, [...prefix, name], depth + 1)))
  }
  return out
}

/**
 * Copy `from` to `to`, then delete `from` — the browser has no directory
 * rename. The delete is reached only when every source file, at any depth,
 * has a same-size twin in a destination this call created. Any doubt at all
 * throws with both folders still on disk.
 */
export async function renameFolder(
  root: FileSystemDirectoryHandle,
  from: string,
  to: string,
): Promise<{ copied: number }> {
  // The plan was made when the dialog opened; Prime writes into these same
  // folders from a path that knows nothing about it. Re-check now.
  if (await dirExists(root, to)) {
    throw new Error(`"${to}" already exists now — "${from}" was left alone.`)
  }

  const src = await root.getDirectoryHandle(from)
  const files = await listFilesDeep(src)           // throws on anything too deep
  const dest = await root.getDirectoryHandle(to, { create: true })

  for (const f of files) {
    let sDir = src
    let dDir = dest
    for (const seg of f.dir) {
      sDir = await sDir.getDirectoryHandle(seg)
      dDir = await dDir.getDirectoryHandle(seg, { create: true })
    }
    const source = await (await sDir.getFileHandle(f.name)).getFile()
    const w = await (await dDir.getFileHandle(f.name, { create: true })).createWritable()
    await w.write(source)
    await w.close()
    // A name in a listing is not evidence the bytes arrived: a cloud placeholder
    // that read short, or a full disk, both leave a file of the wrong size.
    const written = await (await dDir.getFileHandle(f.name)).getFile()
    if (written.size !== source.size) {
      throw new Error(`"${from}/${[...f.dir, f.name].join('/')}": ${written.size} of ${source.size} bytes copied — the old folder was left alone.`)
    }
  }

  // Every source file, by path and size, must be present in the destination.
  const landed = new Map((await listFilesDeep(dest)).map((f) => [[...f.dir, f.name].join('/'), f]))
  if (landed.size < files.length) {
    throw new Error(`"${from}": ${landed.size} of ${files.length} files verified — the old folder was left alone.`)
  }
  for (const f of files) {
    if (!landed.has([...f.dir, f.name].join('/'))) {
      throw new Error(`"${from}/${[...f.dir, f.name].join('/')}" is missing from the copy — the old folder was left alone.`)
    }
  }

  await root.removeEntry(from, { recursive: true })
  return { copied: files.length }
}

export interface TidyProgress { label: string; done: number; total: number }

/** Run a confirmed plan. One folder at a time; a failure stops nothing else. */
export async function runTidy(
  root: FileSystemDirectoryHandle,
  plan: TidyPlan,
  onProgress?: (p: TidyProgress) => void,
): Promise<{ renamed: number; files: number; failed: Array<{ label: string; message: string }> }> {
  let renamed = 0
  let files = 0
  const failed: Array<{ label: string; message: string }> = []
  for (let i = 0; i < plan.rename.length; i++) {
    const c = plan.rename[i]
    onProgress?.({ label: c.label, done: i, total: plan.rename.length })
    try {
      const res = await renameFolder(root, c.from, c.to)
      renamed++
      files += res.copied
    } catch (err) {
      failed.push({ label: c.label, message: err instanceof Error ? err.message : String(err) })
    }
  }
  onProgress?.({ label: '', done: plan.rename.length, total: plan.rename.length })
  return { renamed, files, failed }
}
