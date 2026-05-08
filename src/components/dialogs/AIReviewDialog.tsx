'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Check, X, Sparkles, RefreshCw } from 'lucide-react';

interface AIReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReScan?: (feedback: string) => void;
  title: string;
  data: any;
  evidenceImages?: string[];
  discrepancies?: string[];
}

export function AIReviewDialog({ isOpen, onClose, onConfirm, onReScan, title, data, evidenceImages = [], discrepancies = [] }: AIReviewDialogProps) {
  const [feedback, setFeedback] = useState('');

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
      <Card className={`w-full ${evidenceImages.length > 0 ? 'max-w-5xl' : 'max-w-lg'} shadow-2xl border-primary/20 overflow-hidden flex flex-col max-h-[85vh]`}>
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Sparkles size={20} className="text-primary animate-pulse" />
            AI Review: {title.toUpperCase()}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-medium">
            Review the extracted details before applying them to the claim form.
          </p>
        </CardHeader>

        <CardContent className={`p-0 flex-1 overflow-hidden flex flex-col ${evidenceImages.length > 0 ? 'md:flex-row' : ''}`}>
          {evidenceImages.length > 0 && (
            <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-border/40 bg-zinc-100/50 flex flex-col">
              <div className="p-3 bg-zinc-100 border-b border-border/40 font-semibold text-xs text-muted-foreground flex items-center justify-between">
                <span>EVIDENCE VIEWER</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-zinc-200">
                  {evidenceImages.length} PAGE{evidenceImages.length > 1 ? 'S' : ''}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[40vh] md:max-h-[60vh] bg-zinc-200/50">
                {evidenceImages.map((img, i) => (
                  <img 
                    key={i} 
                    src={img}
                    alt={`Evidence Page ${i + 1}`} 
                    className="w-full rounded-md shadow-md border border-zinc-200 bg-white" 
                  />
                ))}
              </div>
            </div>
          )}

          <div className={`w-full ${evidenceImages.length > 0 ? 'md:w-1/2' : ''} h-full max-h-[50vh] md:max-h-[60vh] p-6 overflow-y-auto`}>
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
              
              {discrepancies.length > 0 && (
                <div className="mt-4 p-3 bg-red-50/50 rounded-lg border border-red-200">
                   <div className="text-[10px] font-bold text-red-700 uppercase mb-2">Math Validation Warnings</div>
                   <ul className="text-xs text-red-900 font-medium list-disc pl-4 space-y-1">
                     {discrepancies.map((d, idx) => (
                       <li key={idx}>{d}</li>
                     ))}
                   </ul>
                   <div className="text-xs text-red-800 mt-2 font-semibold">
                     Please carefully review the extracted items before applying, or provide feedback below to auto-correct.
                   </div>
                </div>
              )}

              {(data?.spare_parts?.length > 0 || data?.labour_items?.length > 0 || data?.painting_items?.length > 0) && (
                <div className="mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                   <div className="text-[10px] font-bold text-blue-700 uppercase mb-2">Extracted Items Summary</div>
                   <div className="text-xs text-blue-900 font-medium flex flex-wrap gap-4">
                     {data?.spare_parts?.length > 0 && <span>• {data.spare_parts.length} Parts</span>}
                     {data?.labour_items?.length > 0 && <span>• {data.labour_items.length} Labour</span>}
                     {data?.painting_items?.length > 0 && <span>• {data.painting_items.length} Paint</span>}
                   </div>
                </div>
              )}
              
              <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <label className="text-[10px] font-bold text-zinc-600 uppercase mb-2 block tracking-wider">
                  Data missing or incorrect? Tell AI to fix it
                </label>
                <div className="relative">
                  <textarea 
                    className="w-full text-sm p-3 pb-10 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none bg-white"
                    rows={3}
                    placeholder="E.g. 'Items between line 2 and 42 are missing, please pull those lines' or 'Column 3 is Net Amount...'"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && feedback.trim() && onReScan) {
                        e.preventDefault();
                        onReScan(feedback);
                        setFeedback('');
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      if (onReScan && feedback.trim()) {
                        onReScan(feedback);
                        setFeedback('');
                      }
                    }}
                    disabled={!feedback.trim()}
                    className="absolute bottom-2 right-2 flex justify-center items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded text-[10px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={12} />
                    Update Extraction
                  </button>
                </div>
              </div>
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
