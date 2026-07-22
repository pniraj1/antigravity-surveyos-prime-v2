import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export type AnnouncementType = 'update' | 'blog' | 'general';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  link?: string;
  createdAt: number;
  createdBy: string;
}

/** Returns a safe http/https URL, or null for anything else (blocks javascript:, data:, relative). */
export function sanitizeLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/** Count of announcements created after the surveyor last opened the bell. */
export function countUnread(items: Announcement[], lastSeen: number | undefined): number {
  const since = lastSeen ?? 0;
  return items.filter((a) => a.createdAt > since).length;
}

/** Newest 20 announcements. Empty array on any error (never blocks the UI). */
export async function loadAnnouncements(): Promise<Announcement[]> {
  try {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }));
  } catch {
    return [];
  }
}

/** Admin-only write (enforced by Firestore rules). */
export async function saveAnnouncement(a: Omit<Announcement, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'announcements'), { ...a, createdAt: Date.now() });
}

/** Admin-only delete (enforced by Firestore rules). */
export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, 'announcements', id));
}
