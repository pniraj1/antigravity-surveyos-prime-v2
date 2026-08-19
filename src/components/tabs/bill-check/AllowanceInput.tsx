'use client';

import { useEffect, useState } from 'react';

interface AllowanceInputProps {
  /** The committed figure. Re-synced whenever it changes from outside. */
  value: number;
  disabled: boolean;
  /** Renders in the warning colour — used when a bill-check allowance is set. */
  highlighted: boolean;
  title?: string;
  onCommit: (value: number) => void;
}

/**
 * A number cell that keeps what you type to itself until you leave it.
 *
 * Committing on every keystroke put a half-typed number in front of the
 * allowance dialog: one backspace on 950 opened it quoting 95, and choosing
 * "Both reports" wrote 95 into a Final Survey Report already filed. The store
 * is written once per edit now — on blur or Enter. Escape abandons the edit.
 */
export function AllowanceInput({ value, disabled, highlighted, title, onCommit }: AllowanceInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  // A commit elsewhere (the scope dialog, a bulk action) must win over a stale
  // draft, otherwise the cell keeps showing a number nothing else agrees with.
  useEffect(() => { setDraft(null); }, [value]);

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    // An emptied cell is not a decision to allow nothing; leave the figure be.
    if (trimmed === '') return;
    const next = Number(trimmed);
    if (!Number.isFinite(next) || next === value) return;
    onCommit(next);
  };

  return (
    <input
      type="number"
      value={draft ?? String(value ?? '')}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
      }}
      disabled={disabled}
      title={title}
      className="px-2 py-1 rounded-lg text-sm text-right border outline-none w-full border-border font-medium"
      style={{
        background: disabled ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
        color: highlighted ? 'var(--color-status-warning)' : 'var(--color-foreground)',
      }}
    />
  );
}
