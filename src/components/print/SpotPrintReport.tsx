'use client';

import React from 'react';
import type { ClaimData, SurveyorProfile } from '@/types';
import { formatDateDMY } from '@/lib/calculations';

interface SpotPrintReportProps {
  claim: ClaimData;
  profile: SurveyorProfile;
}

export const SpotPrintReport = React.forwardRef<HTMLDivElement, SpotPrintReportProps>(({ claim, profile }, ref) => {
  const { spotDetails, spotDamageRows, vehicle, policy, accident, driver } = claim;

  // Helpers for logic in the template
  const isComm = claim.vehicleType !== 'private';
  const isGoods = claim.vehicleType === 'comm-goods';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ntExpired = driver.validityNonTransport && new Date(driver.validityNonTransport) < today;
  const tExpired = driver.validityTransport && new Date(driver.validityTransport) < today;

  const gvwVal = parseFloat(String(spotDetails.gvw)) || 0;
  const ulwVal = parseFloat(String(spotDetails.ulw)) || 0;
  const capVal = parseFloat(String(spotDetails.loadCapacity)) || 0;
  const actualLoad = parseFloat(String(spotDetails.actualLoad)) || 0;
  const overload = isGoods && actualLoad > 0 && capVal > 0 && actualLoad > capVal;

  const formatDateTimeDMY = (dt: string) => {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) { return dt; }
  };

  // CSS Styles from benchmark
  const styles = {
    ts: "width:100%; border-collapse:collapse; font-size:7.8pt; margin-bottom:4px;",
    td: "padding:2px 4px; border:0.4pt solid #bbb; vertical-align:top;",
    th: "background:#0d1b2a; color:#fff; padding:2px 4px; font-size:6.8pt; text-align:left;",
    headerTitle: "text-align:center; font-weight:700; font-size:8.5pt; margin-bottom:1px; text-decoration:underline;",
    sectionBanner: "font-weight:700; font-size:7pt; background:#0d1b2a; color:#fff; padding:2px 4px; margin-bottom:2px;",
    valueBold: "font-weight:700;",
    valueMonospace: "font-family:monospace;",
    dangerText: "color:#c00; font-weight:700;"
  };

  return (
    <div ref={ref} className="spot-report-print-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&display=swap');
        
        @page {
          margin: 8mm 10mm;
          size: A4 portrait;
        }
        
        .spot-report-print-container {
          font-family: 'Barlow', Arial, sans-serif;
          font-size: 7.8pt;
          line-height: 1.3;
          color: #000;
          margin: 0;
          padding: 0;
          width: 100%;
          background: #fff;
        }

        .spot-report-print-container table {
          border-collapse: collapse;
          width: 100%;
        }

        .spot-report-print-container td, 
        .spot-report-print-container th {
          padding: 2px 4px;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tr {
            page-break-inside: avoid;
          }
          .spot-report-print-container {
             width: 100%;
          }
        }
      `}</style>

      {/* SURVEYOR HEADER */}
      <div style={{ borderBottom: '1.2pt solid #000', paddingBottom: '5px', marginBottom: '6px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13pt', fontWeight: 700 }}>{profile.name || 'SURVEYOR NAME'}</div>
          <div style={{ fontSize: '7pt' }}>{profile.qualifications || 'QUALIFICATIONS'}</div>
          <div style={{ fontSize: '7.5pt', fontWeight: 700 }}>INSURANCE SURVEYOR, LOSS ASSESSOR & VALUER</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '6.8pt' }}>
          <div>
            Lic. No.: <b>{profile.licenceNumber}</b> &nbsp;|&nbsp; 
            Expiry: <b>{profile.licenceExpiry}</b> &nbsp;|&nbsp; 
            IIISLA: <b>{profile.iiislaNumber}</b> &nbsp;|&nbsp; 
            E-mail: {profile.email} &nbsp;|&nbsp; 
            Cell: {profile.mobile}
          </div>
          <div style={{ textAlign: 'right', fontWeight: 700 }}>
            {profile.categories}<br />
            <span style={{ fontWeight: 400 }}>{profile.address}</span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '8.5pt', marginBottom: '1px', textDecoration: 'underline' }}>
        PRIVATE AND CONFIDENTIAL
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '8.5pt', marginBottom: '3px', textDecoration: 'underline' }}>
        SPOT SURVEY REPORT
      </div>

      {/* REPORT METADATA */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.8pt', marginBottom: '4px' }}>
        <tbody>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt', width: '18%' }}>Spot Report No.</td>
            <td style={{ ...parseInline(styles.td), fontWeight: 700, width: '32%' }}>{spotDetails.reportNo}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Date & Time of Report</td>
            <td style={{ ...parseInline(styles.td), fontWeight: 700 }}>{formatDateTimeDMY(spotDetails.reportDate)}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Date of Allotment</td>
            <td style={{ ...parseInline(styles.td) }}>{formatDateDMY(spotDetails.allotmentDate)}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Date & Time of Survey</td>
            <td style={{ ...parseInline(styles.td) }}>{formatDateTimeDMY(spotDetails.surveyDatetime)}</td>
          </tr>
        </tbody>
      </table>

      {/* A. VEHICLE PARTICULARS */}
      <div style={{ fontWeight: 700, fontSize: '7pt', background: '#0d1b2a', color: '#fff', padding: '2px 4px', marginBottom: '2px' }}>
        A. VEHICLE PARTICULARS
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.8pt', marginBottom: '4px' }}>
        <tbody>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', width: '18%', fontSize: '6.8pt' }}>Policy No.</td>
            <td style={{ ...parseInline(styles.td), fontFamily: 'monospace', width: '32%' }}>{policy.policyNumber}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Claim No.</td>
            <td style={{ ...parseInline(styles.td), fontFamily: 'monospace' }}>{policy.claimNumber}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Policy Type</td>
            <td style={{ ...parseInline(styles.td) }}>{policy.policyType || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>IDV (₹)</td>
            <td style={{ ...parseInline(styles.td) }}>{policy.idv || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Policy Period</td>
            <td style={{ ...parseInline(styles.td) }}>{formatDateDMY(policy.periodFrom) || '—'} to {formatDateDMY(policy.periodTo) || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Policy Issuing Office</td>
            <td style={{ ...parseInline(styles.td) }}>{policy.policyIssuingOffice || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Appointing Office</td>
            <td style={{ ...parseInline(styles.td) }}>{policy.appointingOffice || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}></td>
            <td style={{ ...parseInline(styles.td) }}></td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Reg. No.</td>
            <td style={{ ...parseInline(styles.td), fontWeight: 700 }}>{vehicle.registrationNumber}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Make / Model / Year</td>
            <td style={{ ...parseInline(styles.td) }}><b>{vehicle.make}</b> / {vehicle.model} / {vehicle.yearOfManufacture}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Chassis No.</td>
            <td style={{ ...parseInline(styles.td), fontFamily: 'monospace' }}>{vehicle.chassisNumber}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Engine No.</td>
            <td style={{ ...parseInline(styles.td), fontFamily: 'monospace' }}>{vehicle.engineNumber}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Date of Reg.</td>
            <td style={{ ...parseInline(styles.td) }}>{formatDateDMY(vehicle.dateOfRegistration) || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Class of Vehicle</td>
            <td style={{ ...parseInline(styles.td) }}>{vehicle.classOfVehicle || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Body Type</td>
            <td style={{ ...parseInline(styles.td) }}>{vehicle.bodyType || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Colour</td>
            <td style={{ ...parseInline(styles.td) }}>{vehicle.colour || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Fuel</td>
            <td style={{ ...parseInline(styles.td) }}>{vehicle.fuel || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>CC</td>
            <td style={{ ...parseInline(styles.td) }}>{vehicle.cubicCapacity || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>RLW / GVW / Seating</td>
            <td style={{ ...parseInline(styles.td) }}>{vehicle.rlw || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Odometer (KM)</td>
            <td style={{ ...parseInline(styles.td) }}>{vehicle.odometer || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Pre-Accident Condition</td>
            <td style={{ ...parseInline(styles.td) }}>{vehicle.preAccidentCondition || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>{isComm ? 'Fitness Cert. No.' : ''}</td>
            <td style={{ ...parseInline(styles.td), fontFamily: 'monospace' }}>{isComm ? vehicle.fitnessNo || '—' : ''}</td>
          </tr>
          {isComm && (
            <tr>
              <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Route / Area</td>
              <td style={{ ...parseInline(styles.td) }} colSpan={3}>{vehicle.route || '—'}</td>
            </tr>
          )}
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Insured</td>
            <td style={{ ...parseInline(styles.td), fontWeight: 600 }}>{policy.insuredName}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Insurer</td>
            <td style={{ ...parseInline(styles.td) }}>{policy.insurerName}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Insured Mobile</td>
            <td style={{ ...parseInline(styles.td) }}>{policy.insuredMobile || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>HPA / Finance With</td>
            <td style={{ ...parseInline(styles.td) }}>{policy.hpa || 'NIL'}</td>
          </tr>
          {policy.insuredAddress && (
            <tr>
              <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Insured Address</td>
              <td style={{ ...parseInline(styles.td) }} colSpan={3}>{policy.insuredAddress}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* B. DRIVER'S PARTICULARS */}
      <div style={{ fontWeight: 700, fontSize: '7pt', background: '#0d1b2a', color: '#fff', padding: '2px 4px', marginBottom: '2px' }}>
        B. DRIVER'S PARTICULARS & DL VERIFICATION
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.8pt', marginBottom: '4px' }}>
        <tbody>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', width: '18%', fontSize: '6.8pt' }}>Driver Name</td>
            <td style={{ ...parseInline(styles.td), fontWeight: 600, width: '32%' }}>
              {driver.name || '—'}{driver.parentName ? ` ${driver.relationType || 'S/o'} ${driver.parentName}` : ''}
            </td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>MDL No.</td>
            <td style={{ ...parseInline(styles.td), fontFamily: 'monospace' }}>{driver.licenceNumber || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Date of Birth</td>
            <td style={{ ...parseInline(styles.td) }}>{formatDateDMY(claim.driver.dob) || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Issuing Authority</td>
            <td style={{ ...parseInline(styles.td) }}>{driver.issuingAuthority || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Licence Classes / Issue Date</td>
            <td style={{ ...parseInline(styles.td) }} colSpan={3}>{driver.vehicleClass || '—'} &nbsp;|&nbsp; Issued: {formatDateDMY(driver.dateOfIssue) || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Non-Transport Valid</td>
            <td style={{ ...parseInline(styles.td), ...(ntExpired ? { color: '#c00', fontWeight: '700' } : {}) }}>
              {formatDateDMY(driver.validityNonTransport) || '—'}{ntExpired ? ' ⚠ EXPIRED' : ''}
            </td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Transport Valid</td>
            <td style={{ ...parseInline(styles.td), ...(tExpired ? { color: '#c00', fontWeight: '700' } : {}) }}>
              {formatDateDMY(driver.validityTransport) || '—'}{tExpired ? ' ⚠ EXPIRED' : ''}
            </td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>MDL Status</td>
            <td style={{ ...parseInline(styles.td) }} colSpan={3}>
              <b>{driver.verificationStatus === 'verified' ? 'ORIGINAL MDL VERIFIED' : driver.verificationStatus === 'photocopy' ? 'PHOTOCOPY VERIFIED' : 'NOT AVAILABLE'}</b>
              {driver.invalidRemarks ? ` — ${driver.invalidRemarks}` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      {/* C. ACCIDENT DETAILS */}
      <div style={{ fontWeight: 700, fontSize: '7pt', background: '#0d1b2a', color: '#fff', padding: '2px 4px', marginBottom: '2px' }}>
        C. ACCIDENT DETAILS
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.8pt', marginBottom: '4px' }}>
        <tbody>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', width: '18%', fontSize: '6.8pt' }}>Date & Time</td>
            <td style={{ ...parseInline(styles.td), width: '32%' }}>{formatDateTimeDMY(accident.dateAndTime)}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Place of Accident</td>
            <td style={{ ...parseInline(styles.td) }}>{accident.placeOfAccident}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Date of Survey</td>
            <td style={{ ...parseInline(styles.td) }}>{formatDateDMY(accident.dateOfSurvey) || '—'}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Place of Survey</td>
            <td style={{ ...parseInline(styles.td) }}>{accident.placeOfSurvey || accident.workshopName || '—'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Third Party</td>
            <td style={{ ...parseInline(styles.td) }}>{spotDetails.tpInvolved === 'no' ? 'NIL' : spotDetails.tpInvolved.toUpperCase()}</td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>TP Details</td>
            <td style={{ ...parseInline(styles.td) }}>{accident.thirdPartyDetails || 'NIL'}</td>
          </tr>
          <tr>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Police Reported</td>
            <td style={{ ...parseInline(styles.td) }}>
              {spotDetails.policeReported === 'yes' ? `Yes — ${accident.policeStation} | Diary: ${accident.firNumber}` : 'No'}
            </td>
            <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Panchanama</td>
            <td style={{ ...parseInline(styles.td) }}>{spotDetails.panchanama === 'yes' ? 'Yes' : 'No'}</td>
          </tr>
        </tbody>
      </table>

      {/* D. COMMERCIAL VEHICLE DOCUMENTS */}
      {isComm && (
        <>
          <div style={{ fontWeight: 700, fontSize: '7pt', background: '#0d1b2a', color: '#fff', padding: '2px 4px', marginBottom: '2px' }}>
            D. COMMERCIAL VEHICLE DOCUMENTS
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.8pt', marginBottom: '4px' }}>
            <tbody>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', width: '18%', fontSize: '6.8pt' }}>Permit No.</td>
                <td style={{ ...parseInline(styles.td), fontFamily: 'monospace', width: '32%' }}>{spotDetails.permitNo || '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Permit Type</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.permitType || '—'}</td>
              </tr>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Permit Valid From</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.permitFrom || '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Permit Valid To</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.permitTo || '—'}</td>
              </tr>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Fitness No.</td>
                <td style={{ ...parseInline(styles.td), fontFamily: 'monospace' }}>{vehicle.fitnessNo || '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Fitness Valid To</td>
                <td style={{ ...parseInline(styles.td), ...(vehicle.fitnessValidUpto && new Date(vehicle.fitnessValidUpto) < today ? { color: '#c00', fontWeight: '700' } : {}) }}>
                  {vehicle.fitnessValidUpto || '—'}{vehicle.fitnessValidUpto && new Date(vehicle.fitnessValidUpto) < today ? ' ⚠ EXPIRED' : ''}
                </td>
              </tr>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Auth. No.</td>
                <td style={{ ...parseInline(styles.td), fontFamily: 'monospace' }}>{spotDetails.authNo || '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Auth Valid To</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.authValid || '—'}</td>
              </tr>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Fitness Type</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.fitnessType || vehicle.fitnessType || '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Area of Operation</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.areaOfOperation || '—'}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* E. LOAD DETAILS */}
      {isGoods && (
        <>
          <div style={{ fontWeight: 700, fontSize: '7pt', background: '#0d1b2a', color: '#fff', padding: '2px 4px', marginBottom: '2px' }}>
            E. LOAD DETAILS
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.8pt', marginBottom: '4px' }}>
            <tbody>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', width: '25%', fontSize: '6.8pt' }}>GVW (kg)</td>
                <td style={{ ...parseInline(styles.td), width: '25%' }}>{gvwVal || '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', width: '25%', fontSize: '6.8pt' }}>ULW / Tare (kg)</td>
                <td style={{ ...parseInline(styles.td) }}>{ulwVal || '—'}</td>
              </tr>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Legal Load Capacity</td>
                <td style={{ ...parseInline(styles.td), fontWeight: 600 }}>{capVal ? `${capVal} kg` : '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Actual Load Carried</td>
                <td style={{ ...parseInline(styles.td), ...(overload ? { color: '#c00', fontWeight: '700' } : {}) }}>
                  {actualLoad ? `${actualLoad} kg` : '—'}{overload ? ` ⚠ Overloaded by ${Math.round(actualLoad - capVal)} kg` : ''}
                </td>
              </tr>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>CN / Challan No.</td>
                <td style={{ ...parseInline(styles.td), fontFamily: 'monospace' }}>{spotDetails.challanNo || '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Challan Date</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.challanDate || '—'}</td>
              </tr>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Goods</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.loadDesc || '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}></td>
                <td style={{ ...parseInline(styles.td) }}></td>
              </tr>
              <tr>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Origin</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.loadOrigin || '—'}</td>
                <td style={{ ...parseInline(styles.td), color: '#444', fontSize: '6.8pt' }}>Destination</td>
                <td style={{ ...parseInline(styles.td) }}>{spotDetails.loadDest || '—'}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* F. CAUSE OF ACCIDENT */}
      <div style={{ fontWeight: 700, fontSize: '7pt', background: '#0d1b2a', color: '#fff', padding: '2px 4px', marginBottom: '2px' }}>
        F. CAUSE AND NATURE OF ACCIDENT
      </div>
      <div style={{ fontSize: '7.2pt', marginBottom: '4px', padding: '2px 4px', border: '0.4pt solid #bbb', lineHeight: 1.5 }}>
        {claim.accident.causeOfAccident || '—'}
      </div>

      {/* G. DAMAGE PARTICULARS AT SPOT */}
      <div style={{ fontWeight: 700, fontSize: '7pt', background: '#0d1b2a', color: '#fff', padding: '2px 4px', marginBottom: '2px' }}>
        G. DAMAGE PARTICULARS AT SPOT
      </div>
      <div style={{ fontSize: '6.8pt', marginBottom: '3px', padding: '2px 4px' }}>
        Severity: <b>{spotDetails.damageSeverity?.toUpperCase()}</b> &nbsp;|&nbsp; 
        Airbags Deployed: <b>{spotDetails.airbags?.toUpperCase()}</b> &nbsp;|&nbsp; 
        Drivable: <b>{spotDetails.drivable}</b>
      </div>
      
      {spotDamageRows.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.8pt', marginBottom: '4px' }}>
          <thead>
            <tr>
              <th style={{ ...parseInline(styles.th), width: '20pt', textAlign: 'center' }}>Sr.</th>
              <th style={{ ...parseInline(styles.th) }}>Component</th>
              <th style={{ ...parseInline(styles.th) }}>Damage Description</th>
            </tr>
          </thead>
          <tbody>
            {spotDamageRows.map((r, i) => (
              <tr key={r.id}>
                <td style={{ ...parseInline(styles.td), textAlign: 'center' }}>{i + 1}</td>
                <td style={{ ...parseInline(styles.td), fontWeight: 600 }}>{r.component || '—'}</td>
                <td style={{ ...parseInline(styles.td) }}>{r.damage || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: '7pt', padding: '2px 4px', border: '0.4pt solid #bbb' }}>
          Damage observations: {spotDetails.comments || 'NIL'}
        </p>
      )}

      {spotDetails.repairs ? (
        <div style={{ fontSize: '7.2pt', marginTop: '6px', padding: '3px 4px', border: '0.4pt solid #bbb', background: '#f9f9f6' }}>
          <b>Repairs:</b> {spotDetails.repairs}
        </div>
      ) : (
        <div style={{ fontSize: '7.2pt', marginTop: '6px', padding: '3px 4px', border: '0.4pt solid #bbb', background: '#f9f9f6' }}>
          <b>Repairs:</b> &nbsp;
        </div>
      )}

      <p style={{ fontSize: '6.5pt', lineHeight: 1.5, margin: '8px 0', textAlign: 'justify', color: '#333' }}>
        We hereby certify that we have carried out spot survey of the above vehicle and report as above without prejudice and subject to terms and conditions of the policy.
      </p>

      {/* SIGNATURE BLOCK */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', marginTop: '14px', gap: '8px' }}>
        {profile.stampDataUrl && (
          <img src={profile.stampDataUrl} style={{ maxHeight: '110px', maxWidth: '140px', objectFit: 'contain' }} />
        )}
        <div style={{ textAlign: 'center' }}>
          {profile.signatureDataUrl && (
            <img src={profile.signatureDataUrl} style={{ maxHeight: '96px', maxWidth: '180px', objectFit: 'contain' }} />
          )}
          <div style={{ fontWeight: 700, fontSize: '7.5pt', marginTop: '2px' }}>{profile.name || 'SURVEYOR NAME'}</div>
          <div style={{ fontSize: '6.5pt', color: '#555' }}>Licenced Surveyor & Loss Assessor</div>
        </div>
      </div>

      <div style={{ fontSize: '6.8pt', marginTop: '6px', paddingTop: '4px', borderTop: '0.4pt solid #ccc' }}>
        <b>ENCL:</b> {spotDetails.enclosures || '\u00A0'.repeat(100)}
      </div>
    </div>
  );
});

SpotPrintReport.displayName = 'SpotPrintReport';

/**
 * Helper to parse inline style strings into React style objects
 */
function parseInline(styleStr: string): React.CSSProperties {
  const obj: any = {};
  styleStr.split(';').forEach(pair => {
    const [key, value] = pair.split(':');
    if (key && value) {
      const camelKey = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      obj[camelKey] = value.trim();
    }
  });
  return obj;
}
