'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { CheckCircle, Loader2, WifiOff, Save } from 'lucide-react';

const STATUS_CONFIG = {
  idle: null, // Hidden when idle and no active claim
  saving: {
    icon: <Loader2 size={13} className="animate-spin" />,
    label: 'Saving...',
    bg: 'rgba(13,27,42,0.85)',
    color: '#F8F9FA',
    border: 'transparent',
  },
  saved: {
    icon: <CheckCircle size={13} />,
    label: 'Saved to Cloud',
    bg: 'rgba(5,150,105,0.9)',
    color: '#ECFDF5',
    border: 'transparent',
  },
  queued: {
    icon: <WifiOff size={13} />,
    label: 'Queued — syncs when online',
    bg: 'rgba(180,83,9,0.88)',
    color: '#FFF7ED',
    border: 'transparent',
  },
};

export function SaveStatusBar() {
  const { saveStatus } = useUIStore();
  const { currentClaim } = useClaimStore();
  const [visible, setVisible] = useState(false);
  const [prevStatus, setPrevStatus] = useState(saveStatus);

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
    setPrevStatus(saveStatus);
  }, [saveStatus]);

  // Only show when there is an active claim
  if (!currentClaim || !visible) return null;

  const config = STATUS_CONFIG[saveStatus];
  if (!config) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl transition-all duration-300"
      style={{
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        backdropFilter: 'blur(8px)',
        animation: 'fadeInUp 0.25s ease-out',
        letterSpacing: '0.02em',
      }}
    >
      <span style={{ opacity: 0.9 }}>{config.icon}</span>
      {config.label}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}
