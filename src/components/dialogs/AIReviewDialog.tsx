'use client';

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Check, X, Sparkles } from 'lucide-react';

interface AIReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  data: any;
}

export function AIReviewDialog({ isOpen, onClose, onConfirm, title, data }: AIReviewDialogProps) {
  if (!isOpen) return null;

  // Flatten sample data for display
  const displayFields = Object.entries(data || {})
    .filter(([_, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => ({
      key: k.replace(/_/g, ' ').toUpperCase(),
      value: String(v)
    }));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-lg shadow-2xl border-primary/20 overflow-hidden flex flex-col max-h-[85vh]">
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Sparkles size={20} className="text-primary animate-pulse" />
            AI Review: {title.toUpperCase()}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-medium">
            Review the extracted details before applying them to the claim form.
          </p>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden">
          <div className="h-full max-h-[50vh] p-6 overflow-y-auto">
            <div className="space-y-4">
              {displayFields.length > 0 ? (
                displayFields.map((field, i) => (
                  <div key={i} className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {field.key}
                    </span>
                    <span className="text-sm font-semibold text-foreground bg-zinc-50 px-2 py-1 rounded border border-zinc-100">
                      {field.value || '—'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground italic">
                  No compatible fields found for preview.
                </div>
              )}
              
              {data?.spare_parts?.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                   <div className="text-[10px] font-bold text-blue-700 uppercase mb-2">Spare Parts Extracted</div>
                   <div className="text-xs text-blue-900 font-medium">
                     {data.spare_parts.length} line items detected. These will be added to your assessment table.
                   </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between items-center gap-3 bg-muted/30 p-4 border-t border-border">
          <div className="text-[10px] text-muted-foreground bg-white px-2 py-1 rounded border border-border">
            ONE-BY-ONE PROCESSING ENABLED
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-all active:scale-95"
            >
              <X size={16} />
              Discard
            </button>
            <button
              onClick={onConfirm}
              className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
            >
              <Check size={16} />
              Apply Fields
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
