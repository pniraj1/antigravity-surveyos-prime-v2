/**
 * reinspection-report-builder.ts
 *
 * Dedicated reinspection report builder using tabular format.
 * Generates a 1-2 page focused report on reinspection findings and parts status.
 */

import type { ClaimData } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';
import { formatDateDMY, getVehicleAgeMonths, getSurveyorHeader, getSigBlock } from './report-utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fd(v: string | null | undefined): string {
  return formatDateDMY(v);
}

function g(v: string | number | null | undefined): string {
  return v !== null && v !== undefined ? String(v) : '—';
}

function fa(v: number | string | null | undefined): string {
  if (!v) return '₹ 0.00';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return '₹ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─── Main Reinspection HTML Builder ───────────────────────────────────────────

export function buildReinspectionHTML(claim: ClaimData, profile: SurveyorProfile | null): string {
  const v = claim.vehicle;
  const p = claim.policy;
  const ri = claim.reinspection;
  const riParts = ri.parts || [];

  const ageMonths = getVehicleAgeMonths(
    v.dateOfRegistration || null,
    v.yearOfManufacture ? Number(v.yearOfManufacture) : null,
    ri.date || null
  );

  // ── Table style shorthands ──────────────────────────────────────────────
  const ts = 'width:100%;border-collapse:collapse;font-size:8pt;';
  const B = 'border:0.5pt solid #000;';
  const td = B + 'padding:3px 5px;vertical-align:top;';
  const tdl = td + 'font-size:7pt;color:#333;';
  const tdb = td + 'font-weight:700;';
  const th = 'background:#e8e8e8;' + B + 'padding:3px 5px;font-size:7pt;font-weight:700;text-align:center;';
  const sec = 'background:#ddd;' + B + 'padding:3px 5px;font-weight:700;font-size:7.5pt;text-transform:uppercase;';

  // ── PAGE 1: Reinspection Report ─────────────────────────────────────────

  const p1 = `
${getSurveyorHeader(profile)}
<div style="text-align:center;font-weight:700;font-size:10pt;border:1pt solid #000;padding:5px;margin-bottom:6px;background:#f0f0f0;">RE-INSPECTION REPORT</div>

<div style="${sec}">REPORT DETAILS</div>
<table style="${ts}">
<tr>
  <td style="${tdl}width:25%;">Report Number</td>
  <td style="${tdb}width:25%;">${g(claim.reportNo)}</td>
  <td style="${tdl}width:25%;">Date of Report</td>
  <td style="${tdb}">${fd(claim.reportDate)}</td>
</tr>
<tr>
  <td style="${tdl}">RI Ref Number</td>
  <td style="${tdb}">${g(ri.refNo)}</td>
  <td style="${tdl}">Date of RI</td>
  <td style="${tdb}">${fd(ri.date)}</td>
</tr>
</table>

<div style="${sec}">ORIGINAL SURVEY DETAILS</div>
<table style="${ts}">
<tr>
  <td style="${tdl}width:25%;">Survey Ref No</td>
  <td style="${tdb}width:25%;">${g(ri.surveyRef)}</td>
  <td style="${tdl}width:25%;">Survey Date</td>
  <td style="${tdb}">${fd(ri.surveyDate)}</td>
</tr>
<tr>
  <td style="${tdl}">RI Appointment Date</td>
  <td style="${tdb}">${fd(ri.riAppointmentDate)}</td>
  <td style="${tdl}">Repair Auth. Date</td>
  <td style="${tdb}">${fd(ri.repairAuthDate)}</td>
</tr>
</table>

<div style="${sec}">VEHICLE DETAILS</div>
<table style="${ts}">
<tr>
  <td style="${tdl}width:25%;">Registration No</td>
  <td style="${tdb}width:25%;">${g(v.registrationNumber)}</td>
  <td style="${tdl}width:25%;">Make / Model</td>
  <td style="${tdb}">${g(v.make)} / ${g(v.model)}</td>
</tr>
<tr>
  <td style="${tdl}">Chassis Number</td>
  <td style="${tdb}" colspan="3">${g(v.chassisNumber)}</td>
</tr>
<tr>
  <td style="${tdl}">Engine Number</td>
  <td style="${tdb}">${g(v.engineNumber)}</td>
  <td style="${tdl}">Colour</td>
  <td style="${tdb}">${g(v.colour)}</td>
</tr>
</table>

<div style="${sec}">POLICY & CLAIM DETAILS</div>
<table style="${ts}">
<tr>
  <td style="${tdl}width:25%;">Policy Number</td>
  <td style="${tdb}width:25%;">${g(p.policyNumber)}</td>
  <td style="${tdl}width:25%;">Insured Name</td>
  <td style="${tdb}">${g(p.insuredName)}</td>
</tr>
<tr>
  <td style="${tdl}">IDV</td>
  <td style="${tdb}">${fa(p.idv)}</td>
  <td style="${tdl}">Vehicle Age (Months)</td>
  <td style="${tdb}">${ageMonths}</td>
</tr>
</table>

<div style="${sec}">REINSPECTION FINDINGS</div>
<table style="${ts}">
<tr>
  <td style="${tdl}width:25%;">Repairs Done as Assessed</td>
  <td style="${tdb}width:25%;">${g(ri.repairsAsAssessed)}</td>
  <td style="${tdl}width:25%;">Vehicle Condition</td>
  <td style="${tdb}width:25%;">${g(ri.vehicleCondition)}</td>
</tr>
<tr>
  <td style="${tdl}">Salvage Status</td>
  <td style="${tdb}" colspan="3">${g(ri.salvageStatus)}</td>
</tr>
<tr>
  <td style="${tdl}">Repair Quality</td>
  <td style="${tdb}" colspan="3">${g(ri.repairQuality)}</td>
</tr>
</table>

<div style="${sec}">PARTS ASSESSMENT - RE-INSPECTION STATUS</div>
<table style="${ts}">
<tr>
  <th style="${th}width:45%;">Particulars</th>
  <th style="${th}width:15%;">Assessed Amt (₹)</th>
  <th style="${th}width:20%;">Status</th>
  <th style="${th}width:20%;">Remarks</th>
</tr>
${riParts.map(part => `
<tr>
  <td style="${td}width:45%;font-size:7.5pt;">${g(part.particulars)}</td>
  <td style="${td}width:15%;text-align:right;font-size:7.5pt;">${fa(part.assessed)}</td>
  <td style="${td}width:20%;font-size:7.5pt;font-weight:700;">${g(part.status).toUpperCase()}</td>
  <td style="${td}width:20%;font-size:7pt;">${g(part.remarks)}</td>
</tr>
`).join('')}
${riParts.length === 0 ? `<tr><td style="${td}" colspan="4">No parts recorded</td></tr>` : ''}
</table>

<div style="${sec}">SURVEYOR CONCLUSION</div>
<div style="border:0.5pt solid #000;padding:5px;font-size:7.5pt;line-height:1.4;margin-bottom:6px;min-height:40px;">
${g(ri.observations)}
</div>

${getSigBlock(profile, '10px')}
`;

  return p1;
}

// ─── Print Trigger ─────────────────────────────────────────────────────────────

export function triggerReinspectionPrint(claim: ClaimData, profile: SurveyorProfile | null): void {
  const html = buildReinspectionHTML(claim, profile);
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (w) {
    w.document.write(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: Arial, sans-serif; margin: 0.5in; background: white; }
@media print {
  body { margin: 0; padding: 0.5in; }
  .no-print { display: none; }
}
</style>
</head>
<body>${html}</body>
</html>
    `);
    w.document.close();
    w.addEventListener('load', () => {
      w.print();
      setTimeout(() => w.close(), 1500);
    });
  }
}
