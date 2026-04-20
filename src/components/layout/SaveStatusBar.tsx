'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { CheckCircle, Loader2, WifiOff, CloudOff, RefreshCw, Link2, AlertTriangle } from 'lucide-react';
import { getDriveQueueCount } from '@/lib/storage/indexeddb';
import { getDriveToken, linkGoogleDrive, flushDriveQueue } from '@/lib/drive';

export function SaveStatusBar() {
  const { saveStatus, isDriveConnected, driveEmail, setActiveTab } = useUIStore();
  const { currentClaim } = useClaimStore();

  const [visible, setVisible] = useState(false);
  const [driveQueueCount, setDriveQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [driveTokenValid, setDriveTokenValid] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [retrying, setRetrying] = useState(false);

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
    if (saveStatus === 'saved') {
      setVisible(true);
    } else if (saveStatus === 'saving' || saveStatus === 'queued') {
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
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">

      {/* ── Badge 1: Cloud Vault save status ── */}
      {showCloudBadge && (() => {
        const cfgs = {
          saving: {
            icon: <Loader2 size={13} className="animate-spin" />,
            label: 'Saving to Cloud Vault…',
            bg: 'rgba(13,27,42,0.88)', color: '#F8F9FA',
            pulse: false,
          },
          saved: {
            icon: <CheckCircle size={13} />,
            label: 'Cloud Vault — Saved',
            bg: 'rgba(5,150,105,0.92)', color: '#ECFDF5',
            pulse: false,
          },
          queued: {
            icon: <WifiOff size={13} />,
            label: 'Cloud Vault — Queued',
            bg: 'rgba(180,83,9,0.90)', color: '#FFF7ED',
            pulse: true,
          },
          idle: null,
        };
        const cfg = cfgs[saveStatus];
        if (!cfg) return null;
        return (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl"
            style={{ background: cfg.bg, color: cfg.color, backdropFilter: 'blur(8px)', letterSpacing: '0.02em', animation: 'fadeInUp 0.25s ease-out' }}
          >
            {cfg.pulse && <span className="pulse-dot" style={{ background: cfg.color }} />}
            <span style={{ opacity: 0.9 }}>{cfg.icon}</span>
            <span>{cfg.label}</span>
            {saveStatus === 'queued' && (
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 400, marginLeft: 2 }}>— syncs when online</span>
            )}
          </div>
        );
      })()}

      {/* ── Badge 2: Google Drive — Not Linked ── */}
      {showDriveNotLinked && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl"
          style={{ background: 'rgba(51,65,85,0.90)', color: '#E2E8F0', backdropFilter: 'blur(8px)', letterSpacing: '0.02em', animation: 'fadeInUp 0.25s ease-out' }}
        >
          <CloudOff size={13} />
          <span>Google Drive — Not Linked</span>
          <button
            onClick={() => setActiveTab('profile')}
            className="ml-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide hover:opacity-80 transition-opacity"
            style={{ background: '#D4AF37', color: '#0D1B2A' }}
          >
            → Link Drive
          </button>
        </div>
      )}

      {/* ── Badge 2b: Google Drive — Session Expired ── */}
      {showDriveExpired && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl"
          style={{ background: 'rgba(194,65,12,0.90)', color: '#FFF7ED', backdropFilter: 'blur(8px)', letterSpacing: '0.02em', animation: 'fadeInUp 0.25s ease-out' }}
        >
          <AlertTriangle size={13} />
          <span>Google Drive — Session Expired</span>
          <button
            onClick={handleRelinkDrive}
            disabled={relinking}
            className="ml-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide hover:opacity-80 transition-opacity disabled:opacity-50"
            style={{ background: '#D4AF37', color: '#0D1B2A' }}
          >
            {relinking ? <Loader2 size={10} className="animate-spin" /> : <><Link2 size={10} className="inline mr-0.5" />Re-link</>}
          </button>
        </div>
      )}

      {/* ── Badge 3: Google Drive — Files Pending ── */}
      {showDrivePending && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl"
          style={{
            background: isOnline ? 'rgba(37,99,235,0.90)' : 'rgba(180,83,9,0.90)',
            color: isOnline ? '#EFF6FF' : '#FFF7ED',
            backdropFilter: 'blur(8px)',
            letterSpacing: '0.02em',
            animation: 'fadeInUp 0.25s ease-out',
          }}
        >
          {!isOnline && <span className="pulse-dot" style={{ background: '#FFF7ED' }} />}
          <CloudOff size={13} />
          <span>
            {driveQueueCount} file{driveQueueCount > 1 ? 's' : ''}{' '}
            {isOnline ? 'pending Drive upload' : 'queued for Drive'}
          </span>
          {isOnline && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="ml-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide hover:opacity-80 transition-opacity disabled:opacity-50"
              style={{ background: '#D4AF37', color: '#0D1B2A' }}
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
