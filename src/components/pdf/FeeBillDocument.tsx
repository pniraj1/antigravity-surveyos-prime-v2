'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ClaimData, AssessmentSummary } from '@/types';
import { formatCurrency } from '@/lib/calculations';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
  },
  header: {
    marginBottom: 30,
    textAlign: 'center',
    borderBottom: '2px solid #D4AF37',
    paddingBottom: 15,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
    marginBottom: 4,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#8D99AE',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    borderBottom: '1px solid #E2E6EA',
    paddingBottom: 5,
    marginBottom: 10,
    textTransform: 'uppercase',
    color: '#0D1B2A',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: '30%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#4A4E69',
  },
  value: {
    width: '70%',
    fontSize: 9,
    color: '#0D1B2A',
  },
  billTable: {
    marginTop: 10,
    border: '1px solid #E2E6EA',
    borderRadius: 8,
    overflow: 'hidden',
  },
  billRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottom: '1px solid #F0F2F5',
  },
  billHeader: {
    backgroundColor: '#F8F9FA',
    borderBottom: '1px solid #E2E6EA',
  },
  billItem: { width: '70%', fontSize: 10 },
  billAmount: { width: '30%', textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold' },
  
  totalSection: {
    marginTop: 20,
    alignSelf: 'flex-end',
    width: '50%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottom: '1px solid #F0F2F5',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#0D1B2A',
    color: '#FFFFFF',
    borderRadius: 4,
  },
  footer: {
    marginTop: 50,
    fontSize: 9,
    textAlign: 'left',
  },
  signatureBox: {
    marginTop: 40,
    borderTop: '1px solid #111827',
    width: '30%',
    paddingTop: 5,
    alignSelf: 'flex-end',
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  }
});

interface Props {
  claim: ClaimData;
  summary: AssessmentSummary;
}

export function FeeBillDocument({ claim, summary }: Props) {
  const fb = claim.feeBill;
  const photoCharges = (fb.photosCount || 0) * (fb.photoRate || 0);
  const subTotal = (fb.professionalFee || 0) + (fb.riFee || 0) + (fb.travelExpenses || 0) +
                   photoCharges + (fb.postalCharges || 0) + (fb.haltageCharges || 0);
  const gstAmount = fb.includeGST ? subTotal * 0.18 : 0;
  const grossTotal = subTotal + gstAmount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>FEE BILL</Text>
          <Text style={styles.subtitle}>Professional Fee Statement for Motor Insurance Survey</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Bill No / Ref:</Text>
            <Text style={styles.value}>{fb.advanceReceipt || 'SB-' + claim.reportNo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Bill Date:</Text>
            <Text style={styles.value}>{fb.billDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Insurer Name:</Text>
            <Text style={styles.value}>{claim.policy.insurerName}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Claim Particulars</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Vehicle Reg No:</Text>
            <Text style={styles.value}>{claim.vehicle.registrationNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Make & Model:</Text>
            <Text style={styles.value}>{claim.vehicle.make} {claim.vehicle.model}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date of Accident:</Text>
            <Text style={styles.value}>{claim.accident.dateAndTime}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fee Components</Text>
          <View style={styles.billTable}>
            <View style={[styles.billRow, styles.billHeader]}>
              <Text style={styles.billItem}>Description</Text>
              <Text style={styles.billAmount}>Amount (₹)</Text>
            </View>
            
            <View style={styles.billRow}>
              <Text style={styles.billItem}>Professional Survey Fee</Text>
              <Text style={styles.billAmount}>{formatCurrency(fb.professionalFee || 0)}</Text>
            </View>
            
            <View style={styles.billRow}>
              <Text style={styles.billItem}>Re-inspection Fee</Text>
              <Text style={styles.billAmount}>{formatCurrency(fb.riFee || 0)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billItem}>Travel / Conveyance Expenses ({fb.travelNote || 'Local'})</Text>
              <Text style={styles.billAmount}>{formatCurrency(fb.travelExpenses || 0)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billItem}>Photography Charges ({fb.photosCount} photos × ₹{fb.photoRate})</Text>
              <Text style={styles.billAmount}>{formatCurrency(photoCharges)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billItem}>Postal & Courier Charges</Text>
              <Text style={styles.billAmount}>{formatCurrency(fb.postalCharges || 0)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billItem}>Haltage & Other Incidentals</Text>
              <Text style={styles.billAmount}>{formatCurrency(fb.haltageCharges || 0)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={{ fontSize: 10 }}>Sub-Total:</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{formatCurrency(subTotal)}</Text>
          </View>
          {fb.includeGST && (
            <View style={styles.totalRow}>
              <Text style={{ fontSize: 10 }}>GST @ 18%:</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{formatCurrency(gstAmount)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>GROSS TOTAL BILL:</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatCurrency(grossTotal)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={{ fontFamily: 'Helvetica-Bold', color: '#0D1B2A' }}>Terms & Conditions:</Text>
          <Text>1. Payments are due within 15 days of bill submission.</Text>
          <Text>2. GST subject to prevailing government norms.</Text>
          <Text>3. PAN: Surveyor Pan | GSTIN: Surveyor GSTIN</Text>
        </View>

        <View style={styles.signatureBox}>
          <Text>Authorised Signature</Text>
        </View>
      </Page>
    </Document>
  );
}
