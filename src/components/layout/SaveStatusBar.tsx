'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { CheckCircle, Loader2, WifiOff, CloudOff } from 'lucide-react';
import { getDriveQueueCount } from '@/lib/storage/indexeddb';

export function SaveStatusBar() {
  const { saveStatus } = useUIStore();
  const { currentClaim } = useClaimStore();
  const [visible, setVisible] = useState(false);
  const [driveQueueCount, setDriveQueueCount] = useState(0);

  // Auto-hide 'saved' badge after 3 seconds
  useEffect(() => {
    if (saveStatus === 'saved') {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    } else if (saveStatus === 'saving' || saveStatus === 'queued') {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [saveStatus]);

  // Poll Drive queue count every 10s so the badge updates after flushes
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const count = await getDriveQueueCount().catch(() => 0);
      if (!cancelled) setDriveQueueCount(count);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const showDrivePending = driveQueueCount > 0;
  const showSaveStatus = currentClaim && visible;

  if (!showSaveStatus && !showDrivePending) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">

      {/* Claim save status */}
      {showSaveStatus && (() => {
        const configs = {
          saving: { icon: <Loader2 size={13} className="animate-spin" />, label: 'Saving...', bg: 'rgba(13,27,42,0.85)', color: '#F8F9FA' },
          saved:  { icon: <CheckCircle size={13} />, label: 'Saved to Cloud', bg: 'rgba(5,150,105,0.9)', color: '#ECFDF5' },
          queued: { icon: <WifiOff size={13} />, label: 'Queued — syncs when online', bg: 'rgba(180,83,9,0.88)', color: '#FFF7ED' },
          idle:   null,
        };
        const config = configs[saveStatus];
        if (!config) return null;
        return (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl"
            style={{ background: config.bg, color: config.color, backdropFilter: 'blur(8px)', letterSpacing: '0.02em', animation: 'fadeInUp 0.25s ease-out' }}
          >
            <span style={{ opacity: 0.9 }}>{config.icon}</span>
            {config.label}
          </div>
        );
      })()}

      {/* Drive upload queue indicator */}
      {showDrivePending && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl cursor-default"
          style={{ background: 'rgba(220,38,38,0.88)', color: '#FFF1F2', backdropFilter: 'blur(8px)', letterSpacing: '0.02em', animation: 'fadeInUp 0.25s ease-out' }}
          title="Files are queued for Drive upload. Link Google Drive in Profile or wait for internet to reconnect."
        >
          <CloudOff size={13} />
          {driveQueueCount} file{driveQueueCount > 1 ? 's' : ''} pending Drive upload
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
