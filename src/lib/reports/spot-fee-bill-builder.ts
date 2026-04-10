/**
 * spot-fee-bill-builder.ts
 *
 * Generates the Surveyor Fee Bill / Invoice as a self-contained HTML string,
 * opened via window.open() → window.print() for pixel-perfect PDF output.
 *
 * Ported from the reference "Spot survey temp.html" → buildFeeBillHTML() +
 * getSurveyorHeader(). That desktop file is NEVER modified — it is the
 * gold-standard reference.
 *
 * Works for BOTH Spot surveys and Final surveys.
 */

import type { ClaimData } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateDMY(v: string | null | undefined): string {
  if (!v) return '—';
  const dStr = String(v).split('T')[0];
  const parts = dStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    if (parts[2].length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return (
      String(d.getDate()).padStart(2, '0') +
      '.' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '.' +
      d.getFullYear()
    );
  }
  return v;
}

function fa(v: number): string {
  return '₹ ' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function numberToWords(num: number): string {
  if (!num || isNaN(num)) return 'ZERO';
  const ones = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
    'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
  ];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  function c(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + c(n % 100) : '');
    if (n < 100000) return c(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 ? ' ' + c(n % 1000) : '');
    if (n < 10000000) return c(Math.floor(n / 100000)) + ' LAKH' + (n % 100000 ? ' ' + c(n % 100000) : '');
    return c(Math.floor(n / 10000000)) + ' CRORE' + (n % 10000000 ? ' ' + c(n % 10000000) : '');
  }
  return c(Math.floor(num));
}

// ─── Surveyor Header (mirrors getSurveyorHeader() from reference) ─────────────

function getSurveyorHeader(profile: SurveyorProfile): string {
  const name   = profile?.name              || 'SURVEYOR NAME';
  const qual   = profile?.qualifications    || 'B.Sc., Dip. in Auto Engg.';
  const addr   = profile?.address           || 'Address';
  const lic    = profile?.licenceNumber     || '—';
  const exp    = profile?.licenceExpiry     || '—';
  const iiisla = profile?.iiislaNumber      || '—';
  const email  = profile?.email             || '—';
  const mob    = profile?.mobile            || '—';
  const cats   = profile?.categories       || 'MOTOR';

  return `<div style="border-bottom:1.2pt solid #000;padding-bottom:5px;margin-bottom:8px;">
    <div style="text-align:center;">
      <div style="font-size:13pt;font-weight:700;">${name}</div>
      <div style="font-size:7pt;">${qual}</div>
      <div style="font-size:7.5pt;font-weight:700;">INSURANCE SURVEYOR, LOSS ASSESSOR &amp; VALUER</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:6.8pt;">
      <div>Lic. No.: <b>${lic}</b> &nbsp;|&nbsp; Expiry: <b>${exp}</b> &nbsp;|&nbsp; IIISLA: <b>${iiisla}</b> &nbsp;|&nbsp; E-mail: ${email} &nbsp;|&nbsp; Cell: ${mob}</div>
      <div style="text-align:right;font-weight:700;">${cats}<br/><span style="font-weight:400;">${addr}</span></div>
    </div>
  </div>`;
}

// ─── Signature Block ──────────────────────────────────────────────────────────

function getSigBlock(profile: SurveyorProfile): string {
  const name = profile?.name || 'SURVEYOR NAME';
  return `<div style="display:flex;justify-content:flex-end;align-items:flex-end;margin-top:20px;gap:8px;">
    <div style="text-align:center;">
      <div style="min-height:60px;"></div>
      <div style="font-weight:700;font-size:7.5pt;margin-top:2px;">${name}</div>
      <div style="font-size:6.5pt;color:#555;">Licenced Surveyor &amp; Loss Assessor</div>
    </div>
  </div>`;
}

// ─── Main Fee Bill HTML Builder ───────────────────────────────────────────────

