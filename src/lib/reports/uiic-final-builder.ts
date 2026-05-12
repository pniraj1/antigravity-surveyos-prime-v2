/**
 * uiic-final-builder.ts
 *
 * Pixel-perfect port of the benchmark "UIIC main correct format.html"
 * buildUIICFinalHTML() + buildUIICBillCheckHTML() functions.
 *
 * Produces a self-contained 5-page print document:
 *   • Page 1: Policy / Claim / Vehicle / Reinspection Details
 *   • Page 2: Document Verification (3-column grid)
 *   • Pages 3-4: Loss Assessment Sheet + Assessment Detail Table
 *   • Page 5: GST Summary + Signatures + Service Hub block
 *
 * The output from triggerUIICFinalPrint() opens in a new window
 * and auto-prints — identical to Power Print in the Spot module.
 *
 * Gold standard reference: C:\Users\Manasi\OneDrive\Desktop\UIIC main correct format.html
 */

import type { ClaimData } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';
import { computeRowNet } from '@/lib/calculations/row-net';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

import { numberToWords, getVehicleAgeMonths, getSurveyorHeader, getSigBlock } from './report-utils';
import { getHtmlScale } from './report-style-utils';

// ─── HTML/PDF SYNC CHECKLIST ──────────────────────────────────────────────────
// Fields that must stay identical between this HTML builder and
// UIICReportDocument.tsx (React-PDF). Update both when changing these:
//   • vehicle: registrationNumber, makeModel, colour, fuelType, seatingCapacity,
//              chassisNumber, engineNumber, dateOfRegistration, yearOfManufacture
//   • policy: policyNumber, insuredName, sumInsured, coverageType, depreciationType
//   • accident: dateAndTime, place, natureOfAccident
//   • assessment table: parts, labour, paint rows + depreciation + GST + net assessed loss
//   • Document checklist (Page 2): all 3-column doc verification fields
//   • surveyor header / signature block (shared via report-utils.ts)
// ─────────────────────────────────────────────────────────────────────────────

// getDepRate has a different param order here (partType, ageMonths, depType) vs standard builder
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

// ─── Main UIIC Final HTML builder ─────────────────────────────────────────────

