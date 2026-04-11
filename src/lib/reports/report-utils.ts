/**
 * report-utils.ts
 *
 * Shared utility functions used across all HTML report builders.
 * Single source of truth — edit here to affect all print outputs.
 *
 * SYNC CHECKLIST: When editing these functions, verify print output in:
 *   - standard-report-builder.ts  (Standard Final Survey)
 *   - uiic-final-builder.ts       (UIIC Final + Bill Check)
 *   - spot-fee-bill-builder.ts    (Spot Fee Bill / Invoice)
 */

import type { SurveyorProfile } from '@/types/vehicle';

export function formatDateDMY(v: string | null | undefined): string {
  if (!v) return '—';
  const dStr = String(v).split('T')[0];
  const parts = dStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    if (parts[2].length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  }
  return v;
}

export function formatDateTimeDMY(v: string | null | undefined): string {
  if (!v) return '—';
  const s = String(v);
  const datePart = formatDateDMY(s.split('T')[0]);
  const timePart = s.includes('T') ? s.split('T')[1].substring(0, 5) : '';
  return timePart && timePart !== '00:00' ? `${datePart} at ${timePart} hrs` : datePart;
}

/** ₹-formatted currency string. Not for use in uiic-final-builder (uses its own fa). */
export function fa(v: number): string {
  return '₹ ' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function numberToWords(num: number): string {
  if (!num || isNaN(num)) return 'ZERO';
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
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

export function getVehicleAgeMonths(regDate: string | null, year: number | null, doa: string | null): number {
  const start: Date | null = regDate ? new Date(regDate) : (year ? new Date(year, 0, 1) : null);
  if (!start) return 0;
  const ref = doa ? new Date(doa) : new Date();
  if (isNaN(start.getTime()) || isNaN(ref.getTime()) || ref < start) return 0;
  return (ref.getFullYear() - start.getFullYear()) * 12 + ref.getMonth() - start.getMonth();
}

/**
 * Renders the surveyor letterhead header block.
 * @param marginBottom Override the bottom margin (default '6px'). spot-fee-bill uses '8px'.
 */
export function getSurveyorHeader(profile: SurveyorProfile | null, marginBottom = '6px'): string {
  const name   = profile?.name           || 'SURVEYOR NAME';
  const qual   = profile?.qualifications || 'B.Sc., Dip. in Auto Engg.';
  const addr   = profile?.address        || 'Address';
  const lic    = profile?.licenceNumber  || '—';
  const exp    = (profile as any)?.licenceExpiry || '—';
  const iiisla = profile?.iiislaNumber   || '—';
  const email  = profile?.email          || '—';
  const mob    = profile?.mobile         || '—';
  const cats   = profile?.categories     || 'MOTOR';

  return `<div style="border-bottom:1.2pt solid #000;padding-bottom:5px;margin-bottom:${marginBottom};">
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

/**
 * Renders the surveyor signature block.
 * @param marginTop Override the top margin (default '14px'). spot-fee-bill uses '20px'.
 */
export function getSigBlock(profile: SurveyorProfile | null, marginTop = '14px'): string {
  const name = profile?.name || 'SURVEYOR NAME';
  return `<div style="display:flex;justify-content:flex-end;align-items:flex-end;margin-top:${marginTop};gap:8px;">
    <div style="text-align:center;">
      <div style="min-height:60px;"></div>
      <div style="font-weight:700;font-size:7.5pt;margin-top:2px;">${name}</div>
      <div style="font-size:6.5pt;color:#555;">Licenced Surveyor &amp; Loss Assessor</div>
    </div>
  </div>`;
}
