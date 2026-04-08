'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { ClaimData, AssessmentSummary } from '@/types';
import { formatCurrency, getVehicleAgeMonths, getDepreciationRate, getDepPolicyLabel } from '@/lib/calculations';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.4,
    color: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottom: '2px solid #2563EB',
    paddingBottom: 10,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    width: 32,
    height: 32,
    backgroundColor: '#2563EB',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  reportTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#2563EB',
    textAlign: 'right',
  },
  reportMeta: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 2,
  },

  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    backgroundColor: '#F3F4F6',
    padding: '4 8',
    borderLeft: '3px solid #2563EB',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
    border: '1px solid #E5E7EB',
  },
  infoItem: {
    width: '50%',
    flexDirection: 'row',
    borderBottom: '1px solid #E5E7EB',
    minHeight: 22,
    alignItems: 'center',
  },
  infoItemFull: {
    width: '100%',
    flexDirection: 'row',
    borderBottom: '1px solid #E5E7EB',
    minHeight: 22,
    alignItems: 'center',
  },
  label: {
    width: '40%',
    backgroundColor: '#F9FAFB',
    padding: '4 8',
    color: '#4B5563',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    height: '100%',
    borderRight: '1px solid #E5E7EB',
  },
  value: {
    width: '60%',
    padding: '4 8',
    color: '#111827',
    fontSize: 8,
  },
  valueFull: {
    width: '80%',
    padding: '4 8',
    color: '#111827',
    fontSize: 8,
  },

  table: {
    width: '100%',
    marginTop: 8,
    border: '1px solid #E5E7EB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    padding: '4 2',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #E5E7EB',
    fontSize: 7,
    padding: '4 2',
    alignItems: 'center',
  },
  colNo: { width: '4%' },
  colPart: { width: '28%', textAlign: 'left', paddingLeft: 4 },
  colTy: { width: '8%' },
  colEst: { width: '10%', textAlign: 'right', paddingRight: 4 },
  colAss: { width: '10%', textAlign: 'right', paddingRight: 4 },
  colDep: { width: '6%', textAlign: 'center' },
  colDepAmt: { width: '10%', textAlign: 'right', paddingRight: 4 },
  colGstPer: { width: '8%', textAlign: 'center' },
  colNet: { width: '16%', textAlign: 'right', paddingRight: 4 },

  summaryContainer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    border: '1px solid #2563EB',
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    fontSize: 8,
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '2px solid #2563EB',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#2563EB',
  },

  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1px solid #E5E7EB',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9CA3AF',
  },
  signatureBox: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signature: {
    width: 150,
    textAlign: 'center',
    paddingTop: 10,
    borderTop: '1px solid #9CA3AF',
    fontSize: 8,
  }
});

interface Props {
  claim: ClaimData;
  summary: AssessmentSummary;
}

