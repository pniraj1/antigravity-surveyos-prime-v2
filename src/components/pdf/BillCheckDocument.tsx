'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ClaimData, BillCheckSummary } from '@/types';
import { formatCurrency, calculateBillCheckSummary, getVehicleAgeMonths } from '@/lib/calculations';


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
    borderBottom: '2px solid #0D1B2A',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#4b5563',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#0D1B2A',
    color: '#FFFFFF',
    padding: 5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: 2,
  },
  colNo: { width: '4%', fontSize: 7 },
  colPart: { width: '26%', fontSize: 7 },
  colGST: { width: '6%', textAlign: 'center', fontSize: 7 },
  colBillNo: { width: '12%', textAlign: 'center', fontSize: 7 },
  colGlass: { width: '13%', textAlign: 'right', fontSize: 7 },
  colMetal: { width: '13%', textAlign: 'right', fontSize: 7 },
  colPlastic: { width: '13%', textAlign: 'right', fontSize: 7 },
  colLabour: { width: '13%', textAlign: 'right', fontSize: 7 },

  
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    borderBottom: '1px solid #111827',
  },
  gridRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '1px solid #e5e7eb',
    fontSize: 8,
  },
  summaryBox: {
    marginTop: 20,
    padding: 15,
    border: '1px solid #0D1B2A',
    backgroundColor: '#FAFAFA',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    fontSize: 10,
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '2px solid #0D1B2A',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: '#0D1B2A',
  },
  footer: {
    marginTop: 40,
    fontSize: 9,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  }
});

interface Props {
  claim: ClaimData;
}


export function BillCheckDocument({ claim }: Props) {
  const ageMonths = getVehicleAgeMonths(
    claim.vehicle.dateOfRegistration,
    claim.vehicle.yearOfManufacture,
    claim.accident.dateAndTime
  );
  
  const bcSummary = calculateBillCheckSummary(
    claim.assessmentRows,
    ageMonths,
    claim.depreciationType,
    claim.feeBill.salvageValue,
    claim.feeBill.lessExcess
  );

  const allowedRows = claim.assessmentRows.filter(r => r.allowed);
  const billCheckItems = allowedRows.map(row => {
    const amount = (row.billStatus === 'not-in-bill') ? 0 : (row.billedAmount || 0);
    return {
      ...row,
      displayAmount: amount
    };
  });
  
  return (
    <Document title={`Bill Check - ${claim.vehicle.registrationNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>BILL CHECK REPORT</Text>
          <Text style={styles.subtitle}>Comparison: Workshop Final Bill vs. Assessed Spares & Labour</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={{ width: '20%', fontFamily: 'Helvetica-Bold' }}>Registration No:</Text>
            <Text style={{ width: '30%' }}>{claim.vehicle.registrationNumber}</Text>
            <Text style={{ width: '20%', fontFamily: 'Helvetica-Bold' }}>Bill No:</Text>
            <Text style={{ width: '30%' }}>{claim.billCheck.billNo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ width: '20%', fontFamily: 'Helvetica-Bold' }}>Insured Name:</Text>
            <Text style={{ width: '30%' }}>{claim.policy.insuredName}</Text>
            <Text style={{ width: '20%', fontFamily: 'Helvetica-Bold' }}>Bill Date:</Text>
            <Text style={{ width: '30%' }}>{claim.billCheck.billDate}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.gridHeaderRow}>
            <Text style={styles.colNo}>Sr.</Text>
            <Text style={styles.colPart}>Particulars (Allowed Items)</Text>
            <Text style={styles.colGST}>GST%</Text>
            <Text style={styles.colBillNo}>Bill No.</Text>
            <Text style={styles.colGlass}>Glass 0%</Text>
            <Text style={styles.colMetal}>15% Dep.</Text>
            <Text style={styles.colPlastic}>50% Dep.</Text>
            <Text style={styles.colLabour}>Labour</Text>
          </View>

          {billCheckItems.map((item, idx) => (
            <View key={item.id} style={styles.gridRow}>
              <Text style={styles.colNo}>{idx + 1}</Text>
              <Text style={styles.colPart}>{item.particulars}</Text>
              <Text style={styles.colGST}>{item.gst}%</Text>
              <Text style={styles.colBillNo}>{claim.billCheck.billNo}</Text>
              <Text style={styles.colGlass}>{item.partType === 'glass' ? formatCurrency(item.displayAmount) : '-'}</Text>
              <Text style={styles.colMetal}>{item.partType === 'metal' ? formatCurrency(item.displayAmount) : '-'}</Text>
              <Text style={styles.colPlastic}>{item.partType === 'plastic' ? formatCurrency(item.displayAmount) : '-'}</Text>
              <Text style={styles.colLabour}>{(item.section === 'labour' || item.section === 'paint') ? formatCurrency(item.displayAmount) : '-'}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text>Total Billed Amount (Reflected in above columns):</Text>
            <Text>{formatCurrency(bcSummary.grandTotalBilled)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={{ color: '#dc2626' }}>Parts Allowed in Assessment but NOT Claimed in Bill:</Text>
            <Text>- {formatCurrency(bcSummary.notInBillTotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Less: Expected Salvage:</Text>
            <Text>- {formatCurrency(bcSummary.salvage)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Less: Policy Excess:</Text>
            <Text>- {formatCurrency(bcSummary.excess)}</Text>
          </View>
          
          <View style={styles.summaryTotal}>
            <Text>NET PAYABLE LIABILITY (Final):</Text>
            <Text>{formatCurrency(bcSummary.netLiability)}</Text>
          </View>
          <Text style={{ fontSize: 8, marginTop: 4, fontFamily: 'Helvetica-Bold' }}>
            ({bcSummary.netInWords})
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>FOR SURVEYOR OFFICE</Text>
          <Text style={{ marginTop: 25 }}>(Authorised Signatory)</Text>
        </View>
      </Page>
    </Document>
  );
}

