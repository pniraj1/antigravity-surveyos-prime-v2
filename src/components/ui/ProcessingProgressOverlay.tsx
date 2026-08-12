'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useExtractionStore } from '@/stores/extraction-store';
import { tipsFor } from '@/lib/ai/verification-tips';

/** Below this, commentary is a flash of noise rather than something readable. */
const TIP_AFTER_MS = 3_000;
const TIP_ROTATE_MS = 4_000;

/**
 * A one-page RC still running after a minute is stuck; a five-page estimate
 * legitimately takes longer, so a flat threshold would cry wolf on every large
 * document. pagesTotal is 0 until the first progress callback lands, so the
 * floor applies until then.
 */
function escalateAfterMs(pagesTotal: number): number {
  return Math.max(60_000, pagesTotal * 20_000);
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * Live extraction progress.
 *
 * Rendered ONCE from the Dashboard shell, deliberately outside
 * <ErrorBoundary key={activeTab}> so it survives tab switches — the whole
 * point of the extraction store. Do not move it back inside a tab.
 */
export function ProcessingProgressOverlay() {
  const jobs = useExtractionStore(s => s.jobs);
  const cancelJob = useExtractionStore(s => s.cancelJob);

  // Oldest running job — the one the surveyor started first.
  const active = useMemo(() => {
    const running = Object.entries(jobs)
      .filter(([, j]) => j.status === 'processing')
      .sort(([, a], [, b]) => a.startedAt - b.startedAt);
    return running[0] ?? null;
  }, [jobs]);

  const runningCount = useMemo(
    () => Object.values(jobs).filter(j => j.status === 'processing').length,
    [jobs],
  );

  const [elapsedMs, setElapsedMs] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [waitAcknowledged, setWaitAcknowledged] = useState<string[]>([]);

  const activeKey = active?.[0] ?? null;
  const startedAt = active?.[1].startedAt ?? null;

  // Tick while something is running.
  useEffect(() => {
    if (!startedAt) { setElapsedMs(0); return; }
    setElapsedMs(Date.now() - startedAt);
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Rotate tips. Reset the index when the document changes so each starts fresh.
  useEffect(() => {
    setTipIndex(0);
    if (!activeKey) return;
    const id = setInterval(() => setTipIndex(i => i + 1), TIP_ROTATE_MS);
    return () => clearInterval(id);
  }, [activeKey]);

  if (!active) return null;

  const [key, job] = active;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const fraction = job.pagesTotal > 0
    ? Math.min(1, job.pagesDone / job.pagesTotal)
    : 0;

  const tips = tipsFor(key);
  const tip = elapsedMs >= TIP_AFTER_MS && tips.length > 0
    ? tips[tipIndex % tips.length]
    : null;

  const escalated =
    elapsedMs >= escalateAfterMs(job.pagesTotal) && !waitAcknowledged.includes(key);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: 'var(--color-neutral-900)',
        border: '1px solid var(--color-neutral-600)',
        borderRadius: '12px',
        padding: '16px 20px',
        maxWidth: '340px',
        boxShadow: '0 10px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header: the mark doubles as the progress indicator — its field rule
          is literally the line a value gets written on. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
            <g
              fill="none"
              stroke="var(--color-neutral-100)"
              strokeWidth="3.6"
              strokeLinecap="square"
              strokeLinejoin="miter"
              style={{ opacity: 0.5, animation: 'msoPulse 2s ease-in-out infinite' }}
            >
              <path d="M19 8 H8 V56 H19" />
              <path d="M45 8 H56 V56 H45" />
            </g>
            <path
              d="M21.5 40 V22.4 L32 32.6 L42.5 22.4 V40"
              fill="none"
              stroke="var(--color-neutral-100)"
              strokeWidth="4.2"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            {/* track */}
            <rect x="21.5" y="45.4" width="21" height="3.1" fill="var(--color-neutral-100)" opacity="0.18" />
            {/* determinate fill — real pages, not a decorative loop */}
            <rect
              x="21.5"
              y="45.4"
              width={21 * fraction}
              height="3.1"
              fill="#E2705A"
              style={{ transition: 'width 400ms ease-out' }}
            />
          </svg>
          <div style={{ color: 'var(--color-neutral-100)', fontWeight: 500, fontSize: '14px' }}>
            Reading {key.toUpperCase()}
            {runningCount > 1 && (
              <span style={{ color: 'var(--color-neutral-400)', fontWeight: 400 }}>
                {' '}+{runningCount - 1} more
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => cancelJob(key)}
          title="Cancel extraction"
          aria-label="Cancel extraction"
          style={{
            background: 'var(--color-neutral-800)',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 6px',
            cursor: 'pointer',
            color: 'var(--color-neutral-200)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ color: 'var(--color-neutral-200)', fontSize: '13px', lineHeight: 1.5, minHeight: '20px' }}>
        {job.progress || 'Analyzing document…'}
      </div>

      <div
        style={{
          color: 'var(--color-neutral-400)',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '6px',
        }}
      >
        <span>{job.pagesTotal > 0 ? `Page ${job.pagesDone} of ${job.pagesTotal}` : 'Elapsed'}</span>
        <span style={{ fontWeight: 500, color: '#E2705A' }}>{formatTime(elapsedSeconds)}</span>
      </div>

      {/* Verification prompt — occupies the wait AND pushes back on automation
          bias. Never narrates the AI; always tells the surveyor what to check. */}
      {tip && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--color-neutral-700)',
            color: 'var(--color-neutral-300)',
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: 'var(--color-neutral-500)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
            While you wait
          </div>
          {tip}
        </div>
      )}

      {/* Taking longer than expected — promote Cancel from an icon to a real
          choice. Never auto-cancels: killing a nearly-finished job the surveyor
          did not choose to kill is worse than a slow one. */}
      {escalated && (
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-neutral-700)' }}>
          <div style={{ color: 'var(--color-neutral-200)', fontSize: '12px', lineHeight: 1.5, marginBottom: '8px' }}>
            This is taking longer than usual
            {job.pagesTotal > 0 ? ` — page ${job.pagesDone} of ${job.pagesTotal}, ` : ' — '}
            {formatTime(elapsedSeconds)} elapsed.
          </div>
          <button
            onClick={() => cancelJob(key)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              background: '#B03C26',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel extraction
          </button>
          <button
            onClick={() => setWaitAcknowledged(prev => [...prev, key])}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '6px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-neutral-400)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Keep waiting
          </button>
        </div>
      )}

      <style>{`
        @keyframes msoPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
