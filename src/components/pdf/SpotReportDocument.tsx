'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';
import { formatDateDMY } from '@/lib/calculations';

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
            Report No: {claim?.reportNo || 'DRAFT'} | Date of Report: {formatDateDMY(claim?.reportDate || claim?.createdAt)}
          </Text>
        </View>

        {/* 1. Policy Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Policy & Insured Information</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Insured Name:</Text>
            <Text style={styles.colValue}>{claim?.policy?.insuredName || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Policy Number:</Text>
            <Text style={styles.colValue}>{claim?.policy?.policyNumber || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Insurer:</Text>
            <Text style={styles.colValue}>{claim?.policy?.insurerName || 'N/A'}</Text>
          </View>
        </View>

        {/* 2. Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Vehicle Details</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Registration No:</Text>
            <Text style={styles.colValue}>{claim?.vehicle?.registrationNumber || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Make & Model:</Text>
            <Text style={styles.colValue}>{claim?.vehicle?.make || ''} {claim?.vehicle?.model || ''}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Condition of Vehicle:</Text>
            <Text style={styles.colValue}>{claim?.vehicle?.preAccidentCondition || 'Not specified'}</Text>
          </View>
          {claim?.vehicle?.isCommercial && (
            <View style={styles.row}>
              <Text style={styles.colLabel}>RLW / PayLoad:</Text>
              <Text style={styles.colValue}>{claim?.vehicle?.registeredLoadWeight || 'N/A'} / {claim?.vehicle?.actualPayload || 'N/A'}</Text>
            </View>
          )}
        </View>

        {/* 3. Driver Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Driver Information (at Spot)</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Driver Name:</Text>
            <Text style={styles.colValue}>{claim?.driver?.name || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>DL Number:</Text>
            <Text style={styles.colValue}>{claim?.driver?.licenceNumber || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>DL Issue Date:</Text>
            <Text style={styles.colValue}>{claim?.driver?.dateOfIssue || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Valid Upto (NT/T):</Text>
            <Text style={styles.colValue}>{claim?.driver?.validityNonTransport || 'N/A'} / {claim?.driver?.validityTransport || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Verification Status:</Text>
            <Text style={{...styles.colValue, fontFamily: 'Helvetica-Bold'}}>{claim?.driver?.verificationStatus || 'Pending'}</Text>
          </View>
        </View>

        {/* 4. Accident Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Occurrence & Authorities</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Date & Time:</Text>
            <Text style={styles.colValue}>{claim?.accident?.dateAndTime || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Cause of Accident:</Text>
            <Text style={styles.colValue}>{claim?.accident?.causeOfAccident || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Place of Accident:</Text>
            <Text style={styles.colValue}>{claim?.accident?.placeOfAccident || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Police Station / FIR:</Text>
            <Text style={styles.colValue}>
              {claim?.accident?.policeStation || 'N/A'} / {claim?.accident?.firNumber || 'N/A'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>FIR Date:</Text>
            <Text style={styles.colValue}>{claim?.accident?.firDate || 'N/A'}</Text>
          </View>
        </View>

        {/* 5. Commercial & Load Details */}
        {claim?.vehicle?.isCommercial && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Commercial Compliance & Logistics</Text>
            <View style={styles.row}>
              <Text style={styles.colLabel}>Permit No / Type:</Text>
              <Text style={styles.colValue}>{claim?.spotDetails?.permitNo || 'N/A'} ({claim?.spotDetails?.permitType || '-'})</Text>
            </View>
            <div style={styles.row}>
              <Text style={styles.colLabel}>Permit Valid Upto:</Text>
              <Text style={styles.colValue}>{claim?.spotDetails?.permitTo || 'N/A'}</Text>
            </div>
            <View style={styles.row}>
              <Text style={styles.colLabel}>Fitness Valid Upto:</Text>
              <Text style={styles.colValue}>{claim?.vehicle?.fitnessValidUpto || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.colLabel}>GVW / ULW / Cap:</Text>
              <Text style={styles.colValue}>{claim?.spotDetails?.gvw || 0} / {claim?.spotDetails?.ulw || 0} / {claim?.spotDetails?.loadCapacity || 0} KG</Text>
            </View>
            <View style={{...styles.row, backgroundColor: (claim?.spotDetails?.actualLoad || 0) > (claim?.spotDetails?.loadCapacity || 0) ? '#fee2e2' : '#f0fdf4'}}>
              <Text style={styles.colLabel}>Actual Load:</Text>
              <Text style={{...styles.colValue, fontFamily: 'Helvetica-Bold'}}>{claim?.spotDetails?.actualLoad || 0} KG {(claim?.spotDetails?.actualLoad || 0) > (claim?.spotDetails?.loadCapacity || 0) ? '(OVERLOADED)' : ''}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.colLabel}>Load Origin-Dest:</Text>
              <Text style={styles.colValue}>{claim?.spotDetails?.loadOrigin || '-'} to {claim?.spotDetails?.loadDest || '-'}</Text>
            </View>
          </View>
        )}

        {/* 6. Physical Verification Matrix */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Document Verification Highlights</Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
            {Object.entries(claim?.documentVerification || {}).map(([key, val]) => {
              const res = val as { status: string; detail: string };
              const displayVal = res.detail ? `${res.status} (${res.detail})` : res.status;
              
              return (
                <View key={key} style={{width: '25%', padding: 4, border: '0.5px solid #e5e7eb'}}>
                  <Text style={{fontSize: 7, color: '#6b7280', textTransform: 'uppercase'}}>{key}</Text>
                  <Text style={{fontSize: 8, fontFamily: 'Helvetica-Bold'}}>{displayVal || '-'}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 7. Damage Matrix */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Damage Matrix / Site Findings</Text>
          <View style={styles.gridHeaderRow}>
            <Text style={styles.colNo}>#</Text>
            <Text style={styles.colPart}>Damaged Parts Observed</Text>
            <Text style={styles.colType}>Damage Description</Text>
          </View>
          { (claim?.spotDamageRows || []).length > 0 ? (
            (claim?.spotDamageRows || []).map((row, idx) => (
              <View key={row.id} style={styles.gridRow}>
                <Text style={styles.colNo}>{idx + 1}</Text>
                <Text style={{...styles.colPart, fontFamily: 'Helvetica-Bold'}}>{row.component}</Text>
                <Text style={styles.colType}>{row.damage}</Text>
              </View>
            ))
          ) : (
            <View style={styles.gridRow}>
              <Text style={{width: '100%', textAlign: 'center'}}>No damaged parts listed.</Text>
            </View>
          )}
        </View>

        {/* 8. Observations & Remarks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Observations & Final Remarks</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Workshop Selected:</Text>
            <Text style={styles.colValue}>{claim?.spotDetails?.repairWorkshop || 'N/A'}</Text>
          </View>
          <View style={{...styles.row, minHeight: 40}}>
            <Text style={styles.colLabel}>Final Remarks:</Text>
            <Text style={styles.colValue}>{claim?.spotDetails?.comments || 'Site inspection completed. Cause of accident verified...'}</Text>
          </View>
        </View>

        {/* Certification Statement */}
        <View style={{...styles.section, marginTop: 20, padding: 10, border: '1px solid #d1d5db', backgroundColor: '#f9fafb'}}>
          <Text style={{fontSize: 9, lineHeight: 1.6, textAlign: 'justify', color: '#374151'}}>
            We have noted down maximum possible visible damages at accident spot. Any other unseen/hidden damages which are related to cause of accident if noticed may be considered on dismantled checkup. This report is issued without prejudice subject to policy terms and condition and the damages stated in this report are based on physical inspection of accidental I.V. on the spot of the accident.
          </Text>
        </View>

        <Text style={styles.footer}>
          SurveyOS Prime V2 | Professional Field Report | Digitally Generated
        </Text>
      </Page>

      {/* 6. Photos Page */}
      { (claim?.photos || []).length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>SITE PHOTOGRAPHS</Text>
          </View>
          <View style={styles.photoGrid}>
            {(claim?.photos || []).map((photo, idx) => (
              <View key={idx} style={styles.photoBox}>
                {photo?.dataUrl && <Image src={photo.dataUrl} style={styles.photoImage} />}
                <Text style={styles.photoCaption}>
                  Fig {idx + 1}: {photo?.name || 'Damage reference'}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.footer}>Evidence Annexure</Text>
        </Page>
      )}
    </Document>
  );
}