export function SurveyReportDocument({ claim, summary }: Props) {
  const ageMonths = getVehicleAgeMonths(
    claim?.vehicle?.dateOfRegistration || null,
    claim?.vehicle?.yearOfManufacture ? Number(claim.vehicle.yearOfManufacture) : null,
    claim?.accident?.dateOfSurvey || null
  );

  const renderInfoItem = (label: string, value: string | number | undefined, isFull = false) => (
    <View style={isFull ? styles.infoItemFull : styles.infoItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={isFull ? styles.valueFull : styles.value}>{value || '-'}</Text>
    </View>
  );

  return (
    <Document>
      {/* ─── PAGE 1: POLICY & VEHICLE & ACCIDENT ────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <View>
              <Text style={styles.companyName}>SurveyOS Prime</Text>
              <Text style={{ fontSize: 7, color: '#6B7280' }}>Reliable Insurance Survey Solutions</Text>
            </View>
          </View>
          <View>
            <Text style={styles.reportTitle}>MOTOR SURVEY REPORT (FINAL)</Text>
            <Text style={styles.reportMeta}>Report No: {claim?.reportNo || 'DRAFT'}</Text>
            <Text style={styles.reportMeta}>Issue Date: {claim?.reportDate || '-'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>1. POLICY & INSURER DETAILS</Text></View>
          <View style={styles.infoGrid}>
            {renderInfoItem('Insurer Name', claim?.policy?.insurerName, true)}
            {renderInfoItem('Policy Number', claim?.policy?.policyNumber)}
            {renderInfoItem('Claim Number', claim?.policy?.claimNumber)}
            {renderInfoItem('Policy Period', `${claim?.policy?.periodFrom || ''} to ${claim?.policy?.periodTo || ''}`)}
            {renderInfoItem('IDV (Sum Insured)', formatCurrency(Number(claim?.policy?.idv) || 0))}
            {renderInfoItem('Policy Type', claim?.policy?.policyType)}
            {renderInfoItem('Appointing Office', claim?.policy?.appointingOffice, true)}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>2. INSURED DETAILS</Text></View>
          <View style={styles.infoGrid}>
            {renderInfoItem('Insured Name', claim?.policy?.insuredName, true)}
            {renderInfoItem('Address', claim?.policy?.insuredAddress, true)}
            {renderInfoItem('Contact No.', claim?.policy?.insuredMobile)}
            {renderInfoItem('HPA/Financier', claim?.policy?.hpa || 'NIL')}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>3. VEHICLE PARTICULARS</Text></View>
          <View style={styles.infoGrid}>
            {renderInfoItem('Registration No.', claim?.vehicle?.registrationNumber)}
            {renderInfoItem('Registration Date', claim?.vehicle?.dateOfRegistration)}
            {renderInfoItem('Make & Model', `${claim?.vehicle?.make || ''} ${claim?.vehicle?.model || ''}`)}
            {renderInfoItem('Year of Mfg', claim?.vehicle?.yearOfManufacture ?? '-')}
            {renderInfoItem('Chassis Number', claim?.vehicle?.chassisNumber)}
            {renderInfoItem('Engine Number', claim?.vehicle?.engineNumber)}
            {renderInfoItem('Vehicle Class', claim?.vehicle?.classOfVehicle)}
            {renderInfoItem('Fuel Type', claim?.vehicle?.fuel)}
            {renderInfoItem('C.C. / HP', claim?.vehicle?.cubicCapacity)}
            {renderInfoItem('Odometer (KM)', claim?.vehicle?.odometer)}
            {renderInfoItem('Body Type', claim?.vehicle?.bodyType)}
            {renderInfoItem('Colour', claim?.vehicle?.colour)}
            {renderInfoItem('Seating / RLW', claim?.vehicle?.seatingCapacity || claim?.vehicle?.registeredLoadWeight)}
            {renderInfoItem('Fitness Expiry', claim?.vehicle?.fitnessValidUpto)}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>SurveyOS Prime - Professional Survey Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
        </View>
      </Page>

      {/* ─── PAGE 2: DRIVER & ACCIDENT & DOCUMENT VERIFICATION ─── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <Text style={styles.companyName}>SurveyOS Prime</Text>
          </View>
          <Text style={styles.reportTitle}>PARTICULARS OF ACCIDENT</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>4. DRIVER'S PARTICULARS</Text></View>
          <View style={styles.infoGrid}>
            {renderInfoItem('Driver Name', claim?.driver?.name, true)}
            {renderInfoItem('Parentage', claim?.driver?.parentName || claim?.driver?.fatherHusbandName, true)}
            {renderInfoItem('Date of Birth', claim?.driver?.dateOfBirth || claim?.driver?.dob)}
            {renderInfoItem('License Number', claim?.driver?.licenseNumber || claim?.driver?.licenceNumber)}
            {renderInfoItem('Issue Date', claim?.driver?.dateOfIssue)}
            {renderInfoItem('N.T. Validity', claim?.driver?.validityNonTransport)}
            {renderInfoItem('TR Validity', claim?.driver?.validityTransport)}
            {renderInfoItem('Issuing Authority', claim?.driver?.issuingAuthority, true)}
            {renderInfoItem('Allowed Classes', claim?.driver?.vehicleClasses, true)}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>5. ACCIDENT DETAILS</Text></View>
          <View style={styles.infoGrid}>
            {renderInfoItem('Date & Time', claim?.accident?.dateAndTime)}
            {renderInfoItem('Accident Location', claim?.accident?.placeOfAccident, true)}
            {renderInfoItem('Police Station', claim?.accident?.policeStation)}
            {renderInfoItem('FIR / Diary No.', claim?.accident?.firNumber)}
            {renderInfoItem('Cause & Nature', claim?.accident?.causeOfAccident, true)}
            {renderInfoItem('TP Involvement', claim?.accident?.thirdPartyDetails || 'NIL', true)}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>6. DOCUMENT VERIFICATION</Text></View>
          <View style={styles.infoGrid}>
            {renderInfoItem('RC Verified?', claim?.vehicle?.registrationNumber ? 'YES' : 'NO')}
            {renderInfoItem('DL Verified?', claim?.driver?.licenseNumber ? 'YES' : 'NO')}
            {renderInfoItem('Permit Category', claim?.spotDetails?.permitType || 'NA')}
            {renderInfoItem('Permit Valid Upto', claim?.spotDetails?.permitTo || 'NA')}
            {renderInfoItem('Fitness Valid Upto', claim?.vehicle?.fitnessValidUpto || 'NA')}
            {renderInfoItem('Authorization', claim?.spotDetails?.authNo || 'NA')}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>SurveyOS Prime - Professional Survey Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
        </View>
      </Page>

      {/* ─── PAGE 3: ASSESSMENT TABLE ──────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>SurveyOS Prime</Text>
          <Text style={styles.reportTitle}>ASSESSMENT DETAILS</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>7. DETAILED ASSESSMENT ({getDepPolicyLabel(claim.depreciationType, ageMonths)})</Text></View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colNo}>No</Text>
              <Text style={styles.colPart}>Particulars of Parts</Text>
              <Text style={styles.colTy}>Type</Text>
              <Text style={styles.colEst}>Estimated</Text>
              <Text style={styles.colAss}>Assessed</Text>
              <Text style={styles.colDep}>Dep%</Text>
              <Text style={styles.colDepAmt}>Dep.Amt</Text>
              <Text style={styles.colGstPer}>GST%</Text>
              <Text style={styles.colNet}>Net Amt</Text>
            </View>
            {(claim?.assessmentRows || []).map((row, index) => {
              const depRate = getDepreciationRate(row.partType, ageMonths, claim?.depreciationType || 'Standard');
              const depAmt = (row.assessed || 0) * (depRate / 100);
              const valueAfterDep = (row.assessed || 0) - depAmt;
              const gstAmt = valueAfterDep * ((row.gst || 0) / 100);
              const netAmt = valueAfterDep + gstAmt;

              return (
                <View key={row.id} style={styles.tableRow}>
                  <Text style={styles.colNo}>{index + 1}</Text>
                  <Text style={styles.colPart}>{row.particulars}</Text>
                  <Text style={styles.colTy}>{row.partType.substring(0, 3).toUpperCase()}</Text>
                  <Text style={styles.colEst}>{formatCurrency(row.estimated)}</Text>
                  <Text style={styles.colAss}>{formatCurrency(row.assessed)}</Text>
                  <Text style={styles.colDep}>{depRate}%</Text>
                  <Text style={styles.colDepAmt}>{formatCurrency(depAmt)}</Text>
                  <Text style={styles.colGstPer}>{row.gst}%</Text>
                  <Text style={styles.colNet}>{formatCurrency(netAmt)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>SurveyOS Prime - Professional Survey Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
        </View>
      </Page>

      {/* ─── PAGE 4: SUMMARY & SIGNATURE ───────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>SurveyOS Prime</Text>
          <Text style={styles.reportTitle}>FINAL SUMMARY</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>8. SUMMARY OF LOSS (LIABILITY)</Text></View>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text>Net Parts (After Depreciation)</Text>
                <Text>{formatCurrency(summary.partsBase)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={{ fontSize: 7, color: '#6B7280', paddingLeft: 10 }}>Add CGST on Parts (9%)</Text>
                <Text style={{ fontSize: 7, color: '#6B7280' }}>{formatCurrency(summary.partsCGST)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={{ fontSize: 7, color: '#6B7280', paddingLeft: 10 }}>Add SGST on Parts (9%)</Text>
                <Text style={{ fontSize: 7, color: '#6B7280' }}>{formatCurrency(summary.partsSGST)}</Text>
              </View>
              
              <View style={[styles.summaryRow, { marginTop: 4 }]}>
                <Text>Labour & Painting Charges (Assessed)</Text>
                <Text>{formatCurrency(summary.labourBase)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={{ fontSize: 7, color: '#6B7280', paddingLeft: 10 }}>Add GST on Labour (18%)</Text>
                <Text style={{ fontSize: 7, color: '#6B7280' }}>{formatCurrency(summary.labourGST)}</Text>
              </View>

              <View style={styles.summaryTotal}>
                <Text>Gross Assessed Liability</Text>
                <Text>{formatCurrency(summary.grandTotal)}</Text>
              </View>
              
              <View style={[styles.summaryRow, { marginTop: 4, color: '#DC2626' }]}>
                <Text>Less: Salvage Value (Expected)</Text>
                <Text>- {formatCurrency(summary.salvage)}</Text>
              </View>
              {summary.voluntaryExcess > 0 && (
                <View style={[styles.summaryRow, { color: '#DC2626' }]}>
                  <Text>Less: Voluntary Excess</Text>
                  <Text>- {formatCurrency(summary.voluntaryExcess)}</Text>
                </View>
              )}
              <View style={[styles.summaryRow, { color: '#DC2626' }]}>
                <Text>Less: Compulsory Excess / Deductible</Text>
                <Text>- {formatCurrency(summary.compulsoryExcess)}</Text>
              </View>
              
              <View style={[styles.summaryTotal, { backgroundColor: '#2563EB', color: '#FFFFFF', padding: 8, marginTop: 10, borderRadius: 4 }]}>
                <Text>NET PAYABLE LOSS</Text>
                <Text>{formatCurrency(summary.netAssessedLoss)}</Text>
              </View>
              
              <Text style={{ fontSize: 7, marginTop: 8, fontStyle: 'italic', color: '#111827', fontFamily: 'Helvetica-Bold' }}>
                ({summary.netInWords})
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>9. SURVEYOR'S REMARKS & DECLARATION</Text></View>
          <View style={{ border: '1px solid #E5E7EB', padding: 8, minHeight: 80, backgroundColor: '#F9FAFB' }}>
            <Text style={{ fontSize: 8, color: '#374151', lineHeight: 1.5 }}>
              The assessment above is based on a thorough physical inspection of the vehicle. The damages noted are consistent with the reported cause and nature of the accident. All replaced parts have been physically verified against the old damaged units. This report is issued without prejudice, subject to the terms, conditions, and exceptions of the insurance policy.
            </Text>
          </View>
        </View>

        <View style={styles.signatureBox}>
          <View style={styles.signature}>
            <Text>Insured Signature</Text>
          </View>
          <View style={styles.signature}>
            <Text>Surveyor Signature & Stamp</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>SurveyOS Prime - Professional Survey Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
        </View>
      </Page>
    </Document>
  );
}
