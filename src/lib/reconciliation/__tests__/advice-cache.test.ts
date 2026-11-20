import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory IndexedDB mock tracking stores, rows, and indexes
const mem = vi.hoisted(() => {
  const dbs = new Map<
    string,
    {
      version: number;
      stores: Map<
        string,
        {
          keyPath?: string;
          indexes: Map<string, string>;
          rows: Map<string, any>;
        }
      >;
    }
  >();
  return { dbs };
});

vi.mock('idb', () => ({
  openDB: vi.fn(
    async (
      name: string,
      version: number,
      opts?: { upgrade?: (db: any, old: number, newV: number, tx: any) => void }
    ) => {
      let rec = mem.dbs.get(name);
      const oldVersion = rec?.version ?? 0;
      if (!rec) {
        rec = { version: 0, stores: new Map() };
        mem.dbs.set(name, rec);
      }
      const r = rec;
      const db = {
        objectStoreNames: {
          contains: (n: string) => r.stores.has(n),
        },
        createObjectStore: (n: string, o?: { keyPath?: string }) => {
          const storeData = {
            keyPath: o?.keyPath,
            indexes: new Map<string, string>(),
            rows: new Map<string, any>(),
          };
          r.stores.set(n, storeData);
          return {
            createIndex: (idxName: string, keyField: string) => {
              storeData.indexes.set(idxName, keyField);
            },
          };
        },
        put: async (storeName: string, val: any, key?: string) => {
          const s = r.stores.get(storeName);
          if (!s) throw new Error(`Store ${storeName} not found`);
          const k = s.keyPath ? val[s.keyPath] : key;
          s.rows.set(k, structuredClone(val));
          return k;
        },
        get: async (storeName: string, key: string) => {
          const s = r.stores.get(storeName);
          const found = s?.rows.get(key);
          return found ? structuredClone(found) : undefined;
        },
        getAll: async (storeName: string) => {
          const s = r.stores.get(storeName);
          if (!s) return [];
          return Array.from(s.rows.values()).map((v) => structuredClone(v));
        },
        getAllFromIndex: async (storeName: string, indexName: string, query: any) => {
          const s = r.stores.get(storeName);
          if (!s) return [];
          const keyField = s.indexes.get(indexName);
          if (!keyField) return [];
          return Array.from(s.rows.values())
            .filter((item: any) => item[keyField] === query)
            .map((v) => structuredClone(v));
        },
        delete: async (storeName: string, key: string) => {
          const s = r.stores.get(storeName);
          s?.rows.delete(key);
        },
        clear: async (storeName: string) => {
          const s = r.stores.get(storeName);
          s?.rows.clear();
        },
        close: () => {},
      };
      if (oldVersion < version && opts?.upgrade) {
        opts.upgrade(db, oldVersion, version, null);
        r.version = version;
      }
      return db;
    }
  ),
}));

import {
  RECONCILIATION_DB_NAME,
  RECONCILIATION_DB_VERSION,
  PROCESSED_EMAILS_STORE,
  CACHED_ADVICES_STORE,
  getReconciliationDB,
  isIndexedDBAvailable,
  isEmailSettledOrDismissed,
  saveProcessedEmail,
  getProcessedEmail,
  getAllProcessedEmails,
  saveCachedAdvice,
  getCachedAdvice,
  getCachedAdvicesByMessageId,
  getAllCachedAdvices,
  getAllUnmatchedCachedAdvices,
  markEmailSettled,
  markEmailDismissed,
  clearReconciliationCache,
  _resetReconciliationDBForTesting,
} from '../advice-cache';
import type {
  ProcessedEmailRecord,
  CachedPaymentAdviceRecord,
} from '@/types/payment-reconciliation';

