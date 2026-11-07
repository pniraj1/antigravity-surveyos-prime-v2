'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { addDaysToDate } from '@/lib/subscription/status';

export interface ExtendSubscriptionModalProps {
  isOpen: boolean;
  surveyor: {
    id: string;
    name: string;
    subscriptionExpiry: string;
  } | null;
  onConfirm: (uid: string, days: number) => void;
  onClose: () => void;
}

export const PRESET_OPTIONS = [
  { days: 30, label: '+30 Days', subtext: '1 Mo' },
  { days: 90, label: '+90 Days', subtext: '3 Mo' },
  { days: 180, label: '+180 Days', subtext: '6 Mo' },
  { days: 365, label: '+365 Days', subtext: '1 Yr' },
];

export function formatExpiryDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (!isNaN(year) && monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
      return `${String(day).padStart(2, '0')} ${months[monthIdx]} ${year}`;
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export function ExtendSubscriptionModal({
  isOpen,
  surveyor,
  onConfirm,
  onClose,
}: ExtendSubscriptionModalProps) {
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    if (isOpen) {
      setDays(30);
    }
  }, [isOpen, surveyor?.id]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !surveyor) return null;

  const currentExpiryFormatted = formatExpiryDate(surveyor.subscriptionExpiry);
  const newExpiryIso = addDaysToDate(surveyor.subscriptionExpiry || null, days);
  const newExpiryFormatted = formatExpiryDate(newExpiryIso);

  const handleConfirm = () => {
    const daysToExtend = Math.max(1, days || 30);
    onConfirm(surveyor.id, daysToExtend);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="extend-modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h3 id="extend-modal-title" className="text-base font-semibold text-foreground">
                Extend Subscription
              </h3>
              <p className="text-xs text-muted-foreground">{surveyor.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Current Expiry Display */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-xs">
            <span className="text-muted-foreground font-medium">Current Expiry</span>
            <span className="font-semibold text-foreground">{currentExpiryFormatted}</span>
          </div>

          {/* Quick Preset Pills */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Quick Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_OPTIONS.map((preset) => {
                const isActive = days === preset.days;
                return (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setDays(preset.days)}
                    aria-label={`Extend by ${preset.days} days`}
                    aria-pressed={isActive}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-2 border-primary shadow-sm'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span
                      className={`text-[10px] font-normal ${
                        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}
                    >
                      ({preset.subtext})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Days Input */}
          <div>
            <label
              htmlFor="extend-days"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5"
            >
              Custom Days
            </label>
            <input
              id="extend-days"
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setDays(isNaN(val) ? 0 : Math.max(0, Math.min(365, val)));
              }}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Live Expiry Preview Box */}
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs">
            <span className="text-muted-foreground font-medium">New Expiry: </span>
            <span className="font-semibold text-foreground">
              {newExpiryFormatted}{' '}
              <span className="text-primary font-medium">(+{days} days from current expiry)</span>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!days || days <= 0}
            className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-primary/90 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Confirm &amp; Extend
          </button>
        </div>
      </div>
    </div>
  );
}
