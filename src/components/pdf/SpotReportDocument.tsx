'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottom: '2px solid #111827',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#374151',
    fontFamily: 'Helvetica-Bold',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f3f4f6',
    padding: 6,
    marginBottom: 8,
    textTransform: 'uppercase',
    borderLeft: '4px solid #111827',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
    borderBottom: '0.5px solid #f3f4f6',
    paddingBottom: 2,
  },
  colLabel: {
    width: '35%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#4b5563',
  },
  colValue: {
    width: '65%',
    fontSize: 9,
    color: '#111827',
  },
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    padding: 5,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  gridRow: {
    flexDirection: 'row',
    padding: 5,
    borderBottom: '1px solid #e5e7eb',
    fontSize: 9,
  },
  colNo: { width: '10%' },
  colPart: { width: '60%' },
  colType: { width: '30%', textAlign: 'right' },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginTop: 10,
  },
  photoBox: {
    marginBottom: 15,
    width: '47%',
    border: '1px solid #e5e7eb',
    padding: 5,
  },
  photoImage: {
    objectFit: 'contain',
    height: 180,
  },
  photoCaption: {
    marginTop: 6,
    fontSize: 8,
    textAlign: 'center',
    fontFamily: 'Helvetica-Oblique',
    color: '#6b7280',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1px solid #e5e7eb',
    paddingTop: 10,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  }
});

interface Props {
  claim: ClaimData;
}

export function SpotReportDocument({ claim }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>SPOT SURVEY REPORT</Text>
          <Text style={styles.subtitle}>
            Report No: {claim.reportNo || 'DRAFT'} | Date: {claim.reportDate}
          </Text>
        </View>

        {/* 1. Policy Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Policy & Insured Information</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Insured Name:</Text>
            <Text style={styles.colValue}>{claim.policy.insuredName || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Policy Number:</Text>
            <Text style={styles.colValue}>{claim.policy.policyNumber || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Insurer:</Text>
            <Text style={styles.colValue}>{claim.policy.insurerName || 'N/A'}</Text>
          </View>
        </View>

        {/* 2. Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Vehicle Details</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Registration No:</Text>
            <Text style={styles.colValue}>{claim.vehicle.registrationNumber || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Make & Model:</Text>
            <Text style={styles.colValue}>{claim.vehicle.make} {claim.vehicle.model}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Condition of Vehicle:</Text>
            <Text style={styles.colValue}>{claim.vehicle.condition || 'Not specified'}</Text>
          </View>
          {claim.vehicle.isCommercial && (
            <View style={styles.row}>
              <Text style={styles.colLabel}>RLW / PayLoad:</Text>
              <Text style={styles.colValue}>{claim.vehicle.registeredLoadWeight || 'N/A'} / {claim.vehicle.actualPayload || 'N/A'}</Text>
            </View>
          )}
        </View>

        {/* 3. Driver Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Driver Information (at Spot)</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Driver Name:</Text>
            <Text style={styles.colValue}>{claim.driver.name || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>DL Number:</Text>
            <Text style={styles.colValue}>{claim.driver.licenseNumber || 'N/A'}</Text>
          </View>
        </View>

        {/* 4. Accident Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Occurrence & Authorities</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Date & Time:</Text>
            <Text style={styles.colValue}>{claim.accident.dateAndTime || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Place of Accident:</Text>
            <Text style={styles.colValue}>{claim.accident.placeOfAccident || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Police Station:</Text>
            <Text style={styles.colValue}>{claim.accident.policeStation || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>FIR / Diary No:</Text>
            <Text style={styles.colValue}>{claim.accident.firNumber || 'N/A'}</Text>
          </View>
        </View>

        {/* 5. Damage Matrix */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Damage Matrix</Text>
          <View style={styles.gridHeaderRow}>
            <Text style={styles.colNo}>#</Text>
            <Text style={styles.colPart}>Damaged Parts Observed</Text>
            <Text style={styles.colType}>Type</Text>
          </View>
          {claim.assessmentRows.length > 0 ? (
            claim.assessmentRows.map((row, idx) => (
              <View key={row.id} style={styles.gridRow}>
                <Text style={styles.colNo}>{idx + 1}</Text>
                <Text style={styles.colPart}>{row.particulars}</Text>
                <Text style={{...styles.colType, textTransform: 'capitalize'}}>{row.partType}</Text>
              </View>
            ))
          ) : (
            <View style={styles.gridRow}>
              <Text style={{width: '100%', textAlign: 'center'}}>No damaged parts listed.</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          SurveyOS Prime V2 | Professional Field Report | Digitally Generated
        </Text>
      </Page>

      {/* 6. Photos Page */}
      {claim.photos.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>SITE PHOTOGRAPHS</Text>
          </View>
          <View style={styles.photoGrid}>
            {claim.photos.map((photo, idx) => (
              <View key={idx} style={styles.photoBox}>
                <Image src={photo.dataUrl} style={styles.photoImage} />
                <Text style={styles.photoCaption}>
                  Fig {idx + 1}: {photo.name || 'Damage reference'}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.footer}>Page 2 of 2 | Evidence Annexure</Text>
        </Page>
      )}
    </Document>
  );
}
