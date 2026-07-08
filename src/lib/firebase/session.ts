// ═══════════════════════════════════════════════════════════
// SESSION PRESENCE SERVICE — single active session per account
//
// Enforces "one device at a time" for a given Google account so two
// devices can't edit the same claims in parallel and silently overwrite
// each other (last-write-wins on updatedAt).
//
// Mechanism: a single Firestore doc at users/{uid}/session/active holds
// the deviceId that currently "owns" the session plus a lastHeartbeat
// timestamp refreshed every 60s by the live tab (see useSessionHeartbeat).
// A session is considered LIVE only while its heartbeat is fresh
// (< FRESHNESS_WINDOW_MS). A crashed/closed tab stops beating, so the
// session goes stale and the next device can claim it without a fight.
// ═══════════════════════════════════════════════════════════

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { logger } from '../utils/logger';

const DEVICE_ID_KEY = 'surveyos_device_id';

/** A heartbeat older than this (ms) means the owning device is gone. */
export const FRESHNESS_WINDOW_MS = 90_000;

/** Shape of the users/{uid}/session/active document. */
export interface ActiveSession {
  deviceId: string;
  deviceHint: string;
  /** Stored as a Firestore Timestamp; may read back as Timestamp or millis. */
  lastHeartbeat: Timestamp | number | null;
  claimedAt: Timestamp | number | null;
}

function sessionRef(uid: string) {
  return doc(db, 'users', uid, 'session', 'active');
}

/**
 * Returns this device's stable UUID, creating and persisting one on first
 * use. Lives in localStorage so it survives logout/login on the same device
 * (which is how same-device re-login avoids a false conflict).
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private mode / SSR) — fall back to ephemeral.
    return `dev-ephemeral-${Math.random().toString(36).slice(2)}`;
  }
}

/** Short human-readable label for the "already open on…" message. */
export function getDeviceHint(): string {
  if (typeof navigator === 'undefined') return 'another device';
  const ua = navigator.userAgent;
  const os =
    /Windows/i.test(ua) ? 'Windows' :
    /Macintosh|Mac OS/i.test(ua) ? 'Mac' :
    /Android/i.test(ua) ? 'Android' :
    /iPhone|iPad|iPod/i.test(ua) ? 'iOS' :
    /Linux/i.test(ua) ? 'Linux' : 'a device';
  const browser =
    /Edg\//i.test(ua) ? 'Edge' :
    /Chrome\//i.test(ua) ? 'Chrome' :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua) ? 'Safari' : 'a browser';
  return `${browser} on ${os}`;
}

/** Normalises a Firestore Timestamp | millis | null to epoch millis. */
function toMillis(value: Timestamp | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Timestamp) return value.toMillis();
  // Plain object shape { seconds, nanoseconds } (e.g. from cache hydration)
  const maybe = value as { seconds?: number };
  return typeof maybe.seconds === 'number' ? maybe.seconds * 1000 : 0;
}

/**
 * True if the session's heartbeat is recent enough that the owning device
 * is presumed alive. Pure — unit-testable without Firestore.
 */
export function isSessionFresh(
  session: ActiveSession | null,
  now: number = Date.now(),
): boolean {
  if (!session) return false;
  return now - toMillis(session.lastHeartbeat) < FRESHNESS_WINDOW_MS;
}

/** True if the given session is owned by THIS device. Pure. */
export function isSessionMine(session: ActiveSession | null): boolean {
  if (!session) return false;
  return session.deviceId === getDeviceId();
}

/** Reads the active-session doc, or null if none exists. */
export async function readActiveSession(uid: string): Promise<ActiveSession | null> {
  const snap = await getDoc(sessionRef(uid));
  return snap.exists() ? (snap.data() as ActiveSession) : null;
}

/** Claims (or refreshes) ownership of the session for this device. */
export async function claimSession(uid: string): Promise<void> {
  await setDoc(sessionRef(uid), {
    deviceId: getDeviceId(),
    deviceHint: getDeviceHint(),
    lastHeartbeat: serverTimestamp(),
    claimedAt: serverTimestamp(),
  });
}

/**
 * Releases the session on logout — but ONLY if this device still owns it.
 * If another device already force-claimed it, we must not delete their doc.
 * Non-fatal: errors are logged, never thrown.
 */
export async function releaseSession(uid: string): Promise<void> {
  try {
    const current = await readActiveSession(uid);
    if (current && !isSessionMine(current)) return; // not ours anymore
    await deleteDoc(sessionRef(uid));
  } catch (err) {
    logger.error('[session] releaseSession failed (non-fatal):', err);
  }
}
