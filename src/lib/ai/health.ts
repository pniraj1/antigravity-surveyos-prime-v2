/**
 * What this surveyor has seen from each model today. Lives in localStorage;
 * every read and write is wrapped so private mode or a blocked store just
 * means "no history".
 *
 * Two clocks on purpose: busy counts reset at LOCAL midnight (a habit
 * signal), dead-today expires at PACIFIC midnight (Google's quota fact).
 */

export type CallOutcome = 'ok' | 'busy' | 'other';

export interface HealthStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

interface HealthDoc {
  day: string;
  today: Record<string, { calls: number; busy: number }>;
  deadToday: Record<string, number>;   // `${keyHash}:${model|*}` → untilTs
  notFound: Record<string, number>;    // model → untilTs
}

const STORAGE_KEY = 'surveyos.ai.health.v1';
const MIN_CALLS_FOR_RATE = 3;
const NOT_FOUND_TTL_MS = 7 * 86_400_000;

export interface Health {
  recordCall(model: string, outcome: CallOutcome): void;
  busyRate(model: string): number;
  markDeadToday(keyHash: string, model: string | '*'): void;
  isDeadToday(keyHash: string, model: string): boolean;
  markNotFound(model: string): void;
  isNotFound(model: string): boolean;
  deadUntilLabel(): string;
}

export function localDayKey(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Next 00:00 America/Los_Angeles after `now`, as a UTC timestamp. */
export function nextPacificMidnight(now: number): number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(now)).map(p => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const msSinceMidnightPacific = ((hour * 60 + minute) * 60 + second) * 1000 + (now % 1000);
  return now - msSinceMidnightPacific + 86_400_000;
}

/** djb2 over the key, base36, first 10 chars. Not reversible, not secret — an identifier. */
export function keyHash(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 10);
}

function safeStore(store: HealthStore | null): HealthStore | null {
  if (!store) return null;
  try { store.getItem(STORAGE_KEY); return store; } catch { return null; }
}

export function createHealth(rawStore: HealthStore | null, now: () => number = Date.now): Health {
  const store = safeStore(rawStore);

  function load(): HealthDoc {
    const empty: HealthDoc = { day: localDayKey(now()), today: {}, deadToday: {}, notFound: {} };
    if (!store) return empty;
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const doc = JSON.parse(raw) as HealthDoc;
      return doc.day === empty.day ? doc : { ...doc, day: empty.day, today: {} };
    } catch { return empty; }
  }
  function save(doc: HealthDoc): void {
    if (!store) return;
    try { store.setItem(STORAGE_KEY, JSON.stringify(doc)); } catch { /* no history */ }
  }

  return {
    recordCall(model, outcome) {
      const doc = load();
      const cur = doc.today[model] ?? { calls: 0, busy: 0 };
      save({ ...doc, today: { ...doc.today, [model]: { calls: cur.calls + 1, busy: cur.busy + (outcome === 'busy' ? 1 : 0) } } });
    },
    busyRate(model) {
      const cur = load().today[model];
      if (!cur || cur.calls < MIN_CALLS_FOR_RATE) return 0;
      return cur.busy / cur.calls;
    },
    markDeadToday(hash, model) {
      const doc = load();
      save({ ...doc, deadToday: { ...doc.deadToday, [`${hash}:${model}`]: nextPacificMidnight(now()) } });
    },
    isDeadToday(hash, model) {
      const d = load().deadToday;
      const t = now();
      return (d[`${hash}:${model}`] ?? 0) > t || (d[`${hash}:*`] ?? 0) > t;
    },
    markNotFound(model) {
      const doc = load();
      save({ ...doc, notFound: { ...doc.notFound, [model]: now() + NOT_FOUND_TTL_MS } });
    },
    isNotFound(model) {
      return (load().notFound[model] ?? 0) > now();
    },
    deadUntilLabel() {
      return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
        .format(new Date(nextPacificMidnight(now()))).replace(/\s?(am|pm)/i, ' $1') + ' IST';
    },
  };
}

/** The app's health record, bound to window.localStorage when present. */
let _health: Health | null = null;
export function getHealth(): Health {
  if (!_health) _health = createHealth(typeof window !== 'undefined' ? window.localStorage : null);
  return _health;
}
/** Tests only. */
export function resetHealthForTests(store: HealthStore | null, now?: () => number): Health {
  _health = createHealth(store, now);
  return _health;
}
