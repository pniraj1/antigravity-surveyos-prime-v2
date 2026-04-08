'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { ClaimData, AssessmentSummary, SurveyorProfile, AssessmentRow } from '@/types';
import { formatCurrency, getVehicleAgeMonths, getDepreciationRate, numberToWords } from '@/lib/calculations';

// ─── UIIC RIGID GRID STYLES ──────────────────────────────────────────────────
const S = StyleSheet.create({
  page: { 
    padding: 25, 
    fontFamily: 'Helvetica', 
    fontSize: 8.5, 
    color: '#000', 
    lineHeight: 1.2 
  },
  
  // ── Header Components ───────────────────────────────────
  headerBox: {
    border: '1px solid #000',
    padding: 3,
    marginBottom: 4,
    width: 140,
  },
  headerName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  prejudiceBox: {
    border: '1px solid #000',
    padding: 2,
    marginBottom: 6,
  },
  prejudiceText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  mainTitleBox: {
    border: '1px solid #000',
    padding: 4,
    backgroundColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'relative',
  },
  mainTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  reportSubTitle: {
    position: 'absolute',
    right: 5,
    bottom: 2,
    fontSize: 7,
    fontFamily: 'Helvetica-BoldOblique',
  },

  // ── Table/Grid Utilities ───────────────────────────────
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    border: '0.5px solid #000',
  },
  row: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #000',
  },
  cell: {
    padding: '3 5',
    borderRight: '0.5px solid #000',
    justifyContent: 'center',
  },
  cellNoBorder: {
    padding: '3 5',
    justifyContent: 'center',
  },
  labelCell: {
    backgroundColor: '#fff',
    fontSize: 7.5,
    fontFamily: 'Helvetica',
  },
  valueCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  headerCell: {
    backgroundColor: '#e5e7eb',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    padding: 4,
  },

  // ── Section Headers ────────────────────────────────────
  sectionHeader: {
    backgroundColor: '#d1d5db',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    padding: 2,
    borderBottom: '0.5px solid #000',
    textTransform: 'uppercase',
  },

  // ── Assessment Table specific ──────────────────────────
  tNo: { width: '4%', textAlign: 'center' },
  tPart: { width: '22%' },
  tType: { width: '7%', textAlign: 'center' },
  tJob: { width: '8%', textAlign: 'center' },
  tAmt: { width: '9%', textAlign: 'right' },
  tDepP: { width: '5%', textAlign: 'center' },
  tAss: { width: '9%', textAlign: 'right' },
  tGstP: { width: '5%', textAlign: 'center' },
  tFinal: { width: '10%', textAlign: 'right' },
  tLab: { width: '10%', textAlign: 'right' },
  tPaint: { width: '10%', textAlign: 'right' },

  // ── Bottom Boxes ───────────────────────────────────────
  flexRow: { flexDirection: 'row' },
  signatureBox: {
    flex: 1,
    border: '0.5px solid #000',
    height: 100,
    padding: 5,
    marginTop: 10,
  },
  sigLabel: { fontSize: 7, marginTop: 70, textAlign: 'center' },
  stampImage: { width: 60, height: 40, alignSelf: 'center' },
});

// ─── HELPER COMPONENTS ───────────────────────────────────────────────────────

const Cell = ({ children, style = {}, noBorder = false }: any) => (
  <View style={[noBorder ? S.cellNoBorder : S.cell, style]}>
    {typeof children === 'string' ? <Text>{children}</Text> : children}
  </View>
);

const LabelValue = ({ label, value, labelStyle = {}, valueStyle = {} }: any) => (
  <>
    <Cell style={[{ width: '30%', backgroundColor: '#fff' }, S.labelCell, labelStyle]}>
      {label}
    </Cell>
    <Cell style={[{ flex: 1 }, S.valueCell, valueStyle]}>
      {value || 'N.A.'}
    </Cell>
  </>
);

