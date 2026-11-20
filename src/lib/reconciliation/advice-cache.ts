// ═══════════════════════════════════════════════════════════
// RECONCILIATION ADVICE CACHE & DEDUPLICATION STORE
//
// ARCHITECTURE:
//   Motor insurance surveyors receive tens or hundreds of payment
//   advice emails. Reparsing large PDFs and running Gemini AI on
//   previously settled or dismissed emails wastes tokens and causes
//   redundant API calls.
//
//   This module provides client-side persistence in IndexedDB
//   (`surveyos-reconciliation`) with two stores:
//   1. `processed-emails`: Tracks email message IDs and their settlement status
//      ('settled' | 'dismissed' | 'unmatched').
//   2. `cached-advices`: Caches extracted payment advice records so they
//      can be matched instantly against future claims without rescanning.
// ═══════════════════════════════════════════════════════════

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type {
  ProcessedEmailRecord,
  CachedPaymentAdviceRecord,
  EmailProcessingStatus,
} from '@/types/payment-reconciliation';

export const RECONCILIATION_DB_NAME = 'surveyos-reconciliation';
export const RECONCILIATION_DB_VERSION = 1;
export const PROCESSED_EMAILS_STORE = 'processed-emails';
export const CACHED_ADVICES_STORE = 'cached-advices';

export interface ReconciliationDB extends DBSchema {
  [PROCESSED_EMAILS_STORE]: {
    key: string;
    value: ProcessedEmailRecord;
    indexes: { 'by-status': EmailProcessingStatus };
  };
  [CACHED_ADVICES_STORE]: {
    key: string;
    value: CachedPaymentAdviceRecord;
    indexes: { 'by-sourceMessageId': string };
  };
}

let dbPromise: Promise<IDBPDatabase<ReconciliationDB>> | null = null;

/**
 * Returns true if IndexedDB is available in the current environment (browser).
 * Safe for SSR / Node.js pre-rendering.
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Reset cached database connection promise (useful for tests or teardown).
 */
export function _resetReconciliationDBForTesting(): void {
  dbPromise = null;
}

/**
 * Opens or retrieves the singleton IndexedDB instance for reconciliation.
 */
