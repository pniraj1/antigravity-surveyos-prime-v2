import type { ClaimData } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';
import { formatDateDMY, getSurveyorHeader, getSigBlock } from './report-utils';

function fd(v: string | null | undefined): string {
  return formatDateDMY(v);
}

function g(v: string | number | null | undefined): string {
  return v !== null && v !== undefined && v !== '' ? String(v) : '—';
}

export function buildValuationReportHTML(claim: ClaimData, profile: SurveyorProfile | null): string {
  const v = claim.vehicle;
  const p = claim.policy;
  const vd = claim.valuationDetails;

  const B = 'border:0.5pt solid #000;';
  const td = B + 'padding:3px 6px;vertical-align:top;font-size:8pt;';
  const tdl = td + 'color:#333;font-size:7.5pt;width:35%;';
  const tdb = td + 'font-weight:700;';
  const sec = 'background:#ddd;' + B + 'padding:3px 6px;font-weight:700;font-size:8pt;text-transform:uppercase;letter-spacing:0.5px;';

  // ── Vehicle detail rows ──────────────────────────────────────────────────
  function detailRow(label: string, value: string, label2?: string, value2?: string): string {
    if (label2 !== undefined && value2 !== undefined) {
      return `<tr>
        <td style="${tdl}">${label}</td><td style="${td}">${value}</td>
        <td style="${tdl}">${label2}</td><td style="${td}">${value2}</td>
      </tr>`;
    }
    return `<tr>
      <td style="${tdl}">${label}</td><td style="${td}" colspan="3">${value}</td>
    </tr>`;
  }

  function condRow(label: string, value: string): string {
    const val = value && value !== '' ? value : '—';
    const color = val.toLowerCase().includes('damage') || val.toLowerCase().includes('dented') ? 'color:#c00;' : '';
    return `<tr>
      <td style="${tdl}">${label}</td>
      <td style="${td}${color}" colspan="3">${val}</td>
    </tr>`;
  }

  // ── Panel damage rows ────────────────────────────────────────────────────
  const panelRowsHTML = vd.panelRows.length > 0
    ? vd.panelRows.map(row =>
        `<tr>
          <td style="${tdl}">${g(row.component)}</td>
          <td style="${td}" colspan="3">${g(row.condition)}</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="4" style="${td}color:#555;">No panel damage reported.</td></tr>`;

  // ── Conclusion paragraph ─────────────────────────────────────────────────
  const insurableText = vd.isInsurable
    ? 'THE ABOVE VEHICLE WAS FOUND IN INSURABLE STATE AND MAY THEREFORE BE INSURED'
    : 'THE ABOVE VEHICLE WAS FOUND TO NOT BE IN AN INSURABLE STATE.';

  const coverText = vd.isInsurable && vd.coverRecommendation
    ? ` ON ${vd.coverRecommendation.toUpperCase()}.`
    : '.';

  const docVerNote = vd.documentVerificationNote
    ? `<p style="font-size:8pt;margin:6px 0 0;">WE HAVE VERIFIED XEROX COPIES OF SET OF DOCUMENTS AND FOUND THEM TO BE IN ORDER${vd.documentVerificationNote ? ' EXCEPT FOR THE ' + vd.documentVerificationNote.toUpperCase() : ''}.</p>`
    : '';

  const enclosures = vd.enclosures
    ? `<p style="font-size:8pt;margin:6px 0 0;"><strong>Enclosures:</strong> ${vd.enclosures}</p>`
    : '';

  const remarksBlock = vd.remarks
    ? `<p style="font-size:8pt;margin:6px 0 0;"><strong>Remarks:</strong> ${vd.remarks}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 8pt; margin: 0; padding: 0; color: #000; }
  @page { size: A4; margin: 12mm 14mm 14mm 14mm; }
  @media print { body { margin: 0; } }
  table { border-collapse: collapse; width: 100%; }
  p { margin: 0; }
</style>
</head>
<body>
${getSurveyorHeader(profile)}

<table style="width:100%;margin-bottom:6px;">
  <tr>
    <td style="font-size:8.5pt;">
      <strong>TO,</strong><br/>
      ${vd.toName?.trim() || (g(p.insurerName) !== '—' ? g(p.insurerName) : 'The Insurance Company')}<br/>
      ${vd.toAddress?.trim() || g(p.policyIssuingOffice)}
    </td>
    <td style="text-align:right;font-size:8pt;">
      <strong>Date:</strong> ${fd(vd.inspectionDate) !== '—' ? fd(vd.inspectionDate) : fd(claim.reportDate)}<br/>
      ${claim.reportNo ? `<strong>Ref No.:</strong> ${claim.reportNo}` : ''}
    </td>
  </tr>
</table>

<p style="font-size:9pt;font-weight:700;text-align:center;text-decoration:underline;margin:6px 0;">
  VEHICLE PRE-INSURANCE INSPECTION REPORT
</p>

<p style="font-size:8pt;margin:4px 0 6px;">
  RESPECTED SIR / MADAM,<br/><br/>
  WE HAVE UNDERTAKEN THIS INSPECTION SINCE THERE WAS BREAKIN IN THE INSURANCE PERIOD.
  AS PER YOUR INSTRUCTION, WE HAVE INSPECTED THE BELOW MENTIONED VEHICLE AT
  ${g(vd.inspectionPlace).toUpperCase()} AND FOUND IT TO BE IN GOOD RUNNING ORDER.
</p>

<!-- Vehicle Details -->
<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
  <tr><td colspan="4" style="${sec}">Vehicle Details</td></tr>
  ${detailRow('Registration Number', g(v.registrationNumber), 'Date of Registration', fd(v.dateOfRegistration))}
  ${detailRow('Chassis No.', g(v.chassisNumber), 'Engine No.', g(v.engineNumber))}
  ${detailRow('Make / Model', `${g(v.make)} / ${g(v.model)}`, 'Fuel Type', g(v.fuel))}
  ${detailRow('Seating Capacity', g(v.seatingCapacity), 'Class of Vehicle', g(v.classOfVehicle))}
  ${detailRow('Type of Body', g(v.bodyType), 'Unladen Weight', v.unladenWeight ? g(v.unladenWeight) + ' kg' : '—')}
  ${detailRow('Registered Laden Weight', v.registeredLoadWeight ? g(v.registeredLoadWeight) + ' kg' : '—', 'Kilometerage', g(vd.odometer))}
  ${p.insuredName ? detailRow('Insured Name', g(p.insuredName), 'Policy Number', g(p.policyNumber)) : ''}
</table>

<!-- Condition of Vehicle -->
<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
  <tr><td colspan="4" style="${sec}">Condition of Vehicle</td></tr>
  ${condRow('Chassis', vd.chassis || 'Monocoque type, safe')}
  ${condRow('Engine & Transmission', vd.engineTransmission || 'Found in good running order')}
  ${condRow('Suspension', vd.suspension || 'Found in appropriate working order')}
  ${condRow('Battery Make', vd.batteryMake ? `${vd.batteryMake}` : '—')}
  ${condRow('Battery Condition', vd.batteryCondition || '—')}
  ${condRow('Tyres & Stepney', (() => {
    const parts: string[] = [];
    if (vd.tyreCount) parts.push(`${vd.tyreCount} tyres`);
    if (vd.stepneyCount) parts.push(`${vd.stepneyCount} stepney`);
    if (vd.tyreMake) parts.push(`Make: ${vd.tyreMake}`);
    if (vd.tyreCondition) parts.push(vd.tyreCondition);
    return parts.length ? parts.join(', ') : '—';
  })())}
  ${condRow('Glass Condition', vd.glassCondition || '—')}
  ${condRow('Seats & Upholstery', vd.seats || '—')}
  ${condRow('Electricals', vd.electricals || '—')}
</table>

<!-- Body Shell / Panel Damage -->
<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
  <tr><td colspan="4" style="${sec}">Cabin & Body Shell</td></tr>
  ${panelRowsHTML}
</table>

<!-- Conclusion -->
<p style="font-size:8pt;margin:8px 0 4px;">
  <strong>${insurableText}${coverText}</strong>
</p>
${docVerNote}
${remarksBlock}
${enclosures}

${getSigBlock(profile)}
</body>
</html>`;
}
