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

import { formatDateDMY, formatDateTimeDMY, formatSurveyDateTime, fa, numberToWords, getVehicleAgeMonths, getSurveyorHeader, getSigBlock } from './report-utils';
import { getHtmlScale } from './report-style-utils';
import { preambleFromClaim, estimateTotalInclGst, billCheckPreambleFromClaim } from './final-survey-preamble';
import { projectForBillCheck } from './bill-check-projection';
import { computeRowNet } from '@/lib/calculations/row-net';
import { getDepreciationRate, toDepreciationType } from '@/lib/calculations/depreciation';
import { getCompulsoryExcess, calculateAssessmentSummary } from '@/lib/calculations/assessment';
import { shouldStartSupplementaryBand } from '@/lib/calculations/utils';
import { buildSerialMap } from '@/lib/calculations/serial-numbers';
import { buildPrintShell, footerFromProfile } from './print-shell';

// NOTE: SurveyReportDocument.tsx (React-PDF) is no longer a parallel rendering
// of this report — it is only used by scripts/generate-pdf.ts to produce the
// marketing screenshot. This builder is the single source for the real report.

// ─── Local Helpers ────────────────────────────────────────────────────────────

function fmt2(v: string | number | null | undefined): string {
  const n = parseFloat(String(v || 0));
  return isNaN(n) ? '0.00' : n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// The private getDepRate that used to sit here omitted the tariff's fibre glass
// line (30% flat), so a fibre glass part was depreciated on the metal age scale
// instead — and this report printed the engine's figure in section 8 against
// the copy's figure in section 9, on the same page. The rate table now has one
// home: getDepreciationRate in lib/calculations/depreciation.

function isExpired(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ─── Main HTML Builder ────────────────────────────────────────────────────────

/**
 * The summary is computed here, from this builder's own `ageMonths` and rows —
 * never accepted from a caller.
 *
 * It used to take an `AssessmentSummary` parameter. Callers each computed one
 * their own way, and one of them (FloatingReportPreview) passed `null` for the
 * registration date, so its vehicle age landed in a different depreciation
 * bracket. The result was a summary block whose "Spare Parts" line disagreed
 * with the Metal / Plastic / Glass lines directly beneath it.
 */
/** Which document this builder is rendering. */
export type ReportMode = 'final' | 'bill-check';

export function buildStandardFinalSurveyHTML(
  claim: ClaimData,
  profile: SurveyorProfile,
  mode: ReportMode = 'final'
): string {
  const isBillCheck = mode === 'bill-check';
  const vehicle = claim.vehicle;
  const driver = claim.driver;
  const policy = claim.policy;
  const accident = claim.accident;
  const bc = claim.billCheck;
  // Bill check renders the same report over projected rows. Everything below
  // this line — every total, every GST band — is untouched by the mode.
  const rows = isBillCheck
    ? projectForBillCheck(claim.assessmentRows || [])
    : (claim.assessmentRows || []);

  const depType = toDepreciationType(claim.depreciationType);
  const ageMonths = getVehicleAgeMonths(
    vehicle.dateOfRegistration || null,
    vehicle.yearOfManufacture ? Number(vehicle.yearOfManufacture) : null,
    accident.dateAndTime || null
  );
  const ageLabel = ageMonths > 0 ? `${Math.floor(ageMonths / 12)}yr ${ageMonths % 12}mo` : '';

  // ── Calculations ───────────────────────────────────────────────────────────
  let metal = 0, plastic = 0, glass = 0, fiberglass = 0, disposalNet = 0, labOnlyBase = 0, paintOnlyBase = 0;

  rows.filter(r => r.section === 'parts').forEach(r => {
    if (r.allowed === false) return;
    const dep = r.depOverride !== undefined ? r.depOverride : getDepreciationRate(r.partType, ageMonths, depType);
    const { isDisposal, netBeforeGst } = computeRowNet(r, dep);
    if (isDisposal) {
      disposalNet += netBeforeGst;
    } else {
      if (r.partType === 'metal') metal += netBeforeGst;
      else if (r.partType === 'glass') glass += netBeforeGst;
      else if (r.partType === 'fiberglass') fiberglass += netBeforeGst;
      else plastic += netBeforeGst;
    }
  });

  rows.filter(r => r.section === 'labour').forEach(r => {
    if (r.allowed !== false) labOnlyBase += r.assessed;
  });
  rows.filter(r => r.section === 'paint').forEach(r => {
    if (r.allowed !== false) paintOnlyBase += r.assessed;
  });

  const labBase = labOnlyBase + paintOnlyBase; // combined for grand total
  // GST is per item. The 0.09 / 0.18 literals that used to be here ignored
  // row.gst entirely, so a 28% tyre was totalled at 18%.
  //
  // Computed from this builder's own ageMonths so the summary block and the
  // material rows beneath it can never disagree.
  const summary = calculateAssessmentSummary(
    rows,
    ageMonths,
    depType,
    claim.feeBill?.salvageValue ?? 0,
    getCompulsoryExcess(claim.feeBill),
    claim.feeBill?.voluntaryExcess ?? 0,
  );

  const pb = summary.partsBase;
  const pT = summary.partsTotal;
  const labT = summary.labourOnlyTotal;
  const paintT = summary.paintOnlyTotal;
  const lT = labT + paintT;
  const grand = pT + lT;

  const salvage = claim.feeBill?.salvageValue || 0;
  const volExcess = claim.feeBill?.voluntaryExcess || 0;
  const compExcess = getCompulsoryExcess(claim.feeBill);
  const excess = volExcess + compExcess;
  const net = Math.max(0, grand - salvage - excess);

  // The engine already derives every one of these. This file used to compute
  // its own, filtered by `allowed`, and the two drifted — the builder printed
  // an estimate that excluded whatever the surveyor rejected, which is the one
  // thing the Estimated column exists to show.
  const estPartsBase = summary.estimatePartsBase;
  const estMetal = summary.estimateMetalBase;
  const estPlastic = summary.estimatePlasticBase;
  const estGlass = summary.estimateGlassBase;
  const estFbr = summary.estimateFiberglassBase;
  const estLabOnly = summary.estimateLabourOnlyBase;
  const estPaintOnly = summary.estimatePaintOnlyBase;
  const estLabBase = estLabOnly + estPaintOnly;

  // Section 9's Assessed column prints the pre-depreciation figure, so its
  // subtotal must too. The engine only exposes post-depreciation totals, which
  // is a different number and belongs in a different column.
  const rawAssessed = (section: 'parts' | 'labour' | 'paint') =>
    rows.filter(r => r.section === section && r.allowed !== false).reduce((s, r) => s + r.assessed, 0);
  const assessedPartsRaw = rawAssessed('parts');
  const assessedLabourRaw = rawAssessed('labour');
  const assessedPaintRaw = rawAssessed('paint');

  // ── Font scale (resolved once, used throughout) ────────────────────────────
  const scale = getHtmlScale(claim.reportSettings?.fontScale);

  // ── Table style shorthands ─────────────────────────────────────────────────
  const ts = `width:100%;border-collapse:collapse;font-size:${scale.cellFont};margin-bottom:4px;`;
  const th = `background:#0d1b2a;color:#fff;padding:${scale.cellPaddingV} ${scale.cellPaddingH};font-size:${scale.labelFont};`;
  const td = `padding:${scale.cellPaddingV} ${scale.cellPaddingH};border:0.4pt solid #bbb;vertical-align:top;`;
  const tdr = `padding:${scale.cellPaddingV} ${scale.cellPaddingH};border:0.4pt solid #bbb;text-align:right;white-space:nowrap;`;
  const sec = `padding:${scale.cellPaddingV} ${scale.cellPaddingH};font-weight:700;background:#e8e3da;font-size:${scale.labelFont};text-transform:uppercase;border:0.4pt solid #bbb;`;
  const sub = `padding:${scale.cellPaddingV} ${scale.cellPaddingH};font-weight:700;background:#dff0ec;color:#1a5a50;border:0.4pt solid #bbb;`;

  // ── Section 9 geometry ─────────────────────────────────────────────────────
  // The printable width is 186mm (A4 less the shell's 12mm side margins). The
  // old `pt` widths were only hints — the table used the default `auto` layout,
  // so `white-space:nowrap` on every numeric cell let a long figure widen its
  // column and push the table off the page. Adding the FbrGls column made a
  // tight table overflow.
  //
  // Fixed layout + percentage widths makes the declared widths binding, and the
  // description column wraps instead of shoving its neighbours.
  //
  // ponytail: FbrGls is the only conditional column. Metal / Plastic / Glass
  // always print — they are the three heads the surveyor reads for, and hiding
  // one because a claim happens not to use it changes a familiar document.
  const hasFiberglass = rows.some(
    r => r.section === 'parts' && r.allowed !== false && r.partType === 'fiberglass'
  );
  /** Material columns present: Metal, Plastic, [FbrGls], Glass. */
  const NMAT = hasFiberglass ? 4 : 3;
  /** Sr, Particulars, Type, Est, Assessed, Dep%, <materials>, GST%, Price+GST. */
  const NCOLS = 8 + NMAT;

  // Percentages sum to 100 in both layouts; the FbrGls share goes to Particulars.
  // Sr / Dep% / GST% are trimmed to what their content actually needs, and the
  // money columns are sized to hold a six-figure amount *with paise* on one
  // line — "1,32,500.00" is an ordinary headlamp, and a figure that breaks
  // across two lines is the one thing that must not happen in this table.
  // The description column absorbs the difference; it wraps by design.
  //
  // Paise are not dropped to buy width: the item column has to tie back to
  // section 8 exactly, and a display-only rounding would leave the subtotals
  // looking a rupee or two out to anyone auditing the document.
  // Sr holds two digits without breaking at the largest font scale: 4.5% of
  // 186mm is 23.7pt, less 10.8pt of padding/border, leaves 12.9pt for a
  // two-digit number that measures ~11.7pt at 10.5pt type.
  const W = {
    sr: 4.5,
    particulars: hasFiberglass ? 17.5 : 26,
    type: 7,
    est: 9.5,
    assessed: 9.5,
    dep: 4.5,
    material: 8.5,
    gst: 4.5,
    price: 9,
  };

  const ts9 = `width:100%;table-layout:fixed;border-collapse:collapse;font-size:${scale.cellFont};margin-bottom:4px;`;
  // No `nowrap` here: under a fixed layout an unwrappable figure overflows its
  // cell instead of widening it, which is worse than a two-line number.
  // `overflow-wrap` is the backstop for an unusually large amount.
  const tdr9 = `padding:${scale.cellPaddingV} ${scale.cellPaddingH};border:0.4pt solid #bbb;text-align:right;overflow-wrap:anywhere;`;
  // Long part descriptions must break rather than force the column wider.
  const td9 = `${td}overflow-wrap:anywhere;word-break:break-word;`;
  // Sr must NOT inherit td9's break rules — they split a two-digit number
  // across two lines rather than wrapping it as a word.
  const tdsr9 = `${td}text-align:center;white-space:nowrap;`;
  // Every section 9 heading already carries "₹", so the cells drop the symbol.
  // Repeating it cost two characters in each of eight money columns, which is
  // what forced figures like 1,32,500.00 to break across two lines.
  const m9 = (v: number) => fmt2(v);

  // ── Parts rows (Sr | Particulars | Type | Est | Assessed | Dep% | Metal | Plastic | [FbrGls] | Glass | GST% | Price+GST)
  // Numbered across every row, rejected included, so a gap in the Bill Check
  // tells the insurer an item was refused without cross-referencing. `rows` is
  // unfiltered here even in bill-check mode — the filter happens below.
  const serials = buildSerialMap(rows);
  // Bill check verifies what was allowed — a disallowed item was never the
  // insurer's liability, so it does not appear here at all. The final report
  // keeps disallowed rows visible, marked NOT ALLOWED, for the surveyor's own
  // record of what was considered and rejected.
  const partRows = rows.filter(r => r.section === 'parts' && (!isBillCheck || r.allowed !== false));
  const partsHtml = partRows.map((r, idx) => {
    const dep = r.depOverride !== undefined ? r.depOverride : getDepreciationRate(r.partType, ageMonths, depType);
    const depLabel = r.depOverride !== undefined ? `${dep}%*` : `${dep}%`;
    const disallowed = r.allowed === false;
    const { isDisposal, afterDep, netBeforeGst } = disallowed ? { isDisposal: false, afterDep: 0, netBeforeGst: 0 } : computeRowNet(r, dep);
    const gstPct = r.gst || 18;
    const cellValue = isDisposal ? netBeforeGst : netBeforeGst * (1 + gstPct / 100);
    // The Assessed column already carries the NOT ALLOWED flag; repeating it
    // here only wrapped it across two lines. Labour rows already print "—".
    const cellLabel = disallowed ? '—' : isDisposal ? `${m9(cellValue)} DISP` : m9(cellValue);
    const cellStyle = disallowed ? `${tdr9}color:#a00;text-align:center;` : isDisposal ? `${tdr9}color:#b45309;font-weight:600;` : `${tdr9}font-weight:600;`;
    const matCell = (type: string) =>
      `<td style="${tdr9}">${r.partType === type && !disallowed ? m9(afterDep) : '—'}</td>`;

    const bandHtml = shouldStartSupplementaryBand(partRows, idx)
      ? `<tr><td colspan="12" style="padding:4px 8px;text-align:center;font-size:10pt;font-weight:600;color:#666;background:linear-gradient(to right,#f5f5f5,#fafafa,#f5f5f5);">Supplementary Estimate</td></tr>`
      : '';

    return bandHtml + `<tr>
      <td style="${tdsr9}">${serials.get(r.id) ?? 0}</td>
      <td style="${td9}">${r.particulars}</td>
      <td style="${td9}text-align:center;">${r.partType === 'plastic' ? 'Pla/Rub' : r.partType === 'fiberglass' ? 'FbrGls' : r.partType.charAt(0).toUpperCase() + r.partType.slice(1)}</td>
      <td style="${tdr9}">${isBillCheck && r.billStatus === 'not-in-bill' ? 'No Bill' : m9(r.estimated)}</td>
      <td style="${tdr9}${disallowed ? 'color:#a00;font-weight:700;font-size:6.5pt;text-align:center;' : ''}">${disallowed ? 'NOT ALLOWED' : m9(r.assessed)}</td>
      <td style="${tdr9}${r.depOverride !== undefined ? 'color:#b45309;' : ''}">${depLabel}</td>
      ${matCell('metal')}
      ${matCell('plastic')}
      ${hasFiberglass ? matCell('fiberglass') : ''}
      ${matCell('glass')}
      <td style="${tdr9}text-align:center;">${isDisposal ? '0%' : `${gstPct}%`}</td>
      <td style="${cellStyle}">${cellLabel}</td>
    </tr>`;
  }).join('');

  // ── Labour / Painting rows ────────────────────────────────────────────────
  // These used to emit 10 cells spanning 11 columns, with their 6th cell
  // labelled GST% while the header's 6th column is Dep% — so every figure from
  // there rightwards sat under the wrong heading. They now follow the same
  // column order as the parts rows: Dep% shows the row's real rate (the
  // material columns still read "—", parts-only).
  //
  // Labour and paint carry no automatic depreciation, but a surveyor may set a
  // manual depOverride. This row used to price straight off `r.assessed` and
  // hardcode Dep% to "—", so an override was both invisible and uncharged.
  const serviceRowHtml = (section: 'labour' | 'paint', typeLabel: string) => {
    const sectionRows = rows.filter(r => r.section === section && (!isBillCheck || r.allowed !== false));
    return sectionRows.map((r, idx) => {
      const disallowed = r.allowed === false;
      const dep = r.depOverride !== undefined ? r.depOverride : getDepreciationRate(r.partType, ageMonths, depType);
      const depLabel = r.depOverride !== undefined ? `${dep}%*` : `${dep}%`;
      const gstPct = r.gst || 18;
      const { netBeforeGst } = disallowed ? { netBeforeGst: 0 } : computeRowNet(r, dep);
      const priceGst = disallowed ? 0 : netBeforeGst * (1 + gstPct / 100);

      const bandHtml = shouldStartSupplementaryBand(sectionRows, idx)
        ? `<tr><td colspan="9" style="padding:4px 8px;text-align:center;font-size:10pt;font-weight:600;color:#666;background:linear-gradient(to right,#f5f5f5,#fafafa,#f5f5f5);">Supplementary Estimate</td></tr>`
        : '';

      return bandHtml + `<tr>
      <td style="${tdsr9}">${serials.get(r.id) ?? 0}</td>
      <td style="${td9}">${r.particulars}</td>
      <td style="${td9}text-align:center;">${typeLabel}</td>
      <td style="${tdr9}">${isBillCheck && r.billStatus === 'not-in-bill' ? 'No Bill' : m9(r.estimated)}</td>
      <td style="${tdr9}${disallowed ? 'color:#a00;font-weight:700;font-size:6.5pt;text-align:center;' : ''}">${disallowed ? 'NOT ALLOWED' : m9(r.assessed)}</td>
      <td style="${tdr9}text-align:center;${r.depOverride !== undefined ? 'color:#b45309;' : ''}">${depLabel}</td>
      <td colspan="${NMAT}" style="${tdr9}text-align:center;">—</td>
      <td style="${tdr9}text-align:center;">${gstPct}%</td>
      <td style="${tdr9}${disallowed ? 'color:#a00;' : 'font-weight:600;'}">${disallowed ? '—' : m9(priceGst)}</td>
    </tr>`;
    }).join('');
  };

  const labOnlyHtml = serviceRowHtml('labour', 'Labour');
  const paintHtml = serviceRowHtml('paint', 'Paint');

  // ── DL expiry checks — MOVED TO UI (DriverForm warning banner) ────────────
  // The report no longer auto-injects EXPIRED. Surveyor decides via MDL Status.
  // const ntExpired = isExpired(driver.validityNonTransport);
  // const tExpired = isExpired(driver.validityTransport);

  // ── Policy / depreciation label ────────────────────────────────────────────
  const depLabel = depType === 'nil' ? 'Nil Depreciation' : `Standard IRDAI ${ageLabel}`;

  // ── Sub-header row reused for Labour and Painting sections ────────────────
  // Under a fixed layout the column widths come from the table's first row, so
  // this repeats no widths — it only has to match the main header cell-for-cell.
  const labPaintSubHeader = `<tr>
      <th style="${th}text-align:center;">Sr.</th>
      <th style="${th}">Particulars</th>
      <th style="${th}text-align:center;">Type</th>
      <th style="${th}text-align:right;">${isBillCheck ? 'Bill ₹' : 'Est. ₹'}</th>
      <th style="${th}text-align:right;">Assessed ₹</th>
      <th style="${th}text-align:center;">Dep%</th>
      <th colspan="${NMAT}" style="${th}text-align:center;">—</th>
      <th style="${th}text-align:center;">GST%</th>
      <th style="${th}text-align:right;">Price+GST ₹</th>
    </tr>`;

  // ── Sections that differ by mode ────────────────────────────────────────────
  // Bill check reads as the final report with its narrative sections removed.
  // Sections 1, 2, 8, 9 and the GST tables are identical either way; only these
  // three change, and the original section numbers are kept so a reader moving
  // between the two documents finds the same content under the same number.
  const driverSectionHtml = `<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">3. DRIVER'S PARTICULARS</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};width:18%;">Driver Name</td>
    <td style="${td}font-weight:600;" colspan="3">${driver.name || '—'}${driver.parentName ? ' ' + (driver.relationType || 'S/o') + ' ' + driver.parentName : ''}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">M.D.L. No.</td>
    <td style="${td}font-family:monospace;width:32%;">${driver.licenceNumber || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Date of Birth</td>
    <td style="${td}">${formatDateDMY(driver.dateOfBirth) || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Licence Classes</td>
    <td style="${td}">${driver.vehicleClasses || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Badge No.</td>
    <td style="${td}">${driver.badgeNumber || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Date of Issue</td>
    <td style="${td}">${formatDateDMY(driver.dateOfIssue) || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Non-Transport Valid</td>
    <td style="${td}">${formatDateDMY(driver.validityNonTransport)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Transport Valid</td>
    <td style="${td}">${formatDateDMY(driver.validityTransport)}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Hazardous Goods Endorsement</td>
    <td style="${td}">${driver.hazardousEndorsement === 'yes' ? 'Yes' + (driver.hazardousEndorsementNote ? ' — ' + driver.hazardousEndorsementNote : '') : driver.hazardousEndorsement === 'no' ? 'No' : '—'}</td>
  </tr>
</table>`;

  const accidentSectionHtml = `<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">4. ACCIDENT &amp; SURVEY DETAILS</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};width:18%;">Accident Date &amp; Time</td>
    <td style="${td}width:32%;">${formatDateTimeDMY(accident.dateAndTime)}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Place</td>
    <td style="${td}">${accident.placeOfAccident || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Police Station</td>
    <td style="${td}">${accident.policeStation || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">FIR No. & Date</td>
    <td style="${td}">${accident.firNumber || '—'} / ${formatDateDMY(accident.firDate)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Appointment Date</td>
    <td style="${td}">${formatDateDMY(accident.appointmentDate)}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};"></td>
    <td style="${td}"></td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Date &amp; Time of Survey</td>
    <td style="${td}">${formatSurveyDateTime(accident.dateOfSurvey, accident.timeOfSurvey)}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Place of Survey</td>
    <td style="${td}">${accident.placeOfSurvey || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Third Party</td>
    <td style="${td}" colspan="3">${accident.thirdPartyDetails || 'NIL'}</td>
  </tr>
</table>`;

  const causeSectionHtml = `<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">7. CAUSE &amp; NATURE OF ACCIDENT</div>
<div style="font-size:${scale.cellFont};margin-bottom:4px;padding:2px 4px;border:0.4pt solid #bbb;background:#fafaf7;line-height:1.5;">${accident.causeOfAccident || '—'}</div>`;

  // Section 4 in bill check mode: the workshop invoice this document verifies.
  // Every field here has a real writer — workshopName and dateOfSurvey from
  // AccidentForm, billNo/billDate/billTotal from the Bill Check tab. Repair
  // Authorised and Est. Repair Completion are deliberately excluded: no screen
  // in this codebase writes either field, so they would always print blank.
  const billRefSectionHtml = `<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">4. WORKSHOP INVOICE &amp; BILL REFERENCE</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};width:18%;">Workshop</td>
    <td style="${td}width:32%;">${accident.workshopName || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};width:18%;">Date of Final Survey</td>
    <td style="${td}">${formatDateDMY(accident.dateOfSurvey)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Bill / Invoice No.</td>
    <td style="${td}font-weight:700;">${bc?.billNo || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Bill / Invoice Date</td>
    <td style="${td}font-weight:700;">${formatDateDMY(bc?.billDate)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Total Bill Amount (incl. GST)</td>
    <td style="${td}font-weight:700;">₹ ${fmt2(bc?.billTotal || 0)}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Allowed by this Report (incl. GST)</td>
    <td style="${td}font-weight:700;">₹ ${fmt2(grand)}</td>
  </tr>
</table>`;

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT HTML
  // ─────────────────────────────────────────────────────────────────────────
  return `${getSurveyorHeader(profile)}
<div style="text-align:center;font-weight:700;font-size:8.5pt;margin-bottom:3px;text-decoration:underline;letter-spacing:0.05em;">PRIVATE AND CONFIDENTIAL — MOTOR ${isBillCheck ? 'BILL CHECK REPORT' : '(FINAL) SURVEY REPORT'}</div>
<p style="font-size:6.5pt;font-style:italic;margin-bottom:4px;text-align:justify;color:#444;">This report is issued by us as Licenced Surveyors without prejudice, in respect of cause, nature &amp; extent of loss/damage, subject to the terms &amp; conditions of the Insurance policy.</p>

<table style="${ts}">
  <tr>
    <td style="${td}color:#444;width:18%;font-size:${scale.labelFont};">Report No.</td>
    <td style="${td}font-weight:700;width:32%;">${claim.reportNo || '—'}</td>
    <td style="${td}color:#444;width:18%;font-size:${scale.labelFont};">Date of report</td>
    <td style="${td}font-weight:700;">${formatDateDMY(claim.reportDate)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Policy No.</td>
    <td style="${td}font-family:monospace;">${policy.policyNumber || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Claim No.</td>
    <td style="${td}font-family:monospace;">${policy.claimNumber || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Policy Period</td>
    <td style="${td}">${formatDateDMY(policy.periodFrom)} to ${formatDateDMY(policy.periodTo)}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">I.D.V.</td>
    <td style="${td}font-weight:600;">₹ ${fmt2(policy.idv)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Policy Type</td>
    <td style="${td}" colspan="3">${policy.policyType || '—'} — <b>${depLabel}</b></td>
  </tr>
</table>

<div style="font-weight:700;font-size:7pt;background:#f5f2ee;width:100%;padding:2px 4px;border:0.4pt solid #bbb;border-bottom:none;">1. INSURER &amp; INSURED DETAILS</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;width:18%;font-size:${scale.labelFont};">Insurer</td>
    <td style="${td}" colspan="3">${policy.insurerName || '—'} | Appointing: ${policy.appointingOffice || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Insured Name</td>
    <td style="${td}font-weight:600;width:32%;">${policy.insuredName || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Mobile</td>
    <td style="${td}">${policy.insuredMobile || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Address</td>
    <td style="${td}" colspan="3">${policy.insuredAddress || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">H.P.A.</td>
    <td style="${td}" colspan="3">${policy.hpaWith || vehicle.hypothecation || 'NIL'}</td>
  </tr>
</table>

<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">2. VEHICLE PARTICULARS</div>
<table style="${ts}">
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};width:18%;">Reg. No.</td>
    <td style="${td}font-weight:700;width:32%;">${vehicle.registrationNumber || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Date of Reg.</td>
    <td style="${td}">${formatDateDMY(vehicle.dateOfRegistration)}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Registering Authority</td>
    <td style="${td}" colspan="3">${vehicle.registeringAuthority || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Make / Model / Year</td>
    <td style="${td}" colspan="3"><b>${vehicle.make || '—'}</b> / ${vehicle.model || '—'} / ${vehicle.yearOfManufacture || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Chassis No.</td>
    <td style="${td}font-family:monospace;">${vehicle.chassisNumber || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Engine No.</td>
    <td style="${td}font-family:monospace;">${vehicle.engineNumber || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Body / Colour / Fuel</td>
    <td style="${td}" colspan="3">${vehicle.bodyType || '—'} / ${vehicle.colour || '—'} / ${vehicle.fuel || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">CC / Odometer</td>
    <td style="${td}">${vehicle.cubicCapacity || '—'} / ${vehicle.odometer || '—'} KM</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Pre-Accident Cond.</td>
    <td style="${td}" colspan="3">${vehicle.preAccidentCondition || '—'}</td>
  </tr>
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">GVW</td>
    <td style="${td}">${vehicle.registeredLoadWeight || '—'}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Seating Capacity</td>
    <td style="${td}">${vehicle.seatingCapacity || '—'}</td>
  </tr>
</table>

${isBillCheck ? billRefSectionHtml : driverSectionHtml + '\n\n' + accidentSectionHtml}
${isBillCheck ? '' : '\n' + causeSectionHtml}

<p style="font-size:${scale.cellFont};line-height:1.5;text-align:justify;margin:4px 0;color:#000;">${isBillCheck
  ? billCheckPreambleFromClaim(claim, net)
  : ((claim.reportPreamble && claim.reportPreamble.trim()) ? claim.reportPreamble : preambleFromClaim(claim, estimateTotalInclGst(rows), net))}</p>
<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">8. ASSESSMENT SUMMARY</div>
<table style="${ts}">
  <thead>
    <tr>
      <th style="${th};width:40%;text-align:left;">Head</th>
      <th style="${th};text-align:right;">${isBillCheck ? 'Billed' : 'Estimated (before GST)'}</th>
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
    ${[
      { label: 'Metal', est: estMetal, ass: summary.metalTotal, incl: summary.metalTotalInclGst },
      { label: 'Plastic / Rubber', est: estPlastic, ass: summary.plasticTotal, incl: summary.plasticTotalInclGst },
      { label: 'Glass', est: estGlass, ass: summary.glassTotal, incl: summary.glassTotalInclGst },
      { label: 'Fibre Glass', est: estFbr, ass: summary.fiberglassTotal, incl: summary.fiberglassTotalInclGst },
    ].filter(s => s.est > 0 || s.ass > 0).map(s => `
    <tr>
      <td style="${td}padding-left:14pt;color:#555;">↳ ${s.label}</td>
      <td style="${tdr}color:#555;">${fa(s.est)}</td>
      <td style="${tdr}color:#555;">${fa(s.ass)}</td>
      <td style="${tdr}color:#555;">${fa(s.incl)}</td>
    </tr>`).join('')}
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
  const totalExcess = (claim.feeBill?.voluntaryExcess || 0) + getCompulsoryExcess(claim.feeBill);
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
      <div style="padding:6px; font-size:${scale.labelFont}; color:#333; border-top:0.4pt solid #0d1b2a; background:#f5faff; line-height:1.4;">
        <span style="font-weight:700; color:#0d1b2a;">SURVEYOR'S REMARKS:</span> 
        ${claim.totalLossDetails.remarks || `Since the assessed repair cost is substantial relative to the IDV, the settlement comparison is provided above for the insurer's final decision.`}
      </div>
    </div>
  `;
})() : ''}

<div style="font-weight:700;font-size:7pt;background:#0d1b2a;color:#fff;padding:2px 4px;margin-bottom:2px;">9. DETAILS OF ${isBillCheck ? 'BILL CHECK' : 'ASSESSMENT'}</div>
<table style="${ts9}">
  <thead>
    <tr>
      <th style="${th}width:${W.sr}%;text-align:center;">Sr.</th>
      <th style="${th}width:${W.particulars}%;">Particulars</th>
      <th style="${th}width:${W.type}%;text-align:center;">Type</th>
      <th style="${th}width:${W.est}%;text-align:right;">${isBillCheck ? 'Bill ₹' : 'Est. ₹'}</th>
      <th style="${th}width:${W.assessed}%;text-align:right;">Assessed ₹</th>
      <th style="${th}width:${W.dep}%;text-align:center;">Dep%</th>
      <th style="${th}width:${W.material}%;text-align:right;">Metal ₹</th>
      <th style="${th}width:${W.material}%;text-align:right;">Pla/Rub ₹</th>
      ${hasFiberglass ? `<th style="${th}width:${W.material}%;text-align:right;">FbrGls ₹</th>` : ''}
      <th style="${th}width:${W.material}%;text-align:right;">Glass ₹</th>
      <th style="${th}width:${W.gst}%;text-align:center;">GST%</th>
      <th style="${th}width:${W.price}%;text-align:right;">Price+GST ₹</th>
    </tr>
  </thead>
  <tbody>
    <tr><td colspan="${NCOLS}" style="${sec}">SPARE PARTS</td></tr>
    ${partsHtml}
    <tr>
      <td colspan="3" style="${sub}text-align:right;font-size:${scale.labelFont};">Sub-Total Parts (after dep, before GST)</td>
      <td style="${sub}text-align:right;">${m9(estPartsBase)}</td>
      <td style="${sub}text-align:right;">${m9(assessedPartsRaw)}</td>
      <td style="${sub}text-align:center;">—</td>
      <td style="${sub}text-align:right;">${m9(metal)}</td>
      <td style="${sub}text-align:right;">${m9(plastic)}</td>
      ${hasFiberglass ? `<td style="${sub}text-align:right;">${m9(fiberglass)}</td>` : ''}
      <td style="${sub}text-align:right;">${m9(glass)}</td>
      <td style="${sub}text-align:center;">—</td>
      <td style="${sub}text-align:right;font-weight:700;">${m9(pT)}</td>
    </tr>
    <tr><td colspan="${NCOLS}" style="${sec}">LABOUR</td></tr>
    ${labPaintSubHeader}
    ${labOnlyHtml}
    <tr>
      <td colspan="3" style="${sub}text-align:right;font-size:${scale.labelFont};">Sub-Total Labour (incl. GST)</td>
      <td style="${sub}text-align:right;">${m9(estLabOnly)}</td>
      <td style="${sub}text-align:right;">${m9(assessedLabourRaw)}</td>
      <td style="${sub}text-align:center;">—</td>
      <td colspan="${NMAT + 1}" style="${sub}text-align:right;">${m9(labOnlyBase)}</td>
      <td style="${sub}text-align:right;font-weight:700;">${m9(labT)}</td>
    </tr>
    <tr><td colspan="${NCOLS}" style="${sec}">PAINTING</td></tr>
    ${labPaintSubHeader}
    ${paintHtml}
    <tr>
      <td colspan="3" style="${sub}text-align:right;font-size:${scale.labelFont};">Sub-Total Painting (incl. GST)</td>
      <td style="${sub}text-align:right;">${m9(estPaintOnly)}</td>
      <td style="${sub}text-align:right;">${m9(assessedPaintRaw)}</td>
      <td style="${sub}text-align:center;">—</td>
      <td colspan="${NMAT + 1}" style="${sub}text-align:right;">${m9(paintOnlyBase)}</td>
      <td style="${sub}text-align:right;font-weight:700;">${m9(paintT)}</td>
    </tr>
  </tbody>
</table>

<p style="font-size:${scale.cellFont};line-height:1.5;margin-bottom:3px;text-align:left;color:#000;">The damages sustained by the vehicle were concurrent with the cause and nature of the accident.</p>
<p style="font-size:${scale.cellFont};font-weight:700;text-align:left;margin-bottom:5px;color:#000;">ISSUED WITHOUT PREJUDICE</p>
${getSigBlock(profile)}
<div style="font-size:6pt;color:#666;margin-top:4px;border-top:0.4pt solid #ccc;padding-top:2px;">Encl: Repair Estimate / Tax Invoice &amp; Digital Photographs</div>`;
}

// ─── Wrap in a full printable A4 HTML document ────────────────────────────────

export function buildStandardPrintDocument(
  claim: ClaimData,
  profile: SurveyorProfile,
  mode: ReportMode = 'final'
): string {
  const reg = claim.vehicle?.registrationNumber || 'Claim';
  return buildPrintShell(buildStandardFinalSurveyHTML(claim, profile, mode), {
    title: mode === 'bill-check'
      ? `Standard Bill Check Report — ${reg}`
      : `Standard Final Survey Report — ${reg}`,
    footerLeft: footerFromProfile(profile),
    fontSize: '7.8pt',
  });
}

// ─── Trigger the print window ─────────────────────────────────────────────────

export function triggerStandardPrint(
  claim: ClaimData,
  profile: SurveyorProfile,
  mode: ReportMode = 'final'
): void {
  const html = buildStandardPrintDocument(claim, profile, mode);
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
