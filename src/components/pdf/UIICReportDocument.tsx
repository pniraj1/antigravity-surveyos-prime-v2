import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ClaimData, AssessmentSummary, SurveyorProfile } from '@/types';

// ─── Helpers (Ported from uiic-final-builder.ts) ─────────────────────────────

function fd(v: string | null | undefined): string {
  if (!v) return '';
  const s = String(v).split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return v;
}

function fa(v: number | string | null | undefined): string {
  return parseFloat(String(v || 0)).toFixed(2);
}

function g(v: string | number | null | undefined): string {
  return v !== null && v !== undefined ? String(v) : '';
}

function numberToWords(num: number): string {
  if (!num || isNaN(num)) return 'ZERO';
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  function c(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + c(n % 100) : '');
    if (n < 100000) return c(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 ? ' ' + c(n % 1000) : '');
    if (n < 10000000) return c(Math.floor(n / 100000)) + ' LAKH' + (n % 100000 ? ' ' + c(n % 100000) : '');
    return c(Math.floor(num / 10000000)) + ' CRORE' + (num % 10000000 ? ' ' + c(num % 10000000) : '');
  }
  return c(Math.floor(num));
}

function getDepRate(partType: string, ageMonths: number, depType: string): number {
  const dt = (depType || 'standard').toLowerCase();
  if (dt === 'nil' || dt === 'nil depreciation') return 0;
  if (partType === 'glass') return 0;
  if (partType === 'plastic') return 50;
  if (partType === 'labour' || partType === 'paint') return 0;
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
    padding: '30 40',
    fontFamily: 'Helvetica',
    fontSize: 8,
    lineHeight: 1.2,
    color: '#000',
  },
  header: {
    borderBottom: '1.2pt solid #000',
    paddingBottom: 5,
    marginBottom: 6,
  },
  headerMain: {
    textAlign: 'center',
    marginBottom: 4,
  },
  surveyorName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  surveyorQual: {
    fontSize: 7,
  },
  surveyorTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
  headerMetaLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 6.8,
    marginTop: 4,
  },
  reportTitleBox: {
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    border: '1pt solid #000',
    padding: 4,
    marginBottom: 4,
    backgroundColor: '#f0f0f0',
  },
  sectionHeader: {
    backgroundColor: '#ddd',
    border: '0.5pt solid #000',
    padding: '3 5',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
  },
  table: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    border: '0.5pt solid #000',
    padding: '3 5',
  },
  cellLabel: {
    fontSize: 7,
    color: '#333',
  },
  cellValue: {
    fontFamily: 'Helvetica-Bold',
  },
  cellValuePlain: {},
  
  // Doc Verification Specific
  docHeader: {
    backgroundColor: '#e8e8e8',
    border: '0.5pt solid #000',
    padding: '3 5',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  docCell: {
    border: '0.5pt solid #000',
    padding: '3 5',
  },
  docRow: {
    flexDirection: 'row',
  },

  // Assessment Grid
  gridHeader: {
    backgroundColor: '#e8e8e8',
    border: '0.5pt solid #000',
    padding: '3 5',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  gridCell: {
    border: '0.5pt solid #000',
    padding: '3 5',
    fontSize: 7,
  },

  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  signatureBox: {
    textAlign: 'center',
    width: 150,
  },
  sigName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    marginTop: 2,
  },
  sigTitle: {
    fontSize: 6.5,
    color: '#555',
  },
  
  serviceHubHeader: {
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    borderTop: '1pt solid #000',
    paddingTop: 4,
    marginTop: 12,
  },
  footerWords: {
    fontSize: 6.5,
    color: '#666',
    marginTop: 4,
    borderTop: '0.4pt solid #ccc',
    paddingTop: 2,
  }
});

interface Props {
  claim: ClaimData;
  summary: AssessmentSummary;
  profile?: SurveyorProfile | null;
}

