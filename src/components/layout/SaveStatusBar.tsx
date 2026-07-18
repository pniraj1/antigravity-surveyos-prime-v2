'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { CheckCircle, Loader2, WifiOff, CloudOff, RefreshCw, Link2, AlertTriangle, UploadCloud } from 'lucide-react';
import { getDriveQueueCount, getPushedAt } from '@/lib/storage/indexeddb';
import { getDriveToken, linkGoogleDrive, flushDriveQueue } from '@/lib/drive';

/** "3m ago" / "1h ago" style readout — pure info, no urgency framing. */
function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function SaveStatusBar() {
  const { saveStatus, isDriveConnected, driveEmail, setActiveTab } = useUIStore();
  const { currentClaim } = useClaimStore();

  const [visible, setVisible] = useState(false);
  const [driveQueueCount, setDriveQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [driveTokenValid, setDriveTokenValid] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // ── Online/offline listener ──────────────────────────────────────────────────
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // ── Drive token validity check (every 60s) ───────────────────────────────────
  useEffect(() => {
    const check = () => setDriveTokenValid(getDriveToken() !== null);
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [isDriveConnected]);

  // ── Cloud Vault badge visibility ─────────────────────────────────────────────
  useEffect(() => {
    if (saveStatus === 'saved' || saveStatus === 'unsynced') {
      setVisible(true);
    } else if (saveStatus === 'saving' || saveStatus === 'queued' || saveStatus === 'error') {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [saveStatus]);

  // ── Drive queue poll (every 10s) ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const count = await getDriveQueueCount().catch(() => 0);
      if (!cancelled) setDriveQueueCount(count);
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Last-synced readout (re-read on claim change + every 30s to tick) ────────
  useEffect(() => {
    if (!currentClaim) { setLastSyncedAt(null); return; }
    let cancelled = false;
    const claimId = currentClaim.id;
    const check = async () => {
      const pushedAt = await getPushedAt(claimId).catch(() => null);
      if (!cancelled) setLastSyncedAt(pushedAt);
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentClaim, saveStatus]);

  // ── Action handlers ──────────────────────────────────────────────────────────
  const handleRelinkDrive = useCallback(async () => {
    setRelinking(true);
    await linkGoogleDrive().catch(() => {});
    setDriveTokenValid(getDriveToken() !== null);
    setRelinking(false);
  }, []);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    await flushDriveQueue().catch(() => {});
    const count = await getDriveQueueCount().catch(() => 0);
    setDriveQueueCount(count);
    setRetrying(false);
  }, []);

  // ── Derived display flags ────────────────────────────────────────────────────
  const showCloudBadge = !!(currentClaim && visible);
  const driveIsLive = isDriveConnected && driveTokenValid;
  const showDriveNotLinked = !isDriveConnected;
  const showDriveExpired = isDriveConnected && !driveTokenValid;
  const showDrivePending = driveIsLive && driveQueueCount > 0;

  const showAnything = showCloudBadge || showDriveNotLinked || showDriveExpired || showDrivePending;
  if (!showAnything) return null;

  return (
    <div className="fixed bottom-24 md:bottom-5 left-4 md:left-[calc(var(--sidebar-width,240px)+16px)] z-50 flex flex-col items-start gap-2 max-w-[calc(100vw-32px)] md:max-w-sm">

      {/* ── Badge 1: Cloud Vault save status ── */}
      {showCloudBadge && (() => {
        const cfgs = {
          saving: {
            icon: <Loader2 size={13} className="animate-spin" />,
            label: 'Saving to Cloud Vault…',
            bg: 'var(--color-neutral-900)', color: 'var(--color-neutral-50)',
            pulse: false,
          },
          saved: {
            icon: <CheckCircle size={13} />,
            label: 'Cloud Vault — Saved',
            bg: 'var(--color-status-success)', color: 'var(--color-neutral-50)',
            pulse: false,
          },
          unsynced: {
            // Calm, not a warning: local save already guarantees the data is
            // safe — this is a normal, expected state between milestones,
            // not a problem the surveyor needs to act on.
            icon: <UploadCloud size={13} />,
            label: 'Saved on device',
            bg: 'var(--color-neutral-900)', color: 'var(--color-neutral-50)',
            pulse: false,
          },
          queued: {
            icon: <WifiOff size={13} />,
            label: 'Cloud Vault — Queued',
            bg: 'var(--color-status-warning)', color: 'var(--color-neutral-50)',
            pulse: true,
          },
          error: {
            icon: <AlertTriangle size={13} />,
            label: 'NOT saved — see Recovered',
            bg: 'var(--color-status-danger)', color: 'var(--color-neutral-50)',
            pulse: true,
          },
          idle: null,
        };
        const cfg = cfgs[saveStatus];
        if (!cfg) return null;
        const relTime = formatRelativeTime(lastSyncedAt);
        const showRelTime = relTime && (saveStatus === 'saved' || saveStatus === 'unsynced');
        return (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-medium shadow-xl"
            style={{ background: cfg.bg, color: cfg.color, backdropFilter: 'blur(8px)', letterSpacing: '0.02em', animation: 'fadeInUp 0.25s ease-out' }}
            title={saveStatus === 'unsynced' ? 'Not yet in Cloud Vault — syncs on tab switch or Save' : undefined}
          >
            {cfg.pulse && <span className="pulse-dot" style={{ background: cfg.color }} />}
            <span style={{ opacity: 0.9 }}>{cfg.icon}</span>
            <span>{cfg.label}</span>
            {showRelTime && (
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 400, marginLeft: 2 }}>— synced {relTime}</span>
            )}
            {saveStatus === 'queued' && (
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 400, marginLeft: 2 }}>— syncs when online</span>
            )}
            {saveStatus === 'unsynced' && (
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 400, marginLeft: 2 }}>— syncing shortly</span>
            )}
          </div>
        );
      })()}

      {/* ── Badge 2: Google Drive — Not Linked ── */}
      {showDriveNotLinked && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-medium shadow-xl"
          style={{ background: 'var(--color-neutral-900)', color: 'var(--color-neutral-50)', backdropFilter: 'blur(8px)', letterSpacing: '0.02em', animation: 'fadeInUp 0.25s ease-out' }}
        >
          <CloudOff size={13} />
          <span>Google Drive — Not Linked</span>
          <button
            onClick={() => setActiveTab('profile')}
            className="ml-1 px-2 py-0.5 rounded-lg text-[10px] font-medium uppercase tracking-wide hover:opacity-80 transition-opacity"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            → Link Drive
          </button>
        </div>
      )}

      {/* ── Badge 2b: Google Drive — Session Expired ── */}
      {showDriveExpired && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-medium shadow-xl"
          style={{ background: 'var(--color-status-warning)', color: 'var(--color-neutral-50)', backdropFilter: 'blur(8px)', letterSpacing: '0.02em', animation: 'fadeInUp 0.25s ease-out' }}
        >
          <AlertTriangle size={13} />
          <span>Google Drive — Session Expired</span>
          <button
            onClick={handleRelinkDrive}
            disabled={relinking}
            className="ml-1 px-2 py-0.5 rounded-lg text-[10px] font-medium uppercase tracking-wide hover:opacity-80 transition-opacity disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            {relinking ? <Loader2 size={10} className="animate-spin" /> : <><Link2 size={10} className="inline mr-0.5" />Re-link</>}
          </button>
        </div>
      )}

      {/* ── Badge 3: Google Drive — Files Pending ── */}
      {showDrivePending && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-medium shadow-xl"
          style={{
            background: isOnline ? 'var(--color-neutral-900)' : 'var(--color-status-warning)',
            color: 'var(--color-neutral-50)',
            backdropFilter: 'blur(8px)',
            letterSpacing: '0.02em',
            animation: 'fadeInUp 0.25s ease-out',
          }}
        >
          {!isOnline && <span className="pulse-dot" style={{ background: 'var(--color-neutral-50)' }} />}
          <CloudOff size={13} />
          <span>
            {driveQueueCount} file{driveQueueCount > 1 ? 's' : ''}{' '}
            {isOnline ? 'pending Drive upload' : 'queued for Drive'}
          </span>
          {isOnline && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="ml-1 px-2 py-0.5 rounded-lg text-[10px] font-medium uppercase tracking-wide hover:opacity-80 transition-opacity disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              {retrying ? <Loader2 size={10} className="animate-spin" /> : <><RefreshCw size={10} className="inline mr-0.5" />Retry</>}
            </button>
          )}
          <span
            className="ml-1 text-[10px] font-normal opacity-60 cursor-pointer hover:opacity-90"
            onClick={() => setActiveTab('profile')}
            title="Manage Drive in Profile"
          >
            {driveEmail ? `(${driveEmail.split('@')[0]})` : ''}
          </span>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 1; }
          60%  { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .pulse-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          animation: pulse-ring 1.4s ease-out infinite;
        }
      `}</style>
    </div>
  );
}
