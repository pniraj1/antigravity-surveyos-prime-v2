// ═══════════════════════════════════════════════════════════
// NIA ASSESSMENT EXCEL
// The Primary_Assessment_Template that New India's surveyor portal imports.
// Spec: docs/superpowers/specs/2026-09-18-nia-assessment-excel-design.md
// Portal behaviour: docs/portal-integration.md §5.3
// ═══════════════════════════════════════════════════════════

import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import { getDepreciationRate } from '@/lib/calculations/depreciation';
import { computeRowNet, effectiveAssessed } from '@/lib/calculations/row-net';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/** The portal's header row, in the order it expects. It counts these keys. */
export const NIA_COLUMNS = [
  'SlNo',
  'category',
  'description',
  'partName',
  'serviceType',
  'estimatedAmount',
  'billedAmount',
  'assessedAmount',
  'depreciationPercentage',
  'hsnCode',
  'gstPercentage',
] as const;

export type NiaDescription =
  | 'Parts at Agewise Depreciation'
  | 'Parts at 50% Depreciation'
  | 'Parts at 30% Depreciation'
  | 'Parts at Cost'
  | 'Labor charges for Removing and Refitting'
  | 'Other Labor Charges';

export interface NiaAssessmentRow {
  SlNo: number;
  category: 'Spare Parts' | 'Labor Charges';
  description: NiaDescription;
  partName: string;
  serviceType: 'REPLACE' | 'ALLOW' | 'NOT ALLOWED';
  /** All amounts are strings: the portal reads assessedAmount with a string method. */
  estimatedAmount: string;
  billedAmount: string;
  /** Pre-depreciation. The portal applies the rate itself. */
  assessedAmount: string;
  depreciationPercentage: string;
  hsnCode: string;
  gstPercentage: string;
}

export interface NiaPainting {
  estimate: number;
  assessed: number;
  billed: number;
}

const money = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2);
const whole = (n: number) => String(Math.round(Number.isFinite(n) ? n : 0));

/**
 * The portal validates HSN against its own table and takes the GST rate from
 * it, so the code must be one known to be on that table. Motor rows carry only
 * these three rates.
 */
function hsnForRate(gst: number, partName: string): string {
  if (gst === 28) return '8708';
  if (gst === 0) return '72041000';
  if (gst === 18) return '8512';
  throw new Error(`"${partName}" has GST ${gst}%; the New India portal accepts only 0, 18 or 28.`);
}