export function buildUIICFinalHTML(claim: ClaimData, profile: SurveyorProfile | null): string {
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

  // ── Font scale (resolved once, used throughout) ────────────────────────────
  const scale = getHtmlScale(claim.reportSettings?.fontScale);

  // ── Table style shorthands (matches benchmark exactly for compact scale) ───────
  const ts = `width:100%;border-collapse:collapse;font-size:${scale.cellFont};`;
  const B = 'border:0.5pt solid #000;';
  const td = B + `padding:${scale.cellPaddingV} ${scale.cellPaddingH};vertical-align:top;`;
  const tdl = td + `font-size:${scale.labelFont};color:#333;`;
  const tdb = td + 'font-weight:700;';
  const th = `background:#e8e8e8;${B}padding:${scale.cellPaddingV} ${scale.cellPaddingH};font-size:${scale.labelFont};font-weight:700;text-align:center;`;
  const sec = `background:#ddd;${B}padding:${scale.cellPaddingV} ${scale.cellPaddingH};font-weight:700;font-size:${scale.headingFont};text-transform:uppercase;`;

  // ── Calculations (ported from benchmark) ────────────────────────────────────
  let partsDepreciated = 0, rawParts = 0, labOnly = 0, paintOnly = 0, disposalNet = 0;
  const AP = rows.filter(r => r.section === 'parts');
  const AL = rows.filter(r => r.section === 'labour');
  const APT = rows.filter(r => r.section === 'paint');

  AP.forEach(r => {
    if (r.allowed !== false) {
      const dep = r.depOverride !== undefined ? r.depOverride : getDepRate(r.partType, ageMonths, depType);
      const { isDisposal, netBeforeGst } = computeRowNet(r, dep);
      if (isDisposal) {
        disposalNet += netBeforeGst;
      } else {
        partsDepreciated += netBeforeGst;
      }
      rawParts += r.assessed;
    }
  });
  AL.forEach(r => { if (r.allowed !== false) labOnly += r.assessed; });
  APT.forEach(r => { if (r.allowed !== false) paintOnly += r.assessed; });

  const labBase = labOnly + paintOnly;
  const pC = partsDepreciated * 0.09, pS = partsDepreciated * 0.09, pT = partsDepreciated + pC + pS + disposalNet;
  const lC = labBase * 0.09, lS = labBase * 0.09, lT = labBase + lC + lS;
  const tow = parseFloat(String(claim.feeBill?.travelExpenses || 0)) || 0; // towing mapped from travelExpenses or 0
  const gross = pT + lT + tow;
  const depAmt = rawParts - partsDepreciated;
  const salvage = claim.feeBill?.salvageValue || 0;
  const volExcess = claim.feeBill?.voluntaryExcess || 0;
  const compExcess = claim.feeBill?.compulsoryExcess || claim.feeBill?.lessExcess || 500;
  const net = Math.max(0, gross - salvage - volExcess - compExcess);
  const payableByInsured = volExcess + compExcess;
  const payableByInsurer = net;

  // ── PAGE 1: Policy / Claim / Vehicle / Survey / Reinspection details ────────
  const p1 = `
${getSurveyorHeader(profile)}
<div style="text-align:center;font-weight:700;font-size:9.5pt;border:1pt solid #000;padding:4px;margin-bottom:4px;background:#f0f0f0;">MOTOR SURVEY REPORT - ( FINAL/ RE INSPECTION)</div>
<table style="${ts}"><tr><td style="${tdl}width:25%;">Report Number:</td><td style="${tdb}width:25%;">${g(claim.reportNo)}</td><td style="${tdl}width:25%;">Date of report :</td><td style="${tdb}">${fd(claim.reportDate)}</td></tr></table>
<div style="${sec}">POLICY DETAILS</div>
<table style="${ts}">
<tr><td style="${tdl}width:25%;">Policy / Cover Note Number</td><td style="${td}width:25%;">${g(p.policyNumber)}</td><td style="${tdl}width:25%;">Claim no.</td><td style="${td}">${g(p.claimNumber)}</td></tr>
<tr><td style="${tdl}">Policy Start Date</td><td style="${td}">${fd(p.periodFrom)}</td><td style="${tdl}">Policy Expiry Date</td><td style="${td}">${fd(p.periodTo)}</td></tr>
</table>
<div style="${sec}">CLAIM DETAILS</div>
<table style="${ts}">
<tr><td style="${tdl}width:25%;">Claimant Name</td><td style="${tdb}width:25%;">${g(p.insuredName)}</td><td style="${tdl}width:25%;">Place of Accident / Theft</td><td style="${td}">${g(a.placeOfAccident)}</td></tr>
<tr><td style="${tdl}">Loss Date</td><td style="${td}">${fd(a.dateAndTime)}</td><td style="${tdl}">Insured Declared Value</td><td style="${tdb}">${fa(p.idv)}</td></tr>
<tr><td style="${tdl}">Policy Issuing Office Code</td><td style="${td}">${g(p.policyIssuingOffice)}</td><td style="${tdl}">Pincode of place of accident</td><td style="${td}">${g(a.pincode)}</td></tr>
<tr><td style="${tdl}">Policy issuing office address</td><td style="${td}" colspan="3">${g(p.appointingOffice)}</td></tr>
<tr><td style="${tdl}">Police Station</td><td style="${td}">${g(a.policeStation)}</td><td style="${tdl}">FIR / Diary No.</td><td style="${td}">${g(a.firNumber)}</td></tr>
<tr><td style="${tdl}">FIR Date</td><td style="${td}" colspan="3">${fd(a.firDate)}</td></tr>
</table>
<table style="${ts}"><tr><td style="${sec}width:50%;">INSURED / CLAIMANT DETAILS</td><td style="${sec}">SPOT SURVEY DETAILS</td></tr>
<tr><td style="${td}vertical-align:top;"><table style="width:100%;border-collapse:collapse;font-size:7pt;">
<tr><td style="padding:2px 3px;color:#333;width:40%;">Insured / Claimant Name &amp; Address</td><td style="padding:2px 3px;">${g(p.insuredName)}<br/>${g(p.insuredAddress)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">FINANCIER INTEREST</td><td style="padding:2px 3px;">${g(p.hpaWith || v.hypothecation) || 'NIL'}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Insured Contact Details</td><td style="padding:2px 3px;">${g(p.insuredMobile)}</td></tr>
</table></td><td style="${td}vertical-align:top;"><table style="width:100%;border-collapse:collapse;font-size:7pt;">
<tr><td style="padding:2px 3px;color:#333;width:50%;">Spot Survey Appointment Date</td><td style="padding:2px 3px;">${fd(sd.allotmentDate)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Spot Survey Date</td><td style="padding:2px 3px;">${fd(sd.surveyDatetime)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Spot Survey Report Date</td><td style="padding:2px 3px;">${fd(sd.reportDate)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Third Party Involved</td><td style="padding:2px 3px;">${g(a.thirdPartyDetails) || 'NIL'}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Type of TP Liability</td><td style="padding:2px 3px;"></td></tr>
</table></td></tr>
<tr><td style="${td}" colspan="2"><b>CAUSE OF ACCIDENT/ DETAILS OF DAMAGES</b><br/><span style="font-size:7pt;">${g(a.causeOfAccident) || '—'}</span></td></tr></table>
<table style="${ts}"><tr><td style="${sec}width:50%;">VEHICLE DETAILS</td><td style="${sec}">FINAL SURVEY DETAILS</td></tr>
<tr><td style="${td}vertical-align:top;"><table style="width:100%;border-collapse:collapse;font-size:7pt;">
<tr><td style="padding:2px 3px;color:#333;width:45%;">Registration Number</td><td style="padding:2px 3px;font-weight:700;">${g(v.registrationNumber)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Date of Registration</td><td style="padding:2px 3px;">${fd(v.dateOfRegistration)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Engine Number</td><td style="padding:2px 3px;font-family:monospace;">${g(v.engineNumber)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Chassis Serial number</td><td style="padding:2px 3px;font-family:monospace;">${g(v.chassisNumber)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Vehicle Make &amp; Model</td><td style="padding:2px 3px;font-weight:600;">${g(v.make)} / ${g(v.model)} / ${g(v.yearOfManufacture)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Vehicle Class</td><td style="padding:2px 3px;">${g(v.classOfVehicle || v.bodyType)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Vehicle Colour</td><td style="padding:2px 3px;">${g(v.colour)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Type of Body</td><td style="padding:2px 3px;">${g(v.bodyType)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Cubic Capacity</td><td style="padding:2px 3px;">${g(v.cubicCapacity)} CC</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Odometer Reading</td><td style="padding:2px 3px;">${g(v.odometer)} km</td></tr>
</table></td><td style="${td}vertical-align:top;"><table style="width:100%;border-collapse:collapse;font-size:7pt;">
<tr><td style="padding:2px 3px;color:#333;width:50%;">Final Survey Appointment Date</td><td style="padding:2px 3px;">${fd(a.appointmentDate)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Date of visits</td><td style="padding:2px 3px;">${fd(a.dateOfSurvey)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Place of Survey</td><td style="padding:2px 3px;">${g(a.placeOfSurvey)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Workshop Name</td><td style="padding:2px 3px;">${g(a.workshopName || sd.repairWorkshop)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Workshop Address</td><td style="padding:2px 3px;">${g(a.workshopAddress)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Workshop Empanelled</td><td style="padding:2px 3px;">NO</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Workshop Phone</td><td style="padding:2px 3px;">${g(a.workshopPhone)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Workshop Fax</td><td style="padding:2px 3px;">${g(a.workshopFax)}</td></tr>
<tr><td style="padding:2px 3px;color:#333;">Workshop E-Mail</td><td style="padding:2px 3px;">${g(a.workshopEmail)}</td></tr>
</table></td></tr></table>
<div style="${sec}">REINSPECTION SURVEY DETAILS</div>
<table style="${ts}"><tr><td style="${tdl}width:25%;">Reinspection appointment date</td><td style="${td}width:25%;">${fd(ri.riAppointmentDate || ri.date)}</td><td style="${tdl}width:25%;">Repair Authorisation Date</td><td style="${td}">${fd(ri.repairAuthDate)}</td></tr>
<tr><td style="${tdl}">Est. Repair Completion Date</td><td style="${td}">${fd(ri.estCompletionDate)}</td><td style="${tdl}">Actual Repair Completion Date</td><td style="${td}">${fd(ri.actualCompletionDate)}</td></tr>
<tr><td style="${tdl}">Workshop Final Invoice Date</td><td style="${td}">${fd(claim.billCheck?.billDate)}</td><td style="${tdl}">Bill Check finalisation date</td><td style="${td}">${fd(claim.billCheck?.billDate)}</td></tr>
<tr><td style="${tdl}">Repairs as per assessment</td><td style="${tdb}">${g(ri.repairsAsAssessed) || 'YES'}</td><td style="${tdl}">Remarks</td><td style="${td}font-size:7pt;">${g(ri.observations)}</td></tr></table>
<div style="font-size:7.5pt;margin-top:4px;"><b>SURVEYOR REMARKS</b><br/>${g(a.remarks) || 'The damages sustained by the vehicle were concurrent with the cause and nature of the accident.'}</div>`;

  // ── PAGE 2: Document Verification grid ──────────────────────────────────────
  const p2 = `<div style="page-break-before:always;"></div>
<div style="font-weight:700;font-size:9pt;text-align:center;">${nm}</div>
<div style="font-size:7pt;font-style:italic;">"ISSUED WITHOUT PREJUDICE"</div>
<div style="text-align:center;font-weight:700;font-size:9pt;margin:4px 0;">MOTOR SURVEY REPORT - (SPOT / FINAL / REINSPECTION)</div>
<div style="font-size:7pt;font-style:italic;margin-bottom:4px;">/ Report Issued Without Prejudice /</div>
<table style="${ts}">
<tr>
  <th style="${th}width:25%;">VEHICLE DOCUMENT NAME</th>
  <th style="${th}width:22%;">DOCUMENT PHOTOCOPY OBTAINED VERIFIED WITH ORIGINAL &amp; ATTESTED</th>
  <th style="${th}">DOCUMENT DETAILS</th>
</tr>
<tr>
  <td style="${tdb}">Vehicle Registration<br/>Certificate (RC Book)</td>
  <td style="${td}text-align:center;">${g(claim.documentVerification?.rc?.detail ? `${claim.documentVerification.rc.status} (${claim.documentVerification.rc.detail})` : claim.documentVerification?.rc?.status)}</td>
  <td style="padding:0;margin:0;vertical-align:top;border-bottom:1pt solid #000;">
    <table style="width:100%;border-collapse:collapse;font-size:7pt;">
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;width:55%;">Registration Type</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(v.registrationType || v.classOfVehicle)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Date of registration</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${fd(v.dateOfRegistration)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Registering Authority</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(v.registeringAuthority)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Registration valid up to</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${fd(v.registrationValidUpTo)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">RC endorsement on financier interest</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(v.rcEndorsement)}</td></tr>
      <tr><td colspan="2" style="background:#e8e8e8;text-align:center;font-weight:700;padding:3px 5px;border-bottom:0.5pt solid #000;">ADDITIONAL DETAILS - PASSENGER CARRYING VEHICLE</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Registered Seating Capacity</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(v.seatingCapacity)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Number of Passengers carried at the time of accident</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g((v as any).passengersAtAccident)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Type of passenger carried (Employee / Hire / Gratuitous)</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g((v as any).passengerType)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Whether Passengers carried in contravention of rule?</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g((v as any).passengersContravention)}</td></tr>
      <tr><td colspan="2" style="background:#e8e8e8;text-align:center;font-weight:700;padding:3px 5px;border-bottom:0.5pt solid #000;">ADDITIONAL DETAILS - GOODS CARRYING VEHICLE</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Registered Laden Weight</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(v.registeredLoadWeight || v.grossWeight)}</td></tr>
      <tr><td style="padding:3px 5px;border-right:0.5pt solid #000;">Registered Unladen Weight</td><td style="padding:3px 5px;">${g(v.unladenWeight)}</td></tr>
    </table>
  </td>
</tr>
<tr>
  <td style="${tdb}border-top:0;">Driving Licence</td>
  <td style="${td}text-align:center;border-top:0;">${g(claim.documentVerification?.dl?.detail ? `${claim.documentVerification.dl.status} (${claim.documentVerification.dl.detail})` : claim.documentVerification?.dl?.status)}</td>
  <td style="padding:0;margin:0;vertical-align:top;border-bottom:1pt solid #000;">
    <table style="width:100%;border-collapse:collapse;font-size:7pt;">
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;width:55%;">Name of Driving Licence Holder</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(d.name)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Driving Licence Number</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(d.licenceNumber)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Licence Type</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g((d as any).licenceType)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Class of vehicles licenced to drive</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(d.vehicleClasses)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Licence Issuing Authority</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(d.issuingAuthority)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Date of Issue of Licence</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${fd(d.dateOfIssue)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">License Valid upto</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${fd(d.validityNonTransport || d.validityTransport)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Badge number</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(d.badgeNumber)}</td></tr>

      <tr><td style="padding:3px 5px;border-right:0.5pt solid #000;">Date of verification of licence</td><td style="padding:3px 5px;">${fd(d.verificationDate)}</td></tr>
    </table>
  </td>
</tr>
<tr><td colspan="3" style="${td}border-top:0;padding:4px;">Complete additional information if applicable.</td></tr>
<tr>
  <td style="${tdb}border-top:0;">Road Permit</td>
  <td style="${td}text-align:center;border-top:0;">${g(claim.documentVerification?.permit?.detail ? `${claim.documentVerification.permit.status} (${claim.documentVerification.permit.detail})` : claim.documentVerification?.permit?.status)}</td>
  <td style="padding:0;margin:0;vertical-align:top;border-bottom:1pt solid #000;">
    <table style="width:100%;border-collapse:collapse;font-size:7pt;">
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;width:55%;">Nature of permit</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(sd.natureOfPermit)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Type of permit</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(sd.permitType)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Permit No</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(sd.permitNo)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Permit Valid upto</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${fd(sd.permitTo)}</td></tr>
      <tr><td style="padding:3px 5px;border-right:0.5pt solid #000;">Permitted area of operation</td><td style="padding:3px 5px;">${g(sd.areaOfOperation)}</td></tr>
    </table>
  </td>
</tr>
<tr>
  <td style="${tdb}border-top:0;">Load Challan and details of goods carried</td>
  <td style="${td}text-align:center;border-top:0;">${g(claim.documentVerification?.loadChallan?.detail ? `${claim.documentVerification.loadChallan.status} (${claim.documentVerification.loadChallan.detail})` : claim.documentVerification?.loadChallan?.status)}</td>
  <td style="padding:0;margin:0;vertical-align:top;border-bottom:1pt solid #000;">
    <table style="width:100%;border-collapse:collapse;font-size:7pt;">
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;width:55%;">Load Challan Number</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g((v as any).loadChallanNumber || sd.challanNo)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Load Challan Date</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${fd((v as any).loadChallanDate || sd.challanDate)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Weight of goods carried at the time of accident</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g((v as any).goodsWeightAtAccident || sd.actualLoad)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Details of goods carried at the time of accident</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g((v as any).detailsOfGoodsCarried || sd.loadDesc)}</td></tr>
      <tr><td style="padding:3px 5px;border-right:0.5pt solid #000;">Nature of goods carried</td><td style="padding:3px 5px;">${g((v as any).natureOfGoods)}</td></tr>
    </table>
  </td>
</tr>
<tr>
  <td style="${tdb}border-top:0;">Fitness certificate</td>
  <td style="${td}text-align:center;border-top:0;">${g(claim.documentVerification?.fitness?.detail ? `${claim.documentVerification.fitness.status} (${claim.documentVerification.fitness.detail})` : claim.documentVerification?.fitness?.status)}</td>
  <td style="padding:0;margin:0;vertical-align:top;border-bottom:1pt solid #000;">
    <table style="width:100%;border-collapse:collapse;font-size:7pt;">
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;width:55%;">Fitness certificate number</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(v.fitnessNo)}</td></tr>
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;">Valid upto date</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${fd(v.fitnessValidUpto)}</td></tr>
      <tr><td style="padding:3px 5px;border-right:0.5pt solid #000;">Type of fitness certificate</td><td style="padding:3px 5px;">${g(v.fitnessType || sd.fitnessType)}</td></tr>
    </table>
  </td>
</tr>
<tr>
  <td style="${tdb}border-top:0;">Fire Brigade Report (Fire Loss)</td>
  <td style="${td}text-align:center;border-top:0;">${g(claim.documentVerification?.fireReport?.detail ? `${claim.documentVerification.fireReport.status} (${claim.documentVerification.fireReport.detail})` : claim.documentVerification?.fireReport?.status)}</td>
  <td style="padding:0;margin:0;vertical-align:top;border-bottom:1pt solid #000;">
    <table style="width:100%;border-collapse:collapse;font-size:7pt;">
      <tr><td style="padding:3px 5px;border-right:0.5pt solid #000;width:55%;">FIR / Case Diary Numbe</td><td style="padding:3px 5px;">${g((a as any).fireBrigadeReportNo)}</td></tr>
    </table>
  </td>
</tr>
<tr>
  <td style="${tdb}border-top:0;">First Information Report (Third Party, Theft Loss &amp; Fire Loss only)</td>
  <td style="${td}text-align:center;border-top:0;">${g(claim.documentVerification?.fir?.detail ? `${claim.documentVerification.fir.status} (${claim.documentVerification.fir.detail})` : claim.documentVerification?.fir?.status)}</td>
  <td style="padding:0;margin:0;vertical-align:top;">
    <table style="width:100%;border-collapse:collapse;font-size:7pt;">
      <tr><td style="padding:3px 5px;border-bottom:0.5pt solid #000;border-right:0.5pt solid #000;width:55%;">Name of police station</td><td style="padding:3px 5px;border-bottom:0.5pt solid #000;">${g(a.policeStation)}</td></tr>
      <tr><td style="padding:3px 5px;border-right:0.5pt solid #000;">Date of FIR</td><td style="padding:3px 5px;">${fd(a.firDate)}</td></tr>
    </table>
  </td>
</tr>
</table>`;

  // ── PAGE 3-4: Assessment Detail (10-column table: Sr|Part Name|Part Type|Job Type|Part List W/o Tax|Dep%|Parts Assess|GST%|With GST|Labour) ───
  let sn = 1;
  const pHtml = AP.map(r => {
    const dep = r.depOverride !== undefined ? r.depOverride : getDepRate(r.partType, ageMonths, depType);
    const dL = r.depOverride !== undefined ? `${dep}%*` : (dep > 0 ? dep + '%' : 'N.D.');
    const isNA = r.allowed === false;
    const { isDisposal, afterDep, netBeforeGst } = isNA ? { isDisposal: false, afterDep: 0, netBeforeGst: 0 } : computeRowNet(r, dep);
    const wg = isNA ? 0 : isDisposal ? netBeforeGst : afterDep * 1.18;
    const wgLabel = isNA ? '' : isDisposal ? `${fa(netBeforeGst)} DISP` : fa(wg);
    const wgStyle = isDisposal ? `${td}text-align:right;color:#b45309;font-weight:600;` : `${td}text-align:right;`;
    const gstLabel = isNA ? '' : isDisposal ? '0' : '18';
    const pt = r.partType === 'metal' ? 'Metal' : r.partType === 'glass' ? 'Glass' : r.partType === 'fiberglass' ? 'Fibre Glass' : 'Plastic/Rubber';
    return `<tr><td style="${td}text-align:center;">${sn++}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">${isNA ? '' : pt}</td><td style="${td}text-align:center;">${isNA ? '' : 'Replace'}</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? '' : dL}</td><td style="${td}text-align:right;">${isNA ? '' : fa(afterDep)}</td><td style="${td}text-align:center;">${gstLabel}</td><td style="${wgStyle}">${wgLabel}</td><td style="${td}text-align:center;">${isNA ? 'Not<br/>Allowed' : ''}</td></tr>`;
  }).join('');

  let ln = 1;
  const lHtml = AL.map(r => {
    const isNA = r.allowed === false;
    return `<tr><td style="${td}text-align:center;">${ln++}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">N.D.</td><td style="${td}"></td><td style="${td}text-align:center;">18</td><td style="${td}text-align:right;">${isNA ? '' : fa(r.assessed)}</td><td style="${td}text-align:center;">${isNA ? 'Not<br/>Allowed' : ''}</td></tr>`;
  }).join('');

  const ptHtml = APT.filter(r => r.allowed !== false).map((r, i) =>
    `<tr><td style="${td}text-align:center;">${i + 1}</td><td style="${td}">${r.particulars}</td><td style="${td}text-align:center;">Labour</td><td style="${td}text-align:center;">Paint</td><td style="${td}text-align:right;">${fa(r.assessed)}</td><td style="${td}text-align:center;">N.D.</td><td style="${td}"></td><td style="${td}text-align:center;">18</td><td style="${td}"></td><td style="${td}text-align:right;">${fa(r.assessed)}</td></tr>`
  ).join('');

  const p3 = `<div style="page-break-before:always;"></div>
<div style="text-align:center; font-family:serif; font-weight:bold; font-size:9pt;">${nm}</div>
<div style="text-align:center;font-weight:700;font-size:9pt;margin-bottom:4px;">FINAL SURVEY REPORT<br/><span style="font-size:7pt;font-style:italic;">/ Report Issued Without Prejudice /</span></div>
<div style="${sec}">LOSS ASSESSMENT SHEET / WORK ORDER / BILL CHECK / CLAIM NOTE</div>
<table style="${ts}margin-bottom:3px;">
<tr><td style="${tdl}width:16%;">Cost of Parts</td><td style="${td}text-align:right;width:17%;">${fa(pT)}</td><td style="${tdl}width:17%;">Vehicle Type</td><td style="${td}width:16%;">${g(v.classOfVehicle || v.bodyType)}</td><td style="${tdl}width:17%;">Assessed Loss</td><td style="${td}text-align:right;width:17%;">${fa(gross)}</td></tr>
<tr><td style="${tdl}">Labour Charges</td><td style="${td}text-align:right;">${fa(labOnly * 1.18)}</td><td style="${tdl}" rowspan="3">Information to Insured regarding Assessment Present/SMS/Telephonic</td><td style="${td}" rowspan="3"></td><td style="${tdl}">Depreciation</td><td style="${td}text-align:right;">${fa(depAmt)}</td></tr>
<tr><td style="${tdl}">Painting Charges</td><td style="${td}text-align:right;">${fa(paintOnly * 1.18)}</td><td style="${tdl}">Salvage</td><td style="${td}text-align:right;">${fa(salvage)}</td></tr>
<tr><td style="${tdl}">Towing Charges</td><td style="${td}text-align:right;">${fa(tow)}</td><td style="${tdl}">Voluntary / Imposed Excess</td><td style="${td}text-align:right;">${fa(volExcess)}</td></tr>
<tr><td style="${tdl}">Gross Assessment</td><td style="${td}text-align:right;">${fa(gross)}</td><td style="${tdl}">Bill Check Done</td><td style="${td}text-align:center;">YES</td><td style="${tdl}">Compulsory Excess</td><td style="${td}text-align:right;">${fa(compExcess)}</td></tr>
<tr><td style="${tdl}">IDV</td><td style="${td}text-align:right;">${fa(p.idv)}</td><td style="${tdl}"></td><td style="${td}"></td><td style="${tdb}">Net Assessment</td><td style="${tdb}text-align:right;">${fa(net)}</td></tr>
<tr><td style="${tdl}">Odometer Reading</td><td style="${td}text-align:right;">${g(v.odometer)} km</td><td style="${tdl}">Reinspection Done</td><td style="${td}text-align:center;">YES</td><td style="${tdl}">Amount Payable by Insured</td><td style="${td}text-align:right;">${fa(payableByInsured)}</td></tr>
<tr><td style="${td}" colspan="4"></td><td style="${tdl}">Amount Payable by Insurer</td><td style="${td}text-align:right;">${fa(payableByInsurer)}</td></tr>
</table>
<div style="${sec}">DETAILS OF ASSESSMENT</div>
<table style="${ts}font-size:7pt;">
<thead><tr><th style="${th}">SR.</th><th style="${th}text-align:left;">Part Name</th><th style="${th}">Part<br/>Type</th><th style="${th}">Job<br/>Type</th><th style="${th}">Part List<br/>W/o Tax</th><th style="${th}">Dep%</th><th style="${th}">Parts<br/>Assess</th><th style="${th}">GST%</th><th style="${th}">With GST</th><th style="${th}">Labour</th></tr></thead><tbody>
<tr><td colspan="10" style="${sec}">SPARE PARTS</td></tr>${pHtml}
<tr><td colspan="10" style="${sec}">LABOUR</td></tr>${lHtml}
<tr><td colspan="10" style="${sec}">PAINTING CHARGES</td></tr>${ptHtml}
<tr style="font-weight:700;background:#eee;"><td colspan="4" style="${td}">SUB TOTAL</td><td style="${td}text-align:right;">${fa(rawParts)}</td><td style="${td}"></td><td style="${td}text-align:right;">${fa(partsDepreciated)}</td><td style="${td}"></td><td style="${td}text-align:right;">${fa(pT)}</td><td style="${td}text-align:right;">${fa(labBase)}</td></tr>
<tr><td colspan="6" style="${td}">TAX IN 18% for Labour</td><td style="${td}" colspan="2"></td><td style="${td}text-align:right;">${fa(labOnly)}</td><td style="${td}text-align:right;">${fa(paintOnly)}</td></tr>
<tr><td colspan="8" style="${td}font-weight:700;">NET TOTAL</td><td style="${td}text-align:right;font-weight:700;">${fa(labOnly * 1.18)}</td><td style="${td}text-align:right;font-weight:700;">${fa(paintOnly * 1.18)}</td></tr>
</tbody></table>`;

  // ── PAGE 5: GST Summary + Signatures ────────────────────────────────────────
  const p5 = `<div style="page-break-before:always;"></div>
<div style="text-align:center; font-family:serif; font-weight:bold; font-size:9pt;">${nm}</div>
<div style="font-weight:700;font-size:8.5pt;margin:6px 0 3px;">GST SUMMARY</div>
<table style="${ts}"><tr><th style="${th}">S.N.</th><th style="${th}">HSN CODE</th><th style="${th}">DEPRECIATED AMOUNT</th><th style="${th}">CGST</th><th style="${th}">SGST</th><th style="${th}">AMOUNT</th></tr>
<tr><td style="${td}"></td><td style="${td}">(Part) 18.00</td><td style="${td}text-align:right;">${fa(partsDepreciated)}</td><td style="${td}text-align:right;">${fa(pC)}</td><td style="${td}text-align:right;">${fa(pS)}</td><td style="${td}text-align:right;font-weight:700;">${fa(pT)}</td></tr>
<tr style="font-weight:700;"><td style="${td}" colspan="2">GRAND TOTAL</td><td style="${td}text-align:right;">${fa(partsDepreciated)}</td><td style="${td}text-align:right;">${fa(pC)}</td><td style="${td}text-align:right;">${fa(pS)}</td><td style="${td}text-align:right;">${fa(pT)}</td></tr></table>
<table style="${ts}margin-top:4px;"><tr><th style="${th}">S.N.</th><th style="${th}">SERVICE ACCOUNTING CODE</th><th style="${th}">AMOUNT</th><th style="${th}">CGST</th><th style="${th}">SGST</th><th style="${th}">AMOUNT</th></tr>
<tr><td style="${td}"></td><td style="${td}">(Labour) 18.00</td><td style="${td}text-align:right;">${fa(labBase)}</td><td style="${td}text-align:right;">${fa(lC)}</td><td style="${td}text-align:right;">${fa(lS)}</td><td style="${td}text-align:right;font-weight:700;">${fa(lT)}</td></tr>
<tr style="font-weight:700;"><td style="${td}" colspan="2">GRAND TOTAL</td><td style="${td}text-align:right;">${fa(labBase)}</td><td style="${td}text-align:right;">${fa(lC)}</td><td style="${td}text-align:right;">${fa(lS)}</td><td style="${td}text-align:right;">${fa(lT)}</td></tr></table>
<div style="display:flex;justify-content:space-between;margin-top:14px;font-size:7.5pt;">
<div style="width:45%;"><div>I / We hereby authorize repairs for Rs. <b>${Math.round(net)}</b></div><div style="margin-top:30px;">Date:</div><div style="margin-top:40px;border-top:0.5pt solid #000;padding-top:3px;">Signature (...Surveyor &amp; Loss Assessor)</div></div>
<div style="width:45%;text-align:right;"><div>I agree with the assessment of the surveyor. Repair will be complete by _______ (date).</div><div style="margin-top:30px;">Date:</div><div style="margin-top:40px;border-top:0.5pt solid #000;padding-top:3px;">Signature of authorised official of workshop</div></div></div>
${getSigBlock(profile)}
<div style="text-align:center;font-weight:700;font-size:8pt;border-top:1pt solid #000;padding-top:4px;margin-top:12px;">FOR SERVICE HUB USE</div>
<div style="font-size:7pt;line-height:1.6;margin-top:3px;">Claim documents are in order. Liability under the policy is confirmed. Bill check and reinspection is carried out. The loss assessment is in order and claim is recommended for Rs. ${fa(net)}</div>
<div style="font-size:7pt;">NOTE:- BILL CHECK REPORT AS PER ASSESSMENT SHEET.</div>
<div style="display:flex;justify-content:space-between;margin-top:16px;font-size:7pt;"><div>Signature of Claims Personnel<br/>Date</div><div>Signature of Claims Officer<br/>Date:</div><div>Signature of Claims Officer approving claim<br/>Date:</div></div>
<div style="text-align:center; font-family:serif; font-weight:bold; font-size:9pt; margin-top:14px;">${nm}</div>
<div style="font-size:6.5pt;color:#666;margin-top:4px;border-top:0.4pt solid #ccc;padding-top:2px;">In words: RUPEES ${numberToWords(net)} ONLY</div>`;

  return p1 + p2 + p3 + p5;
}

