'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  EyeOff,
  ShieldAlert,
  CheckCircle2,
  User,
  Lock,
  AlertCircle,
  Mail,
} from 'lucide-react';

export interface TeamManagementSectionProps {
  maxSeats?: number;
  teamEmails?: string[];
  hideEarnings?: boolean;
  ownerEmail?: string;
  onUpdateTeam?: (emails: string[]) => void;
  onUpdateTeamEmails?: (emails: string[]) => void;
  onUpdateHideEarnings?: (hide: boolean) => void;
  onToggleHideEarnings?: (hide: boolean) => void;
}

export function validateAndAddTeamEmail({
  email,
  teamEmails = [],
  maxSeats = 0,
  ownerEmail,
}: {
  email: string;
  teamEmails?: string[];
  maxSeats?: number;
  ownerEmail?: string;
}): { success: boolean; error?: string; updatedEmails?: string[] } {
  const normalized = (email || '').trim().toLowerCase();

  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  if (maxSeats <= 0 || teamEmails.length >= maxSeats) {
    return {
      success: false,
      error:
        maxSeats <= 0
          ? 'Solo account — no team seats allocated. Contact administrator to upgrade.'
          : `Seat limit reached (${teamEmails.length}/${maxSeats}).`,
    };
  }

  if (ownerEmail && normalized === ownerEmail.trim().toLowerCase()) {
    return { success: false, error: 'Cannot add surveyor owner email as an assistant.' };
  }

  if (teamEmails.some((e) => e.trim().toLowerCase() === normalized)) {
    return { success: false, error: 'This assistant is already in your team.' };
  }

  return {
    success: true,
    updatedEmails: [...teamEmails, normalized],
  };
}

export function addTeamMember(
  email: string,
  currentEmails: string[] = [],
  maxSeats: number = 0,
  onUpdate?: (emails: string[]) => void,
  ownerEmail?: string
): { success: boolean; error?: string; updatedEmails?: string[] } {
  const result = validateAndAddTeamEmail({
    email,
    teamEmails: currentEmails,
    maxSeats,
    ownerEmail,
  });

  if (result.success && result.updatedEmails && onUpdate) {
    onUpdate(result.updatedEmails);
  }

  return result;
}

export function toggleHideEarnings(
  current: boolean = false,
  onUpdate?: (hide: boolean) => void
): boolean {
  const next = !current;
  if (onUpdate) {
    onUpdate(next);
  }
  return next;
}

