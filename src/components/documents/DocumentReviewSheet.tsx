'use client';

// ═══════════════════════════════════════════════════════════
// DOCUMENT REVIEW SHEET
// Standard confirm step between picking/capturing a document and
// sending it to the AI vision model. Shows every file in the slot
// (e.g. RC front + back), lets the surveyor:
//   • deselect files they don't want the AI to read
//   • crop an image (e.g. a photo taken from too far away)
// then confirms with (allFiles, filesForAI).
//
// PDFs can be selected/deselected but not cropped (crop is image-only).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check, Crop as CropIcon, FileText, Loader2, Send, X } from 'lucide-react';
import { cropFileToFile } from '@/lib/image/crop';
import { toast } from 'sonner';
import { loadPdf, type LoadedPdf, PDF_THUMB_WIDTH, PDF_THUMB_QUALITY } from '@/lib/photos/pdf-to-images';
import { PdfPageGrid, type PdfPage } from '@/components/documents/PdfPageGrid';
import { setAIPages } from '@/lib/ai/ai-pages';

// Soft cap: Groq's vision model accepts at most 5 images per request. Gemini
// (the primary provider) is more generous, so this is a warning, not a block.
const AI_IMAGE_WARN = 5;

interface DocumentReviewSheetProps {
  open: boolean;
  slotLabel?: string;
  files: File[];
  onConfirm: (allFiles: File[], filesForAI: File[]) => void;
  onCancel: () => void;
}

