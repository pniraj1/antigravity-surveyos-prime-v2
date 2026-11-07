'use client';

import React from 'react';
import { Eye, LogOut } from 'lucide-react';
import { useAuthStore, type ViewAsSurveyor } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { toast } from 'sonner';

export interface ViewAsSupportBannerProps {
  viewAsSurveyor?: ViewAsSurveyor | null;
  onExit?: () => void;
}

export function ViewAsSupportBanner({
  viewAsSurveyor: propViewAsSurveyor,
  onExit: propOnExit,
}: ViewAsSupportBannerProps = {}) {
  const storeViewAs = useAuthStore((s) => s.viewAsSurveyor);
  const viewAsSurveyor = propViewAsSurveyor !== undefined
    ? propViewAsSurveyor
    : ((typeof useAuthStore?.getState === 'function' ? useAuthStore.getState().viewAsSurveyor : null) ?? storeViewAs);

  const setViewAsSurveyor = useAuthStore((s) => s.setViewAsSurveyor);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  if (!viewAsSurveyor) return null;

  const displayName = viewAsSurveyor.name || 'Surveyor';
  const displayDetail = viewAsSurveyor.licence || viewAsSurveyor.email || viewAsSurveyor.uid;

  const handleExit = () => {
    if (propOnExit) {
      propOnExit();
      return;
    }
    setViewAsSurveyor(null);
    setActiveTab('admin');
    toast.info('Exited Support Mode. Returned to Admin Panel.');
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2.5 shadow-md flex items-center justify-between gap-3 border-b border-amber-600/30 transition-all"
    >
      <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
        <Eye size={18} className="shrink-0 text-amber-950 animate-pulse" />
        <span>
          SUPPORT MODE: Viewing workspace of{' '}
          <strong className="font-bold underline decoration-amber-950/40">{displayName}</strong>{' '}
          ({displayDetail}) — STRICT READ-ONLY ACCESS
        </span>
      </div>

      <button
        onClick={handleExit}
        aria-label="Exit to Admin Panel"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950 text-white text-xs font-semibold hover:bg-black transition-colors shrink-0 shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-white"
      >
        <LogOut size={13} />
        Exit to Admin Panel
      </button>
    </div>
  );
}
