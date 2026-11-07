import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PhotoSheetDownloadButton,
  downloadPart,
  saveSinglePdf,
  triggerBlobDownload,
} from '../PhotoSheetDownloadButton';
import { createBlankClaim } from '@/types/claim';
import { saveReportToClaimFolder } from '@/lib/reports/auto-file-report';
import type { SplitPdfResult, SplitPart } from '@/lib/pdf/split-pdf';

let mockRenderProps: {
  blob: Blob | null;
  loading: boolean;
  error: Error | null;
} = {
  blob: new Blob(['dummy pdf'], { type: 'application/pdf' }),
  loading: false,
  error: null,
};

vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children, fileName }: any) => {
    if (typeof children === 'function') {
      return children(mockRenderProps);
    }
    return <a data-testid="pdf-link" href="#" download={fileName}>{children}</a>;
  },
}));

vi.mock('../PhotoSheetDocument', () => ({
  PhotoSheetDocument: () => <div data-testid="mock-document" />,
}));

vi.mock('../SharePdfButton', () => ({
  SharePdfButton: ({ fileName }: { fileName: string }) => (
    <button data-testid={`share-${fileName}`}>Share</button>
  ),
}));

vi.mock('@/stores/profile-store', () => ({
  useProfileStore: (selector: any) => {
    const state = { profile: { name: 'Test Surveyor' } };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('@/lib/reports/auto-file-report', () => ({
  saveReportToClaimFolder: vi.fn().mockResolvedValue(true),
}));

describe('PhotoSheetDownloadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRenderProps = {
      blob: new Blob(['dummy pdf content'], { type: 'application/pdf' }),
      loading: false,
      error: null,
    };
  });

  it('renders normal single Download PDF button when PDF is <= 1.95MB (or isSplit is false)', () => {
    const claim = createBlankClaim('final', 'private');
    claim.vehicle.registrationNumber = 'MH-12-AB-1234';

    const unSplitResult: SplitPdfResult = {
      isSplit: false,
      parts: [
        {
          partNumber: 1,
          totalParts: 1,
          blob: new Blob(['pdf-1']),
          pageStart: 1,
          pageEnd: 4,
          sizeBytes: 1.5 * 1024 * 1024,
        },
      ],
      originalSizeBytes: 1.5 * 1024 * 1024,
      totalPages: 4,
    };

    const html = renderToStaticMarkup(
      <PhotoSheetDownloadButton claim={claim} options={{}} splitResult={unSplitResult} />
    );

    expect(html).toContain('Download PDF');
    expect(html).not.toContain('Split into');
    expect(html).not.toContain('Download Part 1');
  });

  it('renders multiple part buttons when PDF is > 1.95MB (or isSplit is true)', () => {
    const claim = createBlankClaim('final', 'private');
    claim.vehicle.registrationNumber = 'MH-12-AB-1234';

    const part1Blob = new Blob(['part 1 content'], { type: 'application/pdf' });
    const part2Blob = new Blob(['part 2 content'], { type: 'application/pdf' });

    const splitResult: SplitPdfResult = {
      isSplit: true,
      parts: [
        {
          partNumber: 1,
          totalParts: 2,
          blob: part1Blob,
          pageStart: 1,
          pageEnd: 4,
          sizeBytes: Math.round(1.4 * 1024 * 1024),
        },
        {
          partNumber: 2,
          totalParts: 2,
          blob: part2Blob,
          pageStart: 5,
          pageEnd: 8,
          sizeBytes: Math.round(1.2 * 1024 * 1024),
        },
      ],
      originalSizeBytes: Math.round(2.6 * 1024 * 1024),
      totalPages: 8,
    };

    const html = renderToStaticMarkup(
      <PhotoSheetDownloadButton claim={claim} options={{}} splitResult={splitResult} />
    );

    // Verify split badge / helper text
    expect(html).toContain('Split into 2 parts (&lt;2 MB each)');

    // Verify individual part buttons
    expect(html).toContain('Download Part 1 (Pages 1–4 · 1.4 MB)');
    expect(html).toContain('Download Part 2 (Pages 5–8 · 1.2 MB)');

    // Verify Share button rendered for each part
    expect(html).toContain('data-testid="share-MH-12-AB-1234-Photo-Sheet-Part1.pdf"');
    expect(html).toContain('data-testid="share-MH-12-AB-1234-Photo-Sheet-Part2.pdf"');
  });

  it('renders preparing state while loading is true', () => {
    const claim = createBlankClaim('final', 'private');
    mockRenderProps = {
      blob: null,
      loading: true,
      error: null,
    };

    const html = renderToStaticMarkup(
      <PhotoSheetDownloadButton claim={claim} options={{}} />
    );

    expect(html).toContain('Preparing…');
    expect(html).toContain('disabled');
  });

  it('renders error button if react-pdf throws an error', () => {
    const claim = createBlankClaim('final', 'private');
    mockRenderProps = {
      blob: null,
      loading: false,
      error: new Error('Corrupted image asset'),
    };

    const html = renderToStaticMarkup(
      <PhotoSheetDownloadButton claim={claim} options={{}} />
    );

    expect(html).toContain('PDF Error');
    expect(html).toContain('Corrupted image asset');
  });

  describe('clicking part button / downloadPart execution', () => {
    const originalDocument = globalThis.document;
    const originalUrl = globalThis.URL;

    afterEach(() => {
      globalThis.document = originalDocument;
      globalThis.URL = originalUrl;
    });

    it('triggers download (via Blob URL) and calls saveReportToClaimFolder for the part', async () => {
      const claim = createBlankClaim('final', 'private');
      claim.vehicle.registrationNumber = 'MH-12-AB-1234';

      const mockBlob = new Blob(['part 1 pdf bytes'], { type: 'application/pdf' });
      const part: SplitPart = {
        partNumber: 1,
        totalParts: 2,
        blob: mockBlob,
        pageStart: 1,
        pageEnd: 4,
        sizeBytes: 1000,
      };

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      const appendChildSpy = vi.fn();
      const removeChildSpy = vi.fn();

      globalThis.document = {
        createElement: vi.fn().mockImplementation((tag: string) => {
          if (tag === 'a') return mockAnchor;
          return {};
        }),
        body: {
          appendChild: appendChildSpy,
          removeChild: removeChildSpy,
        },
      } as any;

      const createObjectURLSpy = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
      const revokeObjectURLSpy = vi.fn();

      globalThis.URL.createObjectURL = createObjectURLSpy;
      globalThis.URL.revokeObjectURL = revokeObjectURLSpy;

      const partFileName = await downloadPart(claim, 'MH-12-AB-1234', part);

      expect(partFileName).toBe('MH-12-AB-1234-Photo-Sheet-Part1.pdf');
      expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
      expect(mockAnchor.download).toBe('MH-12-AB-1234-Photo-Sheet-Part1.pdf');
      expect(mockAnchor.href).toBe('blob:http://localhost/test-uuid');
      expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/test-uuid');

      expect(saveReportToClaimFolder).toHaveBeenCalledWith(
        claim,
        'MH-12-AB-1234-Photo-Sheet-Part1.pdf',
        mockBlob,
        'damagePhotos'
      );
    });

    it('handles triggerBlobDownload gracefully when window or document is undefined', () => {
      globalThis.document = undefined as any;
      expect(() => triggerBlobDownload(new Blob(['test']), 'test.pdf')).not.toThrow();
    });

    it('calls saveReportToClaimFolder when single PDF save is triggered', async () => {
      const claim = createBlankClaim('final', 'private');
      claim.vehicle.registrationNumber = 'MH-12-AB-1234';
      const testBlob = new Blob(['unsplit pdf content'], { type: 'application/pdf' });

      const saved = await saveSinglePdf(claim, 'MH-12-AB-1234-Photo-Sheet.pdf', testBlob);
      expect(saved).toBe(true);

      expect(saveReportToClaimFolder).toHaveBeenCalledWith(
        claim,
        'MH-12-AB-1234-Photo-Sheet.pdf',
        testBlob,
        'damagePhotos'
      );
    });

    it('returns false when saveSinglePdf is passed null blob', async () => {
      const claim = createBlankClaim('final', 'private');
      const saved = await saveSinglePdf(claim, 'MH-12-AB-1234-Photo-Sheet.pdf', null);
      expect(saved).toBe(false);
      expect(saveReportToClaimFolder).not.toHaveBeenCalled();
    });
  });
});
