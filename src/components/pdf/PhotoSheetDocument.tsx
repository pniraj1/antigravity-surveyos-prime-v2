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
const HEADER_H  = 45;
const FOOTER_H  = 25;
const CAPTION_H = 0;
const BORDER_W  = 2; // 1 px border on each side

const ACCENT = '#2563EB';
const DARK   = '#111827';
const GREY   = '#6B7280';

const S = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottom: `2px solid ${ACCENT}`,
    paddingBottom: 6,
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
    // White background to match page, images will cover to avoid letterboxing
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    objectFit: 'fill',
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
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9CA3AF',
    fontFamily: 'Helvetica-Oblique',
    paddingTop: 4,
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

// Removed auto-detect orientation logic as per user request

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
      // Portrait page → 2 cols × 3 rows (best for portrait mobile photos)
      // Landscape page → 3 cols × 2 rows (balanced for landscape photos)
      const cols = pagePortrait ? 2 : 3;
      const rows = pagePortrait ? 3 : 2;
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
  pagePadding: 20,
  cellGap:     8,
  showBorder:  true,
  borderColor: '#E5E7EB',
  pageOrientation: 'portrait',
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

  // Use manual page orientation override
  const pagePortrait = opts.pageOrientation !== 'landscape';
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
                    {/* Image area with cover fit — full grid cell filling */}
                    <View style={[S.imageContainer, { height: config.imageH, width: config.cellW }]}>
                      {photo?.dataUrl ? (
                        <Image src={photo.dataUrl} style={S.photoImage} />
                      ) : (
                        <Text style={{ color: GREY, fontSize: 7 }}>No image</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── Footer ── */}
            <View style={[S.footer, { left: footerLeft, right: footerRight }]} fixed>
              <Text>SurveyOS Prime</Text>
            </View>
          </Page>
        ))
      )}
    </Document>
  );
}
