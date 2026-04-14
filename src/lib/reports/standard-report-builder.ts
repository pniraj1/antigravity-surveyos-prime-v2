/**
 * standard-report-builder.ts
 *
 * Generates the Standard Motor Final Survey Report as a self-contained HTML
 * string, opened via window.open() → window.print() for pixel-perfect PDF output.
 *
 * Ported from the reference "UIIC format.html" benchmark. The desktop file
 * (UIIC format.html) is never modified — it remains the gold-standard reference.
 */

import type { ClaimData } from '@/types/claim';
import type { AssessmentSummary } from '@/types';
import type { SurveyorProfile } from '@/types/vehicle';

import { formatDateDMY, formatDateTimeDMY, fa, numberToWords, getVehicleAgeMonths, getSurveyorHeader, getSigBlock } from './report-utils';

// ─── HTML/PDF SYNC CHECKLIST ──────────────────────────────────────────────────
// Fields that must stay identical between this HTML builder and
// SurveyReportDocument.tsx (React-PDF). Update both when changing these:
//   • vehicle: registrationNumber, makeModel, yearOfManufacture, dateOfRegistration,
//              engineNumber, chassisNumber, colour, fuelType, seatingCapacity
//   • policy: policyNumber, insuredName, sumInsured, dateOfExpiry, depreciationType
//   • accident: dateAndTime, place, natureOfAccident
//   • assessment: parts, labour, paint rows + depreciation + GST totals
//   • surveyor header / signature block (shared via report-utils.ts)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Local Helpers ────────────────────────────────────────────────────────────

