// ═══════════════════════════════════════════════════════════
// DIRECTORY HANDLE STORE — pick a root folder, persist its handle
// in IndexedDB, and re-verify permission each session.
// ═══════════════════════════════════════════════════════════

import { openDB } from 'idb'

const DB_NAME = 'surveyos-local-sync'
const STORE = 'handles'
const ROOT_KEY = 'root'

/** True when the browser supports picking a writable folder (desktop Chromium). */
export function isLocalSyncSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE)
    },
  })
}

/** Retrieve the previously-picked root handle, or null if none stored. */
export async function getStoredRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const database = await db()
  const handle = (await database.get(STORE, ROOT_KEY)) as FileSystemDirectoryHandle | undefined
  return handle ?? null
}

/** Prompt the user to pick a root folder and persist the handle. Throws if unsupported/cancelled. */
export async function pickRootFolder(): Promise<FileSystemDirectoryHandle> {
  if (!isLocalSyncSupported()) throw new Error('This browser cannot open a local folder. Use desktop Chrome or Edge.')
  const handle = await window.showDirectoryPicker!({ mode: 'readwrite' })
  const database = await db()
  await database.put(STORE, handle, ROOT_KEY)
  return handle
}

/** Ensure readwrite permission on a handle, requesting it if needed. Returns true if granted. */
export async function ensureReadWrite(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const }
  if (!handle.queryPermission || !handle.requestPermission) return true // older impls: assume granted
  if ((await handle.queryPermission(opts)) === 'granted') return true
  return (await handle.requestPermission(opts)) === 'granted'
}
