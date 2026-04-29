'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ClaimData } from '@/types/claim';
import type { InsuredReportDraft } from '@/types/insured-report';

const C = {
  navy: '#0D1B2A',
  gold: '#D4AF37',
  bg: '#F0F2F5',
  muted: '#8D99AE',
  red: '#B91C1C',
  yellow: '#92400E',
  green: '#065F46',
} as const;

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 10, color: C.navy, backgroundColor: '#FFFFFF' },
  coverTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 4 },
  coverSubtitle: { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },
  watermark: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginTop: 6 },
  coverRow: { flexDirection: 'row', marginTop: 6 },
  coverLabel: { width: '35%', fontSize: 9, color: C.muted, fontFamily: 'Helvetica-Bold' },
  coverValue: { width: '65%', fontSize: 9, color: C.navy },
  divider: { borderBottom: '1.5px solid #D4AF37', marginVertical: 16 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, textTransform: 'uppercase', borderBottom: '1px solid #F0F2F5', paddingBottom: 4, marginBottom: 10 },
  tableRow: { flexDirection: 'row', borderBottom: '0.5px solid #F0F2F5', paddingVertical: 5 },
  tableLabel: { flex: 3, fontSize: 9, color: C.muted },
  tableValue: { flex: 1, fontSize: 9, textAlign: 'right', color: C.navy },
  tableLabelBold: { flex: 3, fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.navy },
  tableValueBold: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: C.navy },
  highlight: { backgroundColor: '#FFFBEB', borderLeft: '3px solid #D4AF37', padding: 6, marginBottom: 6, borderRadius: 2 },
  clauseTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 2 },
  clauseText: { fontSize: 9, color: '#374151', lineHeight: 1.5 },
  lineItemRow: { flexDirection: 'row', borderBottom: '0.5px solid #F0F2F5', paddingVertical: 5 },
  liDesc: { flex: 3, fontSize: 9, color: C.navy },
  liAmt: { flex: 1, fontSize: 9, textAlign: 'right', color: C.muted },
  liReason: { flex: 3, fontSize: 9, color: '#374151', fontStyle: 'italic' },
  flaggedText: { fontSize: 9, color: C.yellow, fontStyle: 'italic' },
  footer: { marginTop: 24, borderTop: '0.5px solid #F0F2F5', paddingTop: 10 },
  footerText: { fontSize: 8, color: C.muted, lineHeight: 1.5 },
  badge: { fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },
});

