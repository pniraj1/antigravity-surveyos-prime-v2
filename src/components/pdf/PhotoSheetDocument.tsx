'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';
import type { PhotoSheetOptions } from '@/types/assessment';

// ─── A4 constants (points) ───────────────────────────────────────────────────
// A4 portrait:  595 × 842 pt   |   A4 landscape: 842 × 595 pt
// Header (title + subtitle + border + marginBottom): ~52 pt
// Footer clearance (absolute footer at bottom:20, height ~15 pt):  ~42 pt
// Caption bar per cell: ~14 pt  (padding 4+4 + font 6 pt)
// ─────────────────────────────────────────────────────────────────────────────
const HEADER_H  = 52;
const FOOTER_H  = 42;
const CAPTION_H = 14;
const BORDER_W  =  2; // 1 px border on each side

const ACCENT = '#2563EB';
const DARK   = '#111827';
const GREY   = '#6B7280';

const S = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottom: `2px solid ${ACCENT}`,
    paddingBottom: 8,
  },
  titleSection: { flexDirection: 'column' },
  title: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 7.5,
    color: GREY,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  regBadge: {
    backgroundColor: '#F8FAFC',
    border: `1px solid ${ACCENT}`,
    borderRadius: 2,
    padding: '4 10',
    color: ACCENT,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // bottom margin ensures content never overlaps absolute footer
    marginBottom: FOOTER_H,
  },
  imageContainer: {
    // Grey letterbox bars for non-matching aspect ratios — no cropping
    backgroundColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    objectFit: 'contain',
    width: '100%',
    height: '100%',
  },
  captionRow: {
    backgroundColor: DARK,
    padding: '4 7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
    marginRight: 4,
  },
  indexText: {
    color: '#9CA3AF',
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    flexShrink: 0,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9CA3AF',
    fontFamily: 'Helvetica-Oblique',
    borderTop: `1px solid #E5E7EB`,
    paddingTop: 6,
  },
});

// ─── Layout engine ────────────────────────────────────────────────────────────
interface LayoutConfig {
  cols: number;
  rows: number;
  /** Cell width in pt */
  cellW: number;
  /** Image area height in pt (caption + border subtracted) */
  imageH: number;
  gap: number;
  perPage: number;
  /** Whether the PDF page itself is portrait */
  pagePortrait: boolean;
}

/**
 * Detect whether the majority of photos are portrait-oriented.
 * Falls back to `true` (portrait) when dimension data is absent — matching
 * the typical mobile-camera workflow shown in the surveyor sample image.
 */
function detectPortraitDominant(photos: ClaimData['photos']): boolean {
  const withDims = photos.filter(p => p.w != null && p.h != null);
  if (withDims.length === 0) return true; // default: assume portrait (9:16 mobile)
  const portraitCount = withDims.filter(p => (p.h ?? 0) > (p.w ?? 0)).length;
  return portraitCount >= withDims.length / 2;
}

/**
 * Build layout configuration.
 *
 * Core insight from the surveyor sample (9:16 portrait photo):
 *  • Portrait photos on portrait A4 → use 3-column layouts so cells are
 *    tall enough for the 9:16 ratio to fill the width direction.
 *    Best: 3 cols × 2 rows (6-up). At 10 pt gap, each cell is ~172 × 338 pt;
 *    a 9:16 photo at contain fills width completely (172/338*16/9 ≈ 0.9 ✓).
 *  • Landscape photos → switch page to A4 landscape so wide cells naturally
 *    match 16:9 content. Best: 2 cols × 2 rows (4-up) gives ~386 × ~200 pt
 *    cells; a 16:9 photo fills height almost exactly.
 */
function buildLayout(
  layout: number,
  opts: PhotoSheetOptions,
  pagePortrait: boolean,
): LayoutConfig {
  const pad = opts.pagePadding;
  const g   = opts.cellGap;

  // Page usable dimensions
  const pageW = pagePortrait ? 595 : 842;
  const pageH = pagePortrait ? 842 : 595;
  const usableW = pageW - pad * 2;
  const usableH = pageH - pad * 2;
  const gridH   = usableH - HEADER_H - FOOTER_H;

  const cell = (cols: number, rows: number) => ({
    cellW:   (usableW - g * (cols - 1)) / cols,
    imageH:  (gridH   - g * (rows - 1)) / rows - CAPTION_H - BORDER_W,
  });

  switch (layout) {
    case 2: {
      // 2-up: 2 side-by-side columns, full grid height — large format key shots
      const cols = 2;
      const { cellW } = cell(cols, 1);
      return { cols, rows: 1, cellW, imageH: gridH - CAPTION_H - BORDER_W, gap: g, perPage: 2, pagePortrait };
    }
    case 4: {
      const cols = 2, rows = 2;
      return { cols, rows, ...cell(cols, rows), gap: g, perPage: 4, pagePortrait };
    }
    case 6: {
      // Portrait page → 3 cols × 2 rows (best for 9:16 portrait photos)
      // Landscape page → 3 cols × 2 rows (balanced for 16:9 landscape photos)
      const cols = 3, rows = 2;
      return { cols, rows, ...cell(cols, rows), gap: g, perPage: 6, pagePortrait };
    }
    case 8: {
      const cols = 2, rows = 4;
      return { cols, rows, ...cell(cols, rows), gap: g, perPage: 8, pagePortrait };
    }
    case 9: {
      const cols = 3, rows = 3;
      return { cols, rows, ...cell(cols, rows), gap: g, perPage: 9, pagePortrait };
    }
    default:
      return buildLayout(6, opts, pagePortrait);
  }
}

