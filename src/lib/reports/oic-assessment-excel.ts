// ═══════════════════════════════════════════════════════════
// OIC ASSESSMENT EXCEL (Oriental Insurance Company Limited)
// Builds the 2-sheet Excel workbook (9400ExcelOICL.xlsx format)
// for upload to OIC's Motor Surveyor OD assessment portal.
// Spec: SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Specs/2026-11-05-oic-assessment-excel-and-portal-mapping-design.md
// ═══════════════════════════════════════════════════════════

import type { AssessmentRow } from '@/types/assessment';
import type { DepreciationType } from '@/types';
import { getDepreciationRate } from '@/lib/calculations/depreciation';
import { computeRowNet, effectiveAssessed } from '@/lib/calculations/row-net';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { saveDocuments } from '@/lib/documents/sink';

export const OIC_INVOICE_COLUMNS = [
  'Invoice Number',
  'Invoice Date (DD-MM-YYYY)',
  'Invoice GST Type',
  'Invoice Amount',
  'Invoice GST Amount',
] as const;

export const OIC_ITEM_COLUMNS = [
  'Invoice Number',
  'Item Description',
  'Item Sub Type',
  'Side Description',
  'Item Amount',
  'Depreciation Rate',
  'GST Rate',
  'Estimated Amount',
  'Estimated Amount Remarks',
  'HSN Code',
  'GST Amount',
] as const;

export type OicItemDescription =
  | 'Plastic'
  | 'Metallic Parts'
  | 'Glass'
  | 'Non-Metalic Parts'
  | 'Labour Charge'
  | 'Others';

export type OicSideDescription =
  | 'Left'
  | 'Right'
  | 'Bottom'
  | 'Top'
  | 'Rear'
  | 'Front'
  | 'Vertex'
  | '';

export type OicGstType = 'CGST/SGST' | 'IGST';

export type OicPaintingMode = 'split' | 'net_single';

export interface OicItemRow {
  invoiceNumber: string;
  itemDescription: OicItemDescription;
  itemSubType: string;
  sideDescription?: OicSideDescription;
  itemAmount: number;
  depreciationRate: number;
  gstRate: number;
  estimatedAmount: number;
  estimatedAmountRemarks?: string;
  hsnCode: string;
  gstAmount?: number;
}

export interface OicInvoiceRow {
  invoiceNumber: string;
  invoiceDate: string; // DD-MM-YYYY
  gstType: OicGstType;
  invoiceAmount: number;
  invoiceGstAmount: number;
}

export interface OicPaintingSummary {
  totalEstimated: number;
  totalAssessed: number;
  labourPart: number;
  materialPart: number;
  materialDepreciation: number;
  netAssessed: number;
}

