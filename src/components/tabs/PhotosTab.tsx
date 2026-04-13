'use client';

import { useCallback, useMemo, useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { uploadFileToDrive } from '@/lib/drive';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Trash2, Image as ImageIcon, Settings, Loader2,
  UploadCloud, Eye, EyeOff, LayoutGrid, Sliders,
} from 'lucide-react';
import type { PhotoLayout, PhotoSheetOptions } from '@/types/assessment';
import { DEFAULT_PHOTO_SHEET_OPTIONS } from '@/components/pdf/PhotoSheetDocument';
import dynamic from 'next/dynamic';

// ── Single dynamic boundary per pdf component ────────────────────────────────
// Both PDFDownloadLink/PDFViewer + PhotoSheetDocument must be in the SAME
// static import chunk.  We dynamically load only the outer wrapper here.

const PhotoSheetDownloadButton = dynamic(
  () => import('@/components/pdf/PhotoSheetDownloadButton').then(m => m.PhotoSheetDownloadButton),
  {
    ssr: false,
    loading: () => (
      <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed shadow-sm">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </button>
    ),
  },
);

const PhotoSheetPreview = dynamic(
  () => import('@/components/pdf/PhotoSheetPreview').then(m => m.PhotoSheetPreview),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[72vh] rounded-lg bg-muted/40 flex items-center justify-center gap-3 text-muted-foreground text-sm">
        <Loader2 size={20} className="animate-spin" />
        Loading PDF viewer…
      </div>
    ),
  },
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compress an image to a JPEG data-URL and return its post-compress dimensions. */
function compressImage(
  file: File,
  maxWidth: number,
  quality: number,
): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;
        // Preserve original aspect ratio; cap width
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width  = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), w: width, h: height });
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

const LAYOUT_OPTIONS: { value: PhotoLayout; label: string }[] = [
  { value: 2, label: '2 Photos  –  Large format'      },
  { value: 4, label: '4 Photos  –  2 × 2'             },
  { value: 6, label: '6 Photos  –  3 × 2 (recommended)' },
  { value: 8, label: '8 Photos  –  2 × 4'             },
  { value: 9, label: '9 Photos  –  3 × 3'             },
];

// ─────────────────────────────────────────────────────────────────────────────

