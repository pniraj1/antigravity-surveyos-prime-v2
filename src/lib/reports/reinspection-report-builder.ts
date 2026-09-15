/**
 * reinspection-report-builder.ts
 *
 * Dedicated reinspection report builder using tabular format.
 * Generates a 1-2 page focused report on reinspection findings and parts status.
 */

import type { ClaimData } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';
import { formatDateDMY, getVehicleAgeMonths, getSurveyorHeader, getSigBlock } from './report-utils';
import { buildPrintShell, footerFromProfile } from './print-shell';

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
  const a = claim.accident;
  const ri = claim.reinspection;
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
  <td style="${tdl}width:25%;">RI Ref Number</td>
  <td style="${tdb}">${g(ri.refNo)}</td>
</tr>
<tr>
  <td style="${tdl}">Date of Accident</td>
  <td style="${tdb}">${fd(a.dateAndTime)}</td>
  <td style="${tdl}">Date of Survey</td>
  <td style="${tdb}">${fd(a.dateOfSurvey)}</td>
</tr>
<tr>
  <td style="${tdl}">RI Appointment Date</td>
  <td style="${tdb}">${fd(ri.riAppointmentDate)}</td>
  <td style="${tdl}">Date of RI</td>
  <td style="${tdb}">${fd(ri.date)}</td>
</tr>
<tr>
  <td style="${tdl}">Place of Re-inspection</td>
  <td style="${tdb}" colspan="3">${g(ri.placeOfSurvey || a.placeOfSurvey)}</td>
</tr>
<tr>
  <td style="${tdl}">Repair Auth. Date</td>
  <td style="${tdb}">${fd(ri.repairAuthDate)}</td>
  <td style="${tdl}">Est. Completion Date</td>
  <td style="${tdb}">${fd(ri.estCompletionDate)}</td>
</tr>
<tr>
  <td style="${tdl}">Actual Completion Date</td>
  <td style="${tdb}" colspan="3">${fd(ri.actualCompletionDate)}</td>
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
  <td style="${tdl}width:25%;">Insurance Company</td>
  <td style="${tdb}width:25%;">${g(p.insurerName)}</td>
  <td style="${tdl}width:25%;">Policy Issuing Office</td>
  <td style="${tdb}">${g(p.policyIssuingOffice)}</td>
</tr>
<tr>
  <td style="${tdl}">Claim Appointing Office</td>
  <td style="${tdb}" colspan="3">${g(p.appointingOffice)}</td>
</tr>
<tr>
  <td style="${tdl}">Policy Number</td>
  <td style="${tdb}">${g(p.policyNumber)}</td>
  <td style="${tdl}">Insured Name</td>
  <td style="${tdb}">${g(p.insuredName)}</td>
</tr>
<tr>
  <td style="${tdl}">Policy From</td>
  <td style="${tdb}">${fd(p.periodFrom)}</td>
  <td style="${tdl}">Policy Valid Upto</td>
  <td style="${tdb}">${fd(p.periodTo)}</td>
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


<div style="${sec}">SURVEYOR CONCLUSION</div>
<div style="border:0.5pt solid #000;padding:5px;font-size:7.5pt;line-height:1.4;margin-bottom:6px;min-height:40px;">
${g(ri.observations)}
</div>

${getSigBlock(profile, '10px')}
`;

  return p1;
}

// ─── Print Trigger ─────────────────────────────────────────────────────────────

/** Full printable document — shares the A4 shell and running footer. */
export function buildReinspectionPrintDocument(claim: ClaimData, profile: SurveyorProfile | null): string {
  return buildPrintShell(buildReinspectionHTML(claim, profile), {
    title: `Re-inspection Report — ${claim.vehicle?.registrationNumber || 'Claim'}`,
    footerLeft: footerFromProfile(profile),
    fontSize: '8pt',
    fontFamily: 'Arial, Helvetica, sans-serif',
  });
}

export function triggerReinspectionPrint(claim: ClaimData, profile: SurveyorProfile | null): void {
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (w) {
    w.document.write(buildReinspectionPrintDocument(claim, profile));
    w.document.close();
    w.addEventListener('load', () => {
      w.print();
      setTimeout(() => w.close(), 1500);
    });
  }
}
