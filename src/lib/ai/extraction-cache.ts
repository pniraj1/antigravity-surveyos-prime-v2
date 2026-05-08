import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'surveyos-extraction-cache';
const DB_VERSION = 1;
const STORE_RESULTS = 'extraction-results';
const STORE_PROGRESS = 'extraction-progress';
const MAX_ENTRIES = 200;
const PROGRESS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CachedExtraction {
  fileHash: string;
  docType: string;
  extractedAt: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  source: 'parser' | 'ai-vision' | 'ai-text';
  parserName?: string;
  modelUsed?: string;
}

export interface ExtractionProgress {
  fileHash: string;
  docType: string;
  totalPages: number;
  completedPages: number[];
  failedPages: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partialData: any;
  lastError?: string;
  updatedAt: number;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_RESULTS)) {
        const s = db.createObjectStore(STORE_RESULTS, { keyPath: ['fileHash', 'docType'] });
        s.createIndex('extractedAt', 'extractedAt');
      }
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS, { keyPath: ['fileHash', 'docType'] });
      }
    },
  });
}

export async function getCachedExtraction(
  fileHash: string,
  docType: string,
): Promise<CachedExtraction | null> {
  try {
    const db = await getDB();
    return (await db.get(STORE_RESULTS, [fileHash, docType])) ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedExtraction(entry: CachedExtraction): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_RESULTS, entry);
    const all = await db.getAllKeysFromIndex(STORE_RESULTS, 'extractedAt');
    if (all.length > MAX_ENTRIES) {
      const toDelete = all.slice(0, all.length - MAX_ENTRIES);
      const tx = db.transaction(STORE_RESULTS, 'readwrite');
      await Promise.all(toDelete.map((k) => tx.store.delete(k)));
      await tx.done;
    }
  } catch {
    // Cache is opportunistic — never throw
  }
}

export async function getExtractionProgress(
  fileHash: string,
  docType: string,
): Promise<ExtractionProgress | null> {
  try {
    const db = await getDB();
    const entry: ExtractionProgress | undefined = await db.get(STORE_PROGRESS, [fileHash, docType]);
    if (!entry) return null;
    if (Date.now() - entry.updatedAt > PROGRESS_TTL_MS) {
      await db.delete(STORE_PROGRESS, [fileHash, docType]);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export async function saveExtractionProgress(progress: ExtractionProgress): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_PROGRESS, progress);
  } catch {
    // Opportunistic
  }
}

export async function clearExtractionProgress(fileHash: string, docType: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_PROGRESS, [fileHash, docType]);
  } catch {
    // Opportunistic
  }
}

export async function clearExtractionCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE_RESULTS);
    await db.clear(STORE_PROGRESS);
  } catch {
    // Opportunistic
  }
}

export async function getAllExtractionProgress(): Promise<ExtractionProgress[]> {
  try {
    const db = await getDB();
    const all = await db.getAll(STORE_PROGRESS);
    const now = Date.now();
    return all.filter(entry => now - entry.updatedAt < PROGRESS_TTL_MS);
  } catch {
    return [];
  }
}