/** The portal's free-text inputs reject these characters; part names carry them often. */
const cleanName = (s: string) =>
  s.replace(/[<>^&\\|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Item';

/**
 * The portal sets and locks the depreciation rate from this string for every
 * value except "Parts at Agewise Depreciation", which reads our number.
 */
function descriptionFor(r: AssessmentRow, depType: DepreciationType): NiaDescription {
  if (r.section === 'labour') return 'Labor charges for Removing and Refitting';
  if (r.isDisposal) return 'Parts at Cost';
  // The portal locks 50%/30%/0% from the class descriptions and reads our
  // rate only for Agewise. When our rate is not the class default — a nil
  // depreciation policy, or a surveyor override — Agewise is the only
  // description that carries the truth.
  if (depType === 'nil' || r.depOverride !== undefined) return 'Parts at Agewise Depreciation';
  switch (r.partType) {
    case 'plastic':
      return 'Parts at 50% Depreciation';
    case 'fiberglass':
      return 'Parts at 30% Depreciation';
    case 'glass':
      return 'Parts at Cost';
    default:
      return 'Parts at Agewise Depreciation';
  }
}

/**
 * Builds the sheet rows. Parts and labour only; paint is typed into the
 * portal separately (see `niaPainting`). Disallowed rows are kept, at zero,
 * so the insurer sees what was claimed.
 */
export function niaAssessmentRows(
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
): NiaAssessmentRow[] {
  const depRateFor = (r: AssessmentRow) =>
    r.depOverride !== undefined
      ? r.depOverride
      : getDepreciationRate(r.partType, ageMonths, depType);

  const sheet = rows
    .filter((r) => r.section === 'parts' || r.section === 'labour')
    .map((r, i): NiaAssessmentRow => {
      const isLabour = r.section === 'labour';
      const disposal = !isLabour && !!r.isDisposal;

      // A used part's allowed value is already what the surveyor is paying —
      // it must not be depreciated again, and it carries no GST.
      // effectiveAssessed halves IMT-23 rows; computeRowNet applies the same, so disposal and normal rows share one basis.
      const assessed = !r.allowed
        ? 0
        : disposal
          ? computeRowNet(r, depRateFor(r)).netBeforeGst
          : effectiveAssessed(r);
      const gst = disposal ? 0 : r.gst;
      const dep = isLabour || disposal ? 0 : depRateFor(r);

      return {
        SlNo: i + 1,
        category: isLabour ? 'Labor Charges' : 'Spare Parts',
        description: descriptionFor(r, depType),
        partName: cleanName(r.particulars ?? ''),
        serviceType: !r.allowed ? 'NOT ALLOWED' : isLabour ? 'ALLOW' : 'REPLACE',
        estimatedAmount: money(r.estimated),
        billedAmount: money(r.billedTaxable ?? 0),
        assessedAmount: money(assessed),
        depreciationPercentage: whole(dep),
        hsnCode: disposal ? '72041000' : hsnForRate(gst, cleanName(r.particulars ?? '')),
        gstPercentage: whole(gst),
      };
    });

  // The portal takes 50% off paint material in every painting mode, with no
  // policy check. On a nil-depreciation policy surveyors route painting
  // through the labour column, where no depreciation applies; do it for them.
  if (depType === 'nil' && rows.some((r) => r.section === 'paint')) {
    const p = niaPainting(rows);
    sheet.push({
      SlNo: sheet.length + 1,
      category: 'Labor Charges',
      description: 'Other Labor Charges',
      partName: 'Painting Charges',
      serviceType: 'ALLOW',
      estimatedAmount: money(p.estimate),
      billedAmount: money(p.billed),
      assessedAmount: money(p.assessed),
      depreciationPercentage: '0',
      hsnCode: '8512',
      gstPercentage: '18',
    });
  }

  return sheet;
}

/**
 * The painting figures. On a standard policy the surveyor types estimate and
 * assessed into the portal's Painting section under "Consolidated" and the
 * portal depreciates the material half itself, so both are pre-depreciation
 * sums. On a nil-dep policy they feed the labour row below instead.
 */
export function niaPainting(rows: AssessmentRow[]): NiaPainting {
  const paint = rows.filter((r) => r.section === 'paint');
  const allowed = paint.filter((r) => r.allowed);
  return {
    estimate: paint.reduce((s, r) => s + (r.estimated || 0), 0),
    assessed: allowed.reduce((s, r) => s + effectiveAssessed(r), 0),
    billed: allowed.reduce((s, r) => s + (r.billedTaxable ?? 0), 0),
  };
}

/** Pure: the workbook the portal expects. Kept separate so it can be tested. */
export function buildNiaWorkbook(rows: NiaAssessmentRow[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Primary_Assessment_Template');
  ws.addRow([...NIA_COLUMNS]);
  for (const r of rows) ws.addRow(NIA_COLUMNS.map((c) => r[c]));
  return wb;
}

/** Browser only. Builds and downloads `<claimNo>_Primary_Assessment_Template.xlsx`. */
export async function exportNiaAssessmentExcel(
  claimNo: string,
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
): Promise<void> {
  const wb = buildNiaWorkbook(niaAssessmentRows(rows, ageMonths, depType));
  const buffer = await wb.xlsx.writeBuffer();
  const safe = (claimNo || 'claim').replace(/[^A-Za-z0-9_-]+/g, '_');
  saveAs(new Blob([buffer]), `${safe}_Primary_Assessment_Template.xlsx`);
}
