'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';
import { 
  formatCurrency, 
  calculateBillCheckSummary, 
  getVehicleAgeMonths,
  getDepreciationRate 
} from '@/lib/calculations';

const NAVY = '#0D1B2A';
const SLATE = '#1E293B';
const BORDER = '#E2E8F0';
const TEXT_DARK = '#111827';
const TEXT_GREY = '#4B5563';

const S = StyleSheet.create({
  page: { 
    padding: 30, 
    fontFamily: 'Helvetica', 
    fontSize: 8, 
    color: TEXT_DARK, 
    lineHeight: 1.5 
  },
  // ── letterhead ──────────────────────────────────────────
  lhWrap: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12, 
    paddingBottom: 10, 
    borderBottom: `2px solid ${NAVY}` 
  },
  lhLogo: { width: 40, height: 40, marginRight: 12 },
  lhTitle: { 
    fontSize: 16, 
    fontFamily: 'Helvetica-Bold', 
    color: NAVY,
    letterSpacing: 0.5
  },
  lhSub: { 
    fontSize: 7.5, 
    color: '#64748B', 
    marginTop: 2, 
    fontFamily: 'Helvetica-Bold', 
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },

  // ── report meta strip ───────────────────────────────────
  metaStrip: { 
    flexDirection: 'row', 
    backgroundColor: SLATE, 
    padding: '7 10', 
    marginBottom: 10, 
    borderRadius: 2,
    color: '#F8FAFC'
  },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 5.5, color: '#94A3B8', marginBottom: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  secHead: { 
    backgroundColor: '#F1F5F9', 
    color: NAVY, 
    fontFamily: 'Helvetica-Bold', 
    fontSize: 8.5, 
    padding: '3 8', 
    marginBottom: 6, 
    marginTop: 8,
    borderLeft: `3px solid ${NAVY}`,
    textTransform: 'uppercase'
  },

  // ── Assessment Comparison Table ─────────────────────────
  tableHead: { 
    flexDirection: 'row', 
    backgroundColor: SLATE, 
    padding: '4 5', 
    fontFamily: 'Helvetica-Bold', 
    color: '#FFFFFF', 
    fontSize: 7 
  },
  tableRow: { 
    flexDirection: 'row', 
    padding: '3 5', 
    borderBottom: `0.5px solid ${BORDER}`, 
    fontSize: 7,
    alignItems: 'center'
  },
  tableRowAlt: { 
    flexDirection: 'row', 
    padding: '3 5', 
    borderBottom: `0.5px solid ${BORDER}`, 
    fontSize: 7, 
    backgroundColor: '#F8FAFC',
    alignItems: 'center'
  },
  colSr: { width: '4%' },
  colPart: { width: '28%' },
  colType: { width: '8%', textAlign: 'center' },
  colNature: { width: '8%', textAlign: 'center' },
  colBilled: { width: '12%', textAlign: 'right' },
  colDepPct: { width: '8%', textAlign: 'center' },
  colDepVal: { width: '12%', textAlign: 'right' },
  colTotal: { width: '20%', textAlign: 'right', fontFamily: 'Helvetica-Bold', color: SLATE },

  // ── Summary Box ─────────────────────────────────────────
  sumBox: { border: `1px solid ${SLATE}`, marginTop: 8, borderRadius: 2, overflow: 'hidden' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', padding: '3.5 8', borderBottom: `0.5px solid ${BORDER}`, fontSize: 8 },
  sumTotalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: '6 8', backgroundColor: SLATE, fontSize: 10, color: '#FFFFFF' },
  inWords: { padding: '5 8', fontSize: 8, fontFamily: 'Helvetica-Oblique', color: SLATE, backgroundColor: '#F8FAFC' },

  signature: { marginTop: 40, alignItems: 'flex-end', paddingRight: 20 },
  sigLine: { borderTop: `1px solid ${NAVY}`, width: 150, marginBottom: 4 },
  sigLabel: { fontSize: 7, color: TEXT_GREY, width: 150, textAlign: 'center' },

  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, borderTop: `1px solid ${BORDER}`, paddingTop: 6 },
  footerText: { fontSize: 6.5, color: TEXT_GREY, textAlign: 'center', fontFamily: 'Helvetica-Oblique' }
});

interface Props {
  claim: ClaimData;
}

