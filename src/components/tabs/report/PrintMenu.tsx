'use client';

import { Printer, ChevronDown } from 'lucide-react';

export interface PrintOption {
  label: string;
  onSelect: () => void;
}

/**
 * Toolbar "Print ▾" for a tab. Native <details> does the open/close; picking an
 * option closes it. The caller wires each option through its print gate.
 */
export function PrintMenu({ options, disabled = false }: { options: PrintOption[]; disabled?: boolean }) {
  return (
    <details className="relative group/print">
      <summary
        aria-disabled={disabled}
        className={`list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-semibold cursor-pointer select-none bg-primary text-primary-foreground hover:bg-primary/90 transition-colors ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <Printer size={14} /> Print
        <ChevronDown size={12} className="transition-transform group-open/print:rotate-180" />
      </summary>
      <div className="absolute right-0 top-full mt-1 z-50 min-w-[190px] rounded-lg border border-border bg-card shadow-lg p-1">
        {options.map(o => (
          <button
            key={o.label}
            type="button"
            onClick={(e) => {
              e.currentTarget.closest('details')?.removeAttribute('open');
              o.onSelect();
            }}
            className="w-full text-left px-3 py-2 rounded-md text-xs font-medium hover:bg-muted cursor-pointer"
          >
            {o.label}
          </button>
        ))}
      </div>
    </details>
  );
}
