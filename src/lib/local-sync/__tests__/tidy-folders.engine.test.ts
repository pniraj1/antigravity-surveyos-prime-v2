// The assertion that carries this feature is that removeEntry was NOT called.
// Everything below exists to put renameFolder in a situation where a careless
// implementation would delete the surveyor's only copy of a claim's evidence.

import { describe, it, expect } from 'vitest'
import { renameFolder, runTidy } from '../tidy-folders'

/** A folder tree. A string is a file; its length is its size. */
type Tree = { [name: string]: string | Tree }

const notFound = (name: string) =>
  Object.assign(new Error(`"${name}" not found`), { name: 'NotFoundError' })

/**
 * An in-memory File System Access root. Mutates `tree` exactly as the real
 * handles would, and records every removeEntry call on `removed`.
 * `truncate` names one file whose write lands one byte short — a cloud
 * placeholder that read short, or a full disk.
 * `stealDuringCopy` names a file under `A` that vanishes the first time the
 * copy reads a source file — Prime writing to the same folder mid-tidy.
 */
function makeRoot(tree: Tree, opts: { truncate?: string; stealDuringCopy?: string } = {}) {
  const removed: string[] = []
  let stolen = false

  const fileHandle = (parent: Tree, name: string) => ({
    kind: 'file' as const,
    getFile: async () => {
      const contents = parent[name]
      if (typeof contents !== 'string') throw notFound(name)
      return { size: contents.length, contents } as unknown as File
    },
    createWritable: async () => ({
      write: async (data: unknown) => {
        const contents = (data as { contents: string }).contents
        parent[name] = name === opts.truncate ? contents.slice(0, -1) : contents
      },
      close: async () => {},
    }),
  })

  const dirHandle = (node: Tree, path: string): FileSystemDirectoryHandle => ({
    kind: 'directory',
    async *entries() {
      for (const [name, value] of Object.entries(node)) {
        yield [name, typeof value === 'string' ? fileHandle(node, name) : dirHandle(value, `${path}${name}/`)]
      }
    },
    async getDirectoryHandle(name: string, o?: { create?: boolean }) {
      const value = node[name]
      if (value === undefined) {
        if (!o?.create) throw notFound(name)
        const fresh: Tree = {}
        node[name] = fresh
        return dirHandle(fresh, `${path}${name}/`)
      }
      if (typeof value === 'string') throw new TypeError(`"${name}" is a file`)
      return dirHandle(value, `${path}${name}/`)
    },
    async getFileHandle(name: string, o?: { create?: boolean }) {
      if (opts.stealDuringCopy && path === 'A/' && !stolen) {
        stolen = true
        delete node[opts.stealDuringCopy]
      }
      if (node[name] === undefined) {
        if (!o?.create) throw notFound(name)
        node[name] = ''
      }
      return fileHandle(node, name)
    },
    async removeEntry(name: string) {
      removed.push(`${path}${name}`)
      if (node[name] === undefined) throw notFound(name)
      delete node[name]
    },
  } as unknown as FileSystemDirectoryHandle)

  return { root: dirHandle(tree, ''), removed, tree }
}

/** A tree nested `depth` levels below `A`, with one file at the bottom. */
const deepTree = (depth: number): Tree => {
  let node: Tree = { 'IMG.jpg': 'bytes' }
  for (let i = depth; i > 0; i--) node = { [`level ${i}`]: node }
  return { A: node }
}

