'use client';

import { useState, type ElementType, type InputHTMLAttributes } from 'react';

type DecimalInputProps = InputHTMLAttributes<HTMLInputElement> & { as?: ElementType };

/**
 * A number box that never steps with the arrow keys or the mouse wheel
 * (a text box with the number keypad on phones).
 *
 * While focused it shows exactly what is typed, so "12." or "0.5" survive the
 * caller's onChange turning them into numbers. The caller's handlers are
 * untouched: every keystroke still reaches onChange as before.
 */
export function DecimalInput({ as: Comp = 'input', value, onChange, onFocus, onBlur, ...rest }: DecimalInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Comp
      {...rest}
      type="text"
      inputMode="decimal"
      value={draft ?? value ?? ''}
      onFocus={(e: React.FocusEvent<HTMLInputElement>) => { setDraft(String(value ?? '')); onFocus?.(e); }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDraft(e.target.value); onChange?.(e); }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => { setDraft(null); onBlur?.(e); }}
    />
  );
}
