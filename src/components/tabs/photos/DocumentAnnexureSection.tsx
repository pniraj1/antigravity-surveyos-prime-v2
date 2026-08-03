'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  FileText, Loader2, RotateCw, Trash2, UploadCloud, Eye, EyeOff, ShieldCheck,
} from 'lucide-react';

import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  partitionPhotos,
  resolveAnnexureOptions,
  DOC_JPEG_QUALITY,
  DOC_MAX_WIDTH,
} from '@/lib/photos/document-annexure';
import { rotateImage90 } from '@/lib/photos/rotate-image';
import { compressImage } from '@/lib/photos/compress-image';
import type { DocumentLayout } from '@/types/assessment';
import type { PageOrientation } from '@/types/assessment';

const DocumentAnnexureDownloadButton = dynamic(
  () => import('@/components/pdf/DocumentAnnexureDownloadButton').then(m => m.DocumentAnnexureDownloadButton),
  {
    ssr: false,
    loading: () => (
      <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed shadow-sm">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </button>
    ),
  },
);

const DocumentAnnexurePreview = dynamic(
  () => import('@/components/pdf/DocumentAnnexurePreview').then(m => m.DocumentAnnexurePreview),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[72vh] rounded-lg bg-muted/40 flex items-center justify-center gap-3 text-muted-foreground text-sm">
        <Loader2 size={20} className="animate-spin" /> Loading PDF viewer…
      </div>
    ),
  },
);

const LAYOUT_OPTIONS: { value: DocumentLayout; label: string }[] = [
  { value: 1, label: '1 per page — densest documents' },
  { value: 2, label: '2 per page — best for screenshots' },
  { value: 4, label: '4 per page — scanned A4 pages' },
];