export function DocumentReviewSheet({ open, slotLabel, files, onConfirm, onCancel }: DocumentReviewSheetProps) {
  // The parent mounts this component fresh on each open (`{reviewSheet && …}`),
  // so props map straight to initial state — no prop→state sync effect needed.
  const [workingFiles, setWorkingFiles] = useState<File[]>(files);
  const [selected, setSelected] = useState<boolean[]>(() => files.map(() => true));
  const [cropIndex, setCropIndex] = useState<number | null>(null);

  // Per-file PDF info, keyed by index into `workingFiles`. Only multi-page
  // PDFs get an entry with pages; a 1-page PDF or an unreadable PDF has no
  // entry and behaves exactly as before (sent whole).
  type PdfInfo = { numPages: number; pages: PdfPage[]; ticked: Set<number> };
  const [pdfInfo, setPdfInfo] = useState<Record<number, PdfInfo>>({});
  const [pdfProbing, setPdfProbing] = useState(false);
  // Indexes into workingFiles whose PDF couldn't be probed (password-protected /
  // corrupt). No page grid for these; the file is still sent whole.
  const [pdfUnreadable, setPdfUnreadable] = useState<Set<number>>(new Set());

  // ponytail: re-probe on crop; key by File identity if it ever matters
  useEffect(() => {
    let cancelled = false;
    const loadedRefs: LoadedPdf[] = [];
    const pdfIndexes = workingFiles.map((f, i) => (f.type === 'application/pdf' ? i : -1)).filter(i => i >= 0);
    if (pdfIndexes.length === 0) return;

    (async () => {
      setPdfProbing(true);
      for (const i of pdfIndexes) {
        if (cancelled) return;
        try {
          const loaded = await loadPdf(workingFiles[i]);
          if (cancelled) { await loaded.destroy(); return; }
          if (loaded.numPages < 2) { await loaded.destroy(); continue; }
          loadedRefs.push(loaded);
          const pageNumbers = Array.from({ length: loaded.numPages }, (_, k) => k + 1);
          setPdfInfo(prev => ({
            ...prev,
            [i]: { numPages: loaded.numPages, pages: [], ticked: prev[i]?.ticked ?? new Set(pageNumbers) },
          }));
          // Thumbnails stream in one by one so a long PDF shows progress.
          for (const p of pageNumbers) {
            const thumb = await loaded.renderPage(p, PDF_THUMB_WIDTH, PDF_THUMB_QUALITY);
            if (cancelled) return;
            setPdfInfo(prev => {
              const cur = prev[i];
              if (!cur) return prev;
              return { ...prev, [i]: { ...cur, pages: [...cur.pages, { pageNumber: p, thumbDataUrl: thumb.dataUrl }] } };
            });
          }
        } catch {
          // Password-protected / corrupt: pages can't be previewed. No entry
          // is created, so the card falls back to sending the file whole —
          // flag it so the card can say so (see render).
          setPdfUnreadable(prev => new Set(prev).add(i));
        }
      }
    })().finally(() => { if (!cancelled) setPdfProbing(false); });

    return () => {
      cancelled = true;
      for (const l of loadedRefs) void l.destroy();
    };
  }, [workingFiles]);

  const togglePage = (fileIndex: number, pageNumber: number) =>
    setPdfInfo(prev => {
      const cur = prev[fileIndex];
      if (!cur) return prev;
      const ticked = new Set(cur.ticked);
      if (ticked.has(pageNumber)) ticked.delete(pageNumber); else ticked.add(pageNumber);
      return { ...prev, [fileIndex]: { ...cur, ticked } };
    });

  // Object URLs for thumbnails/crop — regenerated whenever the files change,
  // revoked on cleanup to avoid leaks.
  const urls = useMemo(() => workingFiles.map((f) => URL.createObjectURL(f)), [workingFiles]);
  useEffect(() => () => { for (const u of urls) URL.revokeObjectURL(u); }, [urls]);

  const isImage = (f: File) => f.type.startsWith('image/');
  // A multi-page PDF with every page unticked is not sent at all.
  const isSent = (i: number) => selected[i] && (pdfInfo[i] ? pdfInfo[i].ticked.size > 0 : true);
  const selectedCount = workingFiles.filter((_, i) => isSent(i)).length;
  // What actually reaches the provider: one image per photo, one per ticked PDF page.
  const selectedImageCount = workingFiles.reduce((n, f, i) => {
    if (!isSent(i)) return n;
    if (isImage(f)) return n + 1;
    return n + (pdfInfo[i]?.ticked.size ?? 1);
  }, 0);

  const toggle = (i: number) =>
    setSelected((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const handleCropped = useCallback((index: number, cropped: File) => {
    setWorkingFiles((prev) => prev.map((f, i) => (i === index ? cropped : f)));
    setCropIndex(null);
  }, []);

  const handleSend = () => {
    const filesForAI = workingFiles.filter((_, i) => isSent(i));
    if (filesForAI.length === 0) return;
    workingFiles.forEach((f, i) => {
      const info = pdfInfo[i];
      if (isSent(i) && info && info.ticked.size < info.numPages) {
        setAIPages(f, [...info.ticked].sort((a, b) => a - b));
      }
    });
    onConfirm(workingFiles, filesForAI);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review before sending to AI</DialogTitle>
          <DialogDescription>
            {slotLabel ? `Add to: ${slotLabel}. ` : ''}
            Tick the files the AI should read. Crop a photo if it was taken from too far away.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto flex flex-col gap-2 py-1">
          {workingFiles.map((file, i) => {
            const info = pdfInfo[i];
            return (
              <div
                key={`${file.name}-${i}`}
                className={`rounded-lg border p-2 transition-colors ${
                  selected[i] ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Select toggle */}
                  <button
                    onClick={() => toggle(i)}
                    aria-label={selected[i] ? 'Exclude from AI' : 'Include in AI'}
                    className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center ${
                      selected[i] ? 'bg-primary border-primary text-white' : 'border-muted-foreground/40 text-transparent'
                    }`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>

                  {/* Thumbnail / PDF card */}
                  {isImage(file) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urls[i]}
                      alt={file.name}
                      className="w-14 h-14 object-cover rounded-md border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-md border border-border shrink-0 flex items-center justify-center bg-muted/40">
                      <FileText size={20} className="text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {isImage(file) ? 'Image' : 'PDF'} · {Math.max(1, Math.round(file.size / 1024))} KB
                      {info && <> · {info.ticked.size} of {info.numPages} pages</>}
                      {pdfUnreadable.has(i) && <> · Can&apos;t preview pages — will be sent whole</>}
                    </p>
                  </div>

                  {/* Crop (images only) */}
                  {isImage(file) && (
                    <button
                      onClick={() => setCropIndex(i)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/50"
                    >
                      <CropIcon size={13} /> Crop
                    </button>
                  )}
                </div>

                {/* Page picker — multi-page PDFs only */}
                {info && selected[i] && (
                  <div className="mt-2 pl-9">
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      Untick pages the AI should skip — cover letters, terms, blank scans.
                    </p>
                    <PdfPageGrid
                      pages={info.pages}
                      checked={info.ticked}
                      onToggle={p => togglePage(i, p)}
                    />
                    {info.pages.length < info.numPages && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Loader2 size={11} className="animate-spin" /> Loading page {info.pages.length + 1} of {info.numPages}…
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-muted-foreground">
            {selectedCount} of {workingFiles.length} selected
            {selectedImageCount > AI_IMAGE_WARN && (
              <span className="block text-status-warning">
                {selectedImageCount} images/pages — some free models accept only {AI_IMAGE_WARN}.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted/50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={selectedCount === 0 || pdfProbing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40"
            >
              <Send size={14} /> Send to AI
            </button>
          </div>
        </div>

        {/* Crop overlay */}
        {cropIndex !== null && (
          <CropOverlay
            imageUrl={urls[cropIndex]}
            file={workingFiles[cropIndex]}
            onDone={(f) => handleCropped(cropIndex, f)}
            onClose={() => setCropIndex(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Crop overlay ─────────────────────────────────────────────────────────────

interface CropOverlayProps {
  imageUrl: string;
  file: File;
  onDone: (cropped: File) => void;
  onClose: () => void;
}

function CropOverlay({ imageUrl, file, onDone, onClose }: CropOverlayProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  const save = async () => {
    if (!areaPixels) return;
    setSaving(true);
    try {
      onDone(await cropFileToFile(file, areaPixels));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not crop the image.');
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-black rounded-lg overflow-hidden">
      <div className="relative flex-1">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="flex items-center gap-3 p-3 bg-black">
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
          aria-label="Zoom"
        />
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium bg-white/10 text-white"
        >
          <X size={14} /> Cancel
        </button>
        <button
          onClick={save}
          disabled={saving || !areaPixels}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold bg-primary text-white disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Apply
        </button>
      </div>
    </div>
  );
}