// ─── PAGE 1: DOCUMENT VERIFICATION ──────────────────────────────────────────
const PageVerification = ({ claim }: { claim: ClaimData }) => (
  <Page size="A4" style={S.page}>
    <View style={S.headerBox}><Text style={S.headerName}>VIKRAM PATIL</Text></View>
    <View style={S.prejudiceBox}><Text style={S.prejudiceText}>"ISSUED WITHOUT PREJUDICE"</Text></View>
    
    <View style={S.mainTitleBox}>
      <Text style={S.mainTitle}>MOTOR SURVEY REPORT - (SPOT / FINAL / REINSPECTION)</Text>
      <Text style={S.reportSubTitle}>/ Report Issued Without Prejudice /</Text>
    </View>

    <View style={S.table}>
      <View style={S.row}>
        <Cell style={{ width: '25%', ...S.headerCell }}>VEHICLE DOCUMENT NAME</Cell>
        <Cell style={{ width: '15%', ...S.headerCell }}>DOCUMENT PHOTOCOPY OBTAINED...</Cell>
        <Cell style={{ flex: 1, ...S.headerCell }}>DOCUMENT DETAILS</Cell>
      </View>
      
      {/* RC Details */}
      <View style={S.row}>
        <Cell style={{ width: '25%', ...S.labelCell }}>Vehicle Registration Certificate (RC Book)</Cell>
        <Cell style={{ width: '15%', textAlign: 'center' }}>{claim?.spotDetails?.verificationFlags?.rc || 'YES'}</Cell>
        <View style={{ flex: 1 }}>
          <View style={S.row}>
            <LabelValue label="Registration Type" value={claim?.vehicle?.registrationType} />
          </View>
          <View style={S.row}>
            <LabelValue label="Date of registration" value={claim?.vehicle?.dateOfRegistration} />
          </View>
          <View style={S.row}>
            <LabelValue label="Registering Authority" value={claim?.vehicle?.registeringAuthority} />
          </View>
          <View style={S.row}>
            <LabelValue label="Registration valid up to" value={claim?.vehicle?.registrationValidUpTo} />
          </View>
          <View style={[S.row, { borderBottom: 0 }]}><LabelValue label="RC endorsement on financier" value={claim?.vehicle?.rcEndorsement} /></View>
        </View>
      </View>

      {/* Seating/Weight */}
      <View style={S.row}>
        <Cell style={{ width: '40%', ...S.sectionHeader }}>ADDITIONAL DETAILS - PASSENGER / GOODS VEHICLE</Cell>
        <View style={{ flex: 1 }}>
          <View style={S.row}><LabelValue label="Registered Seating Capacity" value={claim?.vehicle?.seatingCapacity} /></View>
          <View style={S.row}><LabelValue label="Registered Laden Weight" value={claim?.vehicle?.grossWeight ? `${claim.vehicle.grossWeight} KG` : ''} /></View>
          <View style={[S.row, { borderBottom: 0 }]}><LabelValue label="Registered Unladen Weight" value={claim?.vehicle?.unladenWeight ? `${claim.vehicle.unladenWeight} KG` : ''} /></View>
        </View>
      </View>

      {/* DL Details */}
      <View style={S.row}>
        <Cell style={{ width: '25%', ...S.labelCell }}>Driving Licence</Cell>
        <Cell style={{ width: '15%', textAlign: 'center' }}>{claim?.spotDetails?.verificationFlags?.dl || 'YES'}</Cell>
        <View style={{ flex: 1 }}>
          <View style={S.row}><LabelValue label="Name of DL Holder" value={claim?.driver?.name} /></View>
          <View style={S.row}><LabelValue label="Driving Licence Number" value={claim?.driver?.licenceNumber} /></View>
          <View style={S.row}><LabelValue label="Licence Type" value={claim?.driver?.vehicleClasses} /></View>
          <View style={S.row}><LabelValue label="Licence Valid upto" value={claim?.driver?.validityTransport || claim?.driver?.validityNonTransport} /></View>
          <View style={S.row}><LabelValue label="Badge number" value={claim?.driver?.badgeNumber} /></View>
          <View style={S.row}><LabelValue label="Authorised To Drive" value={claim?.driver?.authorisedToDrive} /></View>
          <View style={[S.row, { borderBottom: 0 }]}><LabelValue label="Date of verification" value={claim?.driver?.verificationDate} /></View>
        </View>
      </View>

      {/* Road Permit */}
      <View style={S.row}>
        <Cell style={{ width: '25%', ...S.labelCell }}>Road Permit</Cell>
        <Cell style={{ width: '15%', textAlign: 'center' }}>{claim?.spotDetails?.verificationFlags?.permit || 'YES'}</Cell>
        <View style={{ flex: 1 }}>
          <View style={S.row}><LabelValue label="Nature of permit" value={claim?.spotDetails?.natureOfPermit} /></View>
          <View style={S.row}><LabelValue label="Permit No" value={claim?.spotDetails?.permitNo} /></View>
          <View style={S.row}><LabelValue label="Permit Valid upto" value={claim?.spotDetails?.permitTo} /></View>
          <View style={[S.row, { borderBottom: 0 }]}><LabelValue label="Permitted area of operation" value={claim?.spotDetails?.areaOfOperation} /></View>
        </View>
      </View>
    </View>
  </Page>
);