const cleanText = (s: string, maxLen = 100) =>
  s.replace(/[<>^&\\|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen) || 'Item';

/**
 * Maps SurveyOS part types to OIC's strict dropdown list.
 */
function mapPartDescription(r: AssessmentRow): OicItemDescription {
  if (r.section === 'labour') return 'Labour Charge';
  switch (r.partType) {
    case 'plastic':
      return 'Plastic';
    case 'metal':
      return 'Metallic Parts';
    case 'glass':
      return 'Glass';
    case 'fiberglass':
      return 'Non-Metalic Parts';
    default:
      return 'Non-Metalic Parts';
  }
}

/**
 * Standard HSN mapping for motor claims.
 */
function hsnForRate(gst: number): string {
  if (gst === 0) return '72041000';
  if (gst === 28) return '8708';
  return '8512';
}

/**
 * Calculates painting breakdown for standard (75/25 split) vs nil-depreciation policies.
 */
export function oicPaintingSummary(rows: AssessmentRow[]): OicPaintingSummary {
  const paintRows = rows.filter((r) => r.section === 'paint');
  const allowedPaint = paintRows.filter((r) => r.allowed);

  const totalEstimated = paintRows.reduce((s, r) => s + (r.estimated || 0), 0);
  const totalAssessed = allowedPaint.reduce((s, r) => s + effectiveAssessed(r), 0);

  const labourPart = Math.round(totalAssessed * 0.75 * 100) / 100;
  const materialPart = Math.round((totalAssessed - labourPart) * 100) / 100;
  const materialDepreciation = Math.round(materialPart * 0.5 * 100) / 100;
  const netAssessed = labourPart + (materialPart - materialDepreciation);

  return {
    totalEstimated,
    totalAssessed,
    labourPart,
    materialPart,
    materialDepreciation,
    netAssessed,
  };
}

/**
 * Builds the array of item rows ready for OIC's Items sheet.
 */
export function oicAssessmentRows(
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
  invoiceNumber: string,
  opts?: { paintingMode?: OicPaintingMode },
): OicItemRow[] {
  const invNo = cleanText(invoiceNumber, 50) || '1';

  const depRateFor = (r: AssessmentRow): number => {
    if (depType === 'nil') return 0;
    if (r.section === 'labour') return 0;
    if (r.isDisposal) return 0;
    if (r.depOverride !== undefined) return r.depOverride;
    return getDepreciationRate(r.partType, ageMonths, depType);
  };

  const itemRows: OicItemRow[] = [];

  // 1. Process Parts and Labour rows
  for (const r of rows) {
    if (r.section !== 'parts' && r.section !== 'labour') continue;

    const isLabour = r.section === 'labour';
    const isDisposal = !isLabour && !!r.isDisposal;
    const depRate = isLabour || isDisposal || depType === 'nil' ? 0 : depRateFor(r);
    const gstRate = isDisposal ? 0 : r.gst ?? 18;

    const assessed = !r.allowed
      ? 0
      : isDisposal
        ? computeRowNet(r, depRate).netBeforeGst
        : effectiveAssessed(r);

    itemRows.push({
      invoiceNumber: invNo,
      itemDescription: mapPartDescription(r),
      itemSubType: cleanText(r.particulars ?? ''),
      itemAmount: Math.round(assessed * 100) / 100,
      depreciationRate: depRate,
      gstRate,
      estimatedAmount: Math.round((r.estimated || 0) * 100) / 100,
      hsnCode: isDisposal ? '72041000' : hsnForRate(gstRate),
    });
  }

  // 2. Process Painting
  const paintRows = rows.filter((r) => r.section === 'paint');
  if (paintRows.length > 0) {
    const summary = oicPaintingSummary(rows);
    const paintRates = new Set(paintRows.filter((r) => r.allowed).map((r) => r.gst ?? 18));
    const paintGst = paintRates.values().next().value ?? 18;

    if (depType === 'nil') {
      // Nil-depreciation policy: Single consolidated labour charge at 0% depreciation
      itemRows.push({
        invoiceNumber: invNo,
        itemDescription: 'Labour Charge',
        itemSubType: 'TOTAL PAINTING CHARGES',
        itemAmount: summary.totalAssessed,
        depreciationRate: 0,
        gstRate: paintGst,
        estimatedAmount: summary.totalEstimated,
        hsnCode: hsnForRate(paintGst),
      });
    } else if (opts?.paintingMode === 'net_single') {
      // Standard policy (Single Net Line): Pre-deducted 12.5% statutory deduction under Labour Charge
      // As seen in live OIC Surveyor Assessment Reports (e.g. Painting charges FRONT @ 0% dep).
      const netPaintingAssessed = Math.round(summary.totalAssessed * 0.875 * 100) / 100;
      const netPaintingEstimated = Math.round(summary.totalEstimated * 0.875 * 100) / 100;

      if (netPaintingAssessed > 0 || netPaintingEstimated > 0) {
        itemRows.push({
          invoiceNumber: invNo,
          itemDescription: 'Labour Charge',
          itemSubType: 'Painting charges (Net 12.5% Dep)',
          itemAmount: netPaintingAssessed,
          depreciationRate: 0,
          gstRate: paintGst,
          estimatedAmount: summary.totalEstimated,
          hsnCode: '9987',
        });
      }
    } else {
      // Standard policy (Statutory 2-line split, default): 75% Labour (0% dep) + 25% Material (50% dep)
      const estLabour = Math.round(summary.totalEstimated * 0.75 * 100) / 100;
      const estMat = Math.round((summary.totalEstimated - estLabour) * 100) / 100;

      if (summary.labourPart > 0 || estLabour > 0) {
        itemRows.push({
          invoiceNumber: invNo,
          itemDescription: 'Labour Charge',
          itemSubType: 'PAINTING CHARGES (LABOUR 75%)',
          itemAmount: summary.labourPart,
          depreciationRate: 0,
          gstRate: paintGst,
          estimatedAmount: estLabour,
          hsnCode: hsnForRate(paintGst),
        });
      }

      if (summary.materialPart > 0 || estMat > 0) {
        itemRows.push({
          invoiceNumber: invNo,
          itemDescription: 'Plastic',
          itemSubType: 'PAINT MATERIAL (25% STATUTORY)',
          itemAmount: summary.materialPart,
          depreciationRate: 50,
          gstRate: paintGst,
          estimatedAmount: estMat,
          hsnCode: hsnForRate(paintGst),
        });
      }
    }
  }

  return itemRows;
}

export interface BuildOicWorkbookOptions {
  invoiceNumber: string;
  invoiceDate: string; // DD-MM-YYYY
  gstType: OicGstType;
  rows: OicItemRow[];
}

/**
 * Builds the exact 2-sheet Excel workbook required by Oriental Insurance.
 */
export function buildOicWorkbook({
  invoiceNumber,
  invoiceDate,
  gstType,
  rows,
}: BuildOicWorkbookOptions): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  // Calculate invoice sums
  let totalItemAmount = 0;
  let totalItemGst = 0;

  for (const r of rows) {
    totalItemAmount += r.itemAmount;
    const depAmt = (r.itemAmount * r.depreciationRate) / 100;
    const netAmt = r.itemAmount - depAmt;
    const gstAmt = Math.round(((netAmt * r.gstRate) / 100) * 100) / 100;
    totalItemGst += gstAmt;
  }

  // 1. Sheet 1: Invoice
  const invoiceWs = wb.addWorksheet('Invoice');
  invoiceWs.addRow([...OIC_INVOICE_COLUMNS]);
  invoiceWs.addRow([
    invoiceNumber,
    invoiceDate,
    gstType,
    Math.round(totalItemAmount * 100) / 100,
    Math.round(totalItemGst * 100) / 100,
  ]);

  // Invoice Col C Data Validation: IGST, CGST/SGST
  invoiceWs.getCell('C2').dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['"IGST, CGST/SGST"'],
  };

  // 2. Sheet 2: Items
  const itemsWs = wb.addWorksheet('Items');
  itemsWs.addRow([...OIC_ITEM_COLUMNS]);

  rows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const row = itemsWs.addRow([
      r.invoiceNumber,
      r.itemDescription,
      r.itemSubType,
      r.sideDescription || null,
      r.itemAmount,
      r.depreciationRate,
      r.gstRate,
      r.estimatedAmount,
      r.estimatedAmountRemarks || null,
      r.hsnCode,
      { formula: `ROUND((E${rowNum}-(E${rowNum}*F${rowNum}/100))*(G${rowNum}/100),2)` },
    ]);

    // Data validations per row
    row.getCell(2).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Non-Metalic Parts, Metallic Parts, Plastic, Glass, Labour Charge, Others"'],
    };
    row.getCell(4).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Left, Right, Bottom, Top, Rear, Front, Vertex"'],
    };
    row.getCell(6).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"0, 5, 10, 15, 20, 25, 30, 35, 40, 50"'],
    };
    row.getCell(7).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"0, 5, 12, 18, 28"'],
    };
  });

  return wb;
}

