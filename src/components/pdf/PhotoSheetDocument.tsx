'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#4b5563',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  photoBox: {
    marginBottom: 15,
    border: '1px solid #f3f4f6',
    padding: 2,
  },
  photoImage: {
    objectFit: 'cover',
    width: '100%',
  },
  photoCaption: {
    marginTop: 4,
    fontSize: 8,
    textAlign: 'center',
    fontFamily: 'Helvetica-Oblique',
    paddingHorizontal: 4,
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#9ca3af',
  },
});

interface Props {
  claim: ClaimData;
}

export function PhotoSheetDocument({ claim }: Props) {
  const { photos, photoLayout = 6 } = claim;

  // Configuration for different layouts
  const getLayoutConfig = () => {
    switch (photoLayout) {
      case 4: return { width: '48%', height: 320, perPage: 4 };
      case 6: return { width: '48%', height: 210, perPage: 6 };
      case 8: return { width: '48%', height: 160, perPage: 8 };
      case 9: return { width: '31%', height: 180, perPage: 9 };
      default: return { width: '48%', height: 210, perPage: 6 };
    }
  };

  const config = getLayoutConfig();
  
  // Chunk photos into pages based on layout
  const pages: any[][] = [];
  for (let i = 0; i < photos.length; i += config.perPage) {
    pages.push(photos.slice(i, i + config.perPage));
  }

  return (
    <Document>
      {pages.map((pagePhotos, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>VEHICLE DAMAGE PHOTO SHEET</Text>
            <Text style={styles.subtitle}>
              {claim.vehicle.registrationNumber || 'NEW CLAIM'} | {claim.vehicle.make} {claim.vehicle.model}
            </Text>
          </View>

          <View style={styles.photoGrid}>
            {pagePhotos.map((photo, idx) => (
              <View 
                key={idx} 
                style={{ 
                  ...styles.photoBox, 
                  width: config.width,
                }}
              >
                <Image 
                  src={photo.dataUrl} 
                  style={{ 
                    ...styles.photoImage, 
                    height: config.height 
                  }} 
                />
                <Text style={styles.photoCaption}>
                  Photo {pageIdx * config.perPage + idx + 1}: {photo.name || 'Damage detail'}
                </Text>
              </View>
            ))}
          </View>

          <Text 
            style={styles.pageNumber} 
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} 
            fixed 
          />
        </Page>
      ))}
    </Document>
  );
}
