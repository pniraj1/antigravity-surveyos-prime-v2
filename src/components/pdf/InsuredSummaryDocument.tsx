'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ClaimData } from '@/types/claim';
import type { InsuredReportDraft } from '@/types/insured-report';

const C = {
  navy: '#0D1B2A',
  gold: '#D4AF37',
  muted: '#8D99AE',
  red: '#B91C1C',
  green: '#166534',
  greenBg: '#f0fdf4',
  greenBorder: '#86efac',
  gray: '#374151',
  grayBg: '#f9fafb',
  grayBorder: '#e5e7eb',
  mutedBg: '#f3f4f6',
} as const;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: C.navy, lineHeight: 1.4 },
  // Block 1 — Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1.5px solid #D4AF37', paddingBottom: 14 },
  headerGroup: { flexDirection: 'column', gap: 4 },
  headerLabel: { fontSize: 7, color: C.muted, fontFamily: 'Helvetica-Bold' },
  headerValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.navy },
  // Block 2 — Settlement Summary
  summaryBox: { backgroundColor: C.greenBg, borderRadius: 6, padding: 14, marginBottom: 20 },
  summaryTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.green, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  summaryLabel: { fontSize: 9, color: C.gray },
  summaryAmount: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.navy },
  summaryDivider: { borderTop: '1px solid #86efac', marginVertical: 5 },
  summaryHlLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.green },
  summaryHlAmount: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.green },
  // Sections
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6, borderBottom: '0.5px solid #e5e7eb', paddingBottom: 3 },
  // Block 3 — Deduction paragraphs
  deductionBlock: { marginBottom: 8, padding: 8, backgroundColor: C.grayBg, borderRadius: 4 },
  deductionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  deductionText: { fontSize: 8.5, color: C.gray },
  deductionAmount: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.red, marginTop: 3 },
  // Block 4 — Parts table
  tableHeader: { flexDirection: 'row', backgroundColor: C.mutedBg, padding: 5 },
  tableRow: { flexDirection: 'row', padding: 4, borderBottom: '0.5px solid #f3f4f6' },
  colPart: { width: '38%', fontSize: 7.5 },
  colBilled: { width: '15%', fontSize: 7.5, textAlign: 'right' },
  colAssessed: { width: '15%', fontSize: 7.5, textAlign: 'right' },
  colStatus: { width: '32%', fontSize: 7.5, paddingLeft: 4 },
  colHeaderText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.muted },
  // Block 6 — Declaration
  declaration: { marginTop: 20, paddingTop: 10, borderTop: '0.5px solid #e5e7eb' },
  declarationText: { fontSize: 7.5, color: C.muted },
  signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  signatureLine: { borderTop: '0.5px solid #374151', paddingTop: 3, width: 130, fontSize: 7.5, color: C.muted },
});

