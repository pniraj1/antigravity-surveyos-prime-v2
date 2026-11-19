import type { CashLossBasis } from '@/lib/calculations/cash-loss';
import { fa, numberToWords } from './report-utils';

interface Opts { td: string; tdr: string; headBg: string; title?: string }

export const CASH_LOSS_TITLE = '8A. CASH LOSS BASIS (without production of repair bills; all figures before GST)';

/** Shared 8A table. A material row prints only when above 0. Percent not entered prints no deduction. */
export function renderCashLossTable(b: CashLossBasis, o: Opts): string {
  const { td, tdr } = o;
  const line = (label: string, amt: string, st = '') => `<tr><td style="${td}${st}">${label}</td><td style="${tdr}${st}">${amt}</td></tr>`;
  const mats: [string, number][] = [
    ['Metal', b.parts.metal], ['Plastic / Rubber', b.parts.plastic], ['Glass', b.parts.glass], ['Fibre Glass', b.parts.fiberglass],
  ];
  const pct = b.percent === null ? '—' : String(b.percent);
  return `<div style="font-weight:700;font-size:7pt;background:${o.headBg};color:#fff;padding:2px 4px;margin-bottom:2px;">${o.title ?? CASH_LOSS_TITLE}</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
  <thead><tr><th style="background:${o.headBg};color:#fff;text-align:left;padding:2px 4px;">Head</th><th style="background:${o.headBg};color:#fff;text-align:right;padding:2px 4px;">Amount (₹)</th></tr></thead>
  <tbody>
    ${line('Labour assessed (before tax)', fa(b.labour))}
    ${line('Add: Towing charges', fa(b.towing))}
    ${mats.filter(([, v]) => v > 0).map(([n, v]) => line(`${n} parts after depreciation (before tax)`, fa(v))).join('\n    ')}
    ${line('Less: Salvage', `( ${fa(b.salvage)} )`)}
    ${line('GROSS ASSESSED LOSS', fa(b.gross), 'font-weight:700;background:#e8f5f3;')}
    ${line(`Less: Notional deduction for non-submission of bills @ ${pct}%`, `( ${fa(b.notional)} )`)}
    ${line('Less: Policy Excess (Compulsory / Voluntary)', `( ${fa(b.excess)} )`)}
    <tr style="background:${o.headBg};color:#fff;"><td style="padding:3px 4px;font-weight:700;font-size:8pt;">NET LIABILITY ON CASH LOSS BASIS</td><td style="padding:3px 4px;text-align:right;font-weight:700;font-size:8pt;">${fa(b.net)}</td></tr>
    <tr><td colspan="2" style="${td}font-style:italic;font-size:6.5pt;color:#444;">RUPEES ${numberToWords(b.net)} ONLY</td></tr>
  </tbody>
</table>
`;
}