/**
 * Browser-only download & auto-file function.
 */
export async function exportOicAssessmentExcel(
  claimNo: string,
  rows: AssessmentRow[],
  ageMonths: number,
  depType: DepreciationType,
  options?: {
    invoiceNumber?: string;
    invoiceDate?: string;
    gstType?: OicGstType;
    paintingMode?: OicPaintingMode;
  },
): Promise<void> {
  const invNo = options?.invoiceNumber?.trim() || '1';
  const invDate = options?.invoiceDate?.trim() || new Date().toISOString().split('T')[0].split('-').reverse().join('-');
  const gstType = options?.gstType || 'CGST/SGST';

  const itemRows = oicAssessmentRows(rows, ageMonths, depType, invNo, {
    paintingMode: options?.paintingMode,
  });
  const wb = buildOicWorkbook({
    invoiceNumber: invNo,
    invoiceDate: invDate,
    gstType,
    rows: itemRows,
  });

  const buffer = await wb.xlsx.writeBuffer();
  const safe = (claimNo || 'claim').replace(/[^A-Za-z0-9_-]+/g, '_');
  const name = `${safe}_OIC_Assessment.xlsx`;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  await saveDocuments('oicAssessmentExcel', [{ blob, name }], 'generated');
  saveAs(blob, name);
}