export function TeamManagementSection({
  maxSeats = 0,
  teamEmails = [],
  hideEarnings = true,
  ownerEmail,
  onUpdateTeam,
  onUpdateTeamEmails,
  onUpdateHideEarnings,
  onToggleHideEarnings,
}: TeamManagementSectionProps) {
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState('');

  const usedSeats = teamEmails.length;
  const isLimitReached = maxSeats > 0 && usedSeats >= maxSeats;

  const notifyTeamUpdate = (emails: string[]) => {
    onUpdateTeam?.(emails);
    onUpdateTeamEmails?.(emails);
  };

  const notifyHideEarningsUpdate = (hide: boolean) => {
    onUpdateHideEarnings?.(hide);
    onToggleHideEarnings?.(hide);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateAndAddTeamEmail({
      email: emailInput,
      teamEmails,
      maxSeats,
      ownerEmail,
    });

    if (!result.success) {
      setError(result.error || 'Failed to add team member');
      return;
    }

    setError('');
    setEmailInput('');
    if (result.updatedEmails) {
      notifyTeamUpdate(result.updatedEmails);
    }
  };

  const handleRemove = (email: string) => {
    const updated = teamEmails.filter((e) => e.toLowerCase() !== email.toLowerCase());
    notifyTeamUpdate(updated);
  };

  const handleToggleEarnings = () => {
    toggleHideEarnings(hideEarnings, (val) => {
      notifyHideEarningsUpdate(val);
    });
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between border-b border-border"
        style={{ background: 'var(--color-neutral-100)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-primary">
            <Users size={14} />
          </span>
          <span className="text-sm font-medium text-foreground">
            Team Management &amp; Collaboration
          </span>
        </div>

        {/* Status Badge */}
        {maxSeats === 0 ? (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-[var(--color-neutral-200)] text-[var(--color-neutral-700)]">
            <Lock size={10} /> Solo Account (0 Seats)
          </span>
        ) : isLimitReached ? (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-status-warning-tint text-status-warning">
            <ShieldAlert size={10} /> Seat limit reached ({usedSeats}/{maxSeats})
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-primary/10 text-primary">
            <CheckCircle2 size={10} /> {usedSeats} / {maxSeats} seats used
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Helper Notice */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--color-neutral-50)] border border-border text-xs text-muted-foreground">
          <Users size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Assistant Collaboration Access</p>
            <p>
              Assistants sign in with their own Google account. They can collaborate directly on your
              claims without needing your login password.
            </p>
          </div>
        </div>

        {/* Solo Account Disabled Banner */}
        {maxSeats === 0 ? (
          <div className="p-4 rounded-xl border border-border bg-[var(--color-neutral-50)] text-center space-y-2">
            <div className="inline-flex p-2.5 rounded-full bg-[var(--color-neutral-200)] text-[var(--color-neutral-600)]">
              <Lock size={18} />
            </div>
            <div className="text-xs font-semibold text-foreground">Solo Account (0 Seats)</div>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
              Your account is currently set up for a solo surveyor. To add team members or
              assistants, contact your system administrator to assign team seats.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <input
                type="email"
                placeholder="assistant@gmail.com"
                disabled
                className="px-3 py-2 rounded-lg text-xs border border-border bg-[var(--color-neutral-100)] text-muted-foreground cursor-not-allowed w-64"
              />
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--color-neutral-200)] text-muted-foreground cursor-not-allowed flex items-center gap-1.5"
              >
                <UserPlus size={13} /> Add Member
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Add Team Member Input */}
            <form onSubmit={handleAdd} className="space-y-2">
              <label className="block text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Add Team Member
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (error) setError('');
                    }}
                    disabled={isLimitReached}
                    placeholder="assistant@gmail.com"
                    className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      border: '1px solid var(--color-neutral-200)',
                      background: isLimitReached
                        ? 'var(--color-neutral-100)'
                        : 'var(--color-neutral-50)',
                      color: 'var(--color-neutral-900)',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLimitReached || !emailInput.trim()}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isLimitReached
                      ? 'var(--color-neutral-400)'
                      : 'var(--color-primary)',
                  }}
                >
                  <UserPlus size={13} />
                  Add Member
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-status-danger pt-1">
                  <AlertCircle size={13} />
                  <span>{error}</span>
                </div>
              )}
            </form>

            {/* List of active team members */}
            <div className="space-y-2 pt-2">
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Authorized Assistants ({teamEmails.length} / {maxSeats})
              </div>
              {teamEmails.length === 0 ? (
                <div className="p-3.5 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  No team members added yet. Enter an assistant&apos;s Gmail address above.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-[var(--color-neutral-50)]">
                  {teamEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          <User size={13} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground">{email}</div>
                          <div className="text-[10px] text-muted-foreground">Authorized Assistant</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(email)}
                        title="Remove Assistant"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-status-danger hover:bg-status-danger-tint transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Privacy Toggle: Hide Fee Bills & Professional Earnings */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-border bg-[var(--color-neutral-50)]">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-sm text-primary mt-0.5">
                <EyeOff size={16} />
              </div>
              <div>
                <div className="text-xs font-medium text-foreground">
                  Hide Fee Bills &amp; Professional Earnings
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  When enabled, team members cannot view your fee bills, professional earnings, or
                  bank details. Recommended when collaborating with assistants.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hideEarnings}
              onClick={handleToggleEarnings}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                hideEarnings ? 'bg-primary' : 'bg-[var(--color-neutral-400)]'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  hideEarnings ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
