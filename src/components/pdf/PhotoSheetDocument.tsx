'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';

const ACCENT = '#2563EB';
const DARK = '#111827';
const GREY = '#6B7280';
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
    marginBottom: 20,
    borderBottom: `2px solid ${ACCENT}`,
    paddingBottom: 10,
  },
  titleSection: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 8,
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
    fontSize: 10,
  },

  // ── Grid ────────────────────────────────────────────────
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  photoBox: {
    marginBottom: 20,
    border: `1px solid ${BORDER}`,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  photoImage: {
    objectFit: 'cover',
    width: '100%',
  },
  
  // ── Captions (Premium Look) ─────────────────────────────
  captionContainer: {
    backgroundColor: DARK,
    padding: '5 8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoCaption: {
    color: '#FFFFFF',
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9CA3AF',
    fontFamily: 'Helvetica-Oblique',
  },
});

interface Props {
  claim: ClaimData;
}

export function PhotoSheetDocument({ claim }: Props) {
  const { photos = [], photoLayout = 6 } = claim || {};

  // Configuration for different layouts
  const getLayoutConfig = () => {
    switch (photoLayout) {
      case 4: return { width: '47.5%', height: 260, perPage: 4 };
      case 6: return { width: '47.5%', height: 180, perPage: 6 };
      case 8: return { width: '47.5%', height: 140, perPage: 8 };
      case 9: return { width: '31%', height: 140, perPage: 9 };
      default: return { width: '47.5%', height: 180, perPage: 6 };
    }
  };

  const config = getLayoutConfig();
  
  // Chunk photos into pages based on layout
  const pages: any[][] = [];
  const safePhotos = photos || [];
  for (let i = 0; i < safePhotos.length; i += config.perPage) {
    pages.push(safePhotos.slice(i, i + config.perPage));
  }

  return (
    <Document title={`Photo Sheet - ${claim?.vehicle?.registrationNumber || 'DRAFT'}`}>
      {pages.length === 0 ? (
        <Page size="A4" style={S.page}>
          <Text>No photos uploaded for this claim.</Text>
        </Page>
      ) : (
        pages.map((pagePhotos, pageIdx) => (
          <Page key={pageIdx} size="A4" style={S.page}>
            <View style={S.header}>
              <View style={S.titleSection}>
                <Text style={S.title}>PHOTOGRAPHIC EVIDENCE SHEET</Text>
                <Text style={S.subtitle}>
                  Inventory: {claim?.vehicle?.make || ''} {claim?.vehicle?.model || ''} | {claim?.vehicle?.registrationNumber || 'DRAFT'}
                </Text>
              </View>
              <View style={S.regBadge}>
                <Text>PAGE {pageIdx + 1}</Text>
              </View>
            </View>

            <View style={S.photoGrid}>
              {pagePhotos.map((photo, idx) => {
                const globalIndex = pageIdx * config.perPage + idx + 1;
                return (
                  <View 
                    key={idx} 
                    style={{ 
                      ...S.photoBox, 
                      width: config.width,
                    }}
                  >
                    {photo.dataUrl && (
                      <Image 
                        src={photo.dataUrl} 
                        style={{ 
                          ...S.photoImage, 
                          height: config.height 
                        }} 
                      />
                    )}
                    <View style={S.captionContainer}>
                      <Text style={S.photoCaption}>
                        {photo?.name || 'DAMAGE DETAIL'}
                      </Text>
                      <Text style={S.photoIndex}>#{String(globalIndex).padStart(2, '0')}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={S.footer}>
              <Text>SurveyOS Prime Reporting Suite | Claim: {claim?.policy?.claimNumber || 'N/A'}</Text>
              <Text render={({ pageNumber, totalPages }) => `Report Evidence Page ${pageNumber} of ${totalPages}`} fixed />
            </View>
          </Page>
        ))
      )}
    </Document>
  );
}