export async function getReconciliationDB(): Promise<IDBPDatabase<ReconciliationDB>> {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available in the current environment.');
  }

  if (!dbPromise) {
    dbPromise = openDB<ReconciliationDB>(RECONCILIATION_DB_NAME, RECONCILIATION_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROCESSED_EMAILS_STORE)) {
          const emailStore = db.createObjectStore(PROCESSED_EMAILS_STORE, { keyPath: 'messageId' });
          emailStore.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains(CACHED_ADVICES_STORE)) {
          const adviceStore = db.createObjectStore(CACHED_ADVICES_STORE, { keyPath: 'id' });
          adviceStore.createIndex('by-sourceMessageId', 'sourceMessageId');
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/**
 * Returns true if the email has already been settled or dismissed.
 * Returns false if it is new, unmatched, or if IndexedDB is unavailable.
 */
export async function isEmailSettledOrDismissed(messageId: string): Promise<boolean> {
  if (!isIndexedDBAvailable() || !messageId) {
    return false;
  }
  const record = await getProcessedEmail(messageId);
  return record?.status === 'settled' || record?.status === 'dismissed';
}

/**
 * Saves or updates a processed email record in the store.
 */
export async function saveProcessedEmail(record: ProcessedEmailRecord): Promise<void> {
  if (!isIndexedDBAvailable() || !record?.messageId) return;
  const db = await getReconciliationDB();
  await db.put(PROCESSED_EMAILS_STORE, record);
}

/**
 * Retrieves a processed email record by messageId.
 */
export async function getProcessedEmail(messageId: string): Promise<ProcessedEmailRecord | undefined> {
  if (!isIndexedDBAvailable() || !messageId) return undefined;
  const db = await getReconciliationDB();
  return db.get(PROCESSED_EMAILS_STORE, messageId);
}

/**
 * Retrieves all processed email records.
 */
export async function getAllProcessedEmails(): Promise<ProcessedEmailRecord[]> {
  if (!isIndexedDBAvailable()) return [];
  const db = await getReconciliationDB();
  return db.getAll(PROCESSED_EMAILS_STORE);
}

/**
 * Saves or updates a cached payment advice voucher record.
 */
export async function saveCachedAdvice(record: CachedPaymentAdviceRecord): Promise<void> {
  if (!isIndexedDBAvailable() || !record?.id) return;
  const db = await getReconciliationDB();
  await db.put(CACHED_ADVICES_STORE, record);
}

/**
 * Retrieves a cached payment advice record by its ID.
 */
export async function getCachedAdvice(id: string): Promise<CachedPaymentAdviceRecord | undefined> {
  if (!isIndexedDBAvailable() || !id) return undefined;
  const db = await getReconciliationDB();
  return db.get(CACHED_ADVICES_STORE, id);
}

/**
 * Retrieves all cached payment advice records originating from a specific source message ID.
 */
export async function getCachedAdvicesByMessageId(messageId: string): Promise<CachedPaymentAdviceRecord[]> {
  if (!isIndexedDBAvailable() || !messageId) return [];
  const db = await getReconciliationDB();
  return db.getAllFromIndex(CACHED_ADVICES_STORE, 'by-sourceMessageId', messageId);
}

/**
 * Retrieves all cached payment advice records across all processed messages.
 */
export async function getAllCachedAdvices(): Promise<CachedPaymentAdviceRecord[]> {
  if (!isIndexedDBAvailable()) return [];
  const db = await getReconciliationDB();
  return db.getAll(CACHED_ADVICES_STORE);
}

/**
 * Retrieves all cached advices whose source email is not marked settled or dismissed.
 */
export async function getAllUnmatchedCachedAdvices(): Promise<CachedPaymentAdviceRecord[]> {
  if (!isIndexedDBAvailable()) return [];
  const [advices, emails] = await Promise.all([
    getAllCachedAdvices(),
    getAllProcessedEmails(),
  ]);
  const settledOrDismissedIds = new Set(
    emails
      .filter((e) => e.status === 'settled' || e.status === 'dismissed')
      .map((e) => e.messageId)
  );
  return advices.filter((a) => !settledOrDismissedIds.has(a.sourceMessageId));
}

/**
 * Marks an email as settled with optional matched claim ID and UTR number.
 */
export async function markEmailSettled(
  messageId: string,
  matchedClaimId?: string,
  utrNumber?: string
): Promise<void> {
  if (!isIndexedDBAvailable() || !messageId) return;
  const existing = await getProcessedEmail(messageId);
  const updated: ProcessedEmailRecord = {
    messageId,
    subject: existing?.subject ?? '',
    from: existing?.from ?? '',
    date: existing?.date ?? new Date().toISOString(),
    status: 'settled',
    matchedClaimId: matchedClaimId ?? existing?.matchedClaimId,
    utrNumber: utrNumber ?? existing?.utrNumber,
    processedAt: new Date().toISOString(),
  };
  await saveProcessedEmail(updated);
}

/**
 * Marks an email as dismissed (e.g. not a payment advice, non-matching surveyor, or user-skipped).
 */
export async function markEmailDismissed(messageId: string): Promise<void> {
  if (!isIndexedDBAvailable() || !messageId) return;
  const existing = await getProcessedEmail(messageId);
  const updated: ProcessedEmailRecord = {
    messageId,
    subject: existing?.subject ?? '',
    from: existing?.from ?? '',
    date: existing?.date ?? new Date().toISOString(),
    status: 'dismissed',
    matchedClaimId: existing?.matchedClaimId,
    utrNumber: existing?.utrNumber,
    processedAt: new Date().toISOString(),
  };
  await saveProcessedEmail(updated);
}

/**
 * Clears all processed email records and cached advice vouchers from the store.
 * Used for "Force Full Rescan".
 */
export async function clearReconciliationCache(): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await getReconciliationDB();
  await Promise.all([
    db.clear(PROCESSED_EMAILS_STORE),
    db.clear(CACHED_ADVICES_STORE),
  ]);
}