export function buildSpotFeeBillHTML(
  claim: ClaimData,
  profile: SurveyorProfile,
): string {
  const fb       = claim.feeBill  || ({} as any);
  const vehicle  = claim.vehicle;
  const policy   = claim.policy;
  const accident = claim.accident;
  const spot     = claim.spotDetails;

  // ── Charge calculations ──────────────────────────────────────────────────
  const profFee   = parseFloat(String(fb.professionalFee  || 0)) || 0;
  const riFee     = parseFloat(String(fb.riFee             || 0)) || 0;
  const travel    = parseFloat(String(fb.travelExpenses    || 0)) || 0;
  const photosCnt = parseFloat(String(fb.photosCount       || 0)) || 0;
  const photoRate = parseFloat(String(fb.photoRate         || 0)) || 0;
  const photos    = photosCnt * photoRate;
  const postal    = parseFloat(String(fb.postalCharges     || 0)) || 0;
  const haltage   = parseFloat(String(fb.haltageCharges   || 0)) || 0;
  const travelNote = fb.travelNote || '';

  const subTotal  = profFee + riFee + travel + photos + postal + haltage;
  const includeGST = !!fb.includeGST;
  const gstAmt    = includeGST ? subTotal * 0.18 : 0;
  const grand     = subTotal + gstAmt;

  // ── Date fields ──────────────────────────────────────────────────────────
  // For spot surveys, use spot-specific dates; fall back to accident/report dates
  const billDate    = formatDateDMY(fb.billDate   || claim.reportDate);
  const doaDisplay  = formatDateDMY(accident.dateAndTime || spot.surveyDatetime || '');
  const surveyDate  = formatDateDMY(accident.dateOfSurvey || spot.surveyDatetime || '');
  const surveyPlace = accident.placeOfSurvey || spot.repairWorkshop || '—';
  const reportNo    = claim.surveyType === 'spot'
    ? (spot.reportNo || claim.reportNo || '—')
    : (claim.reportNo || '—');

  // ── Charge rows — only show non-zero items ────────────────────────────────
  const chargeRows: [string, number][] = [
    [`Professional Survey Fee — ${vehicle.registrationNumber || 'Vehicle'}`, profFee],
    [`RI / Re-inspection Fee`, riFee],
    [`Travel / Conveyance Expenses${travelNote ? ' — ' + travelNote : ''}`, travel],
    [`Photography Charges (${photosCnt} photos × ₹${photoRate})`, photos],
    [`Postal / Courier Charges`, postal],
    [`Haltage &amp; Incidental Charges`, haltage],
  ].filter(([, amount]) => (amount as number) > 0) as [string, number][];

  const chargeRowsHTML = chargeRows
    .map(([label, amount], i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8f5f0'}">
        <td style="padding:6px 9px;">${label}</td>
        <td style="padding:6px 9px;text-align:right;">${fa(amount)}</td>
      </tr>`)
    .join('');

  const gstRowHTML = includeGST
    ? `<tr>
        <td style="padding:6px 9px;">GST @ 18% (SAC 998549)</td>
        <td style="padding:6px 9px;text-align:right;">${fa(gstAmt)}</td>
      </tr>`
    : '';

  // ── Bank / payment details from profile ──────────────────────────────────
  const bankName = profile?.bankName  || '—';
  const bankAc   = profile?.bankAccount || '—';
  const bankIfsc = profile?.bankIFSC   || '—';
  const gstNo    = profile?.gstNumber  || '';
  const pan      = profile?.panNumber  || '—';

  // ── Optional notes ──────────────────────────────────────────────────────
  const advanceReceiptNote = fb.advanceReceipt
    ? `<div style="font-size:7pt;margin-top:8px;padding:6px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;">
         <strong>Advance Receipt:</strong> ${fb.advanceReceipt}
       </div>`
    : '';
  const cashReceivedNote = fb.cashReceived
    ? `<div style="font-size:7pt;margin-top:6px;padding:6px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;">
         <strong>Cash Received from Insured:</strong> ${fb.cashReceived}
       </div>`
    : '';

  // ── Table style shorthands ────────────────────────────────────────────────
  const td    = 'padding:3px 6px;border:0.4pt solid #bbb;font-size:7pt;';
  const tdKey = `${td}color:#555;width:30%;`;

  return `${getSurveyorHeader(profile)}

<div style="text-align:center;font-weight:700;font-size:9pt;margin-bottom:10px;text-decoration:underline;letter-spacing:0.05em;">
  SURVEYOR FEE BILL / INVOICE
</div>

<!-- Meta table: To, Bill Date, Report No, Policy, Claim, Insured, Vehicle, Dates -->
<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
  <tr>
    <td style="${tdKey}">To</td>
    <td style="${td}font-weight:600;" colspan="3">${policy.insurerName || '—'}</td>
    <td style="${tdKey}text-align:right;">Bill Date</td>
    <td style="${td}font-weight:600;text-align:right;">${billDate}</td>
  </tr>
  <tr>
    <td style="${tdKey}">Report No.</td>
    <td style="${td}" colspan="5">${reportNo}</td>
  </tr>
  <tr>
    <td style="${tdKey}">Policy No.</td>
    <td style="${td}font-family:monospace;" colspan="2">${policy.policyNumber || '—'}</td>
    <td style="${tdKey}">Claim No.</td>
    <td style="${td}font-family:monospace;" colspan="2">${policy.claimNumber || '—'}</td>
  </tr>
  <tr>
    <td style="${tdKey}">Insured</td>
    <td style="${td}font-weight:600;" colspan="5">${policy.insuredName || '—'}</td>
  </tr>
  <tr>
    <td style="${tdKey}">Vehicle</td>
    <td style="${td}" colspan="5"><b>${vehicle.registrationNumber || '—'}</b>${vehicle.make ? ' — ' + vehicle.make + ' ' + (vehicle.model || '') : ''}</td>
  </tr>
  <tr>
    <td style="${tdKey}">Date of Accident</td>
    <td style="${td}" colspan="2">${doaDisplay}</td>
    <td style="${tdKey}">Date of Survey</td>
    <td style="${td}" colspan="2">${surveyDate}</td>
  </tr>
  <tr>
    <td style="${tdKey}">Place of Survey</td>
    <td style="${td}" colspan="5">${surveyPlace}</td>
  </tr>
</table>

<!-- Charges table -->
<table style="width:100%;border-collapse:collapse;font-size:7pt;margin-bottom:12px;">
  <thead>
    <tr style="background:#0d1b2a;color:#fff;">
      <th style="padding:6px 9px;text-align:left;">Particulars</th>
      <th style="padding:6px 9px;text-align:right;">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${chargeRowsHTML}
    <tr style="background:#f0fdf8;">
      <td style="padding:6px 9px;font-weight:600;">Sub-Total</td>
      <td style="padding:6px 9px;text-align:right;font-weight:600;">${fa(subTotal)}</td>
    </tr>
    ${gstRowHTML}
    <tr style="background:#0d1b2a;color:#fff;">
      <td style="padding:8px 9px;font-weight:700;">TOTAL PAYABLE</td>
      <td style="padding:8px 9px;text-align:right;font-weight:700;">${fa(grand)}</td>
    </tr>
  </tbody>
</table>

<div style="font-style:italic;font-size:7pt;margin-bottom:10px;">
  RUPEES ${numberToWords(grand)} ONLY
</div>

${advanceReceiptNote}
${cashReceivedNote}

<!-- Payment / bank details -->
<div style="font-size:7pt;margin-top:10px;padding:8px 10px;background:#f5f7fa;border-radius:4px;line-height:1.9;">
  <strong>Payment Details:</strong><br/>
  Bank: ${bankName} &nbsp;|&nbsp; A/c: ${bankAc} &nbsp;|&nbsp; IFSC: ${bankIfsc}<br/>
  ${gstNo ? 'GST No.: ' + gstNo + ' &nbsp;|&nbsp; ' : ''}PAN: ${pan}
</div>

${getSigBlock(profile)}`;
}

// ─── Wrap in a full printable A4 HTML document ────────────────────────────────

export function buildSpotFeeBillDocument(
  claim: ClaimData,
  profile: SurveyorProfile,
): string {
  const bodyContent = buildSpotFeeBillHTML(claim, profile);
  const regNo = claim.vehicle?.registrationNumber || 'Claim';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Surveyor Fee Bill — ${regNo}</title>
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

export function triggerSpotFeeBillPrint(
  claim: ClaimData,
  profile: SurveyorProfile,
): void {
  const html = buildSpotFeeBillDocument(claim, profile);
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
