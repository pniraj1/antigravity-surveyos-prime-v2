'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** One page of a PDF, already thumbnailed. */
export interface PdfPage {
  pageNumber: number;
  thumbDataUrl: string;
}

interface PdfPageSelectorDialogProps {
  open: boolean;
  /** The PDF's filename (without extension), shown in the dialog title. */
  fileName: string;
  pages: PdfPage[];
  /** Called with the checked page numbers, ascending, when the surveyor confirms. */
  onConfirm: (selectedPageNumbers: number[]) => void;
  /** Called when the surveyor cancels, presses Escape, or dismisses the dialog. */
  onCancel: () => void;
}

/**
 * Every page starts checked — the surveyor rejects the pages they don't
 * want rather than opting each one in, matching how this was described:
 * "surveyor should be able to choose which pages he wants to select and
 * reject."
 */
export function PdfPageSelectorDialog({
  open,
  fileName,
  pages,
  onConfirm,
  onCancel,
}: PdfPageSelectorDialogProps) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set(pages.map(p => p.pageNumber)));
  // Tracks which `pages` array the state above was derived from, so a new
  // PDF's pages reset the selection to "all checked" without a setState-in-
  // effect (React's documented pattern for resetting derived state on a
  // prop change: adjust state during render, not in a useEffect).
  const [checkedFor, setCheckedFor] = useState(pages);
  if (pages !== checkedFor) {
    setCheckedFor(pages);
    setChecked(new Set(pages.map(p => p.pageNumber)));
  }

  const togglePage = (pageNumber: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm([...checked].sort((a, b) => a - b));
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select pages from {fileName}</DialogTitle>
          <DialogDescription>
            Every page is added by default — uncheck any you don&apos;t want in the annexure.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto py-1">
          {pages.map(page => (
            <label
              key={page.pageNumber}
              className="flex flex-col gap-1.5 rounded-md border border-border p-2 cursor-pointer hover:border-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.thumbDataUrl}
                alt={`Page ${page.pageNumber}`}
                className="w-full aspect-[3/4] object-contain bg-muted rounded"
              />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={checked.has(page.pageNumber)}
                  onChange={() => togglePage(page.pageNumber)}
                  className="accent-primary"
                />
                Page {page.pageNumber}
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={checked.size === 0}>
            Add {checked.size} page{checked.size === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
