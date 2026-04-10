import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ClaimData, AssessmentSummary } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fd(v: string | null | undefined): string {
  if (!v) return '';
  const s = String(v).split('T')[0];
  const parts = s.split('-');
  return parts.length === 3 && parts[0].length === 4 ? `${parts[2]}.${parts[1]}.${parts[0]}` : v;
}

function fa(v: number | string | null | undefined): string {
  return parseFloat(String(v || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function g(v: string | number | null | undefined): string {
  return v !== null && v !== undefined ? String(v) : '';
}

function getDepRate(partType: string, ageMonths: number, depType: string): number {
  const dt = (depType || 'standard').toLowerCase();
  if (dt === 'nil' || dt === 'nil depreciation') return 0;
  if (partType === 'glass') return 0;
  if (partType === 'plastic') return 50;
  if (ageMonths <= 6) return 0;
  if (ageMonths <= 12) return 5;
  if (ageMonths <= 24) return 10;
  if (ageMonths <= 36) return 15;
  if (ageMonths <= 48) return 25;
  if (ageMonths <= 60) return 35;
  if (ageMonths <= 120) return 40;
  return 50;
}

function getVehicleAgeMonths(regDate: string | null, year: number | null, doa: string | null): number {
  const start: Date | null = regDate ? new Date(regDate) : (year ? new Date(year, 0, 1) : null);
  if (!start) return 0;
  const ref = doa ? new Date(doa) : new Date();
  if (isNaN(start.getTime()) || isNaN(ref.getTime()) || ref < start) return 0;
  return (ref.getFullYear() - start.getFullYear()) * 12 + ref.getMonth() - start.getMonth();
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 8,
    lineHeight: 1.3,
    color: '#000',
  },
  header: {
    marginBottom: 10,
    textAlign: 'center',
    borderBottom: '1.5pt solid #000',
    paddingBottom: 5,
  },
  companyName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  reportTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
    marginTop: 4,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#eee',
    padding: '2 4',
    border: '0.5pt solid #000',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderLeft: '0.5pt solid #000',
    borderTop: '0.5pt solid #000',
  },
  gridItem: {
    width: '50%',
    flexDirection: 'row',
    borderRight: '0.5pt solid #000',
    borderBottom: '0.5pt solid #000',
    minHeight: 18,
    alignItems: 'center',
  },
  label: {
    width: '40%',
    padding: '2 4',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
  },
  value: {
    width: '60%',
    padding: '2 4',
  },
  
  // Table
  table: {
    width: '100%',
    marginTop: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f3f3',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    fontSize: 6.5,
    borderBottom: '0.3pt solid #ccc',
  },
  tableCell: {
    padding: '2 1',
    borderLeft: '0.3pt solid #ccc',
  },
  
  colSr: { width: '4%', textAlign: 'center' },
  colPart: { width: '22%' },
  colType: { width: '6%', textAlign: 'center' },
  colEst: { width: '8%', textAlign: 'right' },
  colAss: { width: '8%', textAlign: 'right' },
  colDepP: { width: '5%', textAlign: 'center' },
  colMet: { width: '7%', textAlign: 'right' },
  colPla: { width: '7%', textAlign: 'right' },
  colFib: { width: '7%', textAlign: 'right' },
  colGla: { width: '7%', textAlign: 'right' },
  colGSTP: { width: '5%', textAlign: 'center' },
  colNet: { width: '14%', textAlign: 'right' },

  summaryBox: {
    marginTop: 10,
    width: '100%',
    border: '0.5pt solid #000',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '2 10',
    borderBottom: '0.3pt solid #eee',
  },
  summaryTotal: {
    backgroundColor: '#eee',
    fontFamily: 'Helvetica-Bold',
  },
  
  signatureArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  sigBlock: {
    textAlign: 'center',
    width: 200,
    borderTop: '0.5pt solid #000',
    paddingTop: 5,
  }
});

interface Props {
  claim: ClaimData;
}

