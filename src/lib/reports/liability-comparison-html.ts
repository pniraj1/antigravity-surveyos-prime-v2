import type { LiabilityComparison } from '@/lib/calculations/kept-open';
import { fa } from './report-utils';

interface Opts { td: string; title: string; remarks: string; headerBg: string; labelFont: string }

const NA = '<td style="__TD__text-align:right;color:#888;">—</td>';

/** Shared "Comparison of Insurer's Liability" table. Rows with nothing to show are skipped (K.O., missing). */
export function renderLiabilityComparison(c: LiabilityComparison, o: Opts): string {
  const { td, headerBg: bg } = o;
  const r = `${td}text-align:right;`;
  const na = NA.replace('__TD__', td);
  const neg = (v: number) => `<td style="${r}color:#a00;">- ${fa(v)}</td>`;
  const pos = (v: number) => `<td style="${r}">+ ${fa(v)}</td>`;
  const val = (v: number) => `<td style="${r}">${fa(v)}</td>`;
  const row = (label: string, cells: string) => `<tr><td style="${td}">${label}</td>${cells}</tr>`;
  const sum = `border-top:1pt solid ${bg};`;
  const net = (v: number) => `<td style="${r}${sum}">₹ ${fa(v)}</td>`;
  const addl = c.addl;
  const k = c.cash;
  // 5th column only when cash loss is on; every cell helper below is a no-op otherwise.
  const x = (cell: string) => (k ? cell : '');
  const rows = [
    row('Assessed repair cost (incl. GST)', val(c.repair.grand) + na + na + na + x(na)),
    row('Insured Declared Value (IDV)', na + val(c.idv) + val(c.idv) + val(c.idv) + x(na)),
    k ? row('Cash loss gross (before GST, after salvage &amp; towing)', na + na + na + na + val(k.gross)) : '',
    k ? row(`Less: Notional deduction @ ${k.percent}%`, na + na + na + na + neg(k.notional)) : '',
    row('Less: Policy Excess (Comp/Vol)', neg(c.repair.excess) + neg(c.excess) + neg(c.excess) + neg(c.excess) + x(neg(c.excess))),
    row('Less: Salvage Value', neg(c.repair.salvage) + na + neg(c.salvageWithRC) + neg(c.salvageWithoutRC) + x(na)),
    c.missing > 0 ? row('Less: Missing items', na + neg(c.missing) + neg(c.missing) + neg(c.missing) + x(na)) : '',
    row('Add: Towing / Addl. Expenses', pos(c.repair.towing) + pos(addl) + pos(addl) + pos(addl) + x(na)),
    c.repair.keptOpen > 0 ? row('Add: K.O. parts (as per estimate)', pos(c.repair.keptOpen) + na + na + na + x(na)) : '',
    `<tr style="background:#f8fafc;font-weight:700;"><td style="${td}color:${bg};${sum}">NET PAYABLE LIABILITY</td>${net(c.repair.net)}${net(c.totalLoss)}${net(c.netWithRC)}${net(c.netWithoutRC)}${k ? net(k.net) : ''}</tr>`,
  ].join('');

  return `
    <div style="margin-top:10px; margin-bottom:15px; border:1pt solid ${bg}; border-radius:4px; overflow:hidden;">
      <div style="background:${bg}; color:#fff; font-weight:700; font-size:7.5pt; padding:4px; text-align:center; text-transform:uppercase;">
        ${o.title}
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:7pt;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="${td}text-align:left;font-weight:700;">Description</th>
            <th style="${td}width:18%;text-align:right;">Repair Basis</th>
            <th style="${td}width:18%;text-align:right;">Total Loss</th>
            <th style="${td}width:18%;text-align:right;">Net Loss (W/RC)</th>
            <th style="${td}width:18%;text-align:right;">Net Loss (W/O RC)</th>
            ${k ? `<th style="${td}width:18%;text-align:right;">Cash Loss</th>` : ''}
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
      <div style="padding:6px; font-size:${o.labelFont}; color:#333; border-top:0.4pt solid ${bg}; background:#f5faff; line-height:1.4;">
        <span style="font-weight:700; color:${bg};">SURVEYOR'S REMARKS:</span>
        ${o.remarks}
      </div>
    </div>
  `;
}