export function DocumentAnnexureSection() {
  const { currentClaim, addPhoto, deletePhoto, updatePhotoName, replacePhotoImage, updateDocumentAnnexure } =
    useClaimStore();
  const profile = useProfileStore(s => s.profile);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [rotatingIndex, setRotatingIndex] = useState<number | null>(null);

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0 || !currentClaim) return;
      setIsProcessing(true);

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file.type.startsWith('image/')) {
            toast.error(`${file.name} is not an image. PDFs must be screenshotted first.`);
            continue;
          }
          try {
            const { dataUrl, w, h } = await compressImage(file, DOC_MAX_WIDTH, DOC_JPEG_QUALITY, 'image/jpeg');
            const name = file.name.split('.')[0].substring(0, 30);
            // Documents never leave the device: no Drive upload, no queueing,
            // no claim.json backup (see performClaimBackup's driveSafeClaim).
            addPhoto(dataUrl, name, w, h, 'document');
          } catch {
            // A document is attested evidence — unlike a damage photo, a silent
            // drop here would leave the surveyor signing an incomplete annexure.
            toast.error(`Could not read ${file.name}. Try re-taking the screenshot.`);
          }
        }
      } finally {
        setIsProcessing(false);
        event.target.value = '';
      }
    },
    [addPhoto, currentClaim],
  );

  const handleRotate = useCallback(
    async (index: number, dataUrl: string) => {
      setRotatingIndex(index);
      try {
        const rotated = await rotateImage90(dataUrl);
        replacePhotoImage(index, rotated.dataUrl, rotated.w, rotated.h);
      } catch {
        toast.error('Could not rotate this document.');
      } finally {
        setRotatingIndex(null);
      }
    },
    [replacePhotoImage],
  );

  if (!currentClaim) return null;

  const opts = resolveAnnexureOptions(currentClaim.documentAnnexure);
  const documents = partitionPhotos(currentClaim.photos).documents;
  const hasDocuments = documents.length > 0;
  const missingMarks = opts.verified && (!profile.signatureDataUrl || !profile.stampDataUrl);

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">Document Annexure</h2>
          <p className="text-muted-foreground text-sm mt-1">
            RC, DL, policy schedules — any supporting document. Prints as its own PDF,
            separate from the photo sheet.
          </p>
        </div>
        {hasDocuments && (
          <div className="flex items-center gap-2 flex-wrap">
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
            <DocumentAnnexureDownloadButton claim={currentClaim} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-card/50 pb-3 border-b border-border">
              <CardTitle className="text-sm font-medium">Layout</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Documents per page</Label>
                <select
                  value={opts.layout}
                  onChange={e => updateDocumentAnnexure({ layout: Number(e.target.value) as DocumentLayout })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                >
                  {LAYOUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Page orientation</Label>
                <select
                  value={opts.pageOrientation}
                  onChange={e => updateDocumentAnnexure({ pageOrientation: e.target.value as PageOrientation })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                >
                  <option value="portrait">Portrait A4</option>
                  <option value="landscape">Landscape A4</option>
                </select>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Portrait suits phone screenshots. Landscape suits wide cards and scanned
                  pages — and a rotated screenshot, but only at 1 per page.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="bg-card/50 pb-3 border-b border-border">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck size={15} className="text-primary" /> Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Add verified strip</Label>
                <button
                  onClick={() => updateDocumentAnnexure({
                    verified: !opts.verified,
                    ...(!opts.verified && !opts.verifiedDate
                      ? { verifiedDate: new Date().toISOString().split('T')[0] }
                      : {}),
                  })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    opts.verified ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    opts.verified ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {opts.verified && (
                <>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    "Verified with Original", your name, signature and stamp print on every page.
                  </p>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={opts.showLicence}
                      onChange={e => updateDocumentAnnexure({ showLicence: e.target.checked })}
                      className="accent-primary"
                    />
                    IRDAI / IIISLA numbers
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={opts.showDatePlace}
                      onChange={e => updateDocumentAnnexure({ showDatePlace: e.target.checked })}
                      className="accent-primary"
                    />
                    Place and date
                  </label>
                  {opts.showDatePlace && (
                    <div className="space-y-2">
                      <Input
                        value={opts.place}
                        onChange={e => updateDocumentAnnexure({ place: e.target.value })}
                        placeholder="Place"
                        className="h-8 text-xs"
                      />
                      <Input
                        type="date"
                        value={opts.verifiedDate}
                        onChange={e => updateDocumentAnnexure({ verifiedDate: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                  {missingMarks && (
                    <div className="text-[11px] rounded-md bg-status-warning-tint text-status-warning p-2.5 leading-snug">
                      No {!profile.signatureDataUrl ? 'signature' : ''}
                      {!profile.signatureDataUrl && !profile.stampDataUrl ? ' or ' : ''}
                      {!profile.stampDataUrl ? 'stamp' : ''} saved in your Profile. The
                      annexure will print a blank box to sign by hand.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            <p><strong>{documents.length}</strong> document(s) added</p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {showPreview && hasDocuments && (
            <Card className="border-border shadow-sm overflow-hidden">
              <CardHeader className="bg-card/50 pb-3 border-b border-border">
                <CardTitle className="text-sm font-medium">Live PDF Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DocumentAnnexurePreview claim={currentClaim} />
              </CardContent>
            </Card>
          )}

          <Card className="border-border shadow-sm border-dashed bg-muted/10">
            <CardContent className="p-8 flex flex-col items-center justify-center min-h-[180px]">
              <UploadCloud size={44} className="text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-base font-medium mb-1">Add Documents</h3>
              <p className="text-sm text-muted-foreground mb-5 text-center max-w-sm">
                Screenshots of RC, DL, policy schedules and the like. Images only — a PDF
                has to be screenshotted first.
              </p>
              <Label
                htmlFor="document-upload"
                className={`cursor-pointer inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {isProcessing ? 'Processing…' : 'Browse Files'}
              </Label>
              <input
                id="document-upload"
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={isProcessing}
              />
            </CardContent>
          </Card>

          {hasDocuments && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {documents.map(({ item, index }) => (
                <div key={index} className="group relative rounded-lg border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all">
                  <div className="aspect-[3/4] bg-muted relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-contain bg-muted"
                    />
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleRotate(index, item.dataUrl)}
                        disabled={rotatingIndex === index}
                        title="Rotate 90°"
                        className="bg-background/80 backdrop-blur-sm text-foreground hover:bg-primary hover:text-primary-foreground p-1.5 rounded-md"
                      >
                        {rotatingIndex === index
                          ? <Loader2 size={13} className="animate-spin" />
                          : <RotateCw size={13} />}
                      </button>
                      <button
                        onClick={() => deletePhoto(index)}
                        disabled={rotatingIndex !== null}
                        title="Remove"
                        className="bg-background/80 backdrop-blur-sm text-destructive hover:bg-destructive hover:text-white p-1.5 rounded-md"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground shadow-sm flex items-center gap-1">
                      <FileText size={9} /> {item.w} × {item.h}
                    </div>
                  </div>
                  <div className="p-2 border-t border-border">
                    <Input
                      value={item.name}
                      onChange={e => updatePhotoName(index, e.target.value)}
                      placeholder="Caption…"
                      className="h-7 text-xs border-transparent hover:border-input focus:bg-background px-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
