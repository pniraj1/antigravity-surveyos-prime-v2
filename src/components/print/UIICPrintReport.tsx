'use client';

import React from 'react';
import { ClaimData, AssessmentSummary, SurveyorProfile } from '@/types';
import { formatDateDMY, formatCurrency, numberToWords, getVehicleAgeMonths, getDepreciationRate } from '@/lib/calculations';

interface UIICPrintReportProps {
  claim: ClaimData;
  summary: AssessmentSummary & {
    netInWords?: string;
    partsCGST?: number;
    partsSGST?: number;
    partsBase?: number;
    partsTotal?: number;
    labourBase?: number;
  };
  profile: SurveyorProfile;
}

export const UIICPrintReport = React.forwardRef<HTMLDivElement, UIICPrintReportProps>(({ claim, summary, profile }, ref) => {
  const ageMonths = getVehicleAgeMonths(
    claim?.vehicle?.dateOfRegistration || null,
    claim?.vehicle?.yearOfManufacture ? Number(claim.vehicle.yearOfManufacture) : null,
    claim?.accident?.dateOfSurvey || null
  );

  return (
    <div ref={ref} className="uiic-report">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          .print-page { page-break-after: always; min-height: 270mm; overflow: hidden; }
          .uiic-report { width: 210mm; background: white; color: black; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .uiic-report { font-family: 'Inter', sans-serif; font-size: 11px; padding: 0; }
        .grid-header { background: #006838; color: white; font-weight: bold; padding: 4px 8px; text-transform: uppercase; }
        .report-box { border: 1px solid #006838; margin-bottom: 10px; }
        .row { display: flex; border-bottom: 1px solid #006838; }
        .row:last-child { border-bottom: none; }
        .label { width: 30%; background: #f0f7f2; padding: 4px 8px; font-weight: bold; border-right: 1px solid #006838; }
        .value { flex: 1; padding: 4px 8px; font-weight: 500; }
        .assessment-table { width: 100%; border-collapse: collapse; border: 1px solid #006838; }
        .assessment-table th, .assessment-table td { border: 1px solid #006838; padding: 4px; font-size: 9px; text-align: left; }
        .assessment-table th { background: #006838; color: white; text-transform: uppercase; }
        .text-right { text-align: right !important; }
        .text-center { text-align: center !important; }
      `}</style>

      {/* --- PAGE 1: DOCUMENT VERIFICATION --- */}
      <div className="print-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ border: '2px solid black', padding: '5px 15px', fontWeight: '900', fontSize: '14px' }}>
            {profile?.name || 'SURVEYOR'}
          </div>
          <div style={{ border: '1px solid black', padding: '5px 10px', fontSize: '10px', fontStyle: 'italic' }}>
            "ISSUED WITHOUT PREJUDICE"
          </div>
        </div>

        <div className="grid-header text-center" style={{ marginBottom: 10 }}>
          MOTOR SURVEY REPORT - (SPOT / FINAL / REINSPECTION)
        </div>

        <div className="report-box">
          <div className="row">
            <div className="label" style={{ width: '40%' }}>VEHICLE DOCUMENT NAME</div>
            <div className="label" style={{ width: '15%' }}>OBTAINED?</div>
            <div className="label">DOCUMENT DETAILS</div>
          </div>
          
          {/* RC Section */}
          <div className="row">
            <div className="value" style={{ width: '40%', fontSize: '10px' }}>Vehicle Registration Certificate (RC Book)</div>
            <div className="value text-center" style={{ width: '15%' }}>{claim?.spotDetails?.verificationFlags?.rc || 'YES'}</div>
            <div className="value" style={{ padding: 0 }}>
              <div className="row"><div className="label">Reg. Type</div><div className="value">{claim.vehicle.registrationType}</div></div>
              <div className="row"><div className="label">Reg. Date</div><div className="value">{claim.vehicle.dateOfRegistration}</div></div>
              <div className="row"><div className="label">Authority</div><div className="value">{claim.vehicle.registeringAuthority}</div></div>
              <div className="row"><div className="label">Valid-To</div><div className="value">{claim.vehicle.registrationValidUpTo}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="label">RC Endorsement</div><div className="value">{claim.vehicle.rcEndorsement}</div></div>
            </div>
          </div>

          <div className="grid-header">ADDITIONAL DETAILS - PASSENGER / GOODS VEHICLE</div>
          <div className="row">
             <div className="label">Seating Cap.</div><div className="value">{claim.vehicle.seatingCapacity}</div>
             <div className="label">Gross Weight</div><div className="value">{claim.vehicle.grossWeight ? `${claim.vehicle.grossWeight} KG` : ''}</div>
          </div>

          {/* DL Section */}
          <div className="grid-header">DRIVING LICENCE VERIFICATION</div>
          <div className="row">
            <div className="label" style={{ width: '40%' }}>Driving Licence</div>
            <div className="value text-center" style={{ width: '15%' }}>{claim?.spotDetails?.verificationFlags?.dl || 'YES'}</div>
            <div className="value" style={{ padding: 0 }}>
              <div className="row"><div className="label">Holder</div><div className="value">{claim.driver.name}</div></div>
              <div className="row"><div className="label">DL No.</div><div className="value">{claim.driver.licenceNumber}</div></div>
              <div className="row"><div className="label">Class</div><div className="value">{claim.driver.vehicleClasses}</div></div>
              <div className="row"><div className="label">Validity</div><div className="value">{claim.driver.validityTransport || claim.driver.validityNonTransport}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="label">Authorised?</div><div className="value">{claim.driver.authorisedToDrive}</div></div>
            </div>
          </div>

          {/* Road Permit */}
          <div className="grid-header">ROAD PERMIT / AUTHORIZATION</div>
          <div className="row">
             <div className="label">Permit No</div><div className="value">{claim.spotDetails?.permitNo}</div>
             <div className="label">Nature</div><div className="value">{claim.spotDetails?.natureOfPermit}</div>
          </div>
          <div className="row">
             <div className="label">Valid Upto</div><div className="value">{claim.spotDetails?.permitTo}</div>
             <div className="label">Area</div><div className="value">{claim.spotDetails?.areaOfOperation}</div>
          </div>
        </div>
      </div>

      {/* --- PAGE 2: CLAIM & VEHICLE GRID --- */}
      <div className="print-page">
        <div style={{ border: '2px solid black', padding: '5px 15px', fontWeight: '900', fontSize: '14px', width: 'fit-content', marginBottom: 10 }}>
          {profile?.name || 'SURVEYOR'}
        </div>

        <div style={{ display: 'flex', border: '1px solid #006838', marginBottom: 10 }}>
           <div className="label">REPORT NO: {claim.reportNo}</div>
           <div className="value">DATE: {claim.reportDate}</div>
        </div>

        <div className="report-box" style={{ display: 'flex' }}>
          <div style={{ flex: 1, borderRight: '1px solid #006838' }}>
            <div className="grid-header">POLICY DETAILS</div>
            <div className="row"><div className="label">Policy No</div><div className="value">{claim.policy.policyNumber}</div></div>
            <div className="row"><div className="label">Insured</div><div className="value">{claim.policy.insuredName}</div></div>
            <div className="row"><div className="label">IDV (₹)</div><div className="value text-right">{claim.policy.idv}</div></div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="grid-header">CLAIM DETAILS</div>
            <div className="row"><div className="label">Claim No</div><div className="value">{claim.policy.claimNumber}</div></div>
            <div className="row"><div className="label">Loss Date</div><div className="value">{claim.accident.dateAndTime}</div></div>
            <div className="row"><div className="label">Place</div><div className="value">{claim.accident.placeOfAccident}</div></div>
          </div>
        </div>

        <div className="grid-header">VEHICLE DETAILS & SURVEY INFO</div>
        <div className="report-box" style={{ display: 'flex' }}>
          <div style={{ flex: 1, borderRight: '1px solid #006838' }}>
            <div className="row"><div className="label">Reg No</div><div className="value">{claim.vehicle.registrationNumber}</div></div>
            <div className="row"><div className="label">Chassis</div><div className="value">{claim.vehicle.chassisNumber}</div></div>
            <div className="row"><div className="label">Engine</div><div className="value">{claim.vehicle.engineNumber}</div></div>
            <div className="row"><div className="label">Make/Model</div><div className="value">{claim.vehicle.make} / {claim.vehicle.model}</div></div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="row"><div className="label">Survey Date</div><div className="value">{claim.accident.dateOfSurvey}</div></div>
            <div className="row"><div className="label">Survey Place</div><div className="value">{claim.accident.placeOfSurvey}</div></div>
          </div>
        </div>

        <div className="grid-header">SURVEYOR REMARKS / CAUSE OF ACCIDENT</div>
        <div style={{ border: '1px solid #006838', padding: 10, minHeight: 150 }}>
          {claim.accident.causeOfAccident || 'As per the claim form, the vehicle met with an accident...'}
        </div>
      </div>

      {/* --- PAGE 3: ASSESSMENT TABLE --- */}
      <div className="print-page">
        <div className="text-center" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: '900', fontSize: '18px', color: '#006838' }}>FINAL SURVEY REPORT</div>
          <div style={{ fontSize: '9px', fontStyle: 'italic', color: '#666' }}>LOSS ASSESSMENT SHEET / WORK ORDER / CLAIM NOTE</div>
        </div>

        <table className="assessment-table">
          <thead>
            <tr>
              <th className="text-center" style={{ width: '40px' }}>Sr.</th>
              <th>Description of Parts</th>
              <th className="text-center">SAC/HSN</th>
              <th className="text-right">Unit Rate</th>
              <th className="text-center">Qty</th>
              <th className="text-center">GST %</th>
              <th className="text-right">Estimated</th>
              <th className="text-right">Assessed</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={8} style={{ background: '#f5f5f5', fontWeight: 'bold' }}>A. SPARE PARTS</td></tr>
            {(claim.assessmentRows || []).filter(r => r.section === 'parts').map((row, idx) => {
              const depRate = getDepreciationRate(row.partType, ageMonths, claim?.depreciationType || 'Conventional');
              return (
                <tr key={row.id}>
                  <td className="text-center">{idx + 1}</td>
                  <td>{row.particulars}</td>
                  <td className="text-center">{row.partType}</td>
                  <td className="text-right">{row.assessed?.toFixed(2)}</td>
                  <td className="text-center">1</td>
                  <td className="text-center">{row.gst}%</td>
                  <td className="text-right">{row.estimated?.toFixed(2)}</td>
                  <td className="text-right">{row.assessed?.toFixed(2)}</td>
                </tr>
              );
            })}
            <tr><td colSpan={8} style={{ background: '#f5f5f5', fontWeight: 'bold' }}>B. LABOUR CHARGES</td></tr>
            {(claim.assessmentRows || []).filter(r => r.section === 'labour').map((row, idx) => (
              <tr key={row.id}>
                <td className="text-center">{idx + 1}</td>
                <td>{row.particulars}</td>
                <td className="text-center">998729</td>
                <td className="text-right">{row.assessed?.toFixed(2)}</td>
                <td className="text-center">1</td>
                <td className="text-center">{row.gst}%</td>
                <td className="text-right">{row.estimated?.toFixed(2)}</td>
                <td className="text-right">{row.assessed?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 20, border: '2px solid #006838' }}>
          <div className="grid-header">SUMMARY OF LIABILITY</div>
          <div className="row"><div className="label">Total Parts (Before Dep)</div><div className="value text-right">{formatCurrency(summary.partsBase)}</div></div>
          <div className="row"><div className="label">Total Labour Charges</div><div className="value text-right">{formatCurrency(summary.labourBase)}</div></div>
          <div className="row"><div className="label" style={{ color: '#B91C1C' }}>NET LIABILITY OF INSURER</div><div className="value text-right" style={{ color: '#B91C1C', fontWeight: '900', fontSize: '14px' }}>{formatCurrency(summary.netAssessedLoss)}</div></div>
          <div className="row"><div className="label">Amount in Words</div><div className="value font-bold italic" style={{ fontSize: '10px' }}>Rupees {summary.netInWords} Only.</div></div>
        </div>

        {/* Professional Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 50 }}>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <div style={{ height: '60px' }}>
               {profile?.signatureDataUrl && <img src={profile.signatureDataUrl} style={{ maxWidth: '120px', maxHeight: '60px' }} />}
            </div>
            <div style={{ borderTop: '1px solid black', paddingTop: '5px', fontWeight: 'bold' }}>
              VIKRAM PATIL<br />(Surveyor & Loss Assessor)
            </div>
          </div>
          <div style={{ textAlign: 'center', width: '200px' }}>
             <div style={{ height: '60px' }}></div>
             <div style={{ borderTop: '1px solid black', paddingTop: '5px', fontWeight: 'bold' }}>
               FOR WORKSHOP / INSURED<br />(Authorized Signatory)
             </div>
          </div>
        </div>
      </div>
    </div>
  );
});

UIICPrintReport.displayName = 'UIICPrintReport';
