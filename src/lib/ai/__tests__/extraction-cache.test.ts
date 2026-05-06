import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Lightweight in-memory IDB mock — avoids jsdom/fake-indexeddb dependency
// ---------------------------------------------------------------------------
type StoreData = Map<string, unknown>;

const stores: Record<string, StoreData> = {};
const indexes: Record<string, Map<string, [string, string]>> = {};

function keyStr(key: IDBValidKey): string {
  return JSON.stringify(key);
}

const mockDB = {
  get: vi.fn(async (storeName: string, key: IDBValidKey) => {
    return stores[storeName]?.get(keyStr(key)) ?? undefined;
  }),
  put: vi.fn(async (storeName: string, value: Record<string, unknown>) => {
    if (!stores[storeName]) stores[storeName] = new Map();
    // keyPath for both stores is ['fileHash', 'docType']
    const compositeKey: [string, string] = [String(value['fileHash']), String(value['docType'])];
    const key = keyStr(compositeKey);
    stores[storeName].set(key, value);
    if (storeName === 'extraction-results') {
      if (!indexes['extractedAt']) indexes['extractedAt'] = new Map();
      indexes['extractedAt'].set(key, compositeKey);
    }
  }),
  delete: vi.fn(async (storeName: string, key: IDBValidKey) => {
    stores[storeName]?.delete(keyStr(key));
  }),
  clear: vi.fn(async (storeName: string) => {
    if (stores[storeName]) stores[storeName].clear();
    if (storeName === 'extraction-results') indexes['extractedAt']?.clear();
  }),
  getAllKeysFromIndex: vi.fn(async (_storeName: string, _indexName: string) => {
    return Array.from(indexes['extractedAt']?.values() ?? []);
  }),
  transaction: vi.fn((_storeName: string, _mode: string) => {
    const ops: Array<Promise<unknown>> = [];
    const txStore = {
      delete: (key: IDBValidKey) => {
        const p = mockDB.delete(_storeName, key);
        ops.push(p);
        return p;
      },
    };
    return {
      store: txStore,
      done: Promise.all(ops).then(() => undefined),
    };
  }),
};

vi.mock('idb', () => ({
  openDB: vi.fn(async () => mockDB),
}));

// ---------------------------------------------------------------------------
// Import after mock is set up
// ---------------------------------------------------------------------------
import {
  getCachedExtraction,
  saveCachedExtraction,
  getExtractionProgress,
  saveExtractionProgress,
  clearExtractionCache,
} from '../extraction-cache';

beforeEach(async () => {
  // Reset in-memory stores
  for (const key of Object.keys(stores)) delete stores[key];
  for (const key of Object.keys(indexes)) delete indexes[key];
  vi.clearAllMocks();

  // Re-attach implementations after clearAllMocks
  mockDB.get.mockImplementation(async (storeName: string, key: IDBValidKey) => {
    return stores[storeName]?.get(keyStr(key)) ?? undefined;
  });
  mockDB.put.mockImplementation(async (storeName: string, value: Record<string, unknown>) => {
    if (!stores[storeName]) stores[storeName] = new Map();
    const compositeKey: [string, string] = [String(value['fileHash']), String(value['docType'])];
    const key = keyStr(compositeKey);
    stores[storeName].set(key, value);
    if (storeName === 'extraction-results') {
      if (!indexes['extractedAt']) indexes['extractedAt'] = new Map();
      indexes['extractedAt'].set(key, compositeKey);
    }
  });
  mockDB.delete.mockImplementation(async (storeName: string, key: IDBValidKey) => {
    stores[storeName]?.delete(keyStr(key));
  });
  mockDB.clear.mockImplementation(async (storeName: string) => {
    if (stores[storeName]) stores[storeName].clear();
    if (storeName === 'extraction-results') indexes['extractedAt']?.clear();
  });
  mockDB.getAllKeysFromIndex.mockImplementation(async () => {
    return Array.from(indexes['extractedAt']?.values() ?? []);
  });
  mockDB.transaction.mockImplementation((_storeName: string, _mode: string) => {
    const ops: Array<Promise<unknown>> = [];
    const txStore = {
      delete: (key: IDBValidKey) => {
        const p = mockDB.delete(_storeName, key);
        ops.push(p);
        return p;
      },
    };
    return {
      store: txStore,
      done: Promise.all(ops).then(() => undefined),
    };
  });

  await clearExtractionCache();
});

describe('extraction result cache', () => {
  it('returns null on miss', async () => {
    const result = await getCachedExtraction('abc123', 'estimate');
    expect(result).toBeNull();
  });

  it('stores and retrieves extraction result', async () => {
    const entry = {
      fileHash: 'abc123',
      docType: 'estimate',
      extractedAt: Date.now(),
      data: { spare_parts: [{ description: 'BUMPER' }] },
      source: 'parser' as const,
      parserName: 'generic-table',
    };
    await saveCachedExtraction(entry);
    const hit = await getCachedExtraction('abc123', 'estimate');
    expect(hit?.data.spare_parts[0].description).toBe('BUMPER');
  });
});

describe('extraction progress', () => {
  it('returns null when no progress stored', async () => {
    const p = await getExtractionProgress('xyz', 'estimate');
    expect(p).toBeNull();
  });

  it('stores and retrieves progress', async () => {
    await saveExtractionProgress({
      fileHash: 'xyz',
      docType: 'estimate',
      totalPages: 6,
      completedPages: [0, 1],
      failedPages: [],
      partialData: { spare_parts: [] },
      updatedAt: Date.now(),
    });
    const p = await getExtractionProgress('xyz', 'estimate');
    expect(p?.completedPages).toEqual([0, 1]);
  });
});
