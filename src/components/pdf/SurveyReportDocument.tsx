'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import type { ClaimData, AssessmentSummary } from '@/types';
import { formatCurrency } from '@/lib/calculations';

// Optional: If we wanted custom fonts later, we register them here.
// For now, we rely on standard Helvetica which requires 0 bytes of loading.

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
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f3f4f6',
    padding: 4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  colLabel: {
    width: '30%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  colValue: {
    width: '70%',
    fontSize: 9,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    padding: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  gridRow: {
    flexDirection: 'row',
    padding: 4,
    borderBottom: '1px solid #e5e7eb',
    fontSize: 8,
  },
  colNo: { width: '5%' },
  colPart: { width: '35%' },
  colTy: { width: '10%' },
  colEst: { width: '15%', textAlign: 'right' },
  colAss: { width: '15%', textAlign: 'right' },
  colFirst: { width: '20%', textAlign: 'right' },
  summaryBox: {
    marginTop: 10,
    padding: 10,
    border: '1px solid #e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    fontSize: 9,
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1px solid #111827',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  photoBox: {
    marginBottom: 10,
  },
  photoImage: {
    objectFit: 'contain',
  },
  photoCaption: {
    marginTop: 4,
    fontSize: 8,
    textAlign: 'center',
    fontFamily: 'Helvetica-Oblique',
  }
});

interface Props {
  claim: ClaimData;
  summary: AssessmentSummary;
}

export function SurveyReportDocument({ claim, summary }: Props) {
  
  // Calculate dynamic photo size based on layout (4, 6, 8, 9)
  const getPhotoWidth = () => {
    if (claim.photoLayout === 4) return '48%';
    if (claim.photoLayout === 9) return '31%';
    return '48%'; // Default for 6 or 8 (we just fit them vertically)
  };
  
  const getPhotoHeight = () => {
    if (claim.photoLayout === 4) return 250;
    if (claim.photoLayout === 6) return 180;
    if (claim.photoLayout === 8) return 140;
    if (claim.photoLayout === 9) return 180;
    return 180;
  };

  return (
    <Document>
      {/* ─── PAGE 1: DETAILS ────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>MOTOR SURVEY REPORT</Text>
          <Text style={styles.subtitle}>Report No: {claim.reportNo || 'DRAFT'} | Date: {claim.reportDate}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Insurer Details</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Insurer Name:</Text>
            <Text style={styles.colValue}>{claim.policy.insurerName || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Policy Number:</Text>
            <Text style={styles.colValue}>{claim.policy.policyNumber || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Insured Name:</Text>
            <Text style={styles.colValue}>{claim.policy.insuredName || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>IDV (₹):</Text>
            <Text style={styles.colValue}>{claim.policy.idv || 'N/A'}</Text>
          </View>
        </View>

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
            <Text style={styles.colLabel}>Chassis Number:</Text>
            <Text style={styles.colValue}>{claim.vehicle.chassisNumber || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Year of Mfg:</Text>
            <Text style={styles.colValue}>{claim.vehicle.yearOfManufacture || 'N/A'}</Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Accident Details</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Date of Loss:</Text>
            <Text style={styles.colValue}>{claim.accident.dateAndTime || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Place of Accident:</Text>
            <Text style={styles.colValue}>{claim.accident.placeOfAccident || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Cause:</Text>
            <Text style={styles.colValue}>{claim.accident.causeOfAccident || 'N/A'}</Text>
          </View>
        </View>
      </Page>

      {/* ─── PAGE 2+: FINANCIAL MATRIX ─────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>ASSESSMENT SUMMARY</Text>
          <Text style={styles.subtitle}>{claim.vehicle.registrationNumber} | {claim.vehicle.make} {claim.vehicle.model}</Text>
        </View>

        {claim.assessmentRows.length > 0 && (
          <View style={styles.section}>
            <View style={styles.gridHeaderRow}>
              <Text style={styles.colNo}>#</Text>
              <Text style={styles.colPart}>Particulars</Text>
              <Text style={styles.colTy}>Type</Text>
              <Text style={styles.colEst}>Estimate</Text>
              <Text style={styles.colAss}>Assessed</Text>
            </View>
            
            {claim.assessmentRows.filter(r => r.allowed).map((row, idx) => (
              <View key={row.id} style={styles.gridRow}>
                <Text style={styles.colNo}>{idx + 1}</Text>
                <Text style={styles.colPart}>{row.particulars || 'Undefined Part'}</Text>
                <Text style={{...styles.colTy, textTransform: 'capitalize'}}>{row.partType}</Text>
                <Text style={styles.colEst}>{formatCurrency(row.estimated)}</Text>
                <Text style={styles.colAss}>{formatCurrency(row.assessed)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Financial Summary Block */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text>Total Estimated Repairs:</Text>
            <Text>{formatCurrency(summary.totalEstimated)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Parts Assessed (Base):</Text>
            <Text>{formatCurrency(summary.partsBase)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Parts GST (CGST+SGST):</Text>
            <Text>{formatCurrency(summary.partsCGST + summary.partsSGST)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Labour Assessed (Base):</Text>
            <Text>{formatCurrency(summary.labourBase)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Labour GST:</Text>
            <Text>{formatCurrency(summary.labourGST)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Less: Expected Salvage:</Text>
            <Text>- {formatCurrency(summary.salvage)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Less: Policy Excess:</Text>
            <Text>- {formatCurrency(summary.excess)}</Text>
          </View>
          <View style={styles.summaryTotal}>
            <Text>NET ASSESSED LIABILITY:</Text>
            <Text>{formatCurrency(summary.netAssessedLoss)}</Text>
          </View>
          <Text style={{ marginTop: 8, fontSize: 8, fontFamily: 'Helvetica-Oblique' }}>
            Amount In Words: {summary.netInWords}
          </Text>
        </View>
      </Page>

      {/* ─── PAGE 3+: PHOTOS ─────────────────────────────────── */}
      {claim.photos.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>VEHICLE DAMAGE PHOTOS</Text>
          </View>
          <View style={styles.photoGrid}>
            {claim.photos.map((photo, idx) => (
              <View key={idx} style={{ ...styles.photoBox, width: getPhotoWidth() }}>
                <Image 
                  src={photo.dataUrl} 
                  style={{ ...styles.photoImage, height: getPhotoHeight() }} 
                />
                <Text style={styles.photoCaption}>
                  Photo {idx + 1}: {photo.name || 'Damage reference'}
                </Text>
              </View>
            ))}
          </View>
        </Page>
      )}
    </Document>
  );
}
