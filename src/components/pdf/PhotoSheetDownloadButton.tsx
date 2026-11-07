'use client';
/**
 * PhotoSheetDownloadButton
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * @react-pdf/renderer's <PDFDownloadLink> requires its `document` prop to be
 * a *real* react-pdf <Document> element.  If PhotoSheetDocument is loaded via
 * Next.js `dynamic()` it becomes a React component wrapper — not a real
 * react-pdf Document — and PDFDownloadLink silently fails or throws.
 *
 * Fix: keep BOTH imports static here, then wrap *this entire component*
 * in a single `dynamic()` call (ssr:false) from the consumer (PhotosTab).
 */

// ── Static imports (both must live in the same bundle chunk) ─────────────────
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PhotoSheetDocument } from './PhotoSheetDocument';
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import type { ClaimData } from '@/types';
import type { PhotoSheetOptions } from '@/types/assessment';
import { DownloadCloud, Loader2 } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';
import { SharePdfButton } from './SharePdfButton';
import { saveReportToClaimFolder } from '@/lib/reports/auto-file-report';
import { splitPdfBySize, type SplitPdfResult, type SplitPart } from '@/lib/pdf/split-pdf';

interface Props {
  claim: ClaimData;
  options: Partial<PhotoSheetOptions>;
  splitResult?: SplitPdfResult | null;
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  if (typeof window === 'undefined' && typeof document === 'undefined') return;
  const targetDoc = typeof document !== 'undefined' ? document : (globalThis as any).document;
  const targetUrl = typeof URL !== 'undefined' ? URL : (globalThis as any).URL;
  if (!targetDoc || !targetUrl?.createObjectURL) return;

  const url = targetUrl.createObjectURL(blob);
  const a = targetDoc.createElement('a');
  a.href = url;
  a.download = fileName;
  targetDoc.body.appendChild(a);
  a.click();
  targetDoc.body.removeChild(a);
  if (targetUrl.revokeObjectURL) {
    targetUrl.revokeObjectURL(url);
  }
}

export async function downloadPart(
  claim: ClaimData,
  regNum: string,
  part: SplitPart
): Promise<string> {
  const partFileName = `${regNum}-Photo-Sheet-Part${part.partNumber}.pdf`;
  triggerBlobDownload(part.blob, partFileName);
  await saveReportToClaimFolder(claim, partFileName, part.blob, 'damagePhotos');
  return partFileName;
}

export async function saveSinglePdf(
  claim: ClaimData,
  fileName: string,
  blob: Blob | null
): Promise<boolean> {
  if (!blob) return false;
  return saveReportToClaimFolder(claim, fileName, blob, 'damagePhotos');
}

interface ContentProps {
  claim: ClaimData;
  regNum: string;
  defaultFileName: string;
  blob: Blob | null;
  loading: boolean;
  error: Error | string | null;
  initialSplitResult?: SplitPdfResult | null;
}

export function PhotoSheetDownloadContent({
  claim,
  regNum,
  defaultFileName,
  blob,
  loading,
  error,
  initialSplitResult = null,
}: ContentProps) {
  const [splitResult, setSplitResult] = useState<SplitPdfResult | null>(initialSplitResult);
  const [isSplitting, setIsSplitting] = useState(false);

  useEffect(() => {
    let active = true;

    if (initialSplitResult) {
      setSplitResult(initialSplitResult);
      setIsSplitting(false);
      return;
    }

    if (!blob) {
      setSplitResult(null);
      setIsSplitting(false);
      return;
    }

    setIsSplitting(true);
    splitPdfBySize(blob)
      .then((res) => {
        if (active) {
          setSplitResult(res);
          setIsSplitting(false);
        }
      })
      .catch((err) => {
        console.warn('[PhotoSheetDownloadButton] splitPdfBySize failed, falling back to unsplit:', err);
        if (active) {
          setSplitResult({
            isSplit: false,
            parts: [
              {
                partNumber: 1,
                totalParts: 1,
                blob,
                pageStart: 1,
                pageEnd: 1,
                sizeBytes: blob.size,
              },
            ],
            originalSizeBytes: blob.size,
            totalPages: 1,
          });
          setIsSplitting(false);
        }
      });

    return () => {
      active = false;
    };
  }, [blob, initialSplitResult]);

  if (error) {
    return (
      <button
        disabled
        title={String(error)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-sm bg-destructive/20 text-destructive cursor-not-allowed shadow-sm"
      >
        <DownloadCloud size={16} /> PDF Error
      </button>
    );
  }

  if (loading || isSplitting) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <button
          disabled
          className="flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-sm transition-all shadow-sm bg-muted text-muted-foreground cursor-not-allowed"
        >
          <Loader2 size={16} className="animate-spin" />
          Preparing…
        </button>
        <SharePdfButton blob={null} fileName={defaultFileName} />
      </span>
    );
  }

  if (splitResult?.isSplit) {
    return (
      <span
        className="flex flex-wrap items-center gap-2"
        onClick={(e) => {
          // Prevent any stray click inside multi-part container from triggering outer PDFDownloadLink
          e.stopPropagation();
        }}
      >
        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
          PDF &gt; 2 MB — Split into {splitResult.parts.length} parts (&lt;2 MB each)
        </span>
        {splitResult.parts.map((p) => {
          const partFileName = `${regNum}-Photo-Sheet-Part${p.partNumber}.pdf`;
          const sizeMb = (p.sizeBytes / (1024 * 1024)).toFixed(1);
          return (
            <span key={p.partNumber} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void downloadPart(claim, regNum, p);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold text-sm transition-all shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow"
              >
                <DownloadCloud size={16} />
                Download Part {p.partNumber} (Pages {p.pageStart}–{p.pageEnd} · {sizeMb} MB)
              </button>
              <SharePdfButton blob={p.blob} fileName={partFileName} />
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        disabled={loading}
        onClick={() => {
          void saveSinglePdf(claim, defaultFileName, blob);
        }}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-sm transition-all shadow-sm ${
          loading
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow'
        }`}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
        {loading ? 'Preparing…' : 'Download PDF'}
      </button>
      <SharePdfButton blob={loading ? null : blob} fileName={defaultFileName} />
    </span>
  );
}

export function PhotoSheetDownloadButton({ claim, options, splitResult }: Props) {
  const surveyorName = useProfileStore((s) => s.profile.name);
  const regNum = claim?.vehicle?.registrationNumber || 'DRAFT';
  const fileName = `${regNum}-Photo-Sheet.pdf`;

  return (
    <PDFDownloadLink
      document={<PhotoSheetDocument claim={claim} surveyorName={surveyorName} options={options} />}
      fileName={fileName}
    >
      {({ blob, loading, error }) => (
        <PhotoSheetDownloadContent
          claim={claim}
          regNum={regNum}
          defaultFileName={fileName}
          blob={blob}
          loading={loading}
          error={error}
          initialSplitResult={splitResult}
        />
      )}
    </PDFDownloadLink>
  );
}