// ─── PAGE 2: CLAIM & VEHICLE GRID ──────────────────────────────────────────
const PageDetails = ({ claim }: { claim: ClaimData }) => (
  <Page size="A4" style={S.page}>
    <View style={S.headerBox}><Text style={S.headerName}>VIKRAM PATIL</Text></View>
    <View style={[S.row, { border: '0.5px solid #000', marginBottom: 2 }]}>
      <Cell style={{ flex: 1 }}><Text>Report Number: {claim?.reportNo || ''}</Text></Cell>
      <Cell style={{ flex: 1 }}><Text>Report Date: {claim?.reportDate || ''}</Text></Cell>
    </View>

    <View style={S.table}>
      {/* Policy & Claim Details Side by Side */}
      <View style={S.row}>
        <View style={{ flex: 1, borderRight: '0.5px solid #000' }}>
          <View style={S.sectionHeader}><Text>POLICY DETAILS</Text></View>
          <View style={S.row}><LabelValue label="Policy No" value={claim?.policy?.policyNumber} /></View>
          <View style={S.row}><LabelValue label="Insured Name" value={claim?.policy?.insuredName} /></View>
          <View style={S.row}><LabelValue label="IDV (₹)" value={claim?.policy?.idv} /></View>
          <View style={[S.row, { borderBottom: 0 }]}><LabelValue label="Insured Mobile" value={claim?.policy?.insuredMobile} /></View>
        </View>
        <View style={{ flex: 1 }}>
          <View style={S.sectionHeader}><Text>CLAIM DETAILS</Text></View>
          <View style={S.row}><LabelValue label="Claim Number" value={claim?.policy?.claimNumber} /></View>
          <View style={S.row}><LabelValue label="Date of Loss" value={claim?.accident?.dateAndTime} /></View>
          <View style={[S.row, { borderBottom: 0 }]}><LabelValue label="Place of Accident" value={claim?.accident?.placeOfAccident} /></View>
        </View>
      </View>

      {/* Vehicle Details */}
      <View style={S.sectionHeader}><Text>VEHICLE DETAILS & SURVEY INFO</Text></View>
      <View style={S.row}>
        <View style={{ flex: 1, borderRight: '0.5px solid #000' }}>
          <View style={S.row}><LabelValue label="Reg No" value={claim?.vehicle?.registrationNumber} /></View>
          <View style={S.row}><LabelValue label="Chassis No" value={claim?.vehicle?.chassisNumber} /></View>
          <View style={S.row}><LabelValue label="Engine No" value={claim?.vehicle?.engineNumber} /></View>
          <View style={[S.row, { borderBottom: 0 }]}><LabelValue label="Make / Model" value={`${claim?.vehicle?.make || ''} / ${claim?.vehicle?.model || ''}`} /></View>
        </View>
        <View style={{ flex: 1 }}>
          <View style={S.row}><LabelValue label="Date of Survey" value={claim?.accident?.dateOfSurvey} /></View>
          <View style={S.row}><LabelValue label="Survey Place" value={claim?.accident?.placeOfSurvey} /></View>
          <View style={[S.row, { borderBottom: 0 }]}><LabelValue label="Workshop" value={claim?.spotDetails?.surveyPlace} /></View>
        </View>
      </View>

      {/* Remarks */}
      <View style={S.sectionHeader}><Text>SURVEYOR REMARKS / CAUSE OF ACCIDENT</Text></View>
      <View style={{ padding: 8, minHeight: 60 }}>
        <Text style={{ fontSize: 8 }}>{claim?.accident?.causeOfAccident || 'As per the claim form, the vehicle met with an accident...'}</Text>
      </View>
    </View>
  </Page>
);