function fmt(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
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
  surveyorMobile = '',
}: Props) {
  const { financialSummary: fs, policyMappings, lineExplanations, stage, language } = draft;
  const stageLabel = stage === 'preliminary' ? 'PRELIMINARY ESTIMATE' : 'FINAL SETTLEMENT';
  const usedIRDAI = policyMappings.some(c => c.source === 'irdai-standard');

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Cover */}
        <View style={{ borderBottom: '2px solid #D4AF37', paddingBottom: 16, marginBottom: 16 }}>
          <Text style={styles.coverTitle}>Claim Summary</Text>
          <Text style={styles.coverSubtitle}>Prepared for: {claim.policy.insuredName || 'Insured'}</Text>
          <Text style={styles.watermark}>{stageLabel}</Text>
          <View style={{ marginTop: 12 }}>
            <View style={styles.coverRow}>
              <Text style={styles.coverLabel}>Claim No.</Text>
              <Text style={styles.coverValue}>{claim.policy.claimNumber || '—'}</Text>
            </View>
            <View style={styles.coverRow}>
              <Text style={styles.coverLabel}>Vehicle</Text>
              <Text style={styles.coverValue}>
                {[claim.vehicle.make, claim.vehicle.model, claim.vehicle.registrationNumber]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <View style={styles.coverRow}>
              <Text style={styles.coverLabel}>Insurer</Text>
              <Text style={styles.coverValue}>{claim.policy.insurerName || '—'}</Text>
            </View>
            <View style={styles.coverRow}>
              <Text style={styles.coverLabel}>Report Date</Text>
              <Text style={styles.coverValue}>
                {new Date(draft.generatedAt).toLocaleDateString('en-IN')}
              </Text>
            </View>
            <View style={styles.coverRow}>
              <Text style={styles.coverLabel}>Surveyor</Text>
              <Text style={styles.coverValue}>
                {surveyorName}{surveyorLicence ? ` · Lic. ${surveyorLicence}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Section A: Financial Breakdown */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionTitle}>A. Your Claim at a Glance</Text>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Garage repair estimate</Text>
            <Text style={styles.tableValue}>{fmt(fs.garageEstimate)}</Text>
          </View>
          {fs.negotiatedSavings > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Amount negotiated with garage</Text>
              <Text style={styles.tableValue}>{'−'}{fmt(fs.negotiatedSavings)}</Text>
            </View>
          )}
          {fs.depreciationTotal > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Depreciation on parts (as per policy)</Text>
              <Text style={styles.tableValue}>{'−'}{fmt(fs.depreciationTotal)}</Text>
            </View>
          )}
          {fs.excessTotal > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Compulsory / voluntary excess</Text>
              <Text style={styles.tableValue}>{'−'}{fmt(fs.excessTotal)}</Text>
            </View>
          )}
          {(fs.consumablesTotal + fs.notCoveredTotal) > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Items not covered / consumables</Text>
              <Text style={styles.tableValue}>{'−'}{fmt(fs.consumablesTotal + fs.notCoveredTotal)}</Text>
            </View>
          )}
          {fs.salvageTotal > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Salvage / disposal deduction</Text>
              <Text style={styles.tableValue}>{'−'}{fmt(fs.salvageTotal)}</Text>
            </View>
          )}
          <View style={[styles.tableRow, { marginTop: 6, borderTop: '1px solid #0D1B2A' }]}>
            <Text style={styles.tableLabelBold}>Insurance company will pay</Text>
            <Text style={styles.tableValueBold}>{fmt(fs.insurerPays)}</Text>
          </View>
          <View style={[styles.tableRow, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.tableLabelBold}>Your share (payable to garage)</Text>
            <Text style={[styles.tableValueBold, { color: C.red }]}>{fmt(fs.insuredPays)}</Text>
          </View>
        </View>

        {/* Section B: Policy Coverage */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionTitle}>B. What Your Policy Covers</Text>
          {usedIRDAI && (
            <View style={[styles.highlight, { marginBottom: 10 }]}>
              <Text style={[styles.clauseText, { color: C.yellow }]}>
                Policy document not uploaded — IRDAI standard rules applied below.
              </Text>
            </View>
          )}
          {policyMappings.map((clause, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={styles.clauseTitle}>{clause.clauseTitle}</Text>
              <Text style={styles.clauseText}>{clause.plainLanguage}</Text>
            </View>
          ))}
        </View>

        {/* Section C: Line Item Adjustments */}
        {lineExplanations.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>C. Why Certain Items Were Adjusted</Text>
            <View style={[styles.lineItemRow, { borderBottom: '1px solid #0D1B2A' }]}>
              <Text style={[styles.liDesc, { fontFamily: 'Helvetica-Bold', color: C.muted, fontSize: 8 }]}>
                ITEM
              </Text>
              <Text style={[styles.liAmt, { fontFamily: 'Helvetica-Bold', color: C.muted, fontSize: 8 }]}>
                BILLED
              </Text>
              <Text style={[styles.liAmt, { fontFamily: 'Helvetica-Bold', color: C.muted, fontSize: 8 }]}>
                ASSESSED
              </Text>
              <Text style={[styles.liReason, { fontFamily: 'Helvetica-Bold', color: C.muted, fontSize: 8 }]}>
                REASON
              </Text>
            </View>
            {lineExplanations.map((item, i) => (
              <View
                key={i}
                style={[styles.lineItemRow, item.isFlagged ? { backgroundColor: '#FFFBEB' } : {}]}
              >
                <Text style={styles.liDesc}>{item.partDescription}</Text>
                <Text style={styles.liAmt}>{fmt(item.billedAmount)}</Text>
                <Text style={styles.liAmt}>{fmt(item.surveyorAmount)}</Text>
                <Text style={item.isFlagged ? styles.flaggedText : styles.liReason}>
                  {item.isFlagged
                    ? 'Reviewed under applicable policy terms'
                    : item.aiExplanation}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Section D: Salvage / Disposal */}
        {fs.salvageTotal > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>D. About Salvage / Disposal</Text>
            <Text style={styles.clauseText}>
              {`When a damaged part is replaced, the old part belongs to the insurance company. Its estimated scrap value (₹${fs.salvageTotal.toLocaleString('en-IN')}) has been deducted from your claim settlement.`}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {`Prepared by: ${surveyorName}${surveyorLicence ? ` | IRDAI Licence: ${surveyorLicence}` : ''}${surveyorMobile ? ` | ${surveyorMobile}` : ''}`}
          </Text>
          <Text style={[styles.footerText, { marginTop: 4 }]}>
            This report is prepared for informational purposes to help you understand your claim
            settlement. For disputes, contact your insurance company's grievance cell.
          </Text>
          {language !== 'english' && (
            <Text style={[styles.badge, { marginTop: 4 }]}>Language: {language}</Text>
          )}
        </View>

      </Page>
    </Document>
  );
}
