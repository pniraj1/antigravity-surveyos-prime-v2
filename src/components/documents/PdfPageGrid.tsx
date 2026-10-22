'use client';

/** One page of a PDF, already thumbnailed. */
export interface PdfPage {
  pageNumber: number;
  thumbDataUrl: string;
}

interface PdfPageGridProps {
  pages: PdfPage[];
  checked: Set<number>;
  onToggle: (pageNumber: number) => void;
  className?: string;
  /** Shows "Select all / Unselect all"; true = tick every page, false = none. */
  onSetAll?: (all: boolean) => void;
}

/**
 * Thumbnail grid with a checkbox per page. Shared by the annexure page
 * picker and the AI review sheet so both "choose pages" moments look and
 * behave the same.
 */
export function PdfPageGrid({ pages, checked, onToggle, className = '', onSetAll }: PdfPageGridProps) {
  return (
    <div>
      {onSetAll && (
        <div className="flex gap-3 mb-1.5 text-xs">
          <button type="button" onClick={() => onSetAll(true)} className="text-primary hover:underline">
            Select all
          </button>
          <button type="button" onClick={() => onSetAll(false)} className="text-primary hover:underline">
            Unselect all
          </button>
        </div>
      )}
      <div className={`grid grid-cols-3 gap-3 ${className}`}>
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
                onChange={() => onToggle(page.pageNumber)}
                className="accent-primary"
              />
              Page {page.pageNumber}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