// ─── PAGE 3: ASSESSMENT TABLE ───────────────────────────────────────────────
const PageAssessment = ({ claim, summary, profile }: { claim: ClaimData; summary: AssessmentSummary; profile: SurveyorProfile }) => {
  const ageMonths = getVehicleAgeMonths(
    claim?.vehicle?.dateOfRegistration || null,
    claim?.vehicle?.yearOfManufacture ? Number(claim.vehicle.yearOfManufacture) : null,
    claim?.accident?.dateOfSurvey || null
  );
  
  return (
    <Page size="A4" style={S.page}>
       <View style={S.headerBox}><Text style={S.headerName}>VIKRAM PATIL</Text></View>
    <View style={[S.mainTitleBox, { backgroundColor: '#fff', borderBottom: 'none' }]}>
        <Text style={S.mainTitle}>FINAL SURVEY REPORT</Text>
      </View>
      <View style={{ textAlign: 'center', fontSize: 7, marginBottom: 5 }}>
        <Text>/ Report Issued Without Prejudice /</Text>
        <Text>LOSS ASSESSMENT SHEET / WORK ORDER / BILL CHECK / CLAIM NOTE</Text>
      </View>

      {/* Top summary grid */}
      <View style={S.table}>
        <View style={S.row}>
           <LabelValue label="Cost of Parts" value={formatCurrency(summary?.partsTotal || 0)} />
           <LabelValue label="Assessed Loss" value={formatCurrency(summary?.netAssessedLoss || 0)} />
        </View>
        <View style={S.row}>
           <LabelValue label="Labour Charges" value={formatCurrency(summary?.labourBase || 0)} />
           <LabelValue label="Depreciation" value={formatCurrency((summary?.partsBase || 0) + (summary?.labourBase || 0) - (summary?.grandTotal || 0))} />
        </View>
        <View style={[S.row, { borderBottom: 0 }]}>
           <LabelValue label="Net Assessment" value={formatCurrency(summary?.netAssessedLoss || 0)} />
           <LabelValue label="Amount Payable by Insurer" value={formatCurrency(summary?.netAssessedLoss || 0)} />
        </View>
      </View>

      <Text style={{ ...S.sectionHeader, marginTop: 10 }}>DETAILS OF ASSESSMENT</Text>
      <View style={S.table}>
        <View style={S.row}>
          <Cell style={S.tNo}>SR. NO.</Cell>
          <Cell style={S.tPart}>Part Name</Cell>
          <Cell style={S.tType}>Part Type</Cell>
          <Cell style={S.tJob}>Job Type</Cell>
          <Cell style={S.tAmt}>Part List (W/O Tax)</Cell>
          <Cell style={S.tDepP}>Dep%</Cell>
          <Cell style={S.tAss}>Parts Assmnt</Cell>
          <Cell style={S.tGstP}>GST%</Cell>
          <Cell style={S.tFinal}>Final Amt</Cell>
          <Cell style={S.tLab}>Labour</Cell>
          <Cell style={S.tPaint}>Paint</Cell>
        </View>
        
        {/* Spare Parts Rows */}
        <View style={S.row}><Cell style={{ flex: 1, backgroundColor: '#f0f0f0', borderRight: 'none' }}><Text style={{ fontFamily: 'Helvetica-Bold' }}>SPARE PARTS</Text></Cell></View>
        {(claim?.assessmentRows || []).filter(r => r.section === 'parts').map((row, idx) => {
          const depRate = getDepreciationRate(row.partType, ageMonths, claim?.depreciationType || 'Conventional');
          const valueAfterDep = (row.assessed || 0) * (1 - depRate / 100);
          const finalAmt = valueAfterDep * (1 + (row.gst || 0) / 100);
          
          return (
            <View key={row.id} style={S.row}>
              <Cell style={S.tNo}>{idx + 1}</Cell>
              <Cell style={S.tPart}>{row.particulars}</Cell>
              <Cell style={S.tType}>{row.partType}</Cell>
              <Cell style={S.tJob}>{row.allowed ? 'Replace' : 'Not Allowed'}</Cell>
              <Cell style={S.tAmt}>{(row.assessed || 0).toFixed(2)}</Cell>
              <Cell style={S.tDepP}>{depRate}%</Cell>
              <Cell style={S.tAss}>{valueAfterDep.toFixed(2)}</Cell>
              <Cell style={S.tGstP}>{(row.gst || 0)}%</Cell>
              <Cell style={S.tFinal}>{finalAmt.toFixed(2)}</Cell>
              <Cell style={S.tLab}>-</Cell>
              <Cell style={S.tPaint}>-</Cell>
            </View>
          );
        })}

        {/* Labour Rows */}
        <View style={S.row}><Cell style={{ flex: 1, backgroundColor: '#f0f0f0', borderRight: 'none' }}><Text style={{ fontFamily: 'Helvetica-Bold' }}>LABOUR</Text></Cell></View>
        {(claim?.assessmentRows || []).filter(r => r.section === 'labour').map((row, idx) => (
            <View key={row.id} style={S.row}>
              <Cell style={S.tNo}>{idx + 1}</Cell>
              <Cell style={S.tPart}>{row.particulars}</Cell>
              <Cell style={S.tType}>Labour</Cell>
              <Cell style={S.tJob}>Labour.</Cell>
              <Cell style={S.tAmt}>-</Cell>
              <Cell style={S.tDepP}>-</Cell>
              <Cell style={S.tAss}>-</Cell>
              <Cell style={S.tGstP}>{(row.gst || 0)}%</Cell>
              <Cell style={S.tFinal}>{((row.assessed || 0) * (1 + (row.gst || 0) / 100)).toFixed(2)}</Cell>
              <Cell style={S.tLab}>{(row.assessed || 0).toFixed(2)}</Cell>
              <Cell style={S.tPaint}>-</Cell>
            </View>
        ))}
      </View>
    </Page>
  );
};

