'use client';

import React, { useState } from 'react';
import { HardDrive, Shield, FileText, CloudOff } from 'lucide-react';
import { linkGoogleDrive } from '@/lib/drive';

interface DriveGateScreenProps {
  isRelink?: boolean;
}

export function DriveGateScreen({ isRelink = false }: DriveGateScreenProps) {
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  const handleLink = async () => {
    setLinking(true);
    setError('');
    try {
      const ok = await linkGoogleDrive();
      if (!ok) setError('Drive connection was cancelled. Please try again.');
    } catch {
      setError('Failed to connect Google Drive. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--color-neutral-50)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6 shadow-xl bg-card border border-border"
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
          style={{ background: 'var(--color-neutral-900)' }}
        >
          {isRelink ? (
            <CloudOff size={28} style={{ color: 'var(--color-status-danger)' }} />
          ) : (
            <HardDrive size={28} style={{ color: 'var(--color-primary)' }} />
          )}
        </div>

        {/* Heading */}
        <div className="text-center flex flex-col gap-1">
          <h1 className="text-lg font-medium text-foreground tracking-tight">
            {isRelink ? 'Google Drive Disconnected' : 'Connect Google Drive'}
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isRelink
              ? 'Your Drive session expired. Re-connect to continue working.'
              : 'SurveyOS stores all your documents, photos, and reports on your personal Google Drive. This is required to use the app.'}
          </p>
        </div>

        {/* Why list — only on first link */}
        {!isRelink && (
          <div className="w-full flex flex-col gap-2">
            {[
              { icon: FileText, text: 'Claim documents & photos stored on your Drive' },
              { icon: Shield, text: 'You own your data — not stored on our servers' },
              { icon: HardDrive, text: 'Works offline, syncs when connected' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10"
                >
                  <Icon size={13} style={{ color: 'var(--color-primary)' }} />
                </div>
                <span className="text-xs text-foreground">{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-status-danger text-center">{error}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleLink}
          disabled={linking}
          className="w-full py-3 rounded-xl text-sm font-medium tracking-wide transition-opacity"
          style={{
            background: linking ? 'var(--color-neutral-400)' : 'var(--color-neutral-900)',
            color: 'var(--color-primary)',
            opacity: linking ? 0.7 : 1,
            cursor: linking ? 'not-allowed' : 'pointer',
          }}
        >
          {linking ? 'Connecting…' : isRelink ? 'Re-connect Google Drive' : 'Connect Google Drive'}
        </button>

        <p className="text-[10px] text-muted-foreground text-center">
          Only your own Google account is accessed. No data leaves your Drive.
        </p>
      </div>
    </div>
  );
}
