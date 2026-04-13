'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';

// ── A4 dimensions (in points) ─────────────────────────────
// Page: 595 × 842 pt  |  Padding: 30 pt all sides
// Usable area: 535 × 782 pt
// Header est: ~58 pt (title + subtitle + border + marginBottom)
// Footer clearance: ~45 pt (absolute footer at bottom:20, ~15 pt tall + safety)
// Net grid height: 782 - 58 - 45 = 679 pt
//
// Layout heights (image only, after subtracting ~18 pt caption bar + border):
//   4-up  (2 cols × 2 rows, gap 12): row = (679-12)/2 = 333 pt → image ≈ 313 pt
//   6-up  (2 cols × 3 rows, gap 10): row = (679-20)/3 = 220 pt → image ≈ 200 pt
//   8-up  (2 cols × 4 rows, gap  8): row = (679-24)/4 = 164 pt → image ≈ 144 pt
//   9-up  (3 cols × 3 rows, gap  8): row = (679-16)/3 = 221 pt → image ≈ 201 pt
// ─────────────────────────────────────────────────────────

const ACCENT = '#2563EB';
const DARK   = '#111827';
const GREY   = '#6B7280';
const BORDER = '#E5E7EB';

const S = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: DARK,
    backgroundColor: '#FFFFFF',
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    letterSpacing: 0.5,
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

  // ── Photo grid ──────────────────────────────────────────
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // marginBottom reserves space above the absolute footer
    marginBottom: 45,
  },
  photoBox: {
    border: `1px solid ${BORDER}`,
    borderRadius: 2,
    overflow: 'hidden',
  },
  // Container that holds the image and fills the cell fully.
  // objectFit:'contain' keeps the full photo — letterbox bars shown via backgroundColor.
  imageContainer: {
    backgroundColor: '#F0F0F0', // grey bars for non-square photos
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    objectFit: 'contain',
    width: '100%',
    height: '100%',
  },

  // ── Caption bar ─────────────────────────────────────────
  captionContainer: {
    backgroundColor: DARK,
    padding: '4 7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoCaption: {
    color: '#FFFFFF',
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
    marginRight: 4,
  },
  photoIndex: {
    color: '#9CA3AF',
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
  },

  // ── Footer ──────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    borderTop: `1px solid ${BORDER}`,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9CA3AF',
    fontFamily: 'Helvetica-Oblique',
  },
});

// ── Layout configurations (calculated for A4) ────────────
//   width:   percentage string for flexWrap row
//   height:  image area in points
//   gap:     space between cells in points
//   perPage: photos per page
interface LayoutConfig {
  width: string;
  imageHeight: number;
  gap: number;
  perPage: number;
}

function getLayoutConfig(photoLayout: number): LayoutConfig {
  switch (photoLayout) {
    case 4:  return { width: '48%',  imageHeight: 313, gap: 12, perPage: 4 };
    case 8:  return { width: '48%',  imageHeight: 144, gap:  8, perPage: 8 };
    case 9:  return { width: '32%',  imageHeight: 201, gap:  8, perPage: 9 };
    case 6:
    default: return { width: '48%',  imageHeight: 200, gap: 10, perPage: 6 };
  }
}

// Caption bar height: ~14 pt (padding 4+4 + font 6)
const CAPTION_H = 14;

interface Props {
  claim: ClaimData;
}

export function PhotoSheetDocument({ claim }: Props) {
  const { photos = [], photoLayout = 6 } = claim || {};

  const config = getLayoutConfig(photoLayout);
  const safePhotos = Array.isArray(photos) ? photos : [];

  // Chunk photos into pages
  const pages: typeof safePhotos[] = [];
  for (let i = 0; i < safePhotos.length; i += config.perPage) {
    pages.push(safePhotos.slice(i, i + config.perPage));
  }

  const regNum    = claim?.vehicle?.registrationNumber || 'DRAFT';
  const makeModel = [claim?.vehicle?.make, claim?.vehicle?.model].filter(Boolean).join(' ');
  const claimNum  = claim?.policy?.claimNumber || 'N/A';

  return (
    <Document title={`Photo Sheet – ${regNum}`}>
      {pages.length === 0 ? (
        <Page size="A4" style={S.page}>
          <Text style={{ color: GREY, fontSize: 10, marginTop: 20 }}>
            No photos have been uploaded for this claim.
          </Text>
        </Page>
      ) : (
        pages.map((pagePhotos, pageIdx) => (
          <Page key={pageIdx} size="A4" style={S.page}>

            {/* ── Header ── */}
            <View style={S.header}>
              <View style={S.titleSection}>
                <Text style={S.title}>PHOTOGRAPHIC EVIDENCE SHEET</Text>
                <Text style={S.subtitle}>
                  {makeModel ? `${makeModel} | ` : ''}{regNum}
                </Text>
              </View>
              <View style={S.regBadge}>
                <Text>PAGE {pageIdx + 1}</Text>
              </View>
            </View>

            {/* ── Photo grid ── */}
            <View style={S.photoGrid}>
              {pagePhotos.map((photo, idx) => {
                const globalIndex = pageIdx * config.perPage + idx + 1;
                const totalCellHeight = config.imageHeight + CAPTION_H + 2; // +2 for border

                return (
                  <View
                    key={idx}
                    style={[
                      S.photoBox,
                      {
                        width: config.width,
                        height: totalCellHeight,
                        marginRight: (idx % (config.width === '32%' ? 3 : 2)) < (config.width === '32%' ? 2 : 1) ? config.gap : 0,
                        marginBottom: config.gap,
                      },
                    ]}
                  >
                    {/* Image area */}
                    <View style={[S.imageContainer, { height: config.imageHeight }]}>
                      {photo?.dataUrl ? (
                        <Image
                          src={photo.dataUrl}
                          style={S.photoImage}
                        />
                      ) : (
                        <Text style={{ color: GREY, fontSize: 7 }}>No image</Text>
                      )}
                    </View>

                    {/* Caption bar */}
                    <View style={S.captionContainer}>
                      <Text style={S.photoCaption}>
                        {(photo?.name || 'DAMAGE DETAIL').substring(0, 28).toUpperCase()}
                      </Text>
                      <Text style={S.photoIndex}>
                        #{String(globalIndex).padStart(2, '0')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── Footer ── */}
            <View style={S.footer} fixed>
              <Text>SurveyOS Prime Reporting Suite | Claim: {claimNum}</Text>
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
