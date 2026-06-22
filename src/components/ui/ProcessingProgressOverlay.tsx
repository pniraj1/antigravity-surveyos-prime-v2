'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

interface ProcessingProgressOverlayProps {
  isVisible: boolean;
  progress: string;
  onCancel?: () => void;
}

/**
 * Persistent progress overlay that stays visible even when scrolling.
 * Shows during PDF/document extraction with cancel button.
 */
export function ProcessingProgressOverlay({
  isVisible,
  progress,
  onCancel,
}: ProcessingProgressOverlayProps) {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (isVisible && !startTime) {
      setStartTime(Date.now());
      setElapsedSeconds(0);
    } else if (!isVisible) {
      setStartTime(null);
      setElapsedSeconds(0);
    }
  }, [isVisible, startTime]);

  // Update elapsed time every second
  useEffect(() => {
    if (!isVisible || !startTime) return;

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, startTime]);

  if (!isVisible) return null;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <>
      {/* Fixed overlay backdrop (semi-transparent) */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          zIndex: 9998,
          pointerEvents: 'none',
        }}
      />

      {/* Progress card - fixed position, always visible */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'var(--color-neutral-900)',
          border: '1px solid var(--color-neutral-600)',
          borderRadius: '12px',
          padding: '16px 20px',
          maxWidth: '320px',
          boxShadow: '0 10px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.08)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header with title and close button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--color-neutral-100)',
              fontWeight: 500,
              fontSize: '14px',
            }}
          >
            <Loader2
              size={16}
              style={{
                animation: 'spin 1s linear infinite',
                color: 'var(--color-primary)',
              }}
            />
            Processing
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                background: 'var(--color-neutral-800)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 6px',
                cursor: 'pointer',
                color: 'var(--color-neutral-200)',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--color-neutral-700)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--color-neutral-800)';
              }}
              title="Cancel extraction"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Progress message */}
        <div
          style={{
            color: 'var(--color-neutral-200)',
            fontSize: '13px',
            lineHeight: '1.5',
            marginBottom: '8px',
            minHeight: '20px',
          }}
        >
          {progress || 'Analyzing document...'}
        </div>

        {/* Elapsed time */}
        <div
          style={{
            color: 'var(--color-neutral-400)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Elapsed time</span>
          <span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>
            {formatTime(elapsedSeconds)}
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: '8px',
            height: '3px',
            background: 'var(--color-neutral-700)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'var(--color-primary)',
              animation: 'progress 2s ease-in-out infinite',
              width: '30%',
            }}
          />
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes progress {
          0% { width: 10%; }
          50% { width: 70%; }
          100% { width: 10%; }
        }
      `}</style>
    </>
  );
}