function fmt2(v: string | number | null | undefined): string {
  const n = parseFloat(String(v || 0));
  return isNaN(n) ? '0.00' : n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getDepRate(partType: string, depType: string, ageMonths: number): number {
  if (depType === 'nil') return 0;
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

function isExpired(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ─── Main HTML Builder ────────────────────────────────────────────────────────

export function buildStandardFinalSurveyHTML(
  claim: ClaimData,
  summary: AssessmentSummary,
  profile: SurveyorProfile
): string {
  const vehicle = claim.vehicle;
  const driver = claim.driver;
  const policy = claim.policy;
  const accident = claim.accident;
  const rows = claim.assessmentRows || [];

  const depTypeRaw = (claim.depreciationType || 'standard').toLowerCase();
  const ageMonths = getVehicleAgeMonths(
    vehicle.dateOfRegistration || null,
    vehicle.yearOfManufacture ? Number(vehicle.yearOfManufacture) : null,
    accident.dateAndTime || null
  );
  const ageLabel = ageMonths > 0 ? `${Math.floor(ageMonths / 12)}yr ${ageMonths % 12}mo` : '';

  // ── Calculations ───────────────────────────────────────────────────────────
  let metal = 0, plastic = 0, glass = 0, fiberglass = 0, labOnlyBase = 0, paintOnlyBase = 0;

  rows.filter(r => r.section === 'parts').forEach(r => {
    if (r.allowed === false) return;
    const dep = getDepRate(r.partType, depTypeRaw, ageMonths);
    const ad = r.assessed * (1 - dep / 100);
    if (r.partType === 'metal') metal += ad;
    else if (r.partType === 'glass') glass += ad;
    else if (r.partType === 'fiberglass') fiberglass += ad;
    else plastic += ad;
  });

  rows.filter(r => r.section === 'labour').forEach(r => {
    if (r.allowed !== false) labOnlyBase += r.assessed;
  });
  rows.filter(r => r.section === 'paint').forEach(r => {
    if (r.allowed !== false) paintOnlyBase += r.assessed;
  });

  const labBase = labOnlyBase + paintOnlyBase; // combined for grand total
  const pb = metal + plastic + glass + fiberglass;
  const pCGST = pb * 0.09;
  const pT = pb + pCGST * 2;
  const labGST = labOnlyBase * 0.18;
  const labT = labOnlyBase + labGST;
  const paintGST = paintOnlyBase * 0.18;
  const paintT = paintOnlyBase + paintGST;
  const lT = labT + paintT;
  const grand = pT + lT;

  const salvage = claim.feeBill?.salvageValue || 0;
  const volExcess = claim.feeBill?.voluntaryExcess || 0;
  const compExcess = claim.feeBill?.compulsoryExcess || 500;
  const excess = volExcess + compExcess;
  const net = Math.max(0, grand - salvage - excess);

  const estPartsBase = rows.filter(r => r.section === 'parts' && r.allowed !== false).reduce((s, r) => s + r.estimated, 0);
  const estLabOnly = rows.filter(r => r.section === 'labour' && r.allowed !== false).reduce((s, r) => s + r.estimated, 0);
  const estPaintOnly = rows.filter(r => r.section === 'paint' && r.allowed !== false).reduce((s, r) => s + r.estimated, 0);
  const estLabBase = estLabOnly + estPaintOnly;

  // ── Table style shorthands ─────────────────────────────────────────────────
  const ts = 'width:100%;border-collapse:collapse;font-size:7.8pt;margin-bottom:4px;';
  const th = 'background:#0d1b2a;color:#fff;padding:2px 4px;font-size:6.8pt;';
  const td = 'padding:2px 4px;border:0.4pt solid #bbb;vertical-align:top;';
  const tdr = 'padding:2px 4px;border:0.4pt solid #bbb;text-align:right;white-space:nowrap;';
  const sec = 'padding:2px 4px;font-weight:700;background:#e8e3da;font-size:6.8pt;text-transform:uppercase;border:0.4pt solid #bbb;';
  const sub = 'padding:2px 4px;font-weight:700;background:#dff0ec;color:#1a5a50;border:0.4pt solid #bbb;';

  // ── Parts rows (11 cols: Sr | Particulars | Type | Est | Assessed | Dep% | Metal | Plastic | Glass | GST% | Price+GST)
  let psn = 1;
  const partsHtml = rows.filter(r => r.section === 'parts').map(r => {
    const dep = getDepRate(r.partType, depTypeRaw, ageMonths);
    const disallowed = r.allowed === false;
    const ad = disallowed ? 0 : r.assessed * (1 - dep / 100);
    const gstPct = r.gst || 18;
    const priceGst = disallowed ? 0 : ad * (1 + gstPct / 100);
    return `<tr>
      <td style="${td}text-align:center;">${psn++}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">${r.partType === 'plastic' ? 'Pla/Rub' : r.partType === 'fiberglass' ? 'FbrGls' : r.partType.charAt(0).toUpperCase() + r.partType.slice(1)}</td>
      <td style="${tdr}">${fa(r.estimated)}</td>
      <td style="${tdr}${disallowed ? 'color:#a00;font-weight:700;font-size:6.5pt;text-align:center;' : ''}">${disallowed ? 'NOT ALLOWED' : fa(r.assessed)}</td>
      <td style="${tdr}">${dep}%</td>
      <td style="${tdr}">${r.partType === 'metal' && !disallowed ? fa(ad) : '—'}</td>
      <td style="${tdr}">${r.partType === 'plastic' && !disallowed ? fa(ad) : '—'}</td>
      <td style="${tdr}">${r.partType === 'fiberglass' && !disallowed ? fa(ad) : '—'}</td>
      <td style="${tdr}">${r.partType === 'glass' && !disallowed ? fa(ad) : '—'}</td>
      <td style="${tdr}text-align:center;">${gstPct}%</td>
      <td style="${tdr}${disallowed ? 'color:#a00;' : 'font-weight:600;'}">${fa(priceGst)}</td>
    </tr>`;
  }).join('');

  // ── Labour-only rows (11 cols: Sr | Particulars | Type | Est | Status | GST% | Amount×4 | Price+GST)
  let lsn = 1;
  const labOnlyHtml = rows.filter(r => r.section === 'labour').map(r => {
    const disallowed = r.allowed === false;
    const gstPct = r.gst || 18;
    const priceGst = disallowed ? 0 : r.assessed * (1 + gstPct / 100);
    return `<tr>
      <td style="${td}text-align:center;">${lsn++}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Labour</td>
      <td style="${tdr}">${fa(r.estimated)}</td>
      <td style="${tdr}${disallowed ? 'color:#a00;font-weight:700;font-size:6.5pt;text-align:center;' : ''}">${disallowed ? 'NOT ALLOWED' : ''}</td>
      <td style="${tdr}text-align:center;">${gstPct}%</td>
      <td colspan="4" style="${tdr}">${!disallowed ? fa(r.assessed) : '—'}</td>
      <td style="${tdr}${disallowed ? 'color:#a00;' : 'font-weight:600;'}">${fa(priceGst)}</td>
    </tr>`;
  }).join('');

  // ── Painting-only rows
  let ptsn = 1;
  const paintHtml = rows.filter(r => r.section === 'paint').map(r => {
    const disallowed = r.allowed === false;
    const gstPct = r.gst || 18;
    const priceGst = disallowed ? 0 : r.assessed * (1 + gstPct / 100);
    return `<tr>
      <td style="${td}text-align:center;">${ptsn++}</td>
      <td style="${td}">${r.particulars}</td>
      <td style="${td}text-align:center;">Paint</td>
      <td style="${tdr}">${fa(r.estimated)}</td>
      <td style="${tdr}${disallowed ? 'color:#a00;font-weight:700;font-size:6.5pt;text-align:center;' : ''}">${disallowed ? 'NOT ALLOWED' : ''}</td>
      <td style="${tdr}text-align:center;">${gstPct}%</td>
      <td colspan="4" style="${tdr}">${!disallowed ? fa(r.assessed) : '—'}</td>
      <td style="${tdr}${disallowed ? 'color:#a00;' : 'font-weight:600;'}">${fa(priceGst)}</td>
    </tr>`;
  }).join('');

  // ── DL expiry checks ───────────────────────────────────────────────────────
  const ntExpired = isExpired(driver.validityNonTransport);
  const tExpired = isExpired(driver.validityTransport);

  // ── Policy / depreciation label ────────────────────────────────────────────
  const depLabel = depTypeRaw === 'nil' ? 'Nil Depreciation' : `Standard IRDAI ${ageLabel}`;

  // ── Sub-header row reused for Labour and Painting sections ────────────────
  const labPaintSubHeader = `<tr>
      <th style="${th};width:14pt;text-align:center;">Sr.</th>
      <th style="${th}">Particulars</th>
      <th style="${th};width:30pt;text-align:center;">Type</th>
      <th style="${th};text-align:right;width:38pt;">Est. ₹</th>
      <th style="${th};text-align:center;">Status</th>
      <th style="${th};text-align:center;width:22pt;">GST%</th>
      <th colspan="4" style="${th};text-align:right;">Amount ₹</th>
      <th style="${th};text-align:right;width:42pt;">Price+GST ₹</th>
    </tr>`;

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT HTML
  // ─────────────────────────────────────────────────────────────────────────
  return `${getSurveyorHeader(profile)}
<div style="text-align:center;font-weight:700;font-size:8.5pt;margin-bottom:3px;text-decoration:underline;letter-spacing:0.05em;">PRIVATE AND CONFIDENTIAL — MOTOR (FINAL) SURVEY REPORT</div>
<p style="font-size:6.5pt;font-style:italic;margin-bottom:4px;text-align:justify;color:#444;">This report is issued by us as Licenced Surveyors without prejudice, in respect of cause, nature &amp; extent of loss/damage, subject to the terms &amp; conditions of the Insurance policy.</p>

<table style="${ts}">
  <tr>
    <td style="${td}color:#444;width:18%;font-size:6.8pt;">Report No.</td>
    <td style="${td}font-weight:700;width:32%;">${claim.reportNo || '—'}</td>
    <td style="${td}color:#444;width:18%;font-size:6.8pt;">Date</td>
    <td style="${td}font-weight:700;">${formatDateDMY(claim.reportDate)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Policy No.</td>
    <td style="${td}font-family:monospace;">${policy.policyNumber || '—'}</td>
    <td style="${td}color:#444;font-size:6.8pt;">Claim No.</td>
    <td style="${td}font-family:monospace;">${policy.claimNumber || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Policy Period</td>
    <td style="${td}">${formatDateDMY(policy.periodFrom)} to ${formatDateDMY(policy.periodTo)}</td>
    <td style="${td}color:#444;font-size:6.8pt;">I.D.V.</td>
    <td style="${td}font-weight:600;">₹ ${fmt2(policy.idv)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Policy Type</td>
    <td style="${td}" colspan="3">${policy.policyType || '—'} — <b>${depLabel}</b></td>
  </tr>
</table>

<div style="font-weight:700;font-size:7pt;background:#f5f2ee;width:100%;padding:2px 4px;border:0.4pt solid #bbb;border-bottom:none;">1. INSURER &amp; INSURED DETAILS</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;width:18%;font-size:6.8pt;">Insurer</td>
    <td style="${td}" colspan="3">${policy.insurerName || '—'} | Appointing: ${policy.appointingOffice || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Insured Name</td>
    <td style="${td}font-weight:600;width:32%;">${policy.insuredName || '—'}</td>
    <td style="${td}color:#444;font-size:6.8pt;">Mobile</td>
    <td style="${td}">${policy.insuredMobile || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Address</td>
    <td style="${td}" colspan="3">${policy.insuredAddress || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">H.P.A.</td>
    <td style="${td}" colspan="3">${policy.hpaWith || policy.hpa || vehicle.hypothecation || vehicle.hpa || 'NIL'}</td>
  </tr>
</table>

<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">2. VEHICLE PARTICULARS</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;width:18%;">Reg. No.</td>
    <td style="${td}font-weight:700;width:32%;">${vehicle.registrationNumber || '—'}</td>
    <td style="${td}color:#444;font-size:6.8pt;">Date of Reg.</td>
    <td style="${td}">${formatDateDMY(vehicle.dateOfRegistration)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Make / Model / Year</td>
    <td style="${td}" colspan="3"><b>${vehicle.make || '—'}</b> / ${vehicle.model || '—'} / ${vehicle.yearOfManufacture || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Chassis No.</td>
    <td style="${td}font-family:monospace;">${vehicle.chassisNumber || '—'}</td>
    <td style="${td}color:#444;font-size:6.8pt;">Engine No.</td>
    <td style="${td}font-family:monospace;">${vehicle.engineNumber || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Body / Colour / Fuel</td>
    <td style="${td}" colspan="3">${vehicle.bodyType || '—'} / ${vehicle.colour || '—'} / ${vehicle.fuel || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">CC / Odometer</td>
    <td style="${td}">${vehicle.cubicCapacity || '—'} / ${vehicle.odometer || '—'} KM</td>
    <td style="${td}color:#444;font-size:6.8pt;">Pre-Accident Cond.</td>
    <td style="${td}">${vehicle.preAccidentCondition || vehicle.condition || '—'}</td>
  </tr>
</table>

<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">3. DRIVER'S PARTICULARS</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;width:18%;">Driver Name</td>
    <td style="${td}font-weight:600;" colspan="3">${driver.name || '—'}${driver.parentName ? ' ' + (driver.relationType || 'S/o') + ' ' + driver.parentName : ''}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">M.D.L. No.</td>
    <td style="${td}font-family:monospace;width:32%;">${driver.licenceNumber || driver.licenseNumber || '—'}</td>
    <td style="${td}color:#444;font-size:6.8pt;">Date of Birth</td>
    <td style="${td}">${formatDateDMY(driver.dateOfBirth || driver.dob) || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Licence Classes</td>
    <td style="${td}" colspan="3">${driver.vehicleClasses || driver.vehicleClass || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Non-Transport Valid</td>
    <td style="${td}${ntExpired ? 'color:#c00;font-weight:700;' : ''}">${formatDateDMY(driver.validityNonTransport)}${ntExpired ? ' ⚠ EXPIRED' : ''}</td>
    <td style="${td}color:#444;font-size:6.8pt;">Transport Valid</td>
    <td style="${td}${tExpired ? 'color:#c00;font-weight:700;' : ''}">${formatDateDMY(driver.validityTransport)}${tExpired ? ' ⚠ EXPIRED' : ''}</td>
  </tr>
</table>

<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">4. ACCIDENT &amp; SURVEY DETAILS</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;width:18%;">Date &amp; Time</td>
    <td style="${td}width:32%;">${formatDateTimeDMY(accident.dateAndTime)}</td>
    <td style="${td}color:#444;font-size:6.8pt;">Place</td>
    <td style="${td}">${accident.placeOfAccident || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Date of Survey</td>
    <td style="${td}">${formatDateDMY(accident.dateOfSurvey)}</td>
    <td style="${td}color:#444;font-size:6.8pt;">Place of Survey</td>
    <td style="${td}">${accident.placeOfSurvey || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:6.8pt;">Third Party</td>
    <td style="${td}" colspan="3">${accident.thirdPartyDetails || 'NIL'}</td>
  </tr>
</table>

<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">7. CAUSE &amp; NATURE OF ACCIDENT</div>
<div style="font-size:7.2pt;margin-bottom:4px;padding:2px 4px;border:0.4pt solid #bbb;background:#fafaf7;line-height:1.5;">${accident.causeOfAccident || '—'}</div>

<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">8. ASSESSMENT SUMMARY</div>
<table style="${ts}">
  <thead>
    <tr>
      <th style="${th};width:40%;text-align:left;">Head</th>
      <th style="${th};text-align:right;">Estimated</th>
      <th style="${th};text-align:right;">Assessed (after Dep.)</th>
      <th style="${th};text-align:right;">Incl. GST</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${td}">Spare Parts</td>
      <td style="${tdr}">${fa(estPartsBase)}</td>
      <td style="${tdr}">${fa(pb)}</td>
      <td style="${tdr}">${fa(pT)}</td>
    </tr>
    <tr>
      <td style="${td}">Labour</td>
      <td style="${tdr}">${fa(estLabOnly)}</td>
      <td style="${tdr}">${fa(labOnlyBase)}</td>
      <td style="${tdr}">${fa(labT)}</td>
    </tr>
    <tr>
      <td style="${td}">Painting</td>
      <td style="${tdr}">${fa(estPaintOnly)}</td>
      <td style="${tdr}">${fa(paintOnlyBase)}</td>
      <td style="${tdr}">${fa(paintT)}</td>
    </tr>
    <tr style="background:#e8f5f3;">
      <td style="${td}font-weight:700;">GRAND TOTAL</td>
      <td style="${tdr}font-weight:700;background:#e8f5f3;">${fa(estPartsBase + estLabBase)}</td>
      <td style="${tdr}font-weight:700;background:#e8f5f3;">${fa(pb + labBase)}</td>
      <td style="${tdr}font-weight:700;background:#e8f5f3;">${fa(grand)}</td>
    </tr>
    <tr>
      <td style="${td}">Less: Policy Excess</td>
      <td colspan="2" style="border:0.4pt solid #bbb;"></td>
      <td style="${tdr}">( ${fa(excess)} )</td>
    </tr>
    <tr>
      <td style="${td}">Less: Salvage Value</td>
      <td colspan="2" style="border:0.4pt solid #bbb;"></td>
      <td style="${tdr}">( ${fa(salvage)} )</td>
    </tr>
    <tr style="background:#0d1b2a;color:#fff;">
      <td style="padding:3px 4px;font-weight:700;font-size:8pt;">NET ASSESSED LOSS</td>
      <td colspan="2" style="border:none;"></td>
      <td style="padding:3px 4px;text-align:right;font-weight:700;font-size:8pt;">${fa(net)}</td>
    </tr>
    <tr>
      <td colspan="4" style="${td}font-style:italic;font-size:6.5pt;color:#444;">RUPEES ${numberToWords(net)} ONLY</td>
    </tr>
  </tbody>
</table>

${claim.isTotalLoss && claim.totalLossDetails ? (() => {
  const idv = parseFloat(String(claim.policy?.idv || '0').replace(/,/g, '')) || 0;
  const totalExcess = (claim.feeBill?.voluntaryExcess || 0) + (claim.feeBill?.compulsoryExcess || 500);
  const tlLiability = Math.max(0, idv - totalExcess);
  const netWithRC = Math.max(0, tlLiability - (claim.totalLossDetails.salvageWithRC || 0));
  const netWithoutRC = Math.max(0, tlLiability - (claim.totalLossDetails.salvageWithoutRC || 0));
  const repairBasis = net;

  return `
    <div style="margin-top:10px; margin-bottom:15px; border:1pt solid #0d1b2a; border-radius:4px; overflow:hidden;">
      <div style="background:#0d1b2a; color:#fff; font-weight:700; font-size:7.5pt; padding:4px; text-align:center; text-transform:uppercase;">
        Comparison of Insurer's Liability (Total Loss Assessment)
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:7pt;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="${td}text-align:left;font-weight:700;">Description</th>
            <th style="${td}width:18%;text-align:right;">Repair Basis</th>
            <th style="${td}width:18%;text-align:right;">Total Loss</th>
            <th style="${td}width:18%;text-align:right;">Net Loss (W/RC)</th>
            <th style="${td}width:18%;text-align:right;">Net Loss (W/O RC)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="${td}">Insured Declared Value (IDV)</td>
            <td style="${td}text-align:right;color:#888;">—</td>
            <td style="${td}text-align:right;">${fa(idv)}</td>
            <td style="${td}text-align:right;">${fa(idv)}</td>
            <td style="${td}text-align:right;">${fa(idv)}</td>
          </tr>
          <tr>
            <td style="${td}">Less: Policy Excess (Comp/Vol)</td>
            <td style="${td}text-align:right;color:#888;">—</td>
            <td style="${td}text-align:right;color:#a00;">- ${fa(totalExcess)}</td>
            <td style="${td}text-align:right;color:#a00;">- ${fa(totalExcess)}</td>
            <td style="${td}text-align:right;color:#a00;">- ${fa(totalExcess)}</td>
          </tr>
          <tr>
            <td style="${td}">Less: Salvage Value</td>
            <td style="${td}text-align:right;color:#888;">—</td>
            <td style="${td}text-align:right;color:#888;">—</td>
            <td style="${td}text-align:right;color:#a00;">- ${fa(claim.totalLossDetails.salvageWithRC)}</td>
            <td style="${td}text-align:right;color:#a00;">- ${fa(claim.totalLossDetails.salvageWithoutRC)}</td>
          </tr>
          <tr>
            <td style="${td}">Add: Towing / Addl. Expenses</td>
            <td style="${td}text-align:right;color:#888;">—</td>
            <td style="${td}text-align:right;">+ ${fa((claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
            <td style="${td}text-align:right;">+ ${fa((claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
            <td style="${td}text-align:right;">+ ${fa((claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
          </tr>
          <tr style="background:#f8fafc; font-weight:700;">
            <td style="${td}color:#0d1b2a; border-top:1pt solid #0d1b2a;">NET PAYABLE LIABILITY</td>
            <td style="${td}text-align:right;border-top:1pt solid #0d1b2a;">₹ ${fa(repairBasis)}</td>
            <td style="${td}text-align:right;border-top:1pt solid #0d1b2a;">₹ ${fa(tlLiability + (claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
            <td style="${td}text-align:right;border-top:1pt solid #0d1b2a;">₹ ${fa(netWithRC + (claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
            <td style="${td}text-align:right;border-top:1pt solid #0d1b2a;">₹ ${fa(netWithoutRC + (claim.totalLossDetails.towingExpenses || 0) + (claim.totalLossDetails.workshopRent || 0))}</td>
          </tr>
        </tbody>
      </table>
      <div style="padding:6px; font-size:6.8pt; color:#333; border-top:0.4pt solid #0d1b2a; background:#f5faff; line-height:1.4;">
        <span style="font-weight:700; color:#0d1b2a;">SURVEYOR'S REMARKS:</span> 
        ${claim.totalLossDetails.remarks || `Since the assessed repair cost is substantial relative to the IDV, the settlement comparison is provided above for the insurer's final decision.`}
      </div>
    </div>
  `;
})() : ''}

<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">9. DETAILS OF ASSESSMENT</div>
<table style="${ts}">
  <thead>
    <tr>
      <th style="${th};width:14pt;text-align:center;">Sr.</th>
      <th style="${th}">Particulars</th>
      <th style="${th};width:30pt;text-align:center;">Type</th>
      <th style="${th};text-align:right;width:38pt;">Est. ₹</th>
      <th style="${th};text-align:right;width:42pt;">Assessed ₹</th>
      <th style="${th};text-align:center;width:22pt;">Dep%</th>
      <th style="${th};text-align:right;width:38pt;">Metal ₹</th>
      <th style="${th};text-align:right;width:38pt;">Pla/Rub ₹</th>
      <th style="${th};text-align:right;width:38pt;">FbrGls ₹</th>
      <th style="${th};text-align:right;width:38pt;">Glass ₹</th>
      <th style="${th};text-align:center;width:22pt;">GST%</th>
      <th style="${th};text-align:right;width:42pt;">Price+GST ₹</th>
    </tr>
  </thead>
  <tbody>
    <tr><td colspan="11" style="${sec}">SPARE PARTS</td></tr>
    ${partsHtml}
    <tr>
      <td colspan="6" style="${sub}text-align:right;font-size:6.8pt;">Sub-Total Parts (after dep, before GST)</td>
      <td style="${sub}text-align:right;">${fa(metal)}</td>
      <td style="${sub}text-align:right;">${fa(plastic)}</td>
      <td style="${sub}text-align:right;">${fa(fiberglass)}</td>
      <td style="${sub}text-align:right;">${fa(glass)}</td>
      <td style="${sub}text-align:center;">18%</td>
      <td style="${sub}text-align:right;font-weight:700;">${fa(pT)}</td>
    </tr>
    <tr><td colspan="11" style="${sec}">LABOUR</td></tr>
    ${labPaintSubHeader}
    ${labOnlyHtml}
    <tr>
      <td colspan="5" style="${sub}text-align:right;font-size:6.8pt;">Sub-Total Labour (incl. GST)</td>
      <td colspan="5" style="${sub}text-align:right;">${fa(labOnlyBase)}</td>
      <td style="${sub}text-align:right;font-weight:700;">${fa(labT)}</td>
    </tr>
    <tr><td colspan="11" style="${sec}">PAINTING</td></tr>
    ${labPaintSubHeader}
    ${paintHtml}
    <tr>
      <td colspan="5" style="${sub}text-align:right;font-size:6.8pt;">Sub-Total Painting (incl. GST)</td>
      <td colspan="5" style="${sub}text-align:right;">${fa(paintOnlyBase)}</td>
      <td style="${sub}text-align:right;font-weight:700;">${fa(paintT)}</td>
    </tr>
  </tbody>
</table>

<p style="font-size:6.5pt;line-height:1.5;margin-bottom:5px;text-align:justify;color:#333;">We have carried out survey of the above motor vehicle in connection with the captioned claim and assessed the loss as per Surveyors and Loss Assessors Regulations 2015 under the Insurance Act 1938. This is a final report without prejudice, subject to terms and conditions of the policy including any applicable policy excess and depreciation as per IRDAI guidelines.</p>
${getSigBlock(profile)}
<div style="font-size:6pt;color:#666;margin-top:4px;border-top:0.4pt solid #ccc;padding-top:2px;">Encl: Repair Estimate / Tax Invoice &amp; Digital Photographs</div>`;
}

// ─── Wrap in a full printable A4 HTML document ────────────────────────────────

export function buildStandardPrintDocument(
  claim: ClaimData,
  summary: AssessmentSummary,
  profile: SurveyorProfile
): string {
  const bodyContent = buildStandardFinalSurveyHTML(claim, summary, profile);
  const regNo = claim.vehicle?.registrationNumber || 'Claim';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Standard Final Survey Report — ${regNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Barlow', 'Helvetica', Arial, sans-serif;
      font-size: 7.8pt;
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
    ${bodyContent}
  </div>
</body>
</html>`;
}

// ─── Trigger the print window ─────────────────────────────────────────────────

export function triggerStandardPrint(
  claim: ClaimData,
  summary: AssessmentSummary,
  profile: SurveyorProfile
): void {
  const html = buildStandardPrintDocument(claim, summary, profile);
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

// ─── Legacy alias (keeps any future imports from uiic-html-builder stub working)
export { triggerStandardPrint as triggerUIICPrint };
