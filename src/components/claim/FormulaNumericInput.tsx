'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { evaluateFormula, isFormulaCandidate } from '@/lib/utils/formula-eval';

export interface FormulaNumericInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
  value: number | undefined | null;
  onChange: (value: number) => void;
  integerOnly?: boolean;
}

export function FormulaNumericInput({
  value,
  onChange,
  integerOnly = false,
  className,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: FormulaNumericInputProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [editValue, setEditValue] = React.useState('');

  // Keep local string in sync with external store updates when not actively typing
  React.useEffect(() => {
    if (!isFocused) {
      setEditValue(value !== undefined && value !== null ? String(value) : '');
    }
  }, [value, isFocused]);

  const commitValue = React.useCallback(
    (textToCommit: string) => {
      const trimmed = textToCommit.trim();
      if (!trimmed) {
        onChange(0);
        setEditValue('0');
        return;
      }

      if (isFormulaCandidate(trimmed)) {
        const result = evaluateFormula(trimmed);
        if (result !== null) {
          const finalVal = integerOnly ? Math.round(result) : result;
          onChange(finalVal);
          setEditValue(String(finalVal));
          return;
        }
      }

      // Handle raw numbers (including potential % suffix)
      const clean = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
      const parsed = integerOnly ? parseInt(clean, 10) : parseFloat(clean);
      if (!Number.isNaN(parsed)) {
        onChange(parsed);
        setEditValue(String(parsed));
      } else {
        // Revert invalid input to existing store value
        setEditValue(value !== undefined && value !== null ? String(value) : '');
      }
    },
    [integerOnly, onChange, value],
  );

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setEditValue(value !== undefined && value !== null ? String(value) : '');
    e.currentTarget.select();
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    commitValue(editValue);
    onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue(editValue);
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditValue(value !== undefined && value !== null ? String(value) : '');
      e.currentTarget.blur();
    }
    onKeyDown?.(e);
  };

  return (
    <Input
      type="text"
      inputMode={integerOnly ? 'numeric' : 'decimal'}
      value={isFocused ? editValue : (value !== undefined && value !== null ? String(value) : '')}
      onChange={(e) => setEditValue(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      {...props}
    />
  );
}
