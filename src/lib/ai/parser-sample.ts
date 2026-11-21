import { Bytes, Timestamp, collection, doc, getDocs, orderBy, query, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';

export const CHUNK_BYTES = 900_000;
export const MAX_SAMPLE_BYTES = 8_000_000;
export const RETENTION_DAYS = 15;
export const SAMPLES = 'parserSamples';
export const CHUNKS = 'parserSampleChunks';

export interface ParserSampleMeta {
  uid: string;
  docType: string;
  fileName: string;
  reason: string;
  pages: number;
  size: number;
  chunks: number;
  createdAt: Timestamp;
  expireAt: Timestamp;
}

export function splitBytes(b: Uint8Array, size = CHUNK_BYTES): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < b.length; i += size) out.push(b.slice(i, i + size));
  return out;
}

export function joinBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + RETENTION_DAYS * 86_400_000);
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');

/** Sends a declined digital PDF to Firestore for the admin. Silent by owner decision: never throws, never logs. */
export async function sendParserSample(o: { file: File; docType: string; reason: string; pages: number }): Promise<void> {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid || o.file.type !== 'application/pdf' || o.file.size > MAX_SAMPLE_BYTES) return;
    const bytes = new Uint8Array(await o.file.arrayBuffer());
    const id = hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
    const parts = splitBytes(bytes);
    const now = new Date();
    const expireAt = Timestamp.fromDate(expiryFrom(now));
    const batch = writeBatch(db);
    parts.forEach((part, i) => {
      batch.set(doc(db, SAMPLES, id, CHUNKS, String(i)), { i, uid, data: Bytes.fromUint8Array(part), expireAt });
    });
    const meta: ParserSampleMeta = {
      uid, docType: o.docType, fileName: o.file.name.slice(0, 300), reason: o.reason.slice(0, 500), pages: o.pages,
      size: bytes.length, chunks: parts.length, createdAt: Timestamp.fromDate(now), expireAt,
    };
    batch.set(doc(db, SAMPLES, id), meta);
    await batch.commit();
  } catch { /* ponytail: silent by owner decision */ }
}

export async function listParserSamples(): Promise<(ParserSampleMeta & { id: string })[]> {
  const snap = await getDocs(query(collection(db, SAMPLES), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as ParserSampleMeta) }));
}

export async function loadParserSample(id: string): Promise<Blob> {
  const snap = await getDocs(collection(db, SAMPLES, id, CHUNKS));
  const parts = snap.docs
    .map(d => d.data() as { i: number; data: Bytes })
    .sort((a, b) => a.i - b.i)
    .map(p => p.data.toUint8Array());
  return new Blob([joinBytes(parts) as BlobPart], { type: 'application/pdf' });
}

/** One batch: every piece plus the sample doc, so no orphan piece can block a re-send. */
export async function deleteParserSample(id: string, chunks: number): Promise<void> {
  const batch = writeBatch(db);
  for (let i = 0; i < chunks; i++) batch.delete(doc(db, SAMPLES, id, CHUNKS, String(i)));
  batch.delete(doc(db, SAMPLES, id));
  await batch.commit();
}

interface SavePickerWindow {
  showSaveFilePicker?: (o: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
}

/** True only when the file was saved. False on cancel; other errors are rethrown so the caller does not delete. */
export async function saveBlob(blob: Blob, name: string): Promise<boolean> {
  const picker = (window as unknown as SavePickerWindow).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: name, types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return window.confirm('Did the file save? OK deletes it from the server.');
}