// ─── Wrap in a full printable A4 HTML document ────────────────────────────────

export function buildUIICFinalPrintDocument(claim: ClaimData, profile: SurveyorProfile | null): string {
  const body = buildUIICFinalHTML(claim, profile);
  const regNo = claim.vehicle?.registrationNumber || 'DRAFT';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>UIIC Final Survey Report — ${regNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      background: #525659;
      color: #000;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm 12mm;
      background: #fff;
      margin: 10mm auto;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm 12mm;
      }
      body {
        background: none;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        margin: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        min-height: auto !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    ${body}
  </div>
</body>
</html>`;
}

// ─── Trigger the print window ─────────────────────────────────────────────────

export function triggerUIICFinalPrint(claim: ClaimData, profile: SurveyorProfile | null): void {
  const html = buildUIICFinalPrintDocument(claim, profile);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Popup blocked — please allow popups for this site and try again.');
    return;
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 600);
}

// ══════════════════════════════════════════════════════════════════════════════
// BILL CHECK REPORT BUILDER
// Produces a UIIC-style Bill Check Report using only *allowed* items.
// Serial numbers are preserved from the original Full Survey assessment table.
// ══════════════════════════════════════════════════════════════════════════════

export function buildUIICBillCheckHTML(claim: ClaimData, profile: SurveyorProfile | null): string {
  const v = claim.vehicle;
  const p = claim.policy;
  const a = claim.accident;
  const ri = claim.reinspection;
  const bc = claim.billCheck;
  const rows = claim.assessmentRows || [];
  const depType = claim.depreciationType || 'standard';
  const nm = profile?.name || 'SURVEYOR NAME';

  const ageMonths = getVehicleAgeMonths(
    v.dateOfRegistration || null,
    v.yearOfManufacture ? Number(v.yearOfManufacture) : null,
    a.dateAndTime || null
  );

  // Table style shorthands — same as final builder
  const ts = 'width:100%;border-collapse:collapse;font-size:8pt;';
  const B = 'border:0.5pt solid #000;';
  const td = B + 'padding:3px 5px;vertical-align:top;';
  const tdl = td + 'font-size:7pt;color:#333;';
  const tdb = td + 'font-weight:700;';
  const th = 'background:#e8e8e8;' + B + 'padding:3px 5px;font-size:7pt;font-weight:700;text-align:center;';
  const sec = 'background:#ddd;' + B + 'padding:3px 5px;font-weight:700;font-size:7.5pt;text-transform:uppercase;';

  // ── Collect ONLY allowed rows, grouped by section, but keep original Sr# ───
  const allParts   = rows.filter(r => r.section === 'parts');
  const allLabour  = rows.filter(r => r.section === 'labour');
  const allPaint   = rows.filter(r => r.section === 'paint');

  const allowedParts  = allParts.filter(r => r.allowed !== false);
  const allowedLabour = allLabour.filter(r => r.allowed !== false);
  const allowedPaint  = allPaint.filter(r => r.allowed !== false);

  // ── Calculations using only allowed rows ────────────────────────────────────
  let partsDepreciated = 0, rawParts = 0, labOnly = 0, paintOnly = 0, disposalNet = 0;
  let billedPartsTotal = 0, billedLabourTotal = 0, billedPaintTotal = 0;

  allowedParts.forEach(r => {
    const dep = r.depOverride !== undefined ? r.depOverride : getDepRate(r.partType, ageMonths, depType);
    const { isDisposal, netBeforeGst, afterDep } = computeRowNet(r, dep);
    if (isDisposal) {
      disposalNet += netBeforeGst;
    } else {
      partsDepreciated += netBeforeGst;
    }
    rawParts += r.assessed;
    billedPartsTotal += r.billedAmount ?? afterDep;
  });
  allowedLabour.forEach(r => {
    labOnly += r.assessed;
    billedLabourTotal += r.billedAmount ?? r.assessed;
  });
  allowedPaint.forEach(r => {
    paintOnly += r.assessed;
    billedPaintTotal += r.billedAmount ?? r.assessed;
  });

  const pC = partsDepreciated * 0.09, pS = partsDepreciated * 0.09, pT = partsDepreciated + pC + pS + disposalNet;
  const labBase = labOnly + paintOnly;
  const lC = labBase * 0.09, lS = labBase * 0.09, lT = labBase + lC + lS;
  const tow = parseFloat(String(claim.feeBill?.travelExpenses || 0)) || 0;
  const gross = pT + lT + tow;
  const depAmt = rawParts - partsDepreciated;
  const salvage    = claim.feeBill?.salvageValue    || 0;
  const volExcess  = claim.feeBill?.voluntaryExcess || 0;
  const compExcess = claim.feeBill?.compulsoryExcess || claim.feeBill?.lessExcess || 500;
  const net = Math.max(0, gross - salvage - volExcess - compExcess);

  // Billed totals (what the workshop actually billed)
  const billedPartsTotalWithGST = billedPartsTotal * 1.18;
  const billedLabourTotalWithGST = (billedLabourTotal + billedPaintTotal) * 1.18;
  const totalBilled = billedPartsTotalWithGST + billedLabourTotalWithGST + tow;
  const netBilledLiability = Math.max(0, totalBilled - salvage - volExcess - compExcess);

  // ── Helper: find original Sr# of row in full parts / labour / paint list ────
  function partsSrNo(rowId: string): number {
    return allParts.findIndex(r => r.id === rowId) + 1;
  }
  function labourSrNo(rowId: string): number {
    return allLabour.findIndex(r => r.id === rowId) + 1;
  }
  function paintSrNo(rowId: string): number {
    return allPaint.findIndex(r => r.id === rowId) + 1;
  }

  function billStatusLabel(s: string | undefined): string {
    if (s === 'in-bill')     return 'IN BILL';
    if (s === 'not-in-bill') return 'NOT IN BILL';
    if (s === 'partial')     return 'PARTIAL';
    return 'PENDING';
  }

  // ── PARTS ROWS ───────────────────────────────────────────────────────────────
  const pHtml = allowedParts.map(r => {
    const dep = r.depOverride !== undefined ? r.depOverride : getDepRate(r.partType, ageMonths, depType);
    const dL = r.depOverride !== undefined ? `${dep}%*` : (dep > 0 ? dep + '%' : 'N.D.');
    const { isDisposal, afterDep, netBeforeGst } = computeRowNet(r, dep);
    const billed = r.billedAmount ?? afterDep;
    const srNo   = partsSrNo(r.id);
    const pt = r.partType === 'metal' ? 'Metal' : r.partType === 'glass' ? 'Glass' : r.partType === 'fiberglass' ? 'Fibre Glass' : 'Plastic/Rubber';
    const stColor = r.billStatus === 'in-bill' ? '#065f46' : r.billStatus === 'not-in-bill' ? '#991b1b' : r.billStatus === 'partial' ? '#92400e' : '#374151';
    const netLabel = isDisposal ? `${fa(netBeforeGst)} DISP` : fa(afterDep);
    const netStyle = isDisposal ? `${td}text-align:right;color:#b45309;font-weight:600;` : `${td}text-align:right;`;
    return `<tr>
      <td style="${td}text-align:center;">${srNo}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">${pt}</td>
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
      <td style="${td}text-align:center;">${dL}</td>
      <td style="${netStyle}">${netLabel}</td>
      <td style="${td}text-align:right;">${fa(billed)}</td>
      <td style="${td}text-align:center;font-weight:700;color:${stColor};font-size:6.5pt;">${billStatusLabel(r.billStatus)}</td>
      <td style="${td}font-size:6.5pt;color:#555;">${r.billRemarks || ''}</td>
    </tr>`;
  }).join('');

  // ── LABOUR ROWS ──────────────────────────────────────────────────────────────
  const lHtml = allowedLabour.map(r => {
    const billed = r.billedAmount ?? r.assessed;
    const srNo   = labourSrNo(r.id);
    const stColor = r.billStatus === 'in-bill' ? '#065f46' : r.billStatus === 'not-in-bill' ? '#991b1b' : r.billStatus === 'partial' ? '#92400e' : '#374151';
    return `<tr>
      <td style="${td}text-align:center;">${srNo}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Labour</td>
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
      <td style="${td}text-align:center;">N.D.</td>
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
      <td style="${td}text-align:right;">${fa(billed)}</td>
      <td style="${td}text-align:center;font-weight:700;color:${stColor};font-size:6.5pt;">${billStatusLabel(r.billStatus)}</td>
      <td style="${td}font-size:6.5pt;color:#555;">${r.billRemarks || ''}</td>
    </tr>`;
  }).join('');

  // ── PAINT ROWS ───────────────────────────────────────────────────────────────
  const ptHtml = allowedPaint.map(r => {
    const billed = r.billedAmount ?? r.assessed;
    const srNo   = paintSrNo(r.id);
    const stColor = r.billStatus === 'in-bill' ? '#065f46' : r.billStatus === 'not-in-bill' ? '#991b1b' : r.billStatus === 'partial' ? '#92400e' : '#374151';
    return `<tr>
      <td style="${td}text-align:center;">${srNo}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Paint</td>
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
      <td style="${td}text-align:center;">N.D.</td>
      <td style="${td}text-align:right;">${fa(r.assessed)}</td>
      <td style="${td}text-align:right;">${fa(billed)}</td>
      <td style="${td}text-align:center;font-weight:700;color:${stColor};font-size:6.5pt;">${billStatusLabel(r.billStatus)}</td>
      <td style="${td}font-size:6.5pt;color:#555;">${r.billRemarks || ''}</td>
    </tr>`;
  }).join('');

  // ── PAGE 1: Header + Assessment Summary ─────────────────────────────────────
  const page1 = `
${getSurveyorHeader(profile)}
<div style="font-weight:700;font-size:9pt;text-align:right;margin-bottom:2px;">${nm}</div>
<div style="text-align:center;font-weight:700;font-size:9.5pt;border:1pt solid #000;padding:4px;margin-bottom:4px;background:#f0f0f0;">BILL CHECK REPORT — MOTOR SURVEY (FINAL)</div>

${claim.isTotalLoss && claim.totalLossDetails ? (() => {
  const idv = parseFloat(String(claim.policy?.idv || '0').replace(/,/g, '')) || 0;
  const totalExcess = compExcess + volExcess;
  const tlLiability = Math.max(0, idv - totalExcess);
  const netWithRC = Math.max(0, tlLiability - (claim.totalLossDetails.salvageWithRC || 0));
  const netWithoutRC = Math.max(0, tlLiability - (claim.totalLossDetails.salvageWithoutRC || 0));
  const repairBasis = net;

  return `
    <div style="margin-top:10px; margin-bottom:15px; border:1pt solid #006838; border-radius:4px; overflow:hidden;">
      <div style="background:#006838; color:#fff; font-weight:900; font-size:8pt; padding:6px; text-align:center; letter-spacing:1px;">
        COMPARISON OF INSURER'S LIABILITY (TOTAL LOSS ASSESSMENT)
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:7.5pt;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="${th}text-align:left;color:#006838;">DESCRIPTION</th>
            <th style="${th}width:18%;text-align:right;">REPAIR BASIS</th>
            <th style="${th}width:18%;text-align:right;">TOTAL LOSS</th>
            <th style="${th}width:18%;text-align:right;">NET LOSS (W/RC)</th>
            <th style="${th}width:18%;text-align:right;">NET LOSS (W/O RC)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="${td}font-weight:700;">Insured Declared Value (IDV)</td>
            <td style="${td}text-align:right;color:#666;">-</td>
            <td style="${td}text-align:right;font-weight:700;">${fa(idv)}</td>
            <td style="${td}text-align:right;font-weight:700;">${fa(idv)}</td>
            <td style="${td}text-align:right;font-weight:700;">${fa(idv)}</td>
          </tr>
          <tr>
            <td style="${td}color:#666;">Less: Compulsory/Vol. Excess</td>
            <td style="${td}text-align:right;color:#666;">-</td>
            <td style="${td}text-align:right;color:#b91c1c;">- ${fa(totalExcess)}</td>
            <td style="${td}text-align:right;color:#b91c1c;">- ${fa(totalExcess)}</td>
            <td style="${td}text-align:right;color:#b91c1c;">- ${fa(totalExcess)}</td>
          </tr>
          <tr>
            <td style="${td}color:#666;">Less: Salvage Value</td>
            <td style="${td}text-align:right;color:#666;">-</td>
            <td style="${td}text-align:right;color:#666;">-</td>
            <td style="${td}text-align:right;color:#b91c1c;">- ${fa(claim.totalLossDetails.salvageWithRC)}</td>
            <td style="${td}text-align:right;color:#b91c1c;">- ${fa(claim.totalLossDetails.salvageWithoutRC)}</td>
          </tr>
          <tr>
            <td style="${td}color:#666;">Add: Towing / Workshop Expenses</td>
            <td style="${td}text-align:right;color:#666;">-</td>
            <td style="${td}text-align:right;color:#065f46;">+ ${fa((claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
            <td style="${td}text-align:right;color:#065f46;">+ ${fa((claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
            <td style="${td}text-align:right;color:#065f46;">+ ${fa((claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
          </tr>
          <tr style="background:#f0fdf4;">
            <td style="${td}font-weight:900;color:#006838;font-size:8pt;">NET PAYABLE LIABILITY</td>
            <td style="${td}text-align:right;font-weight:900;font-size:8pt;border-top:1pt solid #006838;">₹ ${fa(repairBasis)}</td>
            <td style="${td}text-align:right;font-weight:900;font-size:8pt;border-top:1pt solid #006838;">₹ ${fa(tlLiability + (claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
            <td style="${td}text-align:right;font-weight:900;font-size:8pt;border-top:1pt solid #006838;background:#dcfce7;">₹ ${fa(netWithRC + (claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
            <td style="${td}text-align:right;font-weight:900;font-size:8pt;border-top:1pt solid #006838;">₹ ${fa(netWithoutRC + (claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
          </tr>
        </tbody>
      </table>
      <div style="padding:8px; font-size:7pt; color:#444; border-top:1pt dashed #006838; background:rgba(0,104,56,0.02); line-height:1.4;">
        <div style="color:#006838; font-weight:900; margin-bottom:3px; font-size:6.5pt; text-transform:uppercase; letter-spacing:0.5px;">Surveyor's Observation / Recommendation:</div>
        ${claim.totalLossDetails.remarks || `Since the repair cost is significant relative to the IDV, the Insurer may opt for the most economical settlement mode as per the above comparison.`} 
        <div style="margin-top:4px; font-style:italic; font-size:6.5pt; color:#666;">
          * Expenses for towing (₹${fa(claim.totalLossDetails.towingExpenses)}) and workshop storage (₹${fa(claim.totalLossDetails.workshopRent)}) are added to TL/Net estimates if applicable.
        </div>
      </div>
    </div>
  `;
})() : ''}
<table style="${ts}"><tr><td style="${tdl}width:25%;">Report Number:</td><td style="${tdb}width:25%;">${g(claim.reportNo)}</td><td style="${tdl}width:25%;">Report Date:</td><td style="${tdb}">${fd(claim.reportDate)}</td></tr>
<tr><td style="${tdl}">Bill / Invoice No.:</td><td style="${tdb}">${g(bc?.billNo)}</td><td style="${tdl}">Bill / Invoice Date:</td><td style="${tdb}">${fd(bc?.billDate)}</td></tr></table>

<div style="${sec}">POLICY &amp; CLAIM DETAILS</div>
<table style="${ts}">
<tr><td style="${tdl}width:25%;">Policy No.</td><td style="${td}width:25%;">${g(p.policyNumber)}</td><td style="${tdl}width:25%;">Claim No.</td><td style="${td}">${g(p.claimNumber)}</td></tr>
<tr><td style="${tdl}">Insured Name</td><td style="${tdb}">${g(p.insuredName)}</td><td style="${tdl}">Vehicle Reg. No.</td><td style="${tdb}">${g(v.registrationNumber)}</td></tr>
<tr><td style="${tdl}">Vehicle Make / Model</td><td style="${td}">${g(v.make)} ${g(v.model)} (${g(v.yearOfManufacture)})</td><td style="${tdl}">Chassis No.</td><td style="${td}">${g(v.chassisNumber)}</td></tr>
<tr><td style="${tdl}">Date of Accident</td><td style="${td}">${fd(a.dateAndTime)}</td><td style="${tdl}">IDV</td><td style="${tdb}">₹ ${fa(p.idv)}</td></tr>
</table>

<div style="${sec}">BILL CHECK REFERENCE</div>
<table style="${ts}">
<tr><td style="${tdl}width:25%;">Final Survey Appt. Date</td><td style="${td}width:25%;">${fd(a.appointmentDate)}</td><td style="${tdl}width:25%;">Repair Auth. Date</td><td style="${td}">${fd(ri?.repairAuthDate)}</td></tr>
<tr><td style="${tdl}">Date of Final Survey</td><td style="${td}">${fd(a.dateOfSurvey)}</td><td style="${tdl}">Actual Repair Completion</td><td style="${td}">${fd(ri?.actualCompletionDate)}</td></tr>
<tr><td style="${tdl}">Workshop Name</td><td style="${td}">${g(a.workshopName)}</td><td style="${tdl}">Bill Check Date</td><td style="${tdb}">${fd(bc?.billDate)}</td></tr>
<tr><td style="${tdl}">Workshop Invoice Total (₹)</td><td style="${tdb}">${fa(bc?.billTotal || 0)}</td><td style="${tdl}">Repairs As Per Assessment</td><td style="${tdb}">${g(ri?.repairsAsAssessed) || 'YES'}</td></tr>
</table>

<div style="${sec}">LOSS ASSESSMENT SUMMARY — ALLOWED ITEMS ONLY</div>
<table style="${ts}margin-bottom:3px;">
<tr><td style="${tdl}width:16%;">Cost of Parts (Assessed)</td><td style="${td}text-align:right;width:17%;">${fa(pT)}</td><td style="${tdl}width:17%;">Vehicle Type</td><td style="${td}width:16%;">${g(v.classOfVehicle || v.bodyType)}</td><td style="${tdl}width:17%;">Assessed Loss</td><td style="${td}text-align:right;width:17%;">${fa(gross)}</td></tr>
<tr><td style="${tdl}">Labour Charges (Assessed)</td><td style="${td}text-align:right;">${fa(labOnly * 1.18)}</td><td style="${tdl}"></td><td style="${td}"></td><td style="${tdl}">Depreciation</td><td style="${td}text-align:right;">${fa(depAmt)}</td></tr>
<tr><td style="${tdl}">Painting Charges (Assessed)</td><td style="${td}text-align:right;">${fa(paintOnly * 1.18)}</td><td style="${tdl}"></td><td style="${td}"></td><td style="${tdl}">Salvage</td><td style="${td}text-align:right;">${fa(salvage)}</td></tr>
<tr><td style="${tdl}">Total Billed by Workshop</td><td style="${td}text-align:right;font-weight:700;">${fa(totalBilled)}</td><td style="${tdl}"></td><td style="${td}"></td><td style="${tdl}">Voluntary / Imposed Excess</td><td style="${td}text-align:right;">${fa(volExcess)}</td></tr>
<tr><td style="${tdl}">Gross Assessment</td><td style="${td}text-align:right;">${fa(gross)}</td><td style="${tdl}"></td><td style="${td}"></td><td style="${tdl}">Compulsory Excess</td><td style="${td}text-align:right;">${fa(compExcess)}</td></tr>
<tr><td style="${tdl}">IDV</td><td style="${td}text-align:right;">${fa(p.idv)}</td><td style="${tdl}">Bill Check Done</td><td style="${td}text-align:center;">YES</td><td style="${tdb}">Net Liability (Billed)</td><td style="${tdb}text-align:right;">${fa(netBilledLiability)}</td></tr>
</table>`;

  // ── PAGE 2: Bill Check Item Table ───────────────────────────────────────────
  const page2 = `<div style="page-break-before:always;"></div>
<div style="text-align:center;font-family:serif;font-weight:bold;font-size:9pt;">${nm}</div>
<div style="text-align:center;font-weight:700;font-size:9pt;margin:4px 0;">BILL CHECK REPORT<br/><span style="font-size:7pt;font-style:italic;">/ Report Issued Without Prejudice /</span></div>
<div style="font-size:7pt;margin-bottom:2px;">Reg No: <b>${g(v.registrationNumber)}</b> &nbsp;|&nbsp; Claim: <b>${g(p.claimNumber)}</b> &nbsp;|&nbsp; Insured: <b>${g(p.insuredName)}</b> &nbsp;|&nbsp; Bill No: <b>${g(bc?.billNo)}</b> &nbsp;|&nbsp; Bill Date: <b>${fd(bc?.billDate)}</b></div>
<div style="${sec}">DETAILS OF BILL CHECK — ALLOWED ITEMS ONLY (Disallowed items excluded)</div>
<table style="${ts}font-size:7pt;">
<thead><tr>
  <th style="${th}width:4%;">SR.</th>
  <th style="${th}text-align:left;width:24%;">Part / Labour Description</th>
  <th style="${th}width:9%;">Type</th>
  <th style="${th}width:10%;">Assessed<br/>Amount (₹)</th>
  <th style="${th}width:5%;">Dep%</th>
  <th style="${th}width:10%;">Assessed<br/>After Dep (₹)</th>
  <th style="${th}width:10%;">Billed<br/>Amount (₹)</th>
  <th style="${th}width:10%;">Bill Status</th>
  <th style="${th}width:18%;">Remarks</th>
</tr></thead>
<tbody>
<tr><td colspan="9" style="${sec}">SPARE PARTS</td></tr>
${pHtml || `<tr><td colspan="9" style="${td}text-align:center;color:#999;font-style:italic;">No parts in allowed items</td></tr>`}
<tr style="font-weight:700;background:#eee;">
  <td colspan="3" style="${td}">PARTS SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(rawParts)}</td>
  <td style="${td}"></td>
  <td style="${td}text-align:right;">${fa(partsDepreciated)}</td>
  <td style="${td}text-align:right;">${fa(billedPartsTotal)}</td>
  <td colspan="2" style="${td}"></td>
</tr>
<tr><td colspan="9" style="${sec}">LABOUR</td></tr>
${lHtml || `<tr><td colspan="9" style="${td}text-align:center;color:#999;font-style:italic;">No labour in allowed items</td></tr>`}
<tr><td colspan="9" style="${sec}">PAINTING CHARGES</td></tr>
${ptHtml || `<tr><td colspan="9" style="${td}text-align:center;color:#999;font-style:italic;">No painting in allowed items</td></tr>`}
<tr style="font-weight:700;background:#eee;">
  <td colspan="3" style="${td}">LABOUR + PAINTING SUB TOTAL</td>
  <td style="${td}text-align:right;">${fa(labBase)}</td>
  <td style="${td}"></td>
  <td style="${td}text-align:right;">${fa(labBase)}</td>
  <td style="${td}text-align:right;">${fa(billedLabourTotal + billedPaintTotal)}</td>
  <td colspan="2" style="${td}"></td>
</tr>
</tbody>
</table>

<div style="display:flex;justify-content:flex-end;margin-top:6px;">
<table style="border-collapse:collapse;font-size:7.5pt;min-width:280px;">
  <tr><td style="${tdl}">Total Assessed (After Dep + GST)</td><td style="${tdb}text-align:right;">₹ ${fa(gross)}</td></tr>
  <tr><td style="${tdl}">Total Billed by Workshop</td><td style="${tdb}text-align:right;">₹ ${fa(totalBilled)}</td></tr>
  <tr><td style="${tdl}">Less: Salvage</td><td style="${td}text-align:right;">₹ ${fa(salvage)}</td></tr>
  <tr><td style="${tdl}">Less: Voluntary / Imposed Excess</td><td style="${td}text-align:right;">₹ ${fa(volExcess)}</td></tr>
  <tr><td style="${tdl}">Less: Compulsory Excess</td><td style="${td}text-align:right;">₹ ${fa(compExcess)}</td></tr>
  <tr style="background:#0D1B2A;">
    <td style="border:0.5pt solid #000;padding:4px 6px;font-weight:700;font-size:8pt;color:#fff;">NET LIABILITY (PAYABLE TO WORKSHOP)</td>
    <td style="border:0.5pt solid #000;padding:4px 6px;font-weight:700;font-size:9pt;color:#F59E0B;text-align:right;">₹ ${fa(netBilledLiability)}</td>
  </tr>
</table>
</div>

<div style="font-size:6.5pt;color:#555;margin-top:4px;border-top:0.4pt solid #ccc;padding-top:2px;">
  In words: RUPEES ${numberToWords(Math.round(netBilledLiability))} ONLY
</div>

${getSigBlock(profile)}

<div style="text-align:center;font-weight:700;font-size:8pt;border-top:1pt solid #000;padding-top:4px;margin-top:12px;">FOR SERVICE HUB USE</div>
<div style="font-size:7pt;line-height:1.6;margin-top:3px;">
  Bill check is carried out. All disallowed items have been excluded. Only allowed items as per Final Survey Report are reflected. Net liability confirmed at Rs. ${fa(netBilledLiability)}.
</div>
<div style="font-size:7pt;">NOTE:- BILL CHECK REPORT AS PER ASSESSMENT SHEET — DISALLOWED ITEMS NOT INCLUDED.</div>
<div style="display:flex;justify-content:space-between;margin-top:16px;font-size:7pt;">
  <div>Signature of Claims Personnel<br/>Date</div>
  <div>Signature of Claims Officer<br/>Date:</div>
  <div>Signature of Claims Officer approving claim<br/>Date:</div>
</div>
<div style="text-align:center;font-family:serif;font-weight:bold;font-size:9pt;margin-top:14px;">${nm}</div>`;

  return page1 + page2;
}

// ─── Wrap Bill Check in a full printable A4 HTML document ─────────────────────

export function buildUIICBillCheckPrintDocument(claim: ClaimData, profile: SurveyorProfile | null): string {
  const body = buildUIICBillCheckHTML(claim, profile);
  const regNo = claim.vehicle?.registrationNumber || 'DRAFT';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bill Check Report — ${regNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      background: #525659;
      color: #000;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm 12mm;
      background: #fff;
      margin: 10mm auto;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm 12mm;
      }
      body {
        background: none;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        margin: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        min-height: auto !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    ${body}
  </div>
</body>
</html>`;
}

// ─── Trigger Bill Check print window ─────────────────────────────────────────

export function triggerUIICBillCheckPrint(claim: ClaimData, profile: SurveyorProfile | null): void {
  const html = buildUIICBillCheckPrintDocument(claim, profile);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Popup blocked — please allow popups for this site and try again.');
    return;
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 600);
}