export function UIICReportDocument({ claim, profile }: Props) {
  const v = claim.vehicle;
  const d = claim.driver;
  const p = claim.policy;
  const a = claim.accident;
  const sd = claim.spotDetails;
  const ri = claim.reinspection;
  const rows = claim.assessmentRows || [];
  const depType = claim.depreciationType || 'standard';
  const nm = profile?.name || 'SURVEYOR NAME';

  const ageMonths = getVehicleAgeMonths(
    v.dateOfRegistration || null,
    v.yearOfManufacture ? Number(v.yearOfManufacture) : null,
    a.dateAndTime || null
  );

  // ── Calculations (Mapped exactly from uiic-final-builder.ts) ────────────────
  let partsDepreciated = 0, rawParts = 0, labOnly = 0, paintOnly = 0;
  const AP = rows.filter(r => r.section === 'parts');
  const AL = rows.filter(r => r.section === 'labour');
  const APT = rows.filter(r => r.section === 'paint');

  AP.forEach(r => {
    if (r.allowed !== false) {
      const dep = getDepRate(r.partType, ageMonths, depType);
      partsDepreciated += r.assessed * (1 - dep / 100);
      rawParts += r.assessed;
    }
  });
  AL.forEach(r => { if (r.allowed !== false) labOnly += r.assessed; });
  APT.forEach(r => { if (r.allowed !== false) paintOnly += r.assessed; });

  const labBase = labOnly + paintOnly;
  const pC = partsDepreciated * 0.09, pS = partsDepreciated * 0.09, pT = partsDepreciated + pC + pS;
  const lC = labBase * 0.09, lS = labBase * 0.09, lT = labBase + lC + lS;
  const tow = parseFloat(String(claim.feeBill?.travelExpenses || 0)) || 0;
  const gross = pT + lT + tow;
  const depAmt = rawParts - partsDepreciated;
  const salvage = claim.feeBill?.salvageValue || 0;
  const volExcess = claim.feeBill?.voluntaryExcess || 0;
  const compExcess = claim.feeBill?.compulsoryExcess || claim.feeBill?.lessExcess || 500;
  const net = Math.max(0, gross - salvage - volExcess - compExcess);
  const payableByInsured = depAmt + salvage + volExcess + compExcess;
  const payableByInsurer = net;

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerMain}>
        <Text style={styles.surveyorName}>{nm}</Text>
        <Text style={styles.surveyorQual}>{profile?.qualifications || 'B.Sc., Dip. in Auto Engg.'}</Text>
        <Text style={styles.surveyorTitle}>INSURANCE SURVEYOR, LOSS ASSESSOR & VALUER</Text>
      </View>
      <View style={styles.headerMetaLine}>
        <View style={{ flex: 1 }}>
          <Text>Lic. No.: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{profile?.licenceNumber || '—'}</Text> | Expiry: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{(profile as any)?.licenceExpiry || '—'}</Text> | IIISLA: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{profile?.iiislaNumber || '—'}</Text></Text>
          <Text>E-mail: {profile?.email || '—'} | Cell: {profile?.mobile || '—'}</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{profile?.categories || 'MOTOR'}</Text>
          <Text>{profile?.address || ''}</Text>
        </View>
      </View>
    </View>
  );

  const renderSigBlock = () => (
    <View style={styles.signatureSection}>
      <View style={styles.signatureBox}>
        <View style={{ minHeight: 40 }} />
        <Text style={styles.sigName}>{nm}</Text>
        <Text style={styles.sigTitle}>Licenced Surveyor & Loss Assessor</Text>
      </View>
    </View>
  );

  return (
    <Document>
      {/* ── PAGE 1: Policy / Claim / Vehicle ─────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        {renderHeader()}
        <View style={styles.reportTitleBox}>
          <Text>MOTOR SURVEY REPORT - ( FINAL/ RE INSPECTION)</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Report Number:</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValue}>{g(claim.reportNo)}</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Report Date :</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValue}>{fd(claim.reportDate)}</Text></View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>POLICY DETAILS</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Policy / Cover Note Number</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{g(p.policyNumber)}</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Claim no.</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{g(p.claimNumber)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Policy Start Date</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{fd(p.periodFrom)}</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Policy Expiry Date</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{fd(p.periodTo)}</Text></View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>CLAIM DETAILS</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Claimant Name</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValue}>{g(p.insuredName)}</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Place of Accident / Theft</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{g(a.placeOfAccident)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Loss Date</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{fd(a.dateAndTime)}</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Insured Declared Value</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValue}>{fa(p.idv)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Policy Issuing Office Code</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{g(p.policyIssuingOffice)}</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Pincode of place of accident</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{g(a.pincode)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Policy issuing office address</Text></View>
            <View style={[styles.tableCell, { width: '75%' }]}><Text style={styles.cellValuePlain}>{g(p.appointingOffice)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Police Station</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{g(a.policeStation)}</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>FIR / Diary No.</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{g(a.firNumber)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>FIR Date</Text></View>
            <View style={[styles.tableCell, { width: '75%' }]}><Text style={styles.cellValuePlain}>{fd(a.firDate)}</Text></View>
          </View>
        </View>

        <View style={styles.tableRow}>
          <View style={{ width: '50%' }}><Text style={styles.sectionHeader}>INSURED / CLAIMANT DETAILS</Text></View>
          <View style={{ width: '50%' }}><Text style={styles.sectionHeader}>SPOT SURVEY DETAILS</Text></View>
        </View>
        <View style={styles.tableRow}>
          <View style={[styles.tableCell, { width: '50%' }]}>
            <Text style={{ fontSize: 7, marginBottom: 2 }}>Insured / Claimant Name & Address: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{g(p.insuredName)}</Text></Text>
            <Text style={{ fontSize: 7, marginBottom: 2 }}>{g(p.insuredAddress)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 2 }}>FINANCIER INTEREST: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{g(p.hpaWith || v.hypothecation) || 'NIL'}</Text></Text>
            <Text style={{ fontSize: 7 }}>Contact: {g(p.insuredMobile)}</Text>
          </View>
          <View style={[styles.tableCell, { width: '50%' }]}>
            <Text style={{ fontSize: 7, marginBottom: 2 }}>Appt Date: {fd(sd.allotmentDate)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 2 }}>Survey Date: {fd(sd.surveyDatetime)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 2 }}>Report Date: {fd(sd.reportDate)}</Text>
            <Text style={{ fontSize: 7 }}>Third Party: {g(a.thirdPartyDetails) || 'NIL'}</Text>
          </View>
        </View>

        <Text style={[styles.tableCell, { width: '100%', fontFamily: 'Helvetica-Bold' }]}>CAUSE OF ACCIDENT / DETAILS OF DAMAGES</Text>
        <Text style={[styles.tableCell, { width: '100%', fontSize: 7, minHeight: 30 }]}>{g(a.causeOfAccident) || '—'}</Text>

        <View style={styles.tableRow}>
          <View style={{ width: '50%' }}><Text style={styles.sectionHeader}>VEHICLE DETAILS</Text></View>
          <View style={{ width: '50%' }}><Text style={styles.sectionHeader}>FINAL SURVEY DETAILS</Text></View>
        </View>
        <View style={styles.tableRow}>
          <View style={[styles.tableCell, { width: '50%' }]}>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Reg No: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{g(v.registrationNumber)}</Text></Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Reg Date: {fd(v.dateOfRegistration)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Engine No: {g(v.engineNumber)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Chassis No: {g(v.chassisNumber)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Make/Model: {g(v.make)} / {g(v.model)} / {g(v.yearOfManufacture)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Class: {g(v.classOfVehicle || v.bodyType)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Colour/Body: {g(v.colour)} / {g(v.bodyType)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>CC/Odo: {g(v.cubicCapacity)} CC / {g(v.odometer)} km</Text>
          </View>
          <View style={[styles.tableCell, { width: '50%' }]}>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Final Appt Date: {fd(a.appointmentDate)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Date of Visits: {fd(a.dateOfSurvey)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Workshop: {g(a.workshopName || sd.repairWorkshop)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Address: {g(a.workshopAddress)}</Text>
            <Text style={{ fontSize: 7, marginBottom: 1 }}>Phone/Email: {g(a.workshopPhone)} / {g(a.workshopEmail)}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>REINSPECTION SURVEY DETAILS</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>RI Appt Date</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{fd(ri.riAppointmentDate || ri.date)}</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Actual Completion</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValuePlain}>{fd(ri.actualCompletionDate)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Repairs as assessed</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellValue}>{g(ri.repairsAsAssessed) || 'YES'}</Text></View>
            <View style={[styles.tableCell, { width: '25%' }]}><Text style={styles.cellLabel}>Remarks</Text></View>
            <View style={[styles.tableCell, { width: '25%', fontSize: 7 }]}><Text>{g(ri.observations)}</Text></View>
          </View>
        </View>

        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 7.5 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>SURVEYOR REMARKS: </Text>
            {g(a.remarks) || 'The damages sustained by the vehicle were concurrent with the cause and nature of the accident.'}
          </Text>
        </View>
      </Page>

      {/* ── PAGE 2: Document Verification ────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={{ textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 9 }}>{nm}</Text>
        <Text style={{ fontSize: 7, fontStyle: 'italic' }}>"ISSUED WITHOUT PREJUDICE"</Text>
        <View style={{ textAlign: 'center', marginVertical: 4 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>MOTOR SURVEY REPORT - (SPOT / FINAL / REINSPECTION)</Text>
          <Text style={{ fontSize: 7, fontStyle: 'italic' }}>/ Report Issued Without Prejudice /</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.docHeader, { width: '25%', justifyContent: 'center', paddingVertical: 10 }]}>VEHICLE DOCUMENT NAME</Text>
            <Text style={[styles.docHeader, { width: '22%', justifyContent: 'center', paddingVertical: 10 }]}>DOCUMENT PHOTOCOPY OBTAINED VERIFIED WITH ORIGINAL & ATTESTED</Text>
            <Text style={[styles.docHeader, { flex: 1, justifyContent: 'center', paddingVertical: 10 }]}>DOCUMENT DETAILS</Text>
          </View>

          {/* RC Section */}
          <View style={styles.tableRow}>
            <View style={[styles.docCell, { width: '25%', justifyContent: 'center', borderTop: 0 }]}>
              <Text>Vehicle Registration</Text>
              <Text>Certificate (RC Book)</Text>
            </View>
            <View style={[styles.docCell, { width: '22%', justifyContent: 'center', borderTop: 0 }]}>
              <Text>{g(claim.documentVerification?.rc?.detail ? `${claim.documentVerification.rc.status} (${claim.documentVerification.rc.detail})` : claim.documentVerification?.rc?.status)}</Text>
            </View>
            <View style={[styles.docCell, { flex: 1, padding: 0, borderTop: 0 }]}>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Registration Type</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.registrationType || v.classOfVehicle)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Date of registration</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{fd(v.dateOfRegistration)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Registering Authority</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.registeringAuthority)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Registration valid up to</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{fd(v.registrationValidUpTo)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>RC endorsement on financier interest</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.rcEndorsement)}</Text></View>
               </View>
               
               <View style={{ backgroundColor: '#e8e8e8', borderBottom: '0.5pt solid #000', padding: '3 5' }}>
                 <Text style={{ fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>ADDITIONAL DETAILS - PASSENGER CARRYING VEHICLE</Text>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Registered Seating Capacity</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.seatingCapacity)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Number of Passengers carried at the time of accident</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.passengersAtAccident)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Type of passenger carried (Employee / Hire / Gratuitous)</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.passengerType)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Whether Passengers carried in contravention of rule?</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.passengersContravention)}</Text></View>
               </View>

               <View style={{ backgroundColor: '#e8e8e8', borderBottom: '0.5pt solid #000', padding: '3 5' }}>
                 <Text style={{ fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>ADDITIONAL DETAILS - GOODS CARRYING VEHICLE</Text>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Registered Laden Weight</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.registeredLoadWeight || v.grossWeight)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Registered Unladen Weight</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.unladenWeight)}</Text></View>
               </View>
            </View>
          </View>

          {/* DL Section */}
          <View style={styles.tableRow}>
            <View style={[styles.docCell, { width: '25%', justifyContent: 'center', borderTop: 0 }]}><Text>Driving Licence</Text></View>
            <View style={[styles.docCell, { width: '22%', justifyContent: 'center', borderTop: 0 }]}><Text>{g(claim.documentVerification?.dl?.detail ? `${claim.documentVerification.dl.status} (${claim.documentVerification.dl.detail})` : claim.documentVerification?.dl?.status)}</Text></View>
            <View style={[styles.docCell, { flex: 1, padding: 0, borderTop: 0 }]}>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Name of Driving Licence Holder</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(d.name)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Driving Licence Number</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(d.licenceNumber)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Licence Type</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(d.licenceType)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Class of vehicles licenced to drive</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(d.vehicleClasses)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Licence Issuing Authority</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(d.issuingAuthority)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Date of Issue of Licence</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{fd(d.dateOfIssue)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>License Valid upto</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{fd(d.validityNonTransport || d.validityTransport)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Badge number</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(d.badgeNumber)}</Text></View>
               </View>

               <View style={{ flexDirection: 'row' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Date of verification of licence</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{fd(d.verificationDate)}</Text></View>
               </View>
            </View>
          </View>

          {/* Note row */}
          <View style={styles.tableRow}>
             <View style={[styles.docCell, { flex: 1, borderTop: 0 }]}><Text>Complete additional information if applicable.</Text></View>
          </View>

          {/* Road Permit */}
          <View style={styles.tableRow}>
            <View style={[styles.docCell, { width: '25%', justifyContent: 'center', borderTop: 0 }]}><Text>Road Permit</Text></View>
            <View style={[styles.docCell, { width: '22%', justifyContent: 'center', borderTop: 0 }]}><Text>{g(claim.documentVerification?.permit?.detail ? `${claim.documentVerification.permit.status} (${claim.documentVerification.permit.detail})` : claim.documentVerification?.permit?.status)}</Text></View>
            <View style={[styles.docCell, { flex: 1, padding: 0, borderTop: 0 }]}>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Nature of permit</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(sd.natureOfPermit)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Type of permit</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(sd.permitType)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Permit No</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(sd.permitNo)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Permit Valid upto</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{fd(sd.permitTo)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Permitted area of operation</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(sd.areaOfOperation)}</Text></View>
               </View>
            </View>
          </View>

          {/* Load Challan */}
          <View style={styles.tableRow}>
            <View style={[styles.docCell, { width: '25%', justifyContent: 'center', borderTop: 0 }]}><Text>Load Challan and details of goods carried</Text></View>
            <View style={[styles.docCell, { width: '22%', justifyContent: 'center', borderTop: 0 }]}><Text>{g(claim.documentVerification?.loadChallan?.detail ? `${claim.documentVerification.loadChallan.status} (${claim.documentVerification.loadChallan.detail})` : claim.documentVerification?.loadChallan?.status)}</Text></View>
            <View style={[styles.docCell, { flex: 1, padding: 0, borderTop: 0 }]}>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Load Challan Number</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.loadChallanNumber || sd.challanNo)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Load Challan Date</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{fd(v.loadChallanDate || sd.challanDate)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Weight of goods carried at the time of accident</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.goodsWeightAtAccident || sd.actualLoad)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Details of goods carried at the time of accident</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.detailsOfGoodsCarried || sd.loadDesc)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Nature of goods carried</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.natureOfGoods)}</Text></View>
               </View>
            </View>
          </View>

          {/* Fitness Certificate */}
          <View style={styles.tableRow}>
            <View style={[styles.docCell, { width: '25%', justifyContent: 'center', borderTop: 0 }]}><Text>Fitness certificate</Text></View>
            <View style={[styles.docCell, { width: '22%', justifyContent: 'center', borderTop: 0 }]}><Text>{g(claim.documentVerification?.fitness?.detail ? `${claim.documentVerification.fitness.status} (${claim.documentVerification.fitness.detail})` : claim.documentVerification?.fitness?.status)}</Text></View>
            <View style={[styles.docCell, { flex: 1, padding: 0, borderTop: 0 }]}>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Fitness certificate number</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.fitnessNo)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Valid upto date</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{fd(v.fitnessValidUpto)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Type of fitness certificate</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(v.fitnessType || sd.fitnessType)}</Text></View>
               </View>
            </View>
          </View>

          {/* Fire Brigade */}
          <View style={styles.tableRow}>
            <View style={[styles.docCell, { width: '25%', justifyContent: 'center', borderTop: 0 }]}><Text>Fire Brigade Report (Fire Loss)</Text></View>
            <View style={[styles.docCell, { width: '22%', justifyContent: 'center', borderTop: 0 }]}><Text>{g(claim.documentVerification?.fireReport?.detail ? `${claim.documentVerification.fireReport.status} (${claim.documentVerification.fireReport.detail})` : claim.documentVerification?.fireReport?.status)}</Text></View>
            <View style={[styles.docCell, { flex: 1, padding: 0, borderTop: 0 }]}>
               <View style={{ flexDirection: 'row' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>FIR / Case Diary Numbe</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(a.fireBrigadeReportNo)}</Text></View>
               </View>
            </View>
          </View>

          {/* FIR */}
          <View style={styles.tableRow}>
            <View style={[styles.docCell, { width: '25%', justifyContent: 'center', borderTop: 0 }]}><Text>First Information Report (Third Party, Theft Loss & Fire Loss only)</Text></View>
            <View style={[styles.docCell, { width: '22%', justifyContent: 'center', borderTop: 0 }]}><Text>{g(claim.documentVerification?.fir?.detail ? `${claim.documentVerification.fir.status} (${claim.documentVerification.fir.detail})` : claim.documentVerification?.fir?.status)}</Text></View>
            <View style={[styles.docCell, { flex: 1, padding: 0, borderTop: 0 }]}>
               <View style={{ flexDirection: 'row', borderBottom: '0.5pt solid #000' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Name of police station</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{g(a.policeStation)}</Text></View>
               </View>
               <View style={{ flexDirection: 'row' }}>
                 <View style={{ width: '60%', borderRight: '0.5pt solid #000', padding: '3 5' }}><Text>Date of FIR</Text></View>
                 <View style={{ flex: 1, padding: '3 5' }}><Text>{fd(a.firDate)}</Text></View>
               </View>
            </View>
          </View>
        </View>
      </Page>

      {/* ── PAGE 3: Assessment ──────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={{ textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 9 }}>{nm}</Text>
        <View style={{ textAlign: 'center', marginBottom: 4 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>FINAL SURVEY REPORT</Text>
          <Text style={{ fontSize: 7, fontStyle: 'italic' }}>/ Report Issued Without Prejudice /</Text>
        </View>
        <Text style={styles.sectionHeader}>LOSS ASSESSMENT SHEET / WORK ORDER / CLAIM NOTE</Text>
        
        <View style={[styles.table, { marginBottom: 3 }]}>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '16%' }]}><Text style={styles.cellLabel}>Cost of Parts</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right' }]}><Text>{fa(pT)}</Text></View>
            <View style={[styles.tableCell, { width: '17%' }]}><Text style={styles.cellLabel}>Vehicle Type</Text></View>
            <View style={[styles.tableCell, { width: '16%' }]}><Text>{g(v.classOfVehicle || v.bodyType)}</Text></View>
            <View style={[styles.tableCell, { width: '17%' }]}><Text style={styles.cellLabel}>Assessed Loss</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right' }]}><Text>{fa(gross)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0 }]}><Text style={styles.cellLabel}>Labour Charges</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(labOnly * 1.18)}</Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0, borderBottom: 0 }]}><Text style={styles.cellLabel}>Information to Insured regarding Assessment Present/SMS/Telephonic</Text></View>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0, borderBottom: 0 }]}><Text></Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text style={styles.cellLabel}>Depreciation</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(depAmt)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0 }]}><Text style={styles.cellLabel}>Painting Charges</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(paintOnly * 1.18)}</Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0, borderBottom: 0 }]}><Text></Text></View>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0, borderBottom: 0 }]}><Text></Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text style={styles.cellLabel}>Salvage</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(salvage)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0 }]}><Text style={styles.cellLabel}>Towing Charges</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(tow)}</Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text></Text></View>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0 }]}><Text></Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text style={styles.cellLabel}>Voluntary / Imposed</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(volExcess)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0 }]}><Text style={styles.cellLabel}>Gross Assessment</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(gross)}</Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text style={styles.cellLabel}>Bill Check Done</Text></View>
            <View style={[styles.tableCell, { width: '16%', textAlign: 'center', borderTop: 0 }]}><Text>YES</Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text style={styles.cellLabel}>Compulsory Excess</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(compExcess)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0 }]}><Text style={styles.cellLabel}>IDV</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(p.idv)}</Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text></Text></View>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0 }]}><Text></Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text style={[styles.cellValue, { color: '#006838' }]}>Net Assessment</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text style={[styles.cellValue, { color: '#006838' }]}>{fa(net)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '16%', borderTop: 0 }]}><Text style={styles.cellLabel}>Odometer Reading</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{g(v.odometer)} km</Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text style={styles.cellLabel}>Reinspection Done</Text></View>
            <View style={[styles.tableCell, { width: '16%', textAlign: 'center', borderTop: 0 }]}><Text>YES</Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text style={styles.cellLabel}>Payable by Insured</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(payableByInsured)}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.tableCell, { width: '66%', borderTop: 0 }]}><Text></Text></View>
            <View style={[styles.tableCell, { width: '17%', borderTop: 0 }]}><Text style={styles.cellLabel}>Payable by Insurer</Text></View>
            <View style={[styles.tableCell, { width: '17%', textAlign: 'right', borderTop: 0 }]}><Text>{fa(payableByInsurer)}</Text></View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>DETAILS OF ASSESSMENT</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.gridHeader, { width: '4%' }]}>№</Text>
            <Text style={[styles.gridHeader, { width: '30%' }]}>Part Name</Text>
            <Text style={[styles.gridHeader, { width: '10%' }]}>Type</Text>
            <Text style={[styles.gridHeader, { width: '10%' }]}>Job</Text>
            <Text style={[styles.gridHeader, { width: '10%' }]}>Part List</Text>
            <Text style={[styles.gridHeader, { width: '8%' }]}>Dep%</Text>
            <Text style={[styles.gridHeader, { width: '10%' }]}>Assess</Text>
            <Text style={[styles.gridHeader, { width: '8%' }]}>GST%</Text>
            <Text style={[styles.gridHeader, { width: '10%' }]}>Total</Text>
          </View>

          <Text style={[styles.sectionHeader, { fontSize: 7, padding: '2 5' }]}>SPARE PARTS</Text>
          {AP.map((r, i) => {
            const dep = getDepRate(r.partType, ageMonths, depType);
            const isNA = r.allowed === false;
            const ass = isNA ? 0 : r.assessed * (1 - dep / 100);
            const wg = isNA ? 0 : ass * 1.18;
            const formattedPartType = r.partType === 'metal' ? 'Metal' : r.partType === 'glass' ? 'Glass' : r.partType === 'fiberglass' ? 'Fibre Glass' : 'Plastic/Rubber';
            return (
              <View key={r.id} style={styles.tableRow}>
                <Text style={[styles.gridCell, { width: '4%', textAlign: 'center' }]}>{i+1}</Text>
                <Text style={[styles.gridCell, { width: '30%' }]}>{r.particulars}</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'center' }]}>{isNA ? '' : formattedPartType}</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'center' }]}>{isNA ? '' : 'Replace'}</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'right' }]}>{isNA ? '' : fa(r.assessed)}</Text>
                <Text style={[styles.gridCell, { width: '8%', textAlign: 'center' }]}>{isNA ? '' : dep + '%'}</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'right' }]}>{isNA ? '' : fa(ass)}</Text>
                <Text style={[styles.gridCell, { width: '8%', textAlign: 'center' }]}>{isNA ? '' : '18'}</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'right' }]}>{isNA ? '' : fa(wg)}</Text>
              </View>
            );
          })}
          
          <Text style={[styles.sectionHeader, { fontSize: 7, padding: '2 5' }]}>LABOUR & PAINTING</Text>
          {[...AL, ...APT].map((r, i) => {
            const isNA = r.allowed === false;
            return (
              <View key={r.id} style={styles.tableRow}>
                <Text style={[styles.gridCell, { width: '4%', textAlign: 'center' }]}>{i+1}</Text>
                <Text style={[styles.gridCell, { width: '30%' }]}>{r.particulars}</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'center' }]}>Labour</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'center' }]}>{r.section === 'paint' ? 'Paint' : 'Repair'}</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'right' }]}><Text/></Text>
                <Text style={[styles.gridCell, { width: '8%', textAlign: 'center' }]}>N.D.</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'right' }]}><Text/></Text>
                <Text style={[styles.gridCell, { width: '8%', textAlign: 'center' }]}>118</Text>
                <Text style={[styles.gridCell, { width: '10%', textAlign: 'right' }]}>{isNA ? '' : fa(r.assessed * 1.18)}</Text>
              </View>
            );
          })}
        </View>
      </Page>

      {/* ── PAGE 5: Summary & Final ─────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={{ textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 9 }}>{nm}</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginVertical: 4 }}>GST SUMMARY</Text>
        
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.gridHeader, { width: '10%' }]}>S.N.</Text>
            <Text style={[styles.gridHeader, { width: '30%' }]}>HSN / ACCOUNT CODE</Text>
            <Text style={[styles.gridHeader, { width: '20%' }]}>BASE AMOUNT</Text>
            <Text style={[styles.gridHeader, { width: '15%' }]}>CGST (9%)</Text>
            <Text style={[styles.gridHeader, { width: '15%' }]}>SGST (9%)</Text>
            <Text style={[styles.gridHeader, { width: '10%' }]}>TOTAL</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.gridCell, { width: '10%' }]}>1</Text>
            <Text style={[styles.gridCell, { width: '30%' }]}>Spare Parts (18%)</Text>
            <Text style={[styles.gridCell, { width: '20%', textAlign: 'right' }]}>{fa(partsDepreciated)}</Text>
            <Text style={[styles.gridCell, { width: '15%', textAlign: 'right' }]}>{fa(pC)}</Text>
            <Text style={[styles.gridCell, { width: '15%', textAlign: 'right' }]}>{fa(pS)}</Text>
            <Text style={[styles.gridCell, { width: '10%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fa(pT)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.gridCell, { width: '10%' }]}>2</Text>
            <Text style={[styles.gridCell, { width: '30%' }]}>Labour & Paint (18%)</Text>
            <Text style={[styles.gridCell, { width: '20%', textAlign: 'right' }]}>{fa(labBase)}</Text>
            <Text style={[styles.gridCell, { width: '15%', textAlign: 'right' }]}>{fa(lC)}</Text>
            <Text style={[styles.gridCell, { width: '15%', textAlign: 'right' }]}>{fa(lS)}</Text>
            <Text style={[styles.gridCell, { width: '10%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fa(lT)}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, fontSize: 7.5 }}>
          <View style={{ width: '45%' }}>
            <Text>I / We hereby authorize repairs for Rs. <Text style={{ fontFamily: 'Helvetica-Bold' }}>{Math.round(net)}</Text></Text>
            <Text style={{ marginTop: 20 }}>Date:</Text>
            <View style={{ marginTop: 30, borderTop: '0.5pt solid #000', paddingTop: 3 }}>
              <Text>Signature (...Surveyor & Loss Assessor)</Text>
            </View>
          </View>
          <View style={{ width: '45%', textAlign: 'right' }}>
            <Text>I agree with the assessment of the surveyor. Repair will be complete by _______ (date).</Text>
            <Text style={{ marginTop: 20 }}>Date:</Text>
            <View style={{ marginTop: 30, borderTop: '0.5pt solid #000', paddingTop: 3 }}>
              <Text>Signature of workshop official</Text>
            </View>
          </View>
        </View>

        {renderSigBlock()}

        <Text style={styles.serviceHubHeader}>FOR SERVICE HUB USE</Text>
        <Text style={{ fontSize: 7, lineHeight: 1.6, marginTop: 3 }}>
          Claim documents are in order. Liability under the policy is confirmed. Bill check and reinspection is carried out. The loss assessment is in order and claim is recommended for Rs. <Text style={{ fontFamily: 'Helvetica-Bold' }}>{fa(net)}</Text>
        </Text>
        <Text style={{ fontSize: 7 }}>NOTE:- BILL CHECK REPORT AS PER ASSESSMENT SHEET.</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, fontSize: 7 }}>
          <Text>Signature of Claims Personnel{"\n"}Date</Text>
          <Text>Signature of Claims Officer{"\n"}Date:</Text>
          <Text>Approving Officer Signature{"\n"}Date:</Text>
        </View>

        <Text style={{ textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 14 }}>{nm}</Text>
        <Text style={styles.footerWords}>In words: RUPEES {numberToWords(net)} ONLY</Text>
      </Page>
    </Document>
  );
}