describe('Reconciliation IndexedDB Advice Cache', () => {
  beforeEach(() => {
    mem.dbs.clear();
    _resetReconciliationDBForTesting();
    // In vitest 'node' env, define indexedDB stub on globalThis
    vi.stubGlobal('indexedDB', {} as any);
  });

  describe('Database schema and initialization', () => {
    it('creates database surveyos-reconciliation with processed-emails and cached-advices stores', async () => {
      const db = await getReconciliationDB();
      expect(db).toBeDefined();

      const dbRecord = mem.dbs.get(RECONCILIATION_DB_NAME);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.version).toBe(RECONCILIATION_DB_VERSION);

      const emailStore = dbRecord?.stores.get(PROCESSED_EMAILS_STORE);
      expect(emailStore).toBeDefined();
      expect(emailStore?.keyPath).toBe('messageId');
      expect(emailStore?.indexes.get('by-status')).toBe('status');

      const adviceStore = dbRecord?.stores.get(CACHED_ADVICES_STORE);
      expect(adviceStore).toBeDefined();
      expect(adviceStore?.keyPath).toBe('id');
      expect(adviceStore?.indexes.get('by-sourceMessageId')).toBe('sourceMessageId');
    });

    it('returns the cached singleton dbPromise on repeated calls', async () => {
      const db1 = await getReconciliationDB();
      const db2 = await getReconciliationDB();
      expect(db1).toBe(db2);
    });
  });

  describe('SSR / Node Environment Safety', () => {
    it('detects when indexedDB is available', () => {
      expect(isIndexedDBAvailable()).toBe(true);
    });

    it('handles environment when indexedDB is undefined safely', async () => {
      vi.stubGlobal('indexedDB', undefined);
      expect(isIndexedDBAvailable()).toBe(false);

      await expect(getReconciliationDB()).rejects.toThrow(
        'IndexedDB is not available in the current environment.'
      );

      // Safe no-op / fallback behavior
      expect(await isEmailSettledOrDismissed('msg-123')).toBe(false);
      expect(await getProcessedEmail('msg-123')).toBeUndefined();
      expect(await getAllProcessedEmails()).toEqual([]);
      expect(await getCachedAdvice('adv-123')).toBeUndefined();
      expect(await getCachedAdvicesByMessageId('msg-123')).toEqual([]);
      expect(await getAllCachedAdvices()).toEqual([]);
      expect(await getAllUnmatchedCachedAdvices()).toEqual([]);

      // Mutations do not throw
      await expect(
        saveProcessedEmail({
          messageId: 'msg-1',
          subject: 'Test',
          from: 'test@example.com',
          date: '2026-11-20',
          status: 'settled',
          processedAt: new Date().toISOString(),
        })
      ).resolves.toBeUndefined();

      await expect(markEmailSettled('msg-1')).resolves.toBeUndefined();
      await expect(markEmailDismissed('msg-1')).resolves.toBeUndefined();
      await expect(clearReconciliationCache()).resolves.toBeUndefined();
    });
  });

  describe('Processed Emails Store', () => {
    const sampleEmail: ProcessedEmailRecord = {
      messageId: 'msg-nia-101',
      subject: 'Payment Released - Survey Fee Claim #310100',
      from: 'NIAHO@newindia.co.in',
      date: '2026-11-18T10:00:00Z',
      status: 'unmatched',
      processedAt: '2026-11-20T08:00:00Z',
    };

    it('saves and retrieves a processed email record', async () => {
      await saveProcessedEmail(sampleEmail);
      const retrieved = await getProcessedEmail('msg-nia-101');

      expect(retrieved).toEqual(sampleEmail);
    });

    it('returns undefined for non-existent message ID', async () => {
      const retrieved = await getProcessedEmail('msg-unknown');
      expect(retrieved).toBeUndefined();
    });

    it('retrieves all processed emails', async () => {
      const email2: ProcessedEmailRecord = {
        messageId: 'msg-uiic-202',
        subject: 'NEFT Remittance Advice',
        from: 'disbursements@uiic.co.in',
        date: '2026-11-19T14:30:00Z',
        status: 'settled',
        matchedClaimId: 'claim-abc-123',
        utrNumber: 'CMS987654',
        processedAt: '2026-11-20T08:05:00Z',
      };

      await saveProcessedEmail(sampleEmail);
      await saveProcessedEmail(email2);

      const all = await getAllProcessedEmails();
      expect(all).toHaveLength(2);
      expect(all.map((e) => e.messageId)).toContain('msg-nia-101');
      expect(all.map((e) => e.messageId)).toContain('msg-uiic-202');
    });

    it('evaluates isEmailSettledOrDismissed accurately', async () => {
      // 1. Not in DB yet
      expect(await isEmailSettledOrDismissed('msg-nia-101')).toBe(false);

      // 2. Saved as unmatched
      await saveProcessedEmail(sampleEmail);
      expect(await isEmailSettledOrDismissed('msg-nia-101')).toBe(false);

      // 3. Mark settled
      await markEmailSettled('msg-nia-101', 'claim-999', 'UTR12345');
      expect(await isEmailSettledOrDismissed('msg-nia-101')).toBe(true);

      const settledRecord = await getProcessedEmail('msg-nia-101');
      expect(settledRecord?.status).toBe('settled');
      expect(settledRecord?.matchedClaimId).toBe('claim-999');
      expect(settledRecord?.utrNumber).toBe('UTR12345');
      expect(settledRecord?.subject).toBe(sampleEmail.subject);

      // 4. Mark dismissed
      await markEmailDismissed('msg-dismissed-1');
      expect(await isEmailSettledOrDismissed('msg-dismissed-1')).toBe(true);

      const dismissedRecord = await getProcessedEmail('msg-dismissed-1');
      expect(dismissedRecord?.status).toBe('dismissed');
    });

    it('updates status and metadata when marking already existing email as settled', async () => {
      await saveProcessedEmail({
        messageId: 'msg-pre-existing',
        subject: 'Payment Advice Notice',
        from: 'payments@newindia.co.in',
        date: '2026-11-15T09:00:00Z',
        status: 'unmatched',
        processedAt: '2026-11-19T10:00:00Z',
      });

      await markEmailSettled('msg-pre-existing', 'claim-target', 'CMS555');
      const updated = await getProcessedEmail('msg-pre-existing');

      expect(updated?.status).toBe('settled');
      expect(updated?.matchedClaimId).toBe('claim-target');
      expect(updated?.utrNumber).toBe('CMS555');
      expect(updated?.subject).toBe('Payment Advice Notice');
    });
  });

  describe('Cached Payment Advice Store', () => {
    const sampleAdvice: CachedPaymentAdviceRecord = {
      id: 'adv-msg-101',
      sourceMessageId: 'msg-nia-101',
      utrNumber: 'CMS93821019',
      paymentDate: '2026-11-18',
      insurerName: 'The New India Assurance',
      extractedAt: '2026-11-20T08:00:00Z',
      claims: [
        {
          claimNumber: '31010031240100001234',
          vehicleNumber: 'MH-12-AB-1234',
          grossFee: 2000,
          conveyance: 400,
          tdsAmount: 240,
          netPaid: 2160,
        },
        {
          claimNumber: '31010031240100005678',
          vehicleNumber: 'MH-14-CD-5678',
          grossFee: 1500,
          conveyance: 300,
          tdsAmount: 180,
          netPaid: 1620,
        },
      ],
    };

    it('saves and retrieves a cached payment advice voucher', async () => {
      await saveCachedAdvice(sampleAdvice);
      const retrieved = await getCachedAdvice('adv-msg-101');

      expect(retrieved).toEqual(sampleAdvice);
      expect(retrieved?.claims).toHaveLength(2);
      expect(retrieved?.claims[0].claimNumber).toBe('31010031240100001234');
    });

    it('retrieves cached advices by sourceMessageId index', async () => {
      const advice1 = { ...sampleAdvice, id: 'adv-part-1' };
      const advice2 = { ...sampleAdvice, id: 'adv-part-2' };
      const adviceOther = {
        ...sampleAdvice,
        id: 'adv-part-3',
        sourceMessageId: 'msg-other-999',
      };

      await saveCachedAdvice(advice1);
      await saveCachedAdvice(advice2);
      await saveCachedAdvice(adviceOther);

      const bySource = await getCachedAdvicesByMessageId('msg-nia-101');
      expect(bySource).toHaveLength(2);
      expect(bySource.map((a) => a.id)).toEqual(
        expect.arrayContaining(['adv-part-1', 'adv-part-2'])
      );
    });

    it('retrieves all cached advice vouchers', async () => {
      await saveCachedAdvice(sampleAdvice);
      const all = await getAllCachedAdvices();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('adv-msg-101');
    });

    it('filters unmatched cached advices correctly', async () => {
      // Email 1 is unmatched
      await saveProcessedEmail({
        messageId: 'msg-1',
        subject: 'Voucher 1',
        from: 'ins@test.com',
        date: '2026-11-20',
        status: 'unmatched',
        processedAt: '2026-11-20',
      });
      // Email 2 is settled
      await saveProcessedEmail({
        messageId: 'msg-2',
        subject: 'Voucher 2',
        from: 'ins@test.com',
        date: '2026-11-20',
        status: 'settled',
        matchedClaimId: 'claim-x',
        processedAt: '2026-11-20',
      });

      await saveCachedAdvice({
        ...sampleAdvice,
        id: 'adv-1',
        sourceMessageId: 'msg-1',
      });
      await saveCachedAdvice({
        ...sampleAdvice,
        id: 'adv-2',
        sourceMessageId: 'msg-2',
      });

      const unmatchedAdvices = await getAllUnmatchedCachedAdvices();
      expect(unmatchedAdvices).toHaveLength(1);
      expect(unmatchedAdvices[0].id).toBe('adv-1');
    });
  });

  describe('Cache Reset & Full Rescan', () => {
    it('purges all processed emails and cached advices on clearReconciliationCache', async () => {
      await saveProcessedEmail({
        messageId: 'msg-clear-test',
        subject: 'Test',
        from: 'test@mail.com',
        date: '2026-11-20',
        status: 'settled',
        processedAt: '2026-11-20',
      });
      await saveCachedAdvice({
        id: 'adv-clear-test',
        sourceMessageId: 'msg-clear-test',
        claims: [],
        extractedAt: '2026-11-20',
      });

      expect(await getAllProcessedEmails()).toHaveLength(1);
      expect(await getAllCachedAdvices()).toHaveLength(1);

      await clearReconciliationCache();

      expect(await getAllProcessedEmails()).toHaveLength(0);
      expect(await getAllCachedAdvices()).toHaveLength(0);
      expect(await isEmailSettledOrDismissed('msg-clear-test')).toBe(false);
    });
  });
});
