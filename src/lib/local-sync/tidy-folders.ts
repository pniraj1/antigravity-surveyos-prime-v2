// ═══════════════════════════════════════════════════════════
// TIDY UP — one-time rename of folders created before the
// insurer short form (2026-09-23). Pure planning here; the
// copy/delete lives in the engine half of this file.
// ═══════════════════════════════════════════════════════════

import { claimFolderName, legacyClaimFolderName } from './nomenclature'

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

/** Directory names directly under the root. */
export async function listRootFolders(root: FileSystemDirectoryHandle): Promise<Set<string>> {
  const names = new Set<string>()
  for await (const [name, handle] of (root as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries()) {
    if (handle.kind === 'directory') names.add(name)
  }
  return names
}

interface CopiedFile { dir: string[]; name: string }

/** Every file under `dir`, one level of subfolders deep — Sync's layout. */
async function listFilesDeep(dir: FileSystemDirectoryHandle, prefix: string[] = []): Promise<CopiedFile[]> {
  const out: CopiedFile[] = []
  for await (const [name, handle] of (dir as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries()) {
    if (handle.kind === 'file') out.push({ dir: prefix, name })
    else if (prefix.length === 0) out.push(...(await listFilesDeep(handle as FileSystemDirectoryHandle, [name])))
  }
  return out
}

/**
 * Copy `from` to `to` and delete `from` — the browser has no directory rename.
 * The delete happens only when every file copied and the counts match, so a
 * failure leaves both folders intact rather than a half-moved claim.
 */
export async function renameFolder(
  root: FileSystemDirectoryHandle,
  from: string,
  to: string,
): Promise<{ copied: number }> {
  const src = await root.getDirectoryHandle(from)
  const files = await listFilesDeep(src)
  const dest = await root.getDirectoryHandle(to, { create: true })

  let copied = 0
  for (const f of files) {
    let sDir = src
    let dDir = dest
    for (const seg of f.dir) {
      sDir = await sDir.getDirectoryHandle(seg)
      dDir = await dDir.getDirectoryHandle(seg, { create: true })
    }
    const file = await (await sDir.getFileHandle(f.name)).getFile()
    const w = await (await dDir.getFileHandle(f.name, { create: true })).createWritable()
    await w.write(file)
    await w.close()
    copied++
  }

  const landed = (await listFilesDeep(dest)).length
  if (copied !== files.length || landed < files.length) {
    throw new Error(`"${from}": ${copied} of ${files.length} files copied — the old folder was left alone.`)
  }
  await root.removeEntry(from, { recursive: true })
  return { copied }
}

export interface TidyProgress { label: string; done: number; total: number }

/** Run a confirmed plan. One folder at a time; a failure stops nothing else. */
export async function runTidy(
  root: FileSystemDirectoryHandle,
  plan: TidyPlan,
  onProgress?: (p: TidyProgress) => void,
): Promise<{ renamed: number; failed: Array<{ label: string; message: string }> }> {
  let renamed = 0
  const failed: Array<{ label: string; message: string }> = []
  for (let i = 0; i < plan.rename.length; i++) {
    const c = plan.rename[i]
    onProgress?.({ label: c.label, done: i, total: plan.rename.length })
    try {
      await renameFolder(root, c.from, c.to)
      renamed++
    } catch (err) {
      failed.push({ label: c.label, message: err instanceof Error ? err.message : String(err) })
    }
  }
  onProgress?.({ label: '', done: plan.rename.length, total: plan.rename.length })
  return { renamed, failed }
}