// ─── PAGE 4: GST SUMMARY & SIGNATURES ──────────────────────────────────────
const PageFinal = ({ claim, summary, profile }: { claim: ClaimData; summary: AssessmentSummary; profile: SurveyorProfile }) => (
  <Page size="A4" style={S.page}>
    <View style={S.headerBox}><Text style={S.headerName}>VIKRAM PATIL</Text></View>
    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 5 }}>GST SUMMARY</Text>
    
    <View style={S.table}>
      <View style={S.row}>
        <Cell style={{ width: '10%', ...S.headerCell }}>S.N.</Cell>
        <Cell style={{ flex: 1, ...S.headerCell }}>HSN CODE</Cell>
        <Cell style={{ width: '20%', ...S.headerCell }}>DEPRECIATED AMOUNT</Cell>
        <Cell style={{ width: '15%', ...S.headerCell }}>CGST</Cell>
        <Cell style={{ width: '15%', ...S.headerCell }}>SGST</Cell>
        <Cell style={{ width: '15%', ...S.headerCell }}>AMOUNT</Cell>
      </View>
      <View style={S.row}>
        <Cell style={{ width: '10%' }}>1</Cell>
        <Cell style={{ flex: 1 }}>(Part) 18.00</Cell>
        <Cell style={{ width: '20%', textAlign: 'right' }}>{(summary?.partsBase || 0).toFixed(2)}</Cell>
        <Cell style={{ width: '15%', textAlign: 'right' }}>{(summary?.partsCGST || 0).toFixed(2)}</Cell>
        <Cell style={{ width: '15%', textAlign: 'right' }}>{(summary?.partsSGST || 0).toFixed(2)}</Cell>
        <Cell style={{ width: '15%', textAlign: 'right' }}>{(summary?.partsTotal || 0).toFixed(2)}</Cell>
      </View>
    </View>

    <View style={{ marginTop: 20 }}>
      {/* Signatures */}
      <View style={S.flexRow}>
        <View style={S.signatureBox}>
          {profile?.signatureDataUrl && <Image src={profile.signatureDataUrl} style={S.stampImage} />}
          <Text style={S.sigLabel}>Signature of Surveyor</Text>
        </View>
        <View style={S.signatureBox}>
          <Text style={S.sigLabel}>Signature of Workshop Official</Text>
        </View>
      </View>
      
      <View style={{ border: '0.5px solid #000', padding: 10, marginTop: 10 }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>FOR SERVICE HUB USE</Text>
        <Text style={{ fontSize: 8, marginTop: 5 }}>Claim documents are in order. Liability under the policy is confirmed. Bill check and reinspection is carried out. The loss assessment is in order and claim is recommended for Rs. {(summary?.netAssessedLoss || 0).toFixed(2)}</Text>
      </View>
    </View>
  </Page>
);

// ─── MASTER DOCUMENT ────────────────────────────────────────────────────────
export function UIICReportDocument({ claim, summary, profile }: { claim: ClaimData; summary: AssessmentSummary; profile: SurveyorProfile }) {
  if (!claim) return null;
  
  return (
    <Document>
      <PageVerification claim={claim} />
      <PageDetails claim={claim} />
      <PageAssessment claim={claim} summary={summary} profile={profile} />
      <PageFinal claim={claim} summary={summary} profile={profile} />
    </Document>
  );
}
