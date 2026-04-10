'use client';

import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Sparkles, X, Check, AlertTriangle, Info } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { getReconciliationFields, ReconciliationField } from '@/lib/ai/reconciliation';

interface ReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReconciliationDialog({ isOpen, onClose }: ReconciliationDialogProps) {
  const currentClaim = useClaimStore((state) => state.currentClaim);
  const reconcileField = useClaimStore((state) => state.reconcileField);

  const fields = useMemo(() => {
    if (!currentClaim) return [];
    return getReconciliationFields(currentClaim).filter(f => f.hasConflict);
  }, [currentClaim]);

  if (!isOpen || !currentClaim) return null;

  const totalConflicts = fields.length;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-4xl shadow-2xl border-primary/20 overflow-hidden flex flex-col max-h-[90vh] bg-white">
        <CardHeader className="bg-primary/5 border-b border-primary/10 py-6">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary text-2xl font-bold">
                <Sparkles size={24} className="text-primary animate-pulse" />
                Data Reconciliation Hub
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Select the authoritative value for each field from the AI-extracted documents.
              </p>
            </div>
            {totalConflicts > 0 && (
              <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-orange-200">
                <AlertTriangle size={14} />
                {totalConflicts} CONFLICTS DETECTED
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1.5fr,1.5fr,3fr] gap-4 px-6 py-4 bg-muted/30 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <div>Field Name</div>
            <div>Current Value</div>
            <div>Scanned Data (Click to Select)</div>
          </div>

          <div className="flex-1 overflow-y-auto p-0 scrollbar-thin">
            <div className="divide-y divide-border/50">
              {fields.map((field) => (
                <FieldRow 
                  key={field.id} 
                  field={field} 
                  onSelect={(val) => reconcileField(field.path, val)} 
                />
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between items-center gap-3 bg-muted/30 p-6 border-t border-border">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-white/50 px-3 py-2 rounded-lg border border-border">
            <Info size={14} className="text-primary" />
            Selection instantly updates the active claim. Review carefuly before closing.
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-bold bg-zinc-900 text-white shadow-xl shadow-zinc-200 hover:bg-zinc-800 transition-all active:scale-95"
          >
            <Check size={18} />
            Finish Reconciliation
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}

function FieldRow({ field, onSelect }: { field: ReconciliationField; onSelect: (val: string) => void }) {
  const isConflict = field.hasConflict;

  return (
    <div className={`grid grid-cols-[1.5fr,1.5fr,3fr] gap-4 px-6 py-4 items-center transition-colors hover:bg-zinc-50/50 ${isConflict ? 'bg-orange-50/20' : ''}`}>
      <div className="flex flex-col">
        <span className="text-xs font-bold text-foreground">
          {field.label}
        </span>
        {isConflict && (
          <span className="text-[9px] font-extrabold text-orange-600 uppercase flex items-center gap-0.5 mt-0.5">
            <AlertTriangle size={10} /> Discrepancy Found
          </span>
        )}
      </div>

      <div className="text-sm font-medium text-muted-foreground truncate italic">
        {field.current || <span className="opacity-30">Not Set</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {field.sources.map((source, i) => {
          const isSelected = field.current === source.value;
          return (
            <button
              key={`${source.origin}-${i}`}
              onClick={() => onSelect(source.value)}
              className={`
                group flex flex-col items-start px-3 py-1.5 rounded-xl border text-left transition-all max-w-[180px]
                ${isSelected 
                  ? 'bg-primary border-primary text-primary-foreground shadow-md scale-105 z-10' 
                  : 'bg-white border-border text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-95'}
              `}
            >
              <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${isSelected ? 'text-primary-foreground/70' : 'text-primary'}`}>
                {source.label}
              </span>
              <span className="text-xs font-bold truncate w-full">
                {source.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
