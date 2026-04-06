'use client';

import { useCallback, useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { uploadFileToDrive } from '@/lib/drive';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DownloadCloud, Trash2, Image as ImageIcon, Settings, Loader2, UploadCloud } from 'lucide-react';
import { PhotoLayout } from '@/types';
import dynamic from 'next/dynamic';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false }
);

const PhotoSheetDocument = dynamic(
  () => import('@/components/pdf/PhotoSheetDocument').then(mod => mod.PhotoSheetDocument),
  { ssr: false }
);

export function PhotosTab() {
  const { currentClaim, addPhoto, deletePhoto, updatePhotoName, updatePhotoLayout } = useClaimStore();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!currentClaim) return null;

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);

    const claimId = currentClaim.id;
    const label   = currentClaim.vehicle?.registrationNumber || claimId;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      try {
        const dataUrl = await compressImage(file, 800, 0.7);
        const name    = file.name.split('.')[0].substring(0, 30);
        addPhoto(dataUrl, name);

        // Non-blocking Drive upload of original file
        uploadFileToDrive(claimId, `photo_${Date.now()}_${name}.jpg`, file, label).catch(() => {});
      } catch (err) {
        console.error('Failed to process image:', file.name, err);
      }
    }

    setIsProcessing(false);
    event.target.value = '';
  }, [addPhoto, currentClaim]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Photo Engine</h2>
          <p className="text-muted-foreground text-sm mt-1">Upload and arrange damage photos. Images are locally compressed.</p>
        </div>

        {currentClaim.photos.length > 0 && (
          <div className="flex items-center gap-3">
            <PDFDownloadLink
              document={<PhotoSheetDocument claim={currentClaim} />}
              fileName={`${currentClaim.vehicle.registrationNumber || 'DRAFT'}-Photo-Sheet.pdf`}
            >
              {/* @ts-ignore */}
              {({ loading }) => (
                <button
                  disabled={loading}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-semibold text-sm transition-all shadow-sm ${
                    loading 
                      ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow'
                  }`}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
                  {loading ? 'Preparing Sheet...' : 'Download Photo Sheet'}
                </button>
              )}
            </PDFDownloadLink>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-card/50 pb-4 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings size={16} className="text-primary" />
                Sheet Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Photos Per Page (PDF layout)</Label>
                <select
                  value={currentClaim.photoLayout}
                  onChange={(e) => updatePhotoLayout(parseInt(e.target.value) as PhotoLayout)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                >
                  <option value="4">4 Photos (Large)</option>
                  <option value="6">6 Photos (Standard)</option>
                  <option value="8">8 Photos (Compact)</option>
                  <option value="9">9 Photos (Grid 3x3)</option>
                </select>
              </div>
              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                <strong>Storage Info:</strong><br/>
                {currentClaim.photos.length} total photo(s).<br/>
                Images are temporarily cached in browser Base64 memory.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gallery Panel */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-border shadow-sm border-dashed bg-muted/10">
            <CardContent className="p-8 flex flex-col items-center justify-center min-h-[200px]">
              <UploadCloud size={48} className="text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-base font-semibold mb-1">Upload Photos</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                Select your collision photos. They will be actively compressed down to save memory avoiding browser lag.
              </p>
              
              <Label 
                htmlFor="photo-upload" 
                className={`cursor-pointer inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {isProcessing ? 'Compressing...' : 'Browse Files'}
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

          {currentClaim.photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentClaim.photos.map((photo, idx) => (
                <div key={idx} className="group relative rounded-lg border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all">
                  <div className="aspect-[4/3] bg-muted relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={photo.dataUrl} 
                      alt={photo.name} 
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <button
                      onClick={() => deletePhoto(idx)}
                      className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-danger hover:bg-danger hover:text-white p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground shadow-sm flex items-center gap-1">
                      <ImageIcon size={10} /> {idx + 1}
                    </div>
                  </div>
                  <div className="p-2 border-t border-border">
                    <Input
                      value={photo.name}
                      onChange={(e) => updatePhotoName(idx, e.target.value)}
                      placeholder="Caption..."
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

// ──────────────────────────────────────────────────────────
// CLIENT-SIDE IMAGE COMPRESSION (Browser CPU)
// ──────────────────────────────────────────────────────────
function compressImage(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No Canvas Context');

        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG to ensure small filesize
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
}