export function SurveyReportDocument({ claim }: Props) {
  const v = claim.vehicle;
  const d = claim.driver;
  const p = claim.policy;
  const a = claim.accident;
  const sd = claim.spotDetails;
  const rows = claim.assessmentRows || [];
  const depType = claim.depreciationType || 'standard';

  const ageMonths = getVehicleAgeMonths(
    v.dateOfRegistration || null,
    v.yearOfManufacture ? Number(v.yearOfManufacture) : null,
    a.dateAndTime || null
  );

  // ── Assessment Aggregates ──────────────────────────────────────────────────
  let totalEst = 0, totalAss = 0, totalMet = 0, totalPla = 0, totalGla = 0, totalNet = 0;
  let labBase = 0, paintBase = 0;

  rows.forEach(r => {
    if (r.section === 'parts' && r.allowed !== false) {
      totalEst += r.estimated;
      totalAss += r.assessed;
      const dr = getDepRate(r.partType, ageMonths, depType);
      const val = r.assessed * (1 - dr/100);
      if (r.partType === 'metal') totalMet += val;
      else if (r.partType === 'plastic') totalPla += val;
      else if (r.partType === 'glass') totalGla += val;
      
      const gst = val * ((r.gst || 18) / 100);
      totalNet += val + gst;
    } else if (r.section === 'labour' && r.allowed !== false) {
      labBase += r.assessed;
      totalNet += r.assessed * 1.18;
    } else if (r.section === 'paint' && r.allowed !== false) {
      paintBase += r.assessed;
      totalNet += r.assessed * 1.18;
    }
  });

  const fb = claim.feeBill || {};
  const salvage = fb.salvageValue || 0;
  const volEx = fb.voluntaryExcess || 0;
  const comEx = fb.compulsoryExcess || fb.lessExcess || 0;
  const tow = fb.travelExpenses || 0;
  const finalNet = Math.max(0, totalNet + tow - salvage - volEx - comEx);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>SURVEYOS PRIME SOLUTIONS</Text>
          <Text style={styles.reportTitle}>FINAL MOTOR SURVEY REPORT</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. POLICY & INSURED PARTICULARS</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}><Text style={styles.label}>Insurer:</Text><Text style={styles.value}>{g(p.insurerName)}</Text></View>
            <View style={styles.gridItem}><Text style={styles.label}>Policy No:</Text><Text style={styles.value}>{g(p.policyNumber)}</Text></View>
            <View style={styles.gridItem}><Text style={styles.label}>Insured Name:</Text><Text style={styles.value}>{g(p.insuredName)}</Text></View>
            <View style={styles.gridItem}><Text style={styles.label}>Period From:</Text><Text style={styles.value}>{fd(p.periodFrom)} to {fd(p.periodTo)}</Text></View>
            <View style={[styles.gridItem, { width: '100%' }]}><Text style={[styles.label, { width: '20%' }]}>Address:</Text><Text style={[styles.value, { width: '80%' }]}>{g(p.insuredAddress)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. VEHICLE & ACCIDENT DETAILS</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}><Text style={styles.label}>Reg. No:</Text><Text style={styles.value}>{g(v.registrationNumber)}</Text></View>
            <View style={styles.gridItem}><Text style={styles.label}>Chassis No:</Text><Text style={styles.value}>{g(v.chassisNumber)}</Text></View>
            <View style={styles.gridItem}><Text style={styles.label}>Make/Model:</Text><Text style={styles.value}>{g(v.make)} / {g(v.model)}</Text></View>
            <View style={styles.gridItem}><Text style={styles.label}>Reg. Date:</Text><Text style={styles.value}>{fd(v.dateOfRegistration)}</Text></View>
            <View style={styles.gridItem}><Text style={styles.label}>Accident Date:</Text><Text style={styles.value}>{fd(a.dateAndTime)}</Text></View>
            <View style={styles.gridItem}><Text style={styles.label}>Place:</Text><Text style={styles.value}>{g(a.placeOfAccident)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. DETAILED LOSS ASSESSMENT</Text>
          <View style={[styles.table, { border: '0.5pt solid #000' }]}>
            <View style={styles.tableHeader}>
              <Text style={styles.colSr}>Sr</Text>
              <Text style={styles.colPart}>Particulars</Text>
              <Text style={styles.colType}>Type</Text>
              <Text style={styles.colEst}>Est.</Text>
              <Text style={styles.colAss}>Assessed</Text>
              <Text style={styles.colDepP}>Dep%</Text>
              <Text style={styles.colMet}>Metal</Text>
              <Text style={styles.colPla}>Pla/Rub</Text>
              <Text style={styles.colFib}>FbrGls</Text>
              <Text style={styles.colGla}>Glass</Text>
              <Text style={styles.colGSTP}>GST%</Text>
              <Text style={styles.colNet}>Price+GST</Text>
            </View>

            {rows.filter(r => r.section === 'parts').map((r, i) => {
              const dr = getDepRate(r.partType, ageMonths, depType);
              const val = r.assessed * (1 - dr/100);
              const gst = val * ((r.gst || 18) / 100);
              return (
                <View key={r.id} style={styles.tableRow}>
                  <Text style={styles.colSr}>{i+1}</Text>
                  <Text style={styles.colPart}>{r.particulars}</Text>
                  <Text style={styles.colType}>{r.partType.substring(0,3)}</Text>
                  <Text style={styles.colEst}>{fa(r.estimated)}</Text>
                  <Text style={styles.colAss}>{fa(r.assessed)}</Text>
                  <Text style={styles.colDepP}>{dr}%</Text>
                  <Text style={styles.colMet}>{r.partType === 'metal' ? fa(val) : ''}</Text>
                  <Text style={styles.colPla}>{r.partType === 'plastic' ? fa(val) : ''}</Text>
                  <Text style={styles.colFib}>{r.partType === 'fiberglass' ? fa(val) : ''}</Text>
                  <Text style={styles.colGla}>{r.partType === 'glass' ? fa(val) : ''}</Text>
                  <Text style={styles.colGSTP}>{r.gst || 18}%</Text>
                  <Text style={styles.colNet}>{fa(val + gst)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.summaryBox}>
          <View style={[styles.summaryRow, styles.summaryTotal]}><Text>A. SPARE PARTS TOTAL (After Dep + GST)</Text><Text>{fa(totalNet - (labBase + paintBase)*1.18)}</Text></View>
          <View style={styles.summaryRow}><Text>B. LABOUR CHARGES (Assessed + 18% GST)</Text><Text>{fa(labBase * 1.18)}</Text></View>
          <View style={styles.summaryRow}><Text>C. PAINTING CHARGES (Assessed + 18% GST)</Text><Text>{fa(paintBase * 1.18)}</Text></View>
          <View style={styles.summaryRow}><Text>D. TOWING CHARGES</Text><Text>{fa(tow)}</Text></View>
          <View style={[styles.summaryRow, { color: 'red' }]}><Text>E. LESS: SALVAGE VALUE</Text><Text>- {fa(salvage)}</Text></View>
          <View style={[styles.summaryRow, { color: 'red' }]}><Text>F. LESS: COMPULSORY EXCESS</Text><Text>- {fa(comEx)}</Text></View>
          <View style={[styles.summaryRow, { color: 'red' }]}><Text>G. LESS: VOLUNTARY EXCESS</Text><Text>- {fa(volEx)}</Text></View>
          <View style={[styles.summaryRow, styles.summaryTotal]}><Text>NET PAYABLE LOSS (A+B+C+D - E-F-G)</Text><Text>{fa(finalNet)}</Text></View>
        </View>

        <View style={styles.signatureArea}>
          <View style={styles.sigBlock}><Text>Insured Signature</Text></View>
          <View style={styles.sigBlock}><Text>Surveyor Signature & Stamp</Text></View>
        </View>
      </Page>
    </Document>
  );
}
