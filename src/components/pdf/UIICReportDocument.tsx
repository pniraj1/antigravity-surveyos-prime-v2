'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { ClaimData, AssessmentSummary } from '@/types';
import type { SurveyorProfile } from '@/types';
import { formatCurrency } from '@/lib/calculations';

// ─── UIIC Colour Palette ─────────────────────────────────────────────────────
const UIIC_GREEN  = '#006838'; // UIIC brand green
const UIIC_GOLD   = '#C9993F'; // accent
const UIIC_LIGHT  = '#EEF4EE'; // section background
const BORDER      = '#BFCFBF';
const TEXT_DARK   = '#0F1F0F';
const TEXT_GREY   = '#4A5568';

const S = StyleSheet.create({
  page:            { padding: 28, fontFamily: 'Helvetica', fontSize: 8.5, color: TEXT_DARK, lineHeight: 1.45 },
  // ── letterhead ──────────────────────────────────────────
  lhWrap:          { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: `2px solid ${UIIC_GREEN}` },
  lhLogo:          { width: 44, height: 44, marginRight: 10 },
  lhTitle:         { fontSize: 15, fontFamily: 'Helvetica-Bold', color: UIIC_GREEN },
  lhSub:           { fontSize: 7, color: UIIC_GOLD, marginTop: 2, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  lhAddress:       { fontSize: 6.5, color: TEXT_GREY, marginTop: 1 },
  // ── report meta strip ───────────────────────────────────
  metaStrip:       { flexDirection: 'row', backgroundColor: UIIC_GREEN, padding: '5 10', marginBottom: 10, borderRadius: 2 },
  metaItem:        { flex: 1, color: '#FFFFFF', fontSize: 7.5 },
  metaLabel:       { fontSize: 6, opacity: 0.7, marginBottom: 1, textTransform: 'uppercase' },
  metaValue:       { fontFamily: 'Helvetica-Bold' },
  // ── section header ──────────────────────────────────────
  secHead:         { backgroundColor: UIIC_GREEN, color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 8.5, padding: '3 8', marginBottom: 0, letterSpacing: 0.3 },
  // ── key-value rows inside sections ──────────────────────
  kvWrap:          { border: `0.5px solid ${BORDER}`, marginBottom: 8 },
  kvRow:           { flexDirection: 'row', borderBottom: `0.5px solid ${BORDER}` },
  kvRowLast:       { flexDirection: 'row' },
  kvLabel:         { width: '32%', backgroundColor: UIIC_LIGHT, padding: '3 6', fontFamily: 'Helvetica-Bold', fontSize: 8, color: TEXT_DARK, borderRight: `0.5px solid ${BORDER}` },
  kvValue:         { flex: 1, padding: '3 6', fontSize: 8, color: TEXT_DARK },
  kvLabelHalf:     { width: '20%', backgroundColor: UIIC_LIGHT, padding: '3 6', fontFamily: 'Helvetica-Bold', fontSize: 8, color: TEXT_DARK, borderRight: `0.5px solid ${BORDER}` },
  kvValueHalf:     { width: '30%', padding: '3 6', fontSize: 8, color: TEXT_DARK, borderRight: `0.5px solid ${BORDER}` },
  // ── assessment table ────────────────────────────────────
  tableHead:       { flexDirection: 'row', backgroundColor: UIIC_GREEN, padding: '3 4', fontFamily: 'Helvetica-Bold', color: '#FFFFFF', fontSize: 7.5 },
  tableRow:        { flexDirection: 'row', padding: '2.5 4', borderBottom: `0.5px solid ${BORDER}`, fontSize: 7.5 },
  tableRowAlt:     { flexDirection: 'row', padding: '2.5 4', borderBottom: `0.5px solid ${BORDER}`, fontSize: 7.5, backgroundColor: '#F7FBF7' },
  tNo:             { width: '5%' },
  tPart:           { width: '36%' },
  tType:           { width: '10%' },
  tEst:            { width: '16%', textAlign: 'right' },
  tAss:            { width: '16%', textAlign: 'right' },
  tGst:            { width: '8%', textAlign: 'right' },
  tRem:            { width: '9%' },
  // ── summary twin box ────────────────────────────────────
  sumBox:          { border: `1px solid ${UIIC_GREEN}`, marginTop: 8, marginBottom: 8 },
  sumHead:         { backgroundColor: UIIC_GREEN, color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 8.5, padding: '3 8' },
  sumRow:          { flexDirection: 'row', justifyContent: 'space-between', padding: '2.5 8', borderBottom: `0.5px solid ${BORDER}`, fontSize: 8.5 },
  sumTotalRow:     { flexDirection: 'row', justifyContent: 'space-between', padding: '4 8', backgroundColor: UIIC_GREEN, fontSize: 10 },
  sumTotalLabel:   { color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  sumTotalValue:   { color: '#FFD700', fontFamily: 'Helvetica-Bold' },
  inWords:         { padding: '4 8', fontSize: 8, fontFamily: 'Helvetica-Oblique', color: UIIC_GREEN, borderTop: `0.5px solid ${BORDER}` },
  // ── signature block ─────────────────────────────────────
  sigBlock:        { flexDirection: 'row', marginTop: 20, justifyContent: 'space-between' },
  sigItem:         { width: '30%', alignItems: 'center' },
  sigLine:         { borderTop: `1px solid ${TEXT_DARK}`, width: '100%', marginBottom: 3 },
  sigLabel:        { fontSize: 7, color: TEXT_GREY, textAlign: 'center' },
  sigImage:        { width: 80, height: 30, objectFit: 'contain', marginBottom: 4 },
  // ── footer ──────────────────────────────────────────────
  footer:          { position: 'absolute', bottom: 18, left: 28, right: 28, borderTop: `1px solid ${UIIC_GREEN}`, paddingTop: 4 },
  footerText:      { fontSize: 6.5, color: TEXT_GREY, textAlign: 'center', fontFamily: 'Helvetica-Oblique' },
  footerMeta:      { flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.5, color: TEXT_GREY, marginBottom: 2 },
  // ── notice box ──────────────────────────────────────────
  notice:          { border: `0.75px solid ${UIIC_GOLD}`, padding: '4 8', marginBottom: 8, backgroundColor: '#FFFDF0' },
  noticeText:      { fontSize: 7.5, color: '#6B4F00', fontFamily: 'Helvetica-Oblique' },
  // ── page break helper ───────────────────────────────────
  confidentialBadge: { position: 'absolute', top: 28, right: 28, border: `0.75px solid ${UIIC_GOLD}`, padding: '2 6', fontSize: 6.5, color: UIIC_GOLD, fontFamily: 'Helvetica-Bold' },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function KVRow({ label, value, last = false, halfWidth = false }: { label: string; value: string; last?: boolean; halfWidth?: boolean }) {
  if (halfWidth) {
    return (
      <View style={last ? S.kvRowLast : S.kvRow}>
        <Text style={S.kvLabelHalf}>{label}</Text>
        <Text style={S.kvValueHalf}>{value || 'N/A'}</Text>
      </View>
    );
  }
  return (
    <View style={last ? S.kvRowLast : S.kvRow}>
      <Text style={S.kvLabel}>{label}</Text>
      <Text style={S.kvValue}>{value || 'N/A'}</Text>
    </View>
  );
}

function KVPairRow({ l1, v1, l2, v2, last = false }: { l1: string; v1: string; l2: string; v2: string; last?: boolean }) {
  return (
    <View style={last ? S.kvRowLast : S.kvRow}>
      <Text style={S.kvLabelHalf}>{l1}</Text>
      <Text style={S.kvValueHalf}>{v1 || 'N/A'}</Text>
      <Text style={S.kvLabelHalf}>{l2}</Text>
      <Text style={{ ...S.kvValueHalf, borderRight: 'none' }}>{v2 || 'N/A'}</Text>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  claim: ClaimData;
  summary: AssessmentSummary;
  profile: SurveyorProfile;
}

export function UIICReportDocument({ claim, summary, profile }: Props) {
  const allowed = claim.assessmentRows.filter(r => r.allowed);
  const disallowed = claim.assessmentRows.filter(r => !r.allowed);

  const footerText = `This report is confidential and addressed to United India Insurance Co. Ltd. · Generated via SurveyOS Prime V2`;

  return (
    <Document>
      {/* ══════════════════════════════════════════════════════════ */}
      {/* PAGE 1 — COVER / DETAILS                                  */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <Text style={S.confidentialBadge}>CONFIDENTIAL</Text>

        {/* Letterhead */}
        <View style={S.lhWrap}>
          <View style={{ flex: 1 }}>
            <Text style={S.lhTitle}>UNITED INDIA INSURANCE CO. LTD.</Text>
            <Text style={S.lhSub}>MOTOR SURVEY REPORT — FINAL SURVEY</Text>
            <Text style={S.lhAddress}>Government of India Undertaking · CIN: U66010TN1938GOI000108</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: TEXT_GREY }}>Report No: {claim.reportNo || 'DRAFT'}</Text>
            <Text style={{ fontSize: 7, color: TEXT_GREY }}>Date: {claim.reportDate}</Text>
          </View>
        </View>

        {/* Meta strip */}
        <View style={S.metaStrip}>
          <View style={S.metaItem}><Text style={S.metaLabel}>Claim Number</Text><Text style={S.metaValue}>{claim.policy.claimNumber || '—'}</Text></View>
          <View style={S.metaItem}><Text style={S.metaLabel}>Reg. No.</Text><Text style={S.metaValue}>{claim.vehicle.registrationNumber || '—'}</Text></View>
          <View style={S.metaItem}><Text style={S.metaLabel}>Date of Survey</Text><Text style={S.metaValue}>{claim.accident.dateOfSurvey || '—'}</Text></View>
          <View style={S.metaItem}><Text style={S.metaLabel}>Net Assessed Loss</Text><Text style={S.metaValue}>{formatCurrency(summary.netAssessedLoss)}</Text></View>
        </View>

        {/* § 1 — Insurer */}
        <Text style={S.secHead}>1. INSURER / POLICY DETAILS</Text>
        <View style={S.kvWrap}>
          <KVPairRow l1="Policy Number"     v1={claim.policy.policyNumber}       l2="Claim Number"   v2={claim.policy.claimNumber} />
          <KVPairRow l1="Insured Name"      v1={claim.policy.insuredName}         l2="IDV (₹)"        v2={claim.policy.idv} />
          <KVPairRow l1="Policy Period From" v1={claim.policy.periodFrom}         l2="Period To"      v2={claim.policy.periodTo} />
          <KVPairRow l1="Policy Type"       v1={claim.policy.policyType}          l2="Issuing Office" v2={claim.policy.policyIssuingOffice} />
          <KVPairRow l1="Appointing Office" v1={claim.policy.appointingOffice}    l2="HPA With"       v2={claim.policy.hpaWith} last />
        </View>

        {/* § 2 — Insured */}
        <Text style={S.secHead}>2. INSURED DETAILS</Text>
        <View style={S.kvWrap}>
          <KVPairRow l1="Name"    v1={claim.policy.insuredName}    l2="Mobile" v2={claim.policy.insuredMobile} />
          <KVRow label="Address" value={claim.policy.insuredAddress} last />
        </View>

        {/* § 3 — Vehicle */}
        <Text style={S.secHead}>3. VEHICLE DETAILS</Text>
        <View style={S.kvWrap}>
          <KVPairRow l1="Reg. No."        v1={claim.vehicle.registrationNumber} l2="Class"       v2={claim.vehicle.classOfVehicle} />
          <KVPairRow l1="Make"            v1={claim.vehicle.make}                l2="Model"       v2={claim.vehicle.model} />
          <KVPairRow l1="Year of Mfg."    v1={String(claim.vehicle.yearOfManufacture || '')} l2="Fuel" v2={claim.vehicle.fuel} />
          <KVPairRow l1="Chassis No."     v1={claim.vehicle.chassisNumber}      l2="Engine No."  v2={claim.vehicle.engineNumber} />
          <KVPairRow l1="Colour"          v1={claim.vehicle.colour}             l2="Body Type"   v2={claim.vehicle.bodyType} />
          <KVPairRow l1="Cubic Capacity"  v1={claim.vehicle.cubicCapacity}      l2="Odometer"    v2={claim.vehicle.odometer} />
          <KVPairRow l1="D.O.R."          v1={claim.vehicle.dateOfRegistration} l2="Hypothecation" v2={claim.vehicle.hypothecation} last />
        </View>

        {/* § 4 — Accident */}
        <Text style={S.secHead}>4. ACCIDENT / LOSS DETAILS</Text>
        <View style={S.kvWrap}>
          <KVPairRow l1="Date & Time of Loss" v1={claim.accident.dateAndTime}    l2="Date of Survey"   v2={claim.accident.dateOfSurvey} />
          <KVRow     label="Place of Accident"  value={claim.accident.placeOfAccident} />
          <KVRow     label="Place of Survey"    value={claim.accident.placeOfSurvey} />
          <KVRow     label="Cause of Accident"  value={claim.accident.causeOfAccident} last />
        </View>

        {/* Footer */}
        <View style={S.footer}>
          <View style={S.footerMeta}>
            <Text>Surveyor: {profile.name || '—'} | Lic: {profile.licenceNumber || '—'}</Text>
            <Text>Page 1 of 3</Text>
          </View>
          <Text style={S.footerText}>{footerText}</Text>
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* PAGE 2 — ASSESSMENT DETAILS                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <Text style={S.confidentialBadge}>CONFIDENTIAL</Text>

        {/* Compact header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: `1.5px solid ${UIIC_GREEN}` }}>
          <View>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: UIIC_GREEN }}>UNITED INDIA INSURANCE CO. LTD.</Text>
            <Text style={{ fontSize: 7, color: TEXT_GREY }}>Assessment Details · Claim No: {claim.policy.claimNumber || 'N/A'} · Reg: {claim.vehicle.registrationNumber || 'N/A'}</Text>
          </View>
          <Text style={{ fontSize: 7, color: TEXT_GREY, alignSelf: 'flex-end' }}>Report No: {claim.reportNo || 'DRAFT'}</Text>
        </View>

        {/* Notice: depreciation type */}
        <View style={S.notice}>
          <Text style={S.noticeText}>
            Depreciation Method: {claim.depreciationType === 'nil' ? 'Nil Depreciation' : claim.depreciationType === 'zero' ? 'Zero Depreciation' : 'Standard (Age-Based · IMT-23)'}
            {' · '}Pre-Accident Condition: {claim.vehicle.preAccidentCondition || 'Good'}
          </Text>
        </View>

        {/* ── ALLOWED items table ─────────────────────────────── */}
        <Text style={S.secHead}>5. ASSESSMENT — ITEMS ALLOWED</Text>
        <View style={{ border: `0.5px solid ${BORDER}`, marginBottom: 8 }}>
          <View style={S.tableHead}>
            <Text style={S.tNo}>#</Text>
            <Text style={S.tPart}>Particulars</Text>
            <Text style={S.tType}>Type</Text>
            <Text style={S.tEst}>Estimated (₹)</Text>
            <Text style={S.tAss}>Assessed (₹)</Text>
            <Text style={S.tGst}>GST%</Text>
            <Text style={S.tRem}>Remarks</Text>
          </View>
          {allowed.length === 0 && (
            <View style={S.tableRow}><Text style={{ flex: 1, color: TEXT_GREY }}>No items assessed as allowed.</Text></View>
          )}
          {allowed.map((row, idx) => (
            <View key={row.id} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={S.tNo}>{idx + 1}</Text>
              <Text style={S.tPart}>{row.particulars || '—'}</Text>
              <Text style={{ ...S.tType, textTransform: 'capitalize' }}>{row.partType}</Text>
              <Text style={S.tEst}>{formatCurrency(row.estimated)}</Text>
              <Text style={S.tAss}>{formatCurrency(row.assessed)}</Text>
              <Text style={S.tGst}>{row.gst}%</Text>
              <Text style={S.tRem}>Allowed</Text>
            </View>
          ))}
        </View>

        {/* ── DISALLOWED items ────────────────────────────────── */}
        {disallowed.length > 0 && (
          <>
            <Text style={S.secHead}>6. ITEMS NOT ALLOWED / DISALLOWED</Text>
            <View style={{ border: `0.5px solid ${BORDER}`, marginBottom: 8 }}>
              <View style={S.tableHead}>
                <Text style={S.tNo}>#</Text>
                <Text style={S.tPart}>Particulars</Text>
                <Text style={S.tType}>Type</Text>
                <Text style={S.tEst}>Estimated (₹)</Text>
                <Text style={S.tAss}>Assessed (₹)</Text>
                <Text style={S.tGst}>GST%</Text>
                <Text style={S.tRem}>Reason</Text>
              </View>
              {disallowed.map((row, idx) => (
                <View key={row.id} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={S.tNo}>{idx + 1}</Text>
                  <Text style={S.tPart}>{row.particulars || '—'}</Text>
                  <Text style={{ ...S.tType, textTransform: 'capitalize' }}>{row.partType}</Text>
                  <Text style={S.tEst}>{formatCurrency(row.estimated)}</Text>
                  <Text style={S.tAss}>{formatCurrency(row.assessed)}</Text>
                  <Text style={S.tGst}>{row.gst}%</Text>
                  <Text style={S.tRem}>Not Allowed</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Financial Summary ────────────────────────────────── */}
        <Text style={{ ...S.secHead, marginTop: 4 }}>7. FINANCIAL ASSESSMENT SUMMARY</Text>
        <View style={S.sumBox}>
          <View style={S.sumRow}><Text>Total Estimated (Workshop):  </Text><Text>{formatCurrency(summary.totalEstimated)}</Text></View>
          <View style={S.sumRow}><Text>Parts — Base Assessed:        </Text><Text>{formatCurrency(summary.partsBase)}</Text></View>
          <View style={S.sumRow}><Text>Parts — CGST (9%):            </Text><Text>{formatCurrency(summary.partsCGST)}</Text></View>
          <View style={S.sumRow}><Text>Parts — SGST (9%):            </Text><Text>{formatCurrency(summary.partsSGST)}</Text></View>
          <View style={S.sumRow}><Text>Labour — Base Assessed:       </Text><Text>{formatCurrency(summary.labourBase)}</Text></View>
          <View style={S.sumRow}><Text>Labour — GST (18%):           </Text><Text>{formatCurrency(summary.labourGST)}</Text></View>
          <View style={{ ...S.sumRow, fontFamily: 'Helvetica-Bold' }}><Text>Grand Total (Parts + Labour + GST):</Text><Text>{formatCurrency(summary.grandTotal)}</Text></View>
          <View style={S.sumRow}><Text>Less: Expected Salvage:       </Text><Text>({formatCurrency(summary.salvage)})</Text></View>
          <View style={S.sumRow}><Text>Less: Policy Excess:          </Text><Text>({formatCurrency(summary.excess)})</Text></View>
          <View style={S.sumTotalRow}>
            <Text style={S.sumTotalLabel}>NET ASSESSED LOSS / LIABILITY:</Text>
            <Text style={S.sumTotalValue}>{formatCurrency(summary.netAssessedLoss)}</Text>
          </View>
          <Text style={S.inWords}>Rupees in Words: {summary.netInWords}</Text>
        </View>

        {/* Footer */}
        <View style={S.footer}>
          <View style={S.footerMeta}>
            <Text>Surveyor: {profile.name || '—'} | Lic: {profile.licenceNumber || '—'}</Text>
            <Text>Page 2 of 3</Text>
          </View>
          <Text style={S.footerText}>{footerText}</Text>
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* PAGE 3 — DECLARATION & SIGNATURE                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <Text style={S.confidentialBadge}>CONFIDENTIAL</Text>

        {/* Compact header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: `1.5px solid ${UIIC_GREEN}` }}>
          <View>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: UIIC_GREEN }}>UNITED INDIA INSURANCE CO. LTD.</Text>
            <Text style={{ fontSize: 7, color: TEXT_GREY }}>Declaration & Enclosures · Claim No: {claim.policy.claimNumber || 'N/A'}</Text>
          </View>
          <Text style={{ fontSize: 7, color: TEXT_GREY, alignSelf: 'flex-end' }}>Report No: {claim.reportNo || 'DRAFT'}</Text>
        </View>

        {/* § 8 — Surveyor Details */}
        <Text style={S.secHead}>8. SURVEYOR DETAILS</Text>
        <View style={S.kvWrap}>
          <KVPairRow l1="Surveyor Name"   v1={profile.name}            l2="IRDAI Lic. No"    v2={profile.licenceNumber} />
          <KVPairRow l1="Qualifications"  v1={profile.qualifications}  l2="Categories"       v2={profile.categories} />
          <KVPairRow l1="Mobile"          v1={profile.mobile}          l2="Email"            v2={profile.email} />
          <KVPairRow l1="GST No."         v1={profile.gstNumber}       l2="PAN"              v2={profile.panNumber} last />
        </View>

        {/* § 9 — Declaration */}
        <Text style={S.secHead}>9. DECLARATION</Text>
        <View style={{ ...S.kvWrap, padding: '6 8' }}>
          <Text style={{ fontSize: 8, lineHeight: 1.6, color: TEXT_DARK }}>
            I/We do hereby declare that the survey was held at the address mentioned above in the presence of concerned persons.
            The loss/damage as assessed above is in my/our opinion fair and reasonable. I/We certify that I/We have no interest either
            directly or indirectly in the settlement of this claim other than as an Independent Surveyor and Loss Assessor.{'\n\n'}
            The above survey report is prepared to the best of my knowledge and belief and in accordance with the instructions of the
            Company. I/We further certify that intimation of survey was given to us on{' '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{claim.spotDetails?.allotmentDate || '___________'}</Text>
            {' '}and I/We surveyed the vehicle on{' '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{claim.accident.dateOfSurvey || '___________'}</Text>.
          </Text>
        </View>

        {/* § 10 — Enclosures */}
        <Text style={S.secHead}>10. ENCLOSURES ATTACHED</Text>
        <View style={{ ...S.kvWrap, padding: '6 8' }}>
          <Text style={{ fontSize: 8, lineHeight: 1.8 }}>
            {claim.spotDetails?.enclosures || '☐ RC Book  ☐ DL Copy  ☐ Policy Copy  ☐ Claim Form  ☐ Repair Estimate  ☐ Photos  ☐ Workshop Bill'}
          </Text>
        </View>

        {/* Signature Block */}
        <View style={S.sigBlock}>
          {/* Insurer copy */}
          <View style={S.sigItem}>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>For United India Insurance Co. Ltd.{'\n'}(Authorised Signatory)</Text>
          </View>

          {/* Surveyor signature */}
          <View style={S.sigItem}>
            {profile.signatureDataUrl && (
              <Image src={profile.signatureDataUrl} style={S.sigImage} />
            )}
            {profile.stampDataUrl && (
              <Image src={profile.stampDataUrl} style={{ ...S.sigImage, width: 60, height: 25 }} />
            )}
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>
              Signature of Surveyor{'\n'}
              {profile.name || '________________________'}{'\n'}
              Lic. No: {profile.licenceNumber || '____'} · {profile.categories || 'MOTOR'}{'\n'}
              Date: {claim.reportDate}
            </Text>
          </View>

          {/* Insured / Workshop */}
          <View style={S.sigItem}>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Acknowledgement by Insured{'\n'}(Name & Date)</Text>
          </View>
        </View>

        {/* Photos if any */}
        {claim.photos.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={S.secHead}>11. PHOTOGRAPHIC EVIDENCE (SAMPLE)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {claim.photos.slice(0, 6).map((p, i) => (
                <Image key={i} src={p.dataUrl} style={{ width: '31%', height: 100, objectFit: 'cover', border: `0.5px solid ${BORDER}` }} />
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={S.footer}>
          <View style={S.footerMeta}>
            <Text>Surveyor: {profile.name || '—'} | Lic: {profile.licenceNumber || '—'} | GST: {profile.gstNumber || '—'}</Text>
            <Text>Page 3 of 3</Text>
          </View>
          <Text style={S.footerText}>{footerText}</Text>
        </View>
      </Page>
    </Document>
  );
}
