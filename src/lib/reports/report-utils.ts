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

// These five were re-implemented here, byte-for-byte identical to
// src/lib/calculations/. Two copies of the money-and-age helpers is how the
// printed report and the screen drift apart: the day-of-month fix in
// getVehicleAgeMonths landed in the engine and would have missed every builder
// importing from this file. Re-exported, not re-written, so the builders keep
// their existing imports and there is one implementation to fix.
// Imported, not just re-exported: `export … from` creates no local binding,
// and formatSurveyDateTime below calls formatDateDMY.
import { formatDateDMY, formatDateTimeDMY, numberToWords, formatCurrency } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';

export { formatDateDMY, formatDateTimeDMY, numberToWords, getVehicleAgeMonths };
/**
 * Escapes text that reaches report HTML from outside the code.
 *
 * Part names were interpolated raw. An ampersand renders fine — that is how
 * this was found — but a "<" in a name is read as the start of a tag: the
 * browser swallows text until the next ">" and the table can collapse from
 * that row down. It cannot make a figure wrong; it can visibly corrupt a
 * document the surveyor signs.
 *
 * Names are not always hand-typed: AI extraction lifts them from the
 * workshop's estimate PDF, which is someone else's document.
 */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** ₹-formatted currency string. Alias kept so the builders' `fa(...)` calls stand. */
export const fa = formatCurrency;

/**
 * Survey date with its optional time, e.g. "10.06.2026 at 11:30 hrs".
 *
 * Survey date and time are stored as two fields, not one datetime, so this
 * joins them for display. Falls back to the date alone when no time was
 * recorded — an absent time must never render as 00:00, which would assert a
 * midnight survey that did not happen.
 */
export function formatSurveyDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  const datePart = formatDateDMY(date);
  if (!time || datePart === '—') return datePart;
  return `${datePart} at ${time} hrs`;
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
  const sig = profile?.signatureDataUrl;
  const stamp = profile?.stampDataUrl;

  return `<div style="display:flex;justify-content:flex-end;align-items:flex-end;margin-top:${marginTop};gap:15px;">
    ${stamp ? `<img src="${stamp}" style="max-height:80px;max-width:80px;object-fit:contain;margin-bottom:-5px;"/>` : ''}
    <div style="text-align:center;">
      <div style="min-height:60px;display:flex;align-items:flex-end;justify-content:center;">
        ${sig ? `<img src="${sig}" style="max-height:60px;max-width:140px;object-fit:contain;"/>` : ''}
      </div>
      <div style="font-weight:700;font-size:7.5pt;margin-top:2px;">${name}</div>
      <div style="font-size:6.5pt;color:#555;">Licenced Surveyor &amp; Loss Assessor</div>
    </div>
  </div>`;
}
