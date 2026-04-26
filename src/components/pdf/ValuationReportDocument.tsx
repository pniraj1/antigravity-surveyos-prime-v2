'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';
import { formatDateDMY } from '@/lib/calculations';

const S = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#111' },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', marginBottom: 2 },
  underline: { borderBottom: '1px solid #111', paddingBottom: 4, marginBottom: 10 },
  bold: { fontFamily: 'Helvetica-Bold' },
  sectionHeader: { fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase', backgroundColor: '#ddd', padding: '3 5', marginTop: 10, marginBottom: 2 },
  row: { flexDirection: 'row', borderBottom: '0.5px solid #ccc', paddingVertical: 2 },
  label: { width: '35%', color: '#444', fontSize: 8 },
  value: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  para: { fontSize: 8, marginTop: 6, lineHeight: 1.5 },
  toBlock: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
});

function g(v: string | number | null | undefined): string {
  return v !== null && v !== undefined && v !== '' ? String(v) : '—';
}

interface Props {
  claim: ClaimData;
}

export function ValuationReportDocument({ claim }: Props) {
  const v = claim.vehicle;
  const p = claim.policy;
  const vd = claim.valuationDetails;
  const rows = vd?.panelRows ?? [];

  function detailRow(label: string, value: string, label2?: string, value2?: string) {
    return (
      <View style={S.row} key={label}>
        <Text style={S.label}>{label}</Text>
        <Text style={S.value}>{value}</Text>
        {label2 !== undefined && <Text style={[S.label, { marginLeft: 8 }]}>{label2}</Text>}
        {value2 !== undefined && <Text style={S.value}>{value2}</Text>}
      </View>
    );
  }

  function condRow(label: string, value: string) {
    return (
      <View style={S.row} key={label}>
        <Text style={S.label}>{label}</Text>
        <Text style={S.value}>{value || '—'}</Text>
      </View>
    );
  }

  const tyreDesc = [
    vd?.tyreCount ? `${vd.tyreCount} tyres` : '',
    vd?.stepneyCount ? `${vd.stepneyCount} stepney` : '',
    vd?.tyreMake ? `Make: ${vd.tyreMake}` : '',
    vd?.tyreCondition || '',
  ].filter(Boolean).join(', ') || '—';

  const insurableText = vd?.isInsurable
    ? `THE ABOVE VEHICLE WAS FOUND IN INSURABLE STATE AND MAY THEREFORE BE INSURED${vd.coverRecommendation ? ' ON ' + vd.coverRecommendation.toUpperCase() : ''}.`
    : 'THE ABOVE VEHICLE WAS FOUND TO NOT BE IN AN INSURABLE STATE.';

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* TO block */}
        <View style={S.toBlock}>
          <View>
            <Text style={S.bold}>TO,</Text>
            <Text>{g(p.insurerName) !== '—' ? g(p.insurerName) : 'The Insurance Company'}</Text>
            {p.policyIssuingOffice ? <Text>{g(p.policyIssuingOffice)}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text>Date: {formatDateDMY(vd?.inspectionDate) || formatDateDMY(claim.reportDate)}</Text>
            {claim.reportNo ? <Text>Ref No.: {claim.reportNo}</Text> : null}
          </View>
        </View>

        {/* Title */}
        <View style={S.underline}>
          <Text style={S.title}>Vehicle Pre-Insurance Inspection Report</Text>
        </View>

        {/* Opening */}
        <Text style={S.para}>
          RESPECTED SIR / MADAM,{'\n\n'}
          WE HAVE UNDERTAKEN THIS INSPECTION SINCE THERE WAS BREAKIN IN THE INSURANCE PERIOD.
          AS PER YOUR INSTRUCTION, WE HAVE INSPECTED THE BELOW MENTIONED VEHICLE AT{' '}
          {g(vd?.inspectionPlace).toUpperCase()} AND FOUND IT TO BE IN GOOD RUNNING ORDER.
        </Text>

        {/* Vehicle Details */}
        <Text style={S.sectionHeader}>Vehicle Details</Text>
        {detailRow('Registration Number', g(v.registrationNumber), 'Date of Registration', formatDateDMY(v.dateOfRegistration))}
        {detailRow('Chassis No.', g(v.chassisNumber), 'Engine No.', g(v.engineNumber))}
        {detailRow('Make / Model', `${g(v.make)} / ${g(v.model)}`, 'Fuel Type', g(v.fuel))}
        {detailRow('Seating Capacity', g(v.seatingCapacity), 'Class of Vehicle', g(v.classOfVehicle))}
        {detailRow('Type of Body', g(v.bodyType), 'Unladen Weight', v.unladenWeight ? g(v.unladenWeight) + ' kg' : '—')}
        {detailRow('Registered Laden Weight', v.registeredLoadWeight ? g(v.registeredLoadWeight) + ' kg' : '—', 'Kilometerage', g(vd?.odometer))}

        {/* Condition */}
        <Text style={S.sectionHeader}>Condition of Vehicle</Text>
        {condRow('Chassis', vd?.chassis || 'Monocoque type, safe')}
        {condRow('Engine & Transmission', vd?.engineTransmission || 'Found in good running order')}
        {condRow('Suspension', vd?.suspension || 'Found in appropriate working order')}
        {condRow('Battery Make', vd?.batteryMake || '—')}
        {condRow('Battery Condition', vd?.batteryCondition || '—')}
        {condRow('Tyres & Stepney', tyreDesc)}
        {vd?.glassCondition ? condRow('Glass Condition', vd.glassCondition) : null}
        {condRow('Seats & Upholstery', vd?.seats || '—')}
        {condRow('Electricals', vd?.electricals || '—')}

        {/* Panel damage */}
        {rows.length > 0 && (
          <>
            <Text style={S.sectionHeader}>Cabin & Body Shell</Text>
            {rows.map(row => condRow(g(row.component), g(row.condition)))}
          </>
        )}

        {/* Conclusion */}
        <Text style={[S.para, { fontFamily: 'Helvetica-Bold', marginTop: 10 }]}>
          {insurableText}
        </Text>

        {vd?.documentVerificationNote ? (
          <Text style={S.para}>
            WE HAVE VERIFIED XEROX COPIES OF SET OF DOCUMENTS AND FOUND THEM TO BE IN ORDER
            {vd.documentVerificationNote ? ' EXCEPT FOR THE ' + vd.documentVerificationNote.toUpperCase() : ''}.
          </Text>
        ) : null}

        {vd?.remarks ? <Text style={S.para}>Remarks: {vd.remarks}</Text> : null}
        {vd?.enclosures ? <Text style={S.para}>Enclosures: {vd.enclosures}</Text> : null}

      </Page>
    </Document>
  );
}