describe('renameFolder', () => {
  it('copies a folder with a subfolder, verifies it, and removes the source once', async () => {
    const { root, removed, tree } = makeRoot({
      A: { 'RC Book.pdf': 'rc-bytes', 'Damage Photos': { 'Damage Photos 1.jpg': 'photo-bytes' } },
    })
    const before = structuredClone(tree.A)

    expect(await renameFolder(root, 'A', 'B')).toEqual({ copied: 2 })
    expect(removed).toEqual(['A'])
    expect(tree.A).toBeUndefined()
    expect(tree.B).toEqual(before)
  })

  it('copies a file nested two levels deep rather than deleting it unseen', async () => {
    const { root, removed, tree } = makeRoot({
      A: { 'Damage Photos': { 'Day 2': { 'IMG.jpg': 'day-2-bytes' } } },
    })

    expect(await renameFolder(root, 'A', 'B')).toEqual({ copied: 1 })
    expect(tree.B).toEqual({ 'Damage Photos': { 'Day 2': { 'IMG.jpg': 'day-2-bytes' } } })
    expect(removed).toEqual(['A'])
  })

  // The only entry a failure may remove is the half-copy this call created;
  // `A` — the surveyor's only copy — must survive every one of these.
  it('refuses a tree deeper than it copies, and takes its half-copy with it', async () => {
    const { root, removed, tree } = makeRoot(deepTree(12))

    await expect(renameFolder(root, 'A', 'B')).rejects.toThrow('nests deeper')
    expect(removed).toEqual(['B'])
    expect(tree.A).toBeDefined()
    expect(tree.B).toBeUndefined()
  })

  it('refuses when the destination already exists, and leaves it untouched', async () => {
    const { root, removed, tree } = makeRoot({
      A: { 'RC Book.pdf': 'rc-bytes' },
      B: { 'RC Book.pdf': 'other-claims-bytes' },
    })

    await expect(renameFolder(root, 'A', 'B')).rejects.toThrow('already exists now')
    expect(removed).toEqual([])
    expect(tree.A).toEqual({ 'RC Book.pdf': 'rc-bytes' })
    expect(tree.B).toEqual({ 'RC Book.pdf': 'other-claims-bytes' })
  })

  it('refuses a short write, and takes its half-copy with it', async () => {
    const { root, removed, tree } = makeRoot(
      { A: { 'RC Book.pdf': 'rc-bytes', 'Photo.jpg': 'photo-bytes' } },
      { truncate: 'Photo.jpg' },
    )

    await expect(renameFolder(root, 'A', 'B')).rejects.toThrow('bytes copied')
    expect(removed).toEqual(['B'])
    expect(tree.A).toEqual({ 'RC Book.pdf': 'rc-bytes', 'Photo.jpg': 'photo-bytes' })
    // Left behind, the half-copy would shadow `A` for every later read.
    expect(tree.B).toBeUndefined()
  })

  it('refuses when a file vanishes mid-copy, and takes its half-copy with it', async () => {
    const { root, removed, tree } = makeRoot(
      { A: { 'RC Book.pdf': 'rc-bytes', 'Photo.jpg': 'photo-bytes' } },
      { stealDuringCopy: 'Photo.jpg' },
    )

    await expect(renameFolder(root, 'A', 'B')).rejects.toThrow('not found')
    expect(removed).toEqual(['B'])
    expect(tree.B).toBeUndefined()
  })
})

describe('runTidy', () => {
  it('carries the first folder\'s failure and still renames the second', async () => {
    const { root, removed } = makeRoot({
      A: { 'RC Book.pdf': 'rc-bytes' },
      X: { 'RC Book.pdf': 'already-there' },
      C: { 'RC Book.pdf': 'c-bytes' },
    })

    const res = await runTidy(root, {
      rename: [
        { claimId: 'c1', label: 'MH12AB1234 - HDFC', from: 'A', to: 'X' },
        { claimId: 'c2', label: 'MH34CD5678 - NIA', from: 'C', to: 'D' },
      ],
      skipped: [],
    })

    expect(res.renamed).toBe(1)
    expect(res.files).toBe(1)
    expect(res.failed).toHaveLength(1)
    expect(res.failed[0].label).toBe('MH12AB1234 - HDFC')
    expect(res.failed[0].message).toContain('already exists now')
    expect(removed).toEqual(['C'])
  })
})