export function BillCheckDocument({ claim }: Props) {
  const ageMonths = getVehicleAgeMonths(
    claim?.vehicle?.dateOfRegistration || null,
    claim?.vehicle?.yearOfManufacture ? Number(claim.vehicle.yearOfManufacture) : null,
    claim?.accident?.dateAndTime || null
  );
  
  const bcSummary = calculateBillCheckSummary(
    claim?.assessmentRows || [],
    ageMonths,
    claim?.depreciationType || 'Standard',
    claim?.feeBill?.salvageValue || 0,
    claim?.feeBill?.compulsoryExcess || 0,
    claim?.feeBill?.voluntaryExcess || 0
  );

  const allowedRows = (claim?.assessmentRows || []).filter(r => r.allowed);

  return (
    <Document title={`Bill Check - ${claim?.vehicle?.registrationNumber || 'DRAFT'}`}>
      <Page size="A4" style={S.page}>
        
        {/* Letterhead */}
        <View style={S.lhWrap}>
          <View style={{ flex: 1 }}>
            <Text style={S.lhTitle}>BILL CHECK ANALYSIS</Text>
            <Text style={S.lhSub}>Comparison: Workshop Final Bill vs. Assessed Liability</Text>
          </View>
        </View>

        {/* Meta Strip */}
        <View style={S.metaStrip}>
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>Registration No</Text>
            <Text style={S.metaValue}>{claim?.vehicle?.registrationNumber || 'DRAFT'}</Text>
          </View>
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>Final Bill Number</Text>
            <Text style={S.metaValue}>{claim?.billCheck?.billNo || 'N/A'}</Text>
          </View>
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>Bill Date</Text>
            <Text style={S.metaValue}>{claim?.billCheck?.billDate || 'N/A'}</Text>
          </View>
          <View style={S.metaItem}>
            <Text style={S.metaLabel}>Policy No</Text>
            <Text style={S.metaValue}>{claim?.policy?.policyNumber || 'N/A'}</Text>
          </View>
        </View>

        <Text style={S.secHead}>1. DETAILED BILL COMPARISON (ITEM-WISE)</Text>
        <View style={S.tableHead}>
          <Text style={S.colSr}>#</Text>
          <Text style={S.colPart}>Particulars / Description</Text>
          <Text style={S.colType}>P/L</Text>
          <Text style={S.colNature}>Nature</Text>
          <Text style={S.colBilled}>Billed Amt</Text>
          <Text style={S.colDepPct}>Dep %</Text>
          <Text style={S.colDepVal}>Dep Val</Text>
          <Text style={S.colTotal}>Net Incl. GST</Text>
        </View>

        {allowedRows.map((item, idx) => {
          const billedAmt = (item.billStatus === 'not-in-bill') ? 0 : (item.billedAmount || 0);
          const depRate = (item.section === 'parts') 
            ? getDepreciationRate(item.partType, ageMonths, claim?.depreciationType || 'Standard')
            : 0;
          const depVal = billedAmt * (depRate / 100);
          const afterDep = billedAmt - depVal;
          const rowTotal = afterDep * (1 + (item.gst || 18) / 100);

          return (
            <View key={item.id} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={S.colSr}>{idx + 1}</Text>
              <Text style={S.colPart}>{item.particulars}</Text>
              <Text style={S.colType}>{item.section === 'parts' ? 'Part' : 'Lab'}</Text>
              <Text style={S.colNature}>{item.partType.toUpperCase()}</Text>
              <Text style={S.colBilled}>{formatCurrency(billedAmt)}</Text>
              <Text style={S.colDepPct}>{depRate}%</Text>
              <Text style={S.colDepVal}>{depVal > 0 ? formatCurrency(depVal) : '-'}</Text>
              <Text style={S.colTotal}>{formatCurrency(rowTotal)}</Text>
            </View>
          );
        })}

        <View style={{ marginTop: 15 }}>
          <Text style={S.secHead}>2. FINAL SETTLEMENT SUMMARY</Text>
          <View style={S.sumBox}>
            <View style={S.sumRow}>
              <Text style={{ color: TEXT_GREY }}>Total Billed Amount (Assessed Items Only):</Text>
              <Text>{formatCurrency(bcSummary.grandTotalBilled)}</Text>
            </View>
            <View style={S.sumRow}>
              <Text style={{ color: '#DC2626' }}>Adjustments (Items not in bill):</Text>
              <Text>- {formatCurrency(bcSummary.notInBillTotal)}</Text>
            </View>
            <View style={S.sumRow}>
              <Text style={{ color: TEXT_GREY }}>Less: Expected Salvage Value:</Text>
              <Text>- {formatCurrency(bcSummary.salvage)}</Text>
            </View>
            {bcSummary.voluntaryExcess > 0 && (
              <View style={S.sumRow}>
                <Text style={{ color: TEXT_GREY }}>Less: Voluntary Excess:</Text>
                <Text>- {formatCurrency(bcSummary.voluntaryExcess)}</Text>
              </View>
            )}
            <View style={S.sumRow}>
              <Text style={{ color: TEXT_GREY }}>Less: Policy Compulsory Excess:</Text>
              <Text>- {formatCurrency(bcSummary.compulsoryExcess)}</Text>
            </View>
            
            <View style={S.sumTotalRow}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>NET PAYABLE LIABILITY OF CO.</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatCurrency(bcSummary.netLiability)}</Text>
            </View>
            <View style={S.inWords}>
              <Text style={{ fontSize: 7, color: TEXT_GREY, marginBottom: 2 }}>Amount In Words:</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>
                {bcSummary.netInWords} ONLY
              </Text>
            </View>
          </View>
        </View>

        <View style={S.signature}>
          <View style={S.sigLine} />
          <Text style={S.sigLabel}>FOR SURVEYOR OFFICE</Text>
          <Text style={{ fontSize: 6.5, color: TEXT_GREY, marginTop: 4 }}>Digital Verification Signature</Text>
        </View>

        <View style={S.footer}>
          <Text style={S.footerText}>
            This is a Bill Check report comparison. All figures are based on the final workshop invoice vs. the original assessment.
          </Text>
        </View>

      </Page>
    </Document>
  );
}