function fmt(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function categoryLabel(cat: string | undefined, allowed: boolean): string {
  if (!allowed) return 'Not covered';
  const map: Record<string, string> = {
    safe: 'Approved in full',
    depreciation: 'Depreciation applied',
    salvage: 'Disposal — used part',
    consumable: 'Consumable — excluded',
    'not-covered': 'Not covered',
    'previous-damage': 'Pre-existing damage',
  };
  return map[cat ?? ''] ?? 'Approved in full';
}

interface Props {
  claim: ClaimData;
  draft: InsuredReportDraft;
  surveyorName?: string;
  surveyorLicence?: string;
  surveyorMobile?: string;
}

export function InsuredSummaryDocument({
  claim,
  draft,
  surveyorName = '',
  surveyorLicence = '',
}: Props) {
  const { financialSummary: fs, policyMappings, lineExplanations } = draft;

  const salvageItems = lineExplanations.filter(e => e.deductionCategory === 'salvage');
  const notCoveredItems = lineExplanations.filter(
    e => e.deductionCategory === 'not-covered' || e.deductionCategory === 'previous-damage',
  );
  const compulsoryExcess = claim.feeBill.compulsoryExcess;
  const voluntaryExcess = claim.feeBill.voluntaryExcess;

  const allRows = claim.assessmentRows;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Block 1: Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerGroup}>
            <View>
              <Text style={styles.headerLabel}>CLAIM NO.</Text>
              <Text style={styles.headerValue}>{claim.policy.claimNumber || '—'}</Text>
            </View>
            <View style={{ marginTop: 6 }}>
              <Text style={styles.headerLabel}>VEHICLE</Text>
              <Text style={styles.headerValue}>
                {[claim.vehicle.make, claim.vehicle.model, claim.vehicle.registrationNumber]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </Text>
            </View>
            <View style={{ marginTop: 6 }}>
              <Text style={styles.headerLabel}>DATE OF ACCIDENT</Text>
              <Text style={styles.headerValue}>
                {claim.accident?.dateAndTime
                  ? new Date(claim.accident.dateAndTime).toLocaleDateString('en-IN')
                  : '—'}
              </Text>
            </View>
          </View>
          <View style={[styles.headerGroup, { alignItems: 'flex-end' }]}>
            <View>
              <Text style={styles.headerLabel}>INSURED</Text>
              <Text style={styles.headerValue}>{claim.policy.insuredName || '—'}</Text>
            </View>
            <View style={{ marginTop: 6 }}>
              <Text style={styles.headerLabel}>POLICY NUMBER</Text>
              <Text style={styles.headerValue}>{claim.policy.policyNumber || '—'}</Text>
            </View>
            <View style={{ marginTop: 6 }}>
              <Text style={styles.headerLabel}>SURVEY DATE</Text>
              <Text style={styles.headerValue}>
                {new Date(draft.generatedAt).toLocaleDateString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Block 2: Settlement Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Claim Settlement Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Your workshop charged</Text>
            <Text style={styles.summaryAmount}>{fmt(fs.garageEstimate)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Your insurance company will pay</Text>
            <Text style={styles.summaryAmount}>{fmt(fs.insurerPays)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryHlLabel}>Amount you pay directly to garage</Text>
            <Text style={styles.summaryHlAmount}>{fmt(fs.insuredPays)}</Text>
          </View>
        </View>

        {/* Block 3: Why is there a difference? */}
        {(fs.depreciationTotal > 0 || fs.excessTotal > 0 || fs.consumablesTotal > 0 || salvageItems.length > 0 || notCoveredItems.length > 0) && (
          <Text style={styles.sectionTitle}>Why is there a difference?</Text>
        )}

        {fs.depreciationTotal > 0 && (
          <View style={styles.deductionBlock}>
            <Text style={styles.deductionTitle}>Depreciation on Parts</Text>
            <Text style={styles.deductionText}>
              As per IRDAI guidelines, depreciation is applied to replaced parts based on your vehicle&apos;s age. This reflects the value the parts had already lost before the accident and is standard for all motor insurance policies of this type.
            </Text>
            <Text style={styles.deductionAmount}>Total deducted: {fmt(fs.depreciationTotal)}</Text>
          </View>
        )}

        {fs.excessTotal > 0 && (
          <View style={styles.deductionBlock}>
            <Text style={styles.deductionTitle}>Policy Excess</Text>
            <Text style={styles.deductionText}>
              {compulsoryExcess > 0 ? `Compulsory excess: ${fmt(compulsoryExcess)} — standard for all claims of this type. ` : ''}
              {voluntaryExcess > 0 ? `Voluntary excess: ${fmt(voluntaryExcess)} — selected by you when purchasing the policy to reduce your premium.` : ''}
            </Text>
            <Text style={styles.deductionAmount}>Total deducted: {fmt(fs.excessTotal)}</Text>
          </View>
        )}

        {fs.consumablesTotal > 0 && (
          <View style={styles.deductionBlock}>
            <Text style={styles.deductionTitle}>Consumables</Text>
            <Text style={styles.deductionText}>
              Engine oil, coolant, nuts, bolts and similar materials are not covered under standard motor insurance. These are maintenance items replaced during every repair.
            </Text>
            <Text style={styles.deductionAmount}>Total excluded: {fmt(fs.consumablesTotal)}</Text>
          </View>
        )}

        {salvageItems.length > 0 && (
          <View style={styles.deductionBlock}>
            <Text style={styles.deductionTitle}>Second-Hand Parts (Disposal)</Text>
            <Text style={styles.deductionText}>
              For the parts below, the workshop sourced second-hand parts. The value reflects the fair market price of the used part. GST does not apply to used parts.
            </Text>
            {salvageItems.map((item, i) => (
              <Text key={i} style={[styles.deductionText, { marginTop: 2 }]}>
                {'  • '}{item.partDescription}: {fmt(item.surveyorAmount)}
              </Text>
            ))}
          </View>
        )}

        {notCoveredItems.length > 0 && (
          <View style={styles.deductionBlock}>
            <Text style={styles.deductionTitle}>Items Not Covered / Pre-existing Damage</Text>
            {notCoveredItems.map((item, i) => (
              <Text key={i} style={[styles.deductionText, { marginTop: 2 }]}>
                {'  • '}{item.partDescription}: {item.aiExplanation || 'See surveyor remarks.'}
              </Text>
            ))}
          </View>
        )}

        {/* Block 4: Part-by-Part Table */}
        <Text style={styles.sectionTitle}>Part-by-Part Assessment</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.colPart, styles.colHeaderText]}>Part</Text>
          <Text style={[styles.colBilled, styles.colHeaderText]}>Workshop Bill</Text>
          <Text style={[styles.colAssessed, styles.colHeaderText]}>Assessed</Text>
          <Text style={[styles.colStatus, styles.colHeaderText]}>Status</Text>
        </View>
        {allRows.map((row, i) => {
          const explanation = lineExplanations.find(e => e.assessmentRowId === row.id);
          const billed = row.billedTaxable ?? row.estimated;
          const cat = explanation?.deductionCategory ?? (row.allowed ? 'safe' : 'not-covered');
          return (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colPart}>{row.particulars}</Text>
              <Text style={styles.colBilled}>{fmt(billed)}</Text>
              <Text style={styles.colAssessed}>{fmt(row.assessed)}</Text>
              <Text style={styles.colStatus}>{categoryLabel(cat, row.allowed)}</Text>
            </View>
          );
        })}

        {/* Block 5: Policy Clauses Referenced */}
        {policyMappings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Policy Clauses Referenced</Text>
            {policyMappings.map((clause, i) => (
              <Text key={i} style={[styles.deductionText, { marginBottom: 3 }]}>
                {'• '}
                {clause.clauseTitle}: {clause.plainLanguage}
              </Text>
            ))}
          </>
        )}

        {/* Block 6: Surveyor Declaration */}
        <View style={styles.declaration}>
          <Text style={styles.declarationText}>
            This claim has been surveyed and assessed in accordance with the terms and conditions of the policy and applicable IRDAI guidelines. The settlement figures are based on actual damage observed at time of inspection.
          </Text>
          <View style={styles.signatureRow}>
            <Text style={styles.signatureLine}>Surveyor Signature</Text>
            <Text style={styles.signatureLine}>
              {surveyorName}{surveyorLicence ? `\nLic: ${surveyorLicence}` : ''}
            </Text>
            <Text style={styles.signatureLine}>Date of Inspection</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