export function PhotosTab() {
  const {
    currentClaim,
    addPhoto,
    deletePhoto,
    updatePhotoName,
    updatePhotoLayout,
  } = useClaimStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview,  setShowPreview]  = useState(false);
  const [options, setOptions] = useState<PhotoSheetOptions>({ ...DEFAULT_PHOTO_SHEET_OPTIONS });

  if (!currentClaim) return null;

  // ── Orientation detection (for info badge) ──────────────────────────────
  const dominantOrientation = useMemo(() => {
    const withDims = currentClaim.photos.filter(p => p.w != null && p.h != null);
    if (withDims.length === 0) return 'portrait'; // default (mobile cameras)
    const portraitCount = withDims.filter(p => (p.h ?? 0) > (p.w ?? 0)).length;
    return portraitCount >= withDims.length / 2 ? 'portrait' : 'landscape';
  }, [currentClaim.photos]);

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      setIsProcessing(true);

      const claimId = currentClaim.id;
      const label   = currentClaim.vehicle?.registrationNumber || claimId;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        try {
          const { dataUrl, w, h } = await compressImage(file, 900, 0.78);
          const name = file.name.split('.')[0].substring(0, 30);
          // Store dimensions for orientation detection
          addPhoto(dataUrl, name, w, h);
          uploadFileToDrive(claimId, `photo_${Date.now()}_${name}.jpg`, file, label).catch(() => {});
        } catch {
          // silently skip failed images
        }
      }
      setIsProcessing(false);
      event.target.value = '';
    },
    [addPhoto, currentClaim],
  );

  // ── Options helpers ───────────────────────────────────────────────────────
  const setOpt = <K extends keyof PhotoSheetOptions>(key: K, value: PhotoSheetOptions[K]) =>
    setOptions(prev => ({ ...prev, [key]: value }));

  const resetOptions = () => setOptions({ ...DEFAULT_PHOTO_SHEET_OPTIONS });

  const hasPhotos = currentClaim.photos.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* ── Toolbar ── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Photo Engine</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Upload damage photos. The PDF auto-selects portrait or landscape A4 based on photo orientation.
          </p>
        </div>

        {hasPhotos && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Preview toggle */}
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold text-sm transition-all shadow-sm border ${
                showPreview
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-primary hover:text-primary'
              }`}
            >
              {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPreview ? 'Hide Preview' : 'Preview PDF'}
            </button>

            {/* Download */}
            <PhotoSheetDownloadButton claim={currentClaim} options={options} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* ── Settings panel ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Layout */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-card/50 pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <LayoutGrid size={15} className="text-primary" />
                Layout
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Photos per page</Label>
                <select
                  value={currentClaim.photoLayout}
                  onChange={(e) => updatePhotoLayout(parseInt(e.target.value) as PhotoLayout)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                >
                  {LAYOUT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Orientation badge */}
              {hasPhotos && (
                <div className="flex items-center gap-2 text-xs rounded-md bg-muted px-3 py-2">
                  <span className="text-muted-foreground">Auto-detected:</span>
                  <span className={`font-semibold ${dominantOrientation === 'portrait' ? 'text-blue-600' : 'text-amber-600'}`}>
                    {dominantOrientation === 'portrait' ? '▯ Portrait A4' : '▭ Landscape A4'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PDF options */}
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-card/50 pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sliders size={15} className="text-primary" />
                PDF Options
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">

              {/* Page padding */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">Page margin</Label>
                  <span className="text-xs font-mono text-muted-foreground">{options.pagePadding} pt</span>
                </div>
                <input
                  type="range" min={15} max={45} step={1}
                  value={options.pagePadding}
                  onChange={e => setOpt('pagePadding', parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              {/* Cell gap */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">Gap between photos</Label>
                  <span className="text-xs font-mono text-muted-foreground">{options.cellGap} pt</span>
                </div>
                <input
                  type="range" min={4} max={20} step={1}
                  value={options.cellGap}
                  onChange={e => setOpt('cellGap', parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              {/* Border toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Cell border</Label>
                <button
                  onClick={() => setOpt('showBorder', !options.showBorder)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    options.showBorder ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    options.showBorder ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Border colour (visible when border on) */}
              {options.showBorder && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Border colour</Label>
                  <input
                    type="color"
                    value={options.borderColor}
                    onChange={e => setOpt('borderColor', e.target.value)}
                    className="h-7 w-12 rounded border border-border cursor-pointer p-0.5"
                  />
                </div>
              )}

              {/* Reset */}
              <button
                onClick={resetOptions}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded border border-dashed border-border hover:border-foreground transition-colors"
              >
                Reset to defaults
              </button>
            </CardContent>
          </Card>

          {/* Storage info */}
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md space-y-1">
            <p><strong>{currentClaim.photos.length}</strong> photo(s) loaded</p>
            <p>Stored as compressed JPEG in browser memory (IndexedDB).</p>
            {dominantOrientation === 'portrait' && (
              <p className="text-blue-600 font-medium mt-1">
                Tip: 6-photo (3×2) layout is optimised for your portrait photos.
              </p>
            )}
          </div>
        </div>

        {/* ── Main panel ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* PDF Preview */}
          {showPreview && hasPhotos && (
            <Card className="border-border shadow-sm overflow-hidden">
              <CardHeader className="bg-card/50 pb-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye size={15} className="text-primary" />
                  Live PDF Preview
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Changes to layout or options update the preview instantly
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <PhotoSheetPreview claim={currentClaim} options={options} />
              </CardContent>
            </Card>
          )}

          {/* Upload dropzone */}
          <Card className="border-border shadow-sm border-dashed bg-muted/10">
            <CardContent className="p-8 flex flex-col items-center justify-center min-h-[180px]">
              <UploadCloud size={44} className="text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-base font-semibold mb-1">Upload Photos</h3>
              <p className="text-sm text-muted-foreground mb-5 text-center max-w-sm">
                Select collision photos. Compressed locally to save memory.
                Portrait and landscape photos are handled automatically.
              </p>
              <Label
                htmlFor="photo-upload"
                className={`cursor-pointer inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {isProcessing ? 'Compressing…' : 'Browse Files'}
              </Label>
              <input
                id="photo-upload"
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </CardContent>
          </Card>

          {/* Gallery grid */}
          {hasPhotos && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentClaim.photos.map((photo, idx) => {
                const isPortrait = photo.h != null && photo.w != null && photo.h > photo.w;
                return (
                  <div key={idx} className="group relative rounded-lg border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <div className="aspect-[4/3] bg-muted relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.dataUrl}
                        alt={photo.name}
                        className="absolute inset-0 w-full h-full object-contain bg-muted"
                      />
                      {/* Delete */}
                      <button
                        onClick={() => deletePhoto(idx)}
                        className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-destructive hover:bg-destructive hover:text-white p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                      {/* Index badge */}
                      <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground shadow-sm flex items-center gap-1">
                        <ImageIcon size={9} /> {idx + 1}
                      </div>
                      {/* Orientation pill */}
                      {photo.w != null && photo.h != null && (
                        <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-semibold backdrop-blur-sm ${
                          isPortrait
                            ? 'bg-blue-100/80 text-blue-700'
                            : 'bg-amber-100/80 text-amber-700'
                        }`}>
                          {isPortrait ? '▯' : '▭'}
                        </div>
                      )}
                    </div>
                    <div className="p-2 border-t border-border">
                      <Input
                        value={photo.name}
                        onChange={(e) => updatePhotoName(idx, e.target.value)}
                        placeholder="Caption…"
                        className="h-7 text-xs border-transparent hover:border-input focus:bg-background px-2"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
