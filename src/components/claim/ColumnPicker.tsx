'use client';

import { useEffect, useRef, useState } from 'react';
import { Settings2, Eye, EyeOff } from 'lucide-react';

interface ColumnPickerProps<K extends string> {
  columns: readonly { key: K; label: string; description: string }[];
  visible: Record<K, boolean>;
  /** Columns shown, for the badge. */
  count: number;
  onToggle: (key: K) => void;
  onShowAll: () => void;
  onReset: () => void;
}

/** The "Columns" button and panel, shared by the Assessment and Bill Check grids. */
export function ColumnPicker<K extends string>({ columns, visible, count, onToggle, onShowAll, onReset }: ColumnPickerProps<K>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all border ${
          open
            ? 'bg-primary text-primary-foreground border-primary shadow-md'
            : 'bg-muted/50 hover:bg-muted text-muted-foreground border-transparent hover:border-border'
        }`}
        title="Toggle column visibility"
      >
        <Settings2 size={14} />
        <span className="hidden sm:inline">Columns</span>
        <span className={`ml-0.5 text-[10px] px-1 rounded-full font-medium leading-tight ${open ? 'bg-white/20' : 'bg-primary/20 text-primary'}`}>
          {count}/{columns.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2.5 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold text-foreground">Column Visibility</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Toggle columns to keep the grid clean</p>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {columns.map((col) => (
              <button
                key={col.key}
                onClick={() => onToggle(col.key)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                  visible[col.key] ? 'bg-primary/8 hover:bg-primary/12' : 'hover:bg-muted/50'
                }`}
              >
                <div className={`flex-shrink-0 w-7 h-4 rounded-full relative transition-colors ${
                  visible[col.key] ? 'bg-primary' : 'bg-muted-foreground/20'
                }`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
                    visible[col.key] ? 'left-3.5' : 'left-0.5'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground">{col.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">{col.description}</span>
                </div>
                {visible[col.key]
                  ? <Eye size={12} className="text-primary flex-shrink-0" />
                  : <EyeOff size={12} className="text-muted-foreground/40 flex-shrink-0" />}
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border flex gap-2 bg-muted/20">
            <button onClick={onShowAll} className="flex-1 text-[10px] font-semibold text-primary hover:bg-primary/10 rounded-md py-1.5 transition-colors">
              Show All
            </button>
            <button onClick={onReset} className="flex-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted rounded-md py-1.5 transition-colors">
              Reset Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