// ─── Default options (exported for consumers) ─────────────────────────────────
export const DEFAULT_PHOTO_SHEET_OPTIONS: PhotoSheetOptions = {
  pagePadding: 30,
  cellGap:     10,
  showBorder:  true,
  borderColor: '#E5E7EB',
};

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  claim:         ClaimData;
  surveyorName?: string;
  options?:      Partial<PhotoSheetOptions>;
}

export function PhotoSheetDocument({ claim, surveyorName = '', options = {} }: Props) {
  const opts: PhotoSheetOptions = { ...DEFAULT_PHOTO_SHEET_OPTIONS, ...options };

  const photos      = Array.isArray(claim?.photos) ? claim.photos : [];
  const photoLayout = claim?.photoLayout ?? 6;

  // Auto-select page orientation based on dominant photo aspect ratio
  const pagePortrait = detectPortraitDominant(photos);
  const config       = buildLayout(photoLayout, opts, pagePortrait);
  const pad          = opts.pagePadding;

  // Chunk photos into pages
  const pages: typeof photos[] = [];
  for (let i = 0; i < photos.length; i += config.perPage) {
    pages.push(photos.slice(i, i + config.perPage));
  }

  const regNum    = claim?.vehicle?.registrationNumber || 'DRAFT';
  const insurer   = claim?.policy?.insurerName        || '';
  const reportNo  = claim?.reportNo                   || '';
  const claimNum  = claim?.policy?.claimNumber        || 'N/A';

  const pageSize      = config.pagePortrait ? 'A4' : ([842, 595] as [number, number]);
  const footerLeft    = pad;
  const footerRight   = pad;

  const cellBorder = opts.showBorder ? `1px solid ${opts.borderColor}` : undefined;

  return (
    <Document title={`Photo Sheet – ${regNum}`}>
      {pages.length === 0 ? (
        <Page size="A4" style={{ padding: pad, fontFamily: 'Helvetica', fontSize: 10, color: DARK }}>
          <Text style={{ color: GREY, marginTop: 20 }}>No photos have been uploaded for this claim.</Text>
        </Page>
      ) : (
        pages.map((pagePhotos, pageIdx) => (
          <Page
            key={pageIdx}
            size={pageSize}
            style={{ padding: pad, fontFamily: 'Helvetica', fontSize: 9, color: DARK, backgroundColor: '#FFFFFF' }}
          >
            {/* ── Header ── */}
            <View style={S.header}>
              <View style={S.titleSection}>
                {/* Row 1: Surveyor name + Vehicle number */}
                <Text style={S.title}>
                  {surveyorName || 'Surveyor'}{'  ·  '}{regNum}
                </Text>
                {/* Row 2: Insurance company + Report number */}
                <Text style={S.subtitle}>
                  {insurer ? `${insurer}  ·  ` : ''}
                  {reportNo ? `Report No: ${reportNo}` : ''}
                </Text>
              </View>
              <View style={S.regBadge}>
                <Text>PAGE {pageIdx + 1}</Text>
              </View>
            </View>

            {/* ── Photo grid ── */}
            <View style={S.photoGrid}>
              {pagePhotos.map((photo, idx) => {
                const globalIdx   = pageIdx * config.perPage + idx + 1;
                const col         = idx % config.cols;
                const isLastInRow = col === config.cols - 1;

                return (
                  <View
                    key={idx}
                    style={{
                      width:         config.cellW,
                      height:        config.imageH + CAPTION_H + BORDER_W,
                      marginRight:   isLastInRow ? 0 : opts.cellGap,
                      marginBottom:  opts.cellGap,
                      border:        cellBorder,
                      borderRadius:  2,
                      overflow:      'hidden',
                    }}
                  >
                    {/* Image area with contain fit — no cropping */}
                    <View style={[S.imageContainer, { height: config.imageH, width: config.cellW }]}>
                      {photo?.dataUrl ? (
                        <Image src={photo.dataUrl} style={S.photoImage} />
                      ) : (
                        <Text style={{ color: GREY, fontSize: 7 }}>No image</Text>
                      )}
                    </View>

                    {/* Caption bar — index only, no filename */}
                    <View style={[S.captionRow, { justifyContent: 'center' }]}>
                      <Text style={S.indexText}>
                        {String(globalIdx).padStart(2, '0')} / {pageIdx * config.perPage + pagePhotos.length}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── Footer ── */}
            <View style={[S.footer, { left: footerLeft, right: footerRight }]} fixed>
              <Text>SurveyOS Prime  |  Claim: {claimNum}</Text>
              <Text render={({ pageNumber, totalPages }) =>
                `Evidence Sheet  ${pageNumber} / ${totalPages}`
              } />
            </View>
          </Page>
        ))
      )}
    </Document>
  );
}
